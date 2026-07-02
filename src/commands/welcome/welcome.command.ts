import {
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ActionRowBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { getOne, getMany, query } from '../../services/neon.service.js';
import { startWelcomePanelCreation } from '../../modules/welcome/setup-flow.js';
import { logger } from '../../utils/logger.js';

export const definition = new SlashCommandBuilder()
  .setName('welcome')
  .setDescription('Manage welcome panels')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand((sub) =>
    sub
      .setName('create')
      .setDescription('Create a new welcome panel')
  )
  .addSubcommand((sub) =>
    sub
      .setName('show')
      .setDescription('Show all welcome panels')
  )
  .addSubcommand((sub) =>
    sub
      .setName('enable')
      .setDescription('Enable a welcome panel')
      .addStringOption((opt) =>
        opt.setName('panel').setDescription('Panel name').setRequired(true).setAutocomplete(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('disable')
      .setDescription('Disable a welcome panel')
      .addStringOption((opt) =>
        opt.setName('panel').setDescription('Panel name').setRequired(true).setAutocomplete(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('edit')
      .setDescription('Edit a welcome panel')
      .addStringOption((opt) =>
        opt.setName('panel').setDescription('Panel name').setRequired(true).setAutocomplete(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('delete')
      .setDescription('Delete a welcome panel')
      .addStringOption((opt) =>
        opt.setName('panel').setDescription('Panel name').setRequired(true).setAutocomplete(true)
      )
  );

export async function handleWelcomeCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;

  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case 'create':
      await handleCreate(interaction);
      break;
    case 'show':
      await handleShow(interaction);
      break;
    case 'enable':
      await handleEnable(interaction);
      break;
    case 'disable':
      await handleDisable(interaction);
      break;
    case 'edit':
      await handleEdit(interaction);
      break;
    case 'delete':
      await handleDelete(interaction);
      break;
  }
}

async function handleCreate(interaction: ChatInputCommandInteraction): Promise<void> {
  // Check if there are already 10 panels (reasonable limit)
  const result = await getOne(
    `SELECT COUNT(*) as count FROM welcome_panels WHERE guild_id = $1`,
    [interaction.guildId!]
  );
  const panelCount = result?.count || 0;

  if (panelCount >= 10) {
    await interaction.reply({
      content: '❌ You can only have up to 10 welcome panels.',
      ephemeral: true,
    });
    return;
  }

  await startWelcomePanelCreation(interaction);
}

async function handleShow(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const panels = await getMany(
    `SELECT * FROM welcome_panels WHERE guild_id = $1 ORDER BY created_at DESC`,
    [interaction.guildId!]
  );

  if (panels.length === 0) {
    await interaction.editReply('❌ No welcome panels found. Create one with `/welcome create`');
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle('Welcome Panels')
    .setColor(0x5865f2)
    .setDescription(
      panels
        .map((p: any) => {
          const status = p.enabled ? '✅' : '❌';
          return `${status} **${p.panel_name}**\n  Channel: <#${p.welcome_channel}>\n  Auto-delete: ${p.auto_delete_ms ? `${p.auto_delete_ms}ms` : 'Disabled'}`;
        })
        .join('\n\n')
    );

  await interaction.editReply({ embeds: [embed] });
}

async function handleEnable(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const panelName = interaction.options.getString('panel', true);

  const panel = await getOne(
    `SELECT * FROM welcome_panels WHERE guild_id = $1 AND panel_name = $2`,
    [interaction.guildId!, panelName]
  );

  if (!panel) {
    await interaction.editReply('❌ Panel not found.');
    return;
  }

  if (panel.enabled) {
    await interaction.editReply('⚠️ Panel is already enabled.');
    return;
  }

  await query(
    `UPDATE welcome_panels SET enabled = true, updated_at = NOW() WHERE id = $1`,
    [panel.id]
  );

  await interaction.editReply(`✅ Panel **${panelName}** enabled.`);
}

async function handleDisable(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const panelName = interaction.options.getString('panel', true);

  const panel = await getOne(
    `SELECT * FROM welcome_panels WHERE guild_id = $1 AND panel_name = $2`,
    [interaction.guildId!, panelName]
  );

  if (!panel) {
    await interaction.editReply('❌ Panel not found.');
    return;
  }

  if (!panel.enabled) {
    await interaction.editReply('⚠️ Panel is already disabled.');
    return;
  }

  await query(
    `UPDATE welcome_panels SET enabled = false, updated_at = NOW() WHERE id = $1`,
    [panel.id]
  );

  await interaction.editReply(`✅ Panel **${panelName}** disabled.`);
}

async function handleEdit(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const panelName = interaction.options.getString('panel', true);

  const panel = await getOne(
    `SELECT * FROM welcome_panels WHERE guild_id = $1 AND panel_name = $2`,
    [interaction.guildId!, panelName]
  );

  if (!panel) {
    await interaction.editReply('❌ Panel not found.');
    return;
  }

  // Show edit options
  const editEmbed = new EmbedBuilder()
    .setTitle(`Editing: ${panelName}`)
    .setDescription('What would you like to edit?')
    .setColor(0x5865f2);

  const nameBtn = new ButtonBuilder()
    .setCustomId(`welcome_edit_name_${panel.id}`)
    .setLabel('Panel Name')
    .setStyle(ButtonStyle.Primary);

  const channelBtn = new ButtonBuilder()
    .setCustomId(`welcome_edit_channel_${panel.id}`)
    .setLabel('Welcome Channel')
    .setStyle(ButtonStyle.Primary);

  const messageBtn = new ButtonBuilder()
    .setCustomId(`welcome_edit_message_${panel.id}`)
    .setLabel('Message')
    .setStyle(ButtonStyle.Primary);

  const autodeleteBtn = new ButtonBuilder()
    .setCustomId(`welcome_edit_autodelete_${panel.id}`)
    .setLabel('Auto Delete')
    .setStyle(ButtonStyle.Primary);

  const embedBtn = new ButtonBuilder()
    .setCustomId(`welcome_edit_embed_${panel.id}`)
    .setLabel('Link/Change Embed')
    .setStyle(ButtonStyle.Primary);

  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(nameBtn, channelBtn, messageBtn);
  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(autodeleteBtn, embedBtn);

  await interaction.editReply({
    embeds: [editEmbed],
    components: [row1, row2],
  });
}

async function handleDelete(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const panelName = interaction.options.getString('panel', true);

  const panel = await getOne(
    `SELECT * FROM welcome_panels WHERE guild_id = $1 AND panel_name = $2`,
    [interaction.guildId!, panelName]
  );

  if (!panel) {
    await interaction.editReply('❌ Panel not found.');
    return;
  }

  await query(`DELETE FROM welcome_panels WHERE id = $1`, [panel.id]);

  await interaction.editReply(`✅ Panel **${panelName}** deleted.`);
}

/**
 * Get panel autocomplete suggestions
 */
export async function getPanelAutocomplete(guildId: string, partial: string): Promise<string[]> {
  const panels = await getMany(
    `SELECT panel_name FROM welcome_panels WHERE guild_id = $1`,
    [guildId]
  );

  return panels
    .map((p: any) => p.panel_name)
    .filter((name: string) => name.includes(partial.toLowerCase()))
    .slice(0, 25);
}
