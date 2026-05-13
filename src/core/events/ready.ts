import { Events, Client } from 'discord.js';
import { logger } from '../../utils/logger.js';

export const name = Events.ClientReady;
export const once = true;

export async function execute(client: Client<true>): Promise<void> {
  logger.info(`✅ Bot online as ${client.user.tag}`);
  logger.info(`📡 Serving ${client.guilds.cache.size} guild(s)`);
}
