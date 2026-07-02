import {
  ButtonInteraction,
  ModalSubmitInteraction,
  TextInputBuilder,
  ModalBuilder,
  ActionRowBuilder,
  TextInputStyle,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuInteraction,
} from 'discord.js';
import { getOne, getMany, query } from '../../services/neon.service.js';
import {
  handleSimpleSelection,
  handleCustomizedSelection,
  handleMessageModalSubmit,
  handleTypeAgain,
  handleAutoDeleteSetup,
  handleAutoDeleteModalSubmit,
  handleChannelModalSubmit,
  handleChannelSetup,
  handlePanelConfirmation,
  handlePanelCancellation,
  showPanelConfirmationScreen,
} from '../../modules/welcome/setup-flow.js';
import { replaceVariables, validateMessage } from '../../utils/variables.js';
import { validateWelcomeMessageSecurity } from '../../utils/security.js';
import { logger } from '../../utils/logger.js';

/**
 * Route button interactions
 */
export async function handleWelcomeButton(interaction: ButtonInteraction): Promise<void> {
  const customId = interaction.customId;

  try {
    if (customId.startsWith('welcome_simple_')) {
      const sessionId = customId.replace('welcome_simple_', '');
      await handleSimpleSelection(interaction, sessionId);
    } else if (customId.startsWith('welcome_customized_')) {
      await handleCustomizedSelection(interaction);
    } else if (customId.startsWith('welcome_type_again_')) {
      const sessionId = customId.replace('welcome_type_again_', '');
      await handleTypeAgain(interaction, sessionId);
    } else if (customId.startsWith('welcome_next_autodelete_')) {
      const sessionId = customId.replace('welcome_next_autodelete_', '');
      await handleAutoDeleteSetup(interaction, sessionId);
    } else if (customId.startsWith('welcome_next_channel_')) {
      const sessionId = customId.replace('welcome_next_channel_', '');
      await handleChannelSetup(interaction, sessionId);
    } else if (customId.startsWith('welcome_confirm_')) {
      const sessionId = customId.replace('welcome_confirm_', '');
      await handlePanelConfirmation(interaction, sessionId);
    } else if (customId.startsWith('welcome_cancel_')) {
      const sessionId = customId.replace('welcome_cancel_', '');
      await handlePanelCancellation(interaction, sessionId);
    } else if (customId.startsWith('welcome_embed_skip_')) {
      const sessionId = customId.replace('welcome_embed_skip_', '');
      await handleEmbedSkip(interaction, sessionId);
    } else if (customId.startsWith('welcome_edit_name_')) {
      const panelId = customId.replace('welcome_edit_name_', '');
      await handleEditName(interaction, panelId);
    } else if (customId.startsWith('welcome_edit_channel_')) {
      const panelId = customId.replace('welcome_edit_channel_', '');
      await handleEditChannel(interaction, panelId);
    } else if (customId.startsWith('welcome_edit_message_')) {
      const panelId = customId.replace('welcome_edit_message_', '');
      await handleEditMessage(interaction, panelId);
    } else if (customId.startsWith('welcome_edit_autodelete_')) {
      const panelId = customId.replace('welcome_edit_autodelete_', '');
      await handleEditAutoDelete(interaction, panelId);
    } else if (customId.startsWith('welcome_edit_embed_')) {
      const panelId = customId.replace('welcome_edit_embed_', '');
      await handleEditEmbed(interaction, panelId);
    }
  } catch (err) {
    logger.error('[WelcomeButton]', err);
    if (!interaction.replied) {
      await interaction.reply({ content: '❌ An error occurred.', ephemeral: true }).catch(() => undefined);
    }
  }
}

/**
 * Route modal interactions
 */
