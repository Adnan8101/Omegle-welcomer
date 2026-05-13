import { Events, Interaction, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { handleSetupCommand } from '../../commands/setup/setup.command';
import { handleConfigCommand } from '../../commands/config/config.command';
import { handleTestWelcomeCommand } from '../../commands/testing/test-welcome.command';
import { handleWelcomeCommand } from '../../commands/welcome/welcome.command';
import { handleWelcomeButton, handleWelcomeModal } from '../handlers/welcome-interactions';
import { logger } from '../../utils/logger';

export const name = Events.InteractionCreate;

const COMMAND_MAP: Record<string, (interaction: ChatInputCommandInteraction) => Promise<void>> = {
  setup: handleSetupCommand,
  config: handleConfigCommand,
  'test-welcome': handleTestWelcomeCommand,
  welcome: handleWelcomeCommand,
};

export async function execute(interaction: Interaction): Promise<void> {
  try {
    if (interaction.isChatInputCommand()) {
      // While the bot is under development, silently ignore command usage from non-admins.
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) return;

      const { commandName } = interaction;
      const handler = COMMAND_MAP[commandName];

      if (!handler) {
        logger.warn(`[interactionCreate] Unknown command: ${commandName}`);
        return;
      }

      await handler(interaction);
    } else if (interaction.isButton()) {
      if (interaction.customId.startsWith('welcome_')) {
        await handleWelcomeButton(interaction);
      }
    } else if (interaction.isModalSubmit()) {
      if (interaction.customId.startsWith('welcome_')) {
        await handleWelcomeModal(interaction);
      }
    } else if (interaction.isAutocomplete()) {
      const { commandName, options } = interaction;
      if (commandName === 'welcome') {
        const { getPanelAutocomplete } = await import('../../commands/welcome/welcome.command');
        const partial = options.getFocused(true).value as string;
        const suggestions = await getPanelAutocomplete(interaction.guildId!, partial);
        await interaction.respond(
          suggestions.map((name) => ({ name, value: name }))
        );
      }
    }
  } catch (err) {
    logger.error('[interactionCreate]', err);
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '❌ An error occurred. Please try again.', ephemeral: true }).catch(() => undefined);
    }
  }
}
