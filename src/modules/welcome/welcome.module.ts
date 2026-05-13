import { Guild, GuildMember, TextChannel } from 'discord.js';
import { GuildConfig } from '../../utils/types';
import { getTemplate, buildVars, renderTemplate } from '../templates/template.module';
import { logger } from '../../utils/logger';

/**
 * Simple welcome function - sends a basic welcome embed
 */
export async function sendWelcome(
  guild: Guild,
  newMember: GuildMember,
  config: GuildConfig
): Promise<void> {
  try {
    if (!config.welcomeChannel) {
      logger.warn(`[Welcome] No welcome channel configured for guild ${guild.id}`);
      return;
    }

    const channel = guild.channels.cache.get(config.welcomeChannel) as TextChannel | undefined;
    if (!channel?.isTextBased()) {
      logger.warn(`[Welcome] Welcome channel not found or not text-based: ${config.welcomeChannel}`);
      return;
    }

    const templateData = getTemplate();
    const vars = buildVars(guild.name, newMember);
    const message = renderTemplate(templateData.message, vars);

    await channel.send({ content: message });

    logger.info(`[Welcome] Welcomed ${newMember.user.tag} in ${guild.name}`);
  } catch (err) {
    logger.error('[Welcome] Failed to send welcome:', err);
  }
}