export async function handleWelcomeModal(interaction: ModalSubmitInteraction): Promise<void> {
  const customId = interaction.customId;

  try {
    if (customId.startsWith('welcome_message_modal_')) {
      const sessionId = customId.replace('welcome_message_modal_', '');
      await handleMessageModalSubmit(interaction, sessionId);
    } else if (customId.startsWith('welcome_autodelete_modal_')) {
      const sessionId = customId.replace('welcome_autodelete_modal_', '');
      await handleAutoDeleteModalSubmit(interaction, sessionId);
    } else if (customId.startsWith('welcome_channel_modal_')) {
      const sessionId = customId.replace('welcome_channel_modal_', '');
      await handleChannelModalSubmit(interaction, sessionId);
    } else if (customId.startsWith('welcome_edit_name_modal_')) {
      const panelId = customId.replace('welcome_edit_name_modal_', '');
      await handleEditNameSubmit(interaction, panelId);
    } else if (customId.startsWith('welcome_edit_channel_modal_')) {
      const panelId = customId.replace('welcome_edit_channel_modal_', '');
      await handleEditChannelSubmit(interaction, panelId);
    } else if (customId.startsWith('welcome_edit_message_modal_')) {
      const panelId = customId.replace('welcome_edit_message_modal_', '');
      await handleEditMessageSubmit(interaction, panelId);
    } else if (customId.startsWith('welcome_edit_autodelete_modal_')) {
      const panelId = customId.replace('welcome_edit_autodelete_modal_', '');
      await handleEditAutoDeleteSubmit(interaction, panelId);
    }
  } catch (err) {
    logger.error('[WelcomeModal]', err);
    if (!interaction.replied) {
      await interaction.reply({ content: '❌ An error occurred.', ephemeral: true }).catch(() => undefined);
    }
  }
}

// Edit handlers

async function handleEditName(interaction: ButtonInteraction, panelId: string): Promise<void> {
  const panel = await getOne(
    `SELECT * FROM welcome_panels WHERE id = $1`,
    [panelId]
  );
  if (!panel) {
    await interaction.reply({ content: '❌ Panel not found.', ephemeral: true });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId(`welcome_edit_name_modal_${panelId}`)
    .setTitle('Edit Panel Name');

  const nameInput = new TextInputBuilder()
    .setCustomId('panel_name')
    .setLabel('Panel Name')
    .setStyle(TextInputStyle.Short)
    .setValue(panel.panel_name)
    .setRequired(true);

  const row = new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput);
  modal.addComponents(row);

    await interaction.showModal(modal);
}

async function handleEditNameSubmit(interaction: ModalSubmitInteraction, panelId: string): Promise<void> {
  const panel = await getOne(
    `SELECT * FROM welcome_panels WHERE id = $1`,
    [panelId]
  );
  if (!panel) {
    await interaction.reply({ content: '❌ Panel not found.', ephemeral: true });
    return;
  }

  const newName = interaction.fields.getTextInputValue('panel_name');

  // Check if new name already exists
  const existing = await getOne(
    `SELECT * FROM welcome_panels WHERE guild_id = $1 AND panel_name = $2`,
    [panel.guild_id, newName]
  );

  if (existing && existing.id !== panelId) {
    await interaction.reply({ content: '❌ A panel with that name already exists.', ephemeral: true });
    return;
  }

  await query(
    `UPDATE welcome_panels SET panel_name = $1, updated_at = NOW() WHERE id = $2`,
    [newName, panelId]
  );

  await interaction.reply({ content: `✅ Panel name updated to **${newName}**.`, ephemeral: true });
}

