import * as dotenv from 'dotenv';
dotenv.config();

import { initializeDatabase, closeDatabase } from './services/neon.service';
import { startBot } from './core/bot';
import { logger } from './utils/logger';

async function main(): Promise<void> {
  logger.info('🚀 Starting Smart Welcome Bot...');

  // Initialize database
  try {
    await initializeDatabase();
    logger.info('[Startup] Neon PostgreSQL connected and initialized');
  } catch (err) {
    logger.error('[Startup] Failed to initialize database:', err);
    process.exit(1);
  }

  // Start bot
  await startBot();

  // Graceful shutdown
  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`[Shutdown] Received ${signal}. Cleaning up...`);
    await closeDatabase();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('uncaughtException', (err) => {
    logger.error('[UncaughtException]', err);
    // Don't exit — let the bot keep running
  });
  process.on('unhandledRejection', (reason) => {
    logger.error('[UnhandledRejection]', reason);
  });
}

main().catch((err) => {
  logger.error('[Fatal]', err);
  process.exit(1);
});
