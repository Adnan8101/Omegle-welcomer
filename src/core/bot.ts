import {
  Client,
  GatewayIntentBits,
  Partials,
  Collection,
} from 'discord.js';
import { config } from '../config';
import { logger } from '../utils/logger';
import * as readyEvent from './events/ready';
import * as guildMemberAddEvent from './events/guildMemberAdd';
import * as interactionCreateEvent from './events/interactionCreate';

// Extend Client type for commands collection (future use)
declare module 'discord.js' {
  interface Client {
    commands: Collection<string, unknown>;
  }
}

export function createBot(): Client {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
    ],
    partials: [Partials.GuildMember],
  });

  client.commands = new Collection();

  // Register events
  const events = [
    readyEvent,
    guildMemberAddEvent,
    interactionCreateEvent,
  ];

  for (const event of events) {
    const { name, once, execute } = event as {
      name: string;
      once?: boolean;
      execute: (...args: unknown[]) => Promise<void>;
    };

    if (once) {
      client.once(name, (...args) => execute(...args).catch((err) => logger.error(`[Event:${name}]`, err)));
    } else {
      client.on(name, (...args) => execute(...args).catch((err) => logger.error(`[Event:${name}]`, err)));
    }

    logger.debug(`Registered event: ${name}`);
  }

  return client;
}

export async function startBot(): Promise<void> {
  const client = createBot();
  await client.login(config.discord.token);
}
