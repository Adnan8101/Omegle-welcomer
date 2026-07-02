import {
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { getMany } from '../../services/neon.service.js';
import { startEmbedCreation, startEmbedEdit, handleEmbedShow, handleEmbedDelete } from '../../core/handlers/embed-interactions.js';

export const definition = new SlashCommandBuilder()
  .setName('embed')
  .setDescription('Manage custom embeds')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand((sub) =>
    sub
      .setName('create')
      .setDescription('Create a new custom embed')
      .addStringOption((opt) =>
        opt.setName('name').setDescription('Embed name').setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('edit')
      .setDescription('Edit an existing custom embed')
      .addStringOption((opt) =>
        opt.setName('embed').setDescription('Embed name').setRequired(true).setAutocomplete(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('show')
      .setDescription('Show details of an existing custom embed')
      .addStringOption((opt) =>
        opt.setName('embed').setDescription('Embed name').setRequired(true).setAutocomplete(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('delete')
      .setDescription('Delete an existing custom embed')
      .addStringOption((opt) =>
        opt.setName('embed').setDescription('Embed name').setRequired(true).setAutocomplete(true)
      )
  );

export async function handleEmbedCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;

  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case 'create':
      await startEmbedCreation(interaction);
      break;
    case 'edit':
      await startEmbedEdit(interaction);
      break;
    case 'show':
      await handleEmbedShow(interaction);
      break;
    case 'delete':
      await handleEmbedDelete(interaction);
      break;
  }
}

export async function getEmbedAutocomplete(guildId: string, partial: string): Promise<string[]> {
  const embeds = await getMany(
    `SELECT name FROM embeds WHERE guild_id = $1`,
    [guildId]
  );

  return embeds
    .map((e: any) => e.name)
    .filter((name: string) => name.toLowerCase().includes(partial.toLowerCase()))
    .slice(0, 25);
}