async function handleEditChannel(interaction: ButtonInteraction, panelId: string): Promise<void> {
  const panel = await getOne(
    `SELECT * FROM welcome_panels WHERE id = $1`,
    [panelId]
  );
  if (!panel) {
    await interaction.reply({ content: '❌ Panel not found.', ephemeral: true });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId(`welcome_edit_channel_modal_${panelId}`)
    .setTitle('Edit Welcome Channel');

  const channelInput = new TextInputBuilder()
    .setCustomId('channel_id')
    .setLabel('Channel ID')
    .setStyle(TextInputStyle.Short)
    .setValue(panel.welcome_channel)
    .setRequired(true);

  const row = new ActionRowBuilder<TextInputBuilder>().addComponents(channelInput);
  modal.addComponents(row);

    await interaction.showModal(modal);
}

async function handleEditChannelSubmit(interaction: ModalSubmitInteraction, panelId: string): Promise<void> {
  const panel = await getOne(
    `SELECT * FROM welcome_panels WHERE id = $1`,
    [panelId]
  );
  if (!panel) {
    await interaction.reply({ content: '❌ Panel not found.', ephemeral: true });
    return;
  }

  const channelId = interaction.fields.getTextInputValue('channel_id');

  // Validate channel
  try {
    const channel = await interaction.guild!.channels.fetch(channelId);
    if (!channel?.isTextBased()) {
      await interaction.reply({ content: '❌ Channel must be a text channel.', ephemeral: true });
      return;
    }
  } catch {
    await interaction.reply({ content: '❌ Invalid channel ID. Channel not found.', ephemeral: true });
    return;
  }

  await query(
    `UPDATE welcome_panels SET welcome_channel = $1, updated_at = NOW() WHERE id = $2`,
    [channelId, panelId]
  );

  await interaction.reply({ content: `✅ Welcome channel updated to <#${channelId}>.`, ephemeral: true });
}

async function handleEditMessage(interaction: ButtonInteraction, panelId: string): Promise<void> {
  const panel = await getOne(
    `SELECT * FROM welcome_panels WHERE id = $1`,
    [panelId]
  );
  if (!panel) {
    await interaction.reply({ content: '❌ Panel not found.', ephemeral: true });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId(`welcome_edit_message_modal_${panelId}`)
    .setTitle('Edit Welcome Message');

  const messageInput = new TextInputBuilder()
    .setCustomId('welcome_message')
    .setLabel('Welcome Message')
    .setStyle(TextInputStyle.Paragraph)
    .setValue(panel.message)
    .setPlaceholder('Use {{server_name}}, {{user}}, {{user_mention}}, {{mem_count}}')
    .setRequired(true);

  const row = new ActionRowBuilder<TextInputBuilder>().addComponents(messageInput);
  modal.addComponents(row);

    await interaction.showModal(modal);
}

async function handleEditMessageSubmit(interaction: ModalSubmitInteraction, panelId: string): Promise<void> {
  const panel = await getOne(
    `SELECT * FROM welcome_panels WHERE id = $1`,
    [panelId]
  );
  if (!panel) {
    await interaction.reply({ content: '❌ Panel not found.', ephemeral: true });
    return;
  }

  const newMessage = interaction.fields.getTextInputValue('welcome_message');

  // Validate message security
  const securityCheck = validateWelcomeMessageSecurity(newMessage);
  if (!securityCheck.valid && securityCheck.errors) {
    await interaction.reply({
      content: `❌ Message contains forbidden content:\n${securityCheck.errors.map(e => `• ${e}`).join('\n')}`,
      ephemeral: true,
    });
    return;
  }

  // Validate variables
  const validation = validateMessage(newMessage);
  if (!validation.valid && validation.invalidVars) {
    await interaction.reply({
      content: `❌ Invalid variables: \`${validation.invalidVars.join(', ')}\`\n\nValid variables: \`{{server_name}}\`, \`{{user}}\`, \`{{user_mention}}\`, \`{{mem_count}}\``,
      ephemeral: true,
    });
    return;
  }

  await query(
    `UPDATE welcome_panels SET message = $1, updated_at = NOW() WHERE id = $2`,
    [newMessage, panelId]
  );

  // Show preview
  const preview = replaceVariables(newMessage, { guild: interaction.guild!, member: interaction.member as any });

  const previewEmbed = new EmbedBuilder()
    .setTitle('Message Preview')
    .setDescription(preview)
    .setColor(0x5865f2);

  await interaction.reply({ embeds: [previewEmbed], ephemeral: true });
}

async function handleEditAutoDelete(interaction: ButtonInteraction, panelId: string): Promise<void> {
  const panel = await getOne(
    `SELECT * FROM welcome_panels WHERE id = $1`,
    [panelId]
  );
  if (!panel) {
    await interaction.reply({ content: '❌ Panel not found.', ephemeral: true });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId(`welcome_edit_autodelete_modal_${panelId}`)
    .setTitle('Edit Auto-Delete');

  const autodeleteInput = new TextInputBuilder()
    .setCustomId('autodelete_value')
    .setLabel('Auto-delete time (e.g., 10s, 1m, or "skip")')
    .setStyle(TextInputStyle.Short)
    .setValue(panel.auto_delete_ms ? `${Math.round(panel.auto_delete_ms / 1000)}s` : 'skip')
    .setRequired(true);

  const row = new ActionRowBuilder<TextInputBuilder>().addComponents(autodeleteInput);
  modal.addComponents(row);

    await interaction.showModal(modal);
}

function parseAutoDeleteValue(value: string): number | null | 'invalid' {
  if (value.toLowerCase() === 'skip') {
    return null;
  }

  const match = value.match(/^(\d+)([smh])$/i);
  if (!match) {
    return 'invalid';
  }

  const amount = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();

  switch (unit) {
    case 's':
      return amount * 1000;
    case 'm':
      return amount * 60 * 1000;
    case 'h':
      return amount * 60 * 60 * 1000;
    default:
      return 'invalid';
  }
}

async function handleEditAutoDeleteSubmit(interaction: ModalSubmitInteraction, panelId: string): Promise<void> {
  const panel = await getOne(
    `SELECT * FROM welcome_panels WHERE id = $1`,
    [panelId]
  );
  if (!panel) {
    await interaction.reply({ content: '❌ Panel not found.', ephemeral: true });
    return;
  }

  const autoDeleteStr = interaction.fields.getTextInputValue('autodelete_value');
  const autoDeleteMs = parseAutoDeleteValue(autoDeleteStr);

  if (autoDeleteMs === 'invalid') {
    await interaction.reply({ content: '❌ Invalid format. Use `skip`, `10s`, `15s`, `1m`, etc.', ephemeral: true });
    return;
  }

  await query(
    `UPDATE welcome_panels SET auto_delete_ms = $1, updated_at = NOW() WHERE id = $2`,
    [autoDeleteMs, panelId]
  );

  await interaction.reply({
    content: `✅ Auto-delete updated to ${autoDeleteMs ? `${autoDeleteMs}ms` : 'Disabled'}.`,
    ephemeral: true,
  });
}

/**
 * Handle skip embed linking during panel creation
 */
async function handleEmbedSkip(interaction: ButtonInteraction, sessionId: string): Promise<void> {
  await query(`UPDATE setup_sessions SET embed_id = NULL WHERE id = $1`, [sessionId]);
  await showPanelConfirmationScreen(interaction, sessionId);
}

/**
 * Handle link/change embed button in welcome panel edit
 */
async function handleEditEmbed(interaction: ButtonInteraction, panelId: string): Promise<void> {
  const panel = await getOne(
    `SELECT * FROM welcome_panels WHERE id = $1`,
    [panelId]
  );
  if (!panel) {
    await interaction.reply({ content: '❌ Panel not found.', ephemeral: true });
    return;
  }

  // Fetch all custom embeds in this guild
  const embeds = await getMany(
    `SELECT * FROM embeds WHERE guild_id = $1 ORDER BY name ASC`,
    [interaction.guildId!]
  );

  if (embeds.length === 0) {
    await interaction.reply({
      content: '⚠️ You do not have any custom embeds configured. Please create one first with `/embed create`.',
      ephemeral: true,
    });
    return;
  }

  const { StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ActionRowBuilder } = await import('discord.js');

  const select = new StringSelectMenuBuilder()
    .setCustomId(`welcome_edit_select_embed_${panelId}`)
    .setPlaceholder('Choose a custom embed...');

  select.addOptions(
    new StringSelectMenuOptionBuilder()
      .setLabel('None / Remove Attached Embed')
      .setDescription('Remove any custom embed currently attached to this welcome panel.')
      .setValue('none')
  );

  for (const embed of embeds) {
    const desc = embed.description ? embed.description.slice(0, 80) : 'No description';
    select.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel(embed.name)
        .setDescription(desc)
        .setValue(embed.id)
    );
  }

  const row = new ActionRowBuilder<any>().addComponents(select);

  await interaction.reply({
    content: 'Select a custom embed to link to this welcome panel:',
    components: [row],
    ephemeral: true,
  });
}

/**
 * Handle select menus in welcome panels setup/edit flows
 */
export async function handleWelcomeSelectMenu(interaction: StringSelectMenuInteraction): Promise<void> {
  const customId = interaction.customId;
  const value = interaction.values[0];

  if (customId.startsWith('welcome_embed_select_')) {
    const sessionId = customId.replace('welcome_embed_select_', '');
    const embedId = value === 'none' ? null : value;

    await query(`UPDATE setup_sessions SET embed_id = $1 WHERE id = $2`, [embedId, sessionId]);
    await showPanelConfirmationScreen(interaction, sessionId);
  } else if (customId.startsWith('welcome_edit_select_embed_')) {
    const panelId = customId.replace('welcome_edit_select_embed_', '');
    const embedId = value === 'none' ? null : value;

    await query(
      `UPDATE welcome_panels SET embed_id = $1, updated_at = NOW() WHERE id = $2`,
      [embedId, panelId]
    );

    let embedName = 'None';
    if (embedId) {
      const embedData = await getOne(`SELECT name FROM embeds WHERE id = $1`, [embedId]);
      if (embedData) {
        embedName = embedData.name;
      }
    }

    await interaction.update({
      content: `✅ Attached embed successfully updated to: **${embedName}**.`,
      components: [],
    });
  }
}
