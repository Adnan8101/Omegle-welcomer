import * as dotenv from 'dotenv';
dotenv.config();

import { REST, Routes } from 'discord.js';
import { config } from '../config/index.js';
import { definition as setupDef } from './setup/setup.command.js';
import { definition as configDef } from './config/config.command.js';
import { definition as testWelcomeDef } from './testing/test-welcome.command.js';
import { definition as welcomeDef } from './welcome/welcome.command.js';
import { definition as embedDef } from './embed/embed.command.js';
import { logger } from '../utils/logger.js';

const commands = [
  setupDef,
  configDef,
  testWelcomeDef,
  welcomeDef,
  embedDef,
].map((cmd) => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(config.discord.token);

(async () => {
  try {
    logger.info('🧹 Clearing all existing global slash commands...');
    await rest.put(Routes.applicationCommands(config.discord.clientId), {
      body: [],
    });
    logger.info('✅ Successfully cleared all global slash commands.');

    logger.info(`🚀 Deploying ${commands.length} slash command(s) to Discord...`);

    // Deploy globally
    await rest.put(Routes.applicationCommands(config.discord.clientId), {
      body: commands,
    });

    logger.info('✅ All slash commands registered globally');
    logger.info('Commands deployed:');
    commands.forEach((cmd: any) => {
      logger.info(`  • /${cmd.name} - ${cmd.description}`);
    });
  } catch (err) {
    logger.error('❌ Failed to deploy commands:', err);
    process.exit(1);
  }
})();
