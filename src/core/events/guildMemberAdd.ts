import { Events, GuildMember, TextChannel } from 'discord.js';
import { getMany, getOne, query } from '../../services/neon.service.js';
import { replaceVariables } from '../../utils/variables.js';
import { logger } from '../../utils/logger.js';

export const name = Events.GuildMemberAdd;

function ensureUserMention(message: string, memberId: string): string {
  const mention = `<@${memberId}>`;
  if (message.includes(mention)) {
    return message;
  }
  return `${mention} ${message}`.trim();
}

export async function execute(member: GuildMember): Promise<void> {
  try {
    const { guild } = member;
    logger.info(`[guildMemberAdd] ${member.user.tag} joined ${guild.name}`);

    // Ensure user record exists in DB (handle both old and new schema)
    try {
      await query(
        `INSERT INTO users (id, username) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
        [member.id, member.user.username]
      );
    } catch (err: any) {
      // If username column doesn't exist, insert without it
      if (err.code === '42703') {
        logger.debug(`[guildMemberAdd] username column doesn't exist, using legacy insert`);
        await query(
          `INSERT INTO users (id) VALUES ($1) ON CONFLICT (id) DO NOTHING`,
          [member.id]
        );
      } else {
        throw err;
      }
    }

    // Check if system is enabled
    const config = await getOne(
      `SELECT * FROM guild_config WHERE guild_id = $1`,
      [guild.id]
    );
    if (!config) {
      logger.info(`[guildMemberAdd] No config found for guild ${guild.id} - creating default config`);
      // Create default config
      await query(
        `INSERT INTO guild_config (id, guild_id, welcome_enabled) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        [guild.id, guild.id, true]
      );
      logger.debug(`[guildMemberAdd] Default config created for ${guild.name}`);
    } else if (!config.welcome_enabled) {
      logger.warn(`[guildMemberAdd] Welcome system disabled for guild ${guild.id}`);
      return;
    }

    // Get all enabled welcome panels
    const panels = await getMany(
      `SELECT * FROM welcome_panels WHERE guild_id = $1 AND enabled = true ORDER BY created_at ASC`,
      [guild.id]
    );

    if (panels.length === 0) {
      logger.info(`[guildMemberAdd] ⚠️ No enabled welcome panels found for guild ${guild.id} (${guild.name})`);
      logger.debug(`[guildMemberAdd] Please set up a welcome panel using /welcome create command`);
      return;
    }

    for (const panel of panels) {
      let channel = guild.channels.cache.get(panel.welcome_channel) as TextChannel | null | undefined;
      if (!channel) {
        const fetched = await guild.channels.fetch(panel.welcome_channel).catch(() => null);
        channel = fetched as TextChannel | null | undefined;
      }

      if (!channel?.isTextBased()) {
        logger.error(
          `[guildMemberAdd] Welcome channel ${panel.welcome_channel} not found or not text-based for guild ${guild.id}`
        );
        continue;
      }

      logger.debug(`[guildMemberAdd] Sending welcome to channel: ${channel.name}`);

      // Replace variables in the message and ensure the user is pinged
      const message = ensureUserMention(replaceVariables(panel.message, { guild, member }), member.id);

      // Send plain text welcome message
      const sentMessage = await channel.send({ content: message });
      logger.info(`[guildMemberAdd] ✅ Welcomed ${member.user.tag} in ${guild.name}`);

      // Auto-delete if configured
      if (panel.auto_delete_ms) {
        setTimeout(() => {
          sentMessage.delete().catch(() => undefined);
        }, panel.auto_delete_ms);
      }
    }
  } catch (err) {
    logger.error('[guildMemberAdd] Unhandled error:', err);
  }
}
