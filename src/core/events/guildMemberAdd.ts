import { Events, GuildMember, TextChannel } from 'discord.js';
import { getOne, query } from '../../services/neon.service';
import { replaceVariables } from '../../utils/variables';
import { logger } from '../../utils/logger';

export const name = Events.GuildMemberAdd;

export async function execute(member: GuildMember): Promise<void> {
  try {
    const { guild } = member;
    logger.info(`[guildMemberAdd] ${member.user.tag} joined ${guild.name}`);

    // Ensure user record exists in DB
    await query(
      `INSERT INTO users (id, username) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
      [member.id, member.user.username]
    );

    // Check if system is enabled
    const config = await getOne(
      `SELECT * FROM guild_config WHERE guild_id = $1`,
      [guild.id]
    );
    if (!config || !config.welcome_enabled) {
      logger.warn(`[guildMemberAdd] System disabled for guild ${guild.id} — skipping`);
      return;
    }

    // Get any enabled welcome panel (use the first one found)
    const panel = await getOne(
      `SELECT * FROM welcome_panels WHERE guild_id = $1 AND enabled = true ORDER BY created_at ASC LIMIT 1`,
      [guild.id]
    );

    if (!panel) {
      logger.debug(`[guildMemberAdd] No enabled welcome panel for ${guild.name}`);
      return;
    }

    // Get the welcome channel
    const channel = guild.channels.cache.get(panel.welcome_channel) as TextChannel | undefined;
    if (!channel?.isTextBased()) {
      logger.warn(`[guildMemberAdd] Welcome channel not found for guild ${guild.id}`);
      return;
    }

    // Replace variables in the message
    const message = replaceVariables(panel.message, { guild, member });

    // Send plain text welcome message
    const sentMessage = await channel.send({ content: message });

    // Auto-delete if configured
    if (panel.auto_delete_ms) {
      setTimeout(() => {
        sentMessage.delete().catch(() => undefined);
      }, panel.auto_delete_ms);
    }

    logger.info(`[guildMemberAdd] Welcomed ${member.user.tag} in ${guild.name}`);
  } catch (err) {
    logger.error('[guildMemberAdd] Unhandled error:', err);
  }
}
