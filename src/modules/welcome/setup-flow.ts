import {
  ChatInputCommandInteraction,
  ModalSubmitInteraction,
  ButtonInteraction,
  StringSelectMenuInteraction,
  TextInputBuilder,
  ModalBuilder,
  ActionRowBuilder,
  TextInputStyle,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  TextChannel,
  ContainerBuilder,
  SectionBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  MessageFlags,
} from 'discord.js';
import { getOne, getMany, query } from '../../services/neon.service.js';
import { getAvailableVariables, replaceVariables, validateMessage } from '../../utils/variables.js';
import { validateWelcomeMessageSecurity } from '../../utils/security.js';
import { logger } from '../../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Start the welcome panel creation flow
 */
export async function startWelcomePanelCreation(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guildId!;
  const userId = interaction.user.id;

  // Create a setup session
  const sessionId = uuidv4();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minute expiry

  await query(
    `INSERT INTO setup_sessions (id, guild_id, user_id, step, expires_at) 
     VALUES ($1, $2, $3, $4, $5)`,
    [sessionId, guildId, userId, 'message', expiresAt]
  );

  // Show initial options
  const optionsEmbed = new EmbedBuilder()
    .setTitle('Welcome Panel Creation')
    .setDescription('Choose how you want to set up your welcome message.')
    .setColor(0x5865f2);

  const customizedBtn = new ButtonBuilder()
    .setCustomId(`welcome_customized_${sessionId}`)
    .setLabel('Customized')
    .setStyle(ButtonStyle.Primary);

  const simpleBtn = new ButtonBuilder()
    .setCustomId(`welcome_simple_${sessionId}`)
    .setLabel('Simple Message')
    .setStyle(ButtonStyle.Primary);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(customizedBtn, simpleBtn);

  await interaction.reply({
    embeds: [optionsEmbed],
    components: [row],
    ephemeral: true,
  });
}

/**
 * Handle simple message selection (opens modal for message input)
 */
export async function handleSimpleSelection(interaction: ButtonInteraction, sessionId: string): Promise<void> {
  const session = await getOne(
    `SELECT * FROM setup_sessions WHERE id = $1`,
    [sessionId]
  );
  if (!session) {
    await interaction.reply({ content: '❌ Session expired. Please try again.', ephemeral: true });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId(`welcome_message_modal_${sessionId}`)
    .setTitle('Enter Welcome Message');

  const messageInput = new TextInputBuilder()
    .setCustomId('welcome_message')
    .setLabel('Welcome Message')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Use {{server_name}}, {{user}}, {{user_mention}}, {{mem_count}}')
    .setRequired(true);

  const row = new ActionRowBuilder<TextInputBuilder>().addComponents(messageInput);
  modal.addComponents(row);

    await interaction.showModal(modal);
}

/**
 * Handle message input modal submission
 */
export async function handleMessageModalSubmit(interaction: ModalSubmitInteraction, sessionId: string): Promise<void> {
  const session = await getOne(
    `SELECT * FROM setup_sessions WHERE id = $1`,
    [sessionId]
  );
  if (!session) {
    await interaction.reply({ content: '❌ Session expired. Please try again.', ephemeral: true });
    return;
  }

  const message = interaction.fields.getTextInputValue('welcome_message');

  // Validate message security
  const securityCheck = validateWelcomeMessageSecurity(message);
  if (!securityCheck.valid && securityCheck.errors) {
    await interaction.reply({
      content: `❌ Message contains forbidden content:\n${securityCheck.errors.map(e => `• ${e}`).join('\n')}`,
      ephemeral: true,
    });
    return;
  }

  // Validate variables
  const validation = validateMessage(message);
  if (!validation.valid && validation.invalidVars) {
    await interaction.reply({
      content: `❌ Invalid variables: \`${validation.invalidVars.join(', ')}\`\n\nValid variables: \`{{server_name}}\`, \`{{user}}\`, \`{{user_mention}}\`, \`{{mem_count}}\``,
      ephemeral: true,
    });
    return;
  }

  // Update session with message
  await query(
    `UPDATE setup_sessions SET message = $1, step = $2 WHERE id = $3`,
    [message, 'preview', sessionId]
  );

  // Show preview
  const guild = interaction.guild!;
  const member = interaction.member! as any;
  const preview = await replaceVariables(message, { guild, member });

  const previewEmbed = new EmbedBuilder()
    .setTitle('Message Preview')
    .setDescription(preview)
    .setColor(0x5865f2)
    .setFooter({ text: 'Available variables: {{server_name}}, {{user}}, {{user_mention}}, {{mem_count}}' });

  const typeAgainBtn = new ButtonBuilder()
    .setCustomId(`welcome_type_again_${sessionId}`)
    .setLabel('Type Again')
    .setStyle(ButtonStyle.Secondary);

  const nextBtn = new ButtonBuilder()
    .setCustomId(`welcome_next_autodelete_${sessionId}`)
    .setLabel('Next')
    .setStyle(ButtonStyle.Primary);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(typeAgainBtn, nextBtn);

  await interaction.reply({
    embeds: [previewEmbed],
    components: [row],
    ephemeral: true,
  });
}

/**
 * Handle type again (restart message input)
 */
export async function handleTypeAgain(interaction: ButtonInteraction, sessionId: string): Promise<void> {
  const session = await getOne(
    `SELECT * FROM setup_sessions WHERE id = $1`,
    [sessionId]
  );
  if (!session) {
    await interaction.reply({ content: '❌ Session expired. Please try again.', ephemeral: true });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId(`welcome_message_modal_${sessionId}`)
    .setTitle('Enter Welcome Message');

  const messageInput = new TextInputBuilder()
    .setCustomId('welcome_message')
    .setLabel('Welcome Message')
    .setStyle(TextInputStyle.Paragraph)
    .setValue(session.message || '')
    .setPlaceholder('Use {{server_name}}, {{user}}, {{user_mention}}, {{mem_count}}')
    .setRequired(true);

  const row = new ActionRowBuilder<TextInputBuilder>().addComponents(messageInput);
  modal.addComponents(row);

    await interaction.showModal(modal);
}

/**
 * Handle auto-delete setup (opens modal)
 */
export async function handleAutoDeleteSetup(interaction: ButtonInteraction, sessionId: string): Promise<void> {
  const session = await getOne(
    `SELECT * FROM setup_sessions WHERE id = $1`,
    [sessionId]
  );
  if (!session) {
    await interaction.reply({ content: '❌ Session expired. Please try again.', ephemeral: true });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId(`welcome_autodelete_modal_${sessionId}`)
    .setTitle('Auto-Delete Setup');

  const autoDeleteInput = new TextInputBuilder()
    .setCustomId('autodelete_value')
    .setLabel('Auto-delete time (e.g., 10s, 1m, or "skip")')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('skip, 10s, 15s, 1m, etc.')
    .setRequired(true);

  const row = new ActionRowBuilder<TextInputBuilder>().addComponents(autoDeleteInput);
  modal.addComponents(row);

    await interaction.showModal(modal);
}

/**
 * Parse auto-delete value (e.g., "10s" -> 10000, "1m" -> 60000, "skip" -> null)
 */
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

/**
 * Handle auto-delete modal submission
 */
export async function handleAutoDeleteModalSubmit(interaction: ModalSubmitInteraction, sessionId: string): Promise<void> {
  const session = await getOne(
    `SELECT * FROM setup_sessions WHERE id = $1`,
    [sessionId]
  );
  if (!session) {
    await interaction.reply({ content: '❌ Session expired. Please try again.', ephemeral: true });
    return;
  }

  const autoDeleteStr = interaction.fields.getTextInputValue('autodelete_value');
  const autoDeleteMs = parseAutoDeleteValue(autoDeleteStr);

  if (autoDeleteMs === 'invalid') {
    await interaction.reply({
      content: '❌ Invalid format. Use `skip`, `10s`, `15s`, `1m`, etc.',
      ephemeral: true,
    });
    return;
  }

  // Update session
  await query(
    `UPDATE setup_sessions SET auto_delete_ms = $1, step = $2 WHERE id = $3`,
    [autoDeleteMs, 'channel', sessionId]
  );

  // Show channel selection
  const channelEmbed = new EmbedBuilder()
    .setTitle('Select Welcome Channel')
    .setDescription('Click the button below to select the welcome channel.')
    .setColor(0x5865f2);

  const nextBtn = new ButtonBuilder()
    .setCustomId(`welcome_next_channel_${sessionId}`)
    .setLabel('Next: Select Channel')
    .setStyle(ButtonStyle.Primary);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(nextBtn);

  await interaction.reply({
    embeds: [channelEmbed],
    components: [row],
    ephemeral: true,
  });
}

/**
 * Handle next button for channel setup (shows modal)
 */
export async function handleChannelSetup(interaction: ButtonInteraction, sessionId: string): Promise<void> {
  const session = await getOne(
    `SELECT * FROM setup_sessions WHERE id = $1`,
    [sessionId]
  );
  if (!session) {
    await interaction.reply({ content: '❌ Session expired. Please try again.', ephemeral: true });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId(`welcome_channel_modal_${sessionId}`)
    .setTitle('Channel ID');

  const channelInput = new TextInputBuilder()
    .setCustomId('channel_id')
    .setLabel('Channel ID')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g., 123456789...')
    .setRequired(true);

  const row = new ActionRowBuilder<TextInputBuilder>().addComponents(channelInput);
  modal.addComponents(row);

    await interaction.showModal(modal);
}

/**
 * Handle channel modal submission
 */
export async function handleChannelModalSubmit(interaction: ModalSubmitInteraction, sessionId: string): Promise<void> {
  const session = await getOne(
    `SELECT * FROM setup_sessions WHERE id = $1`,
    [sessionId]
  );
  if (!session) {
    await interaction.reply({ content: '❌ Session expired. Please try again.', ephemeral: true });
    return;
  }

  const channelId = interaction.fields.getTextInputValue('channel_id');

  // Validate channel exists
  try {
    const channel = await interaction.guild!.channels.fetch(channelId);
    if (!channel?.isTextBased()) {
      await interaction.reply({
        content: '❌ Channel must be a text channel.',
        ephemeral: true,
      });
      return;
    }
  } catch {
    await interaction.reply({
      content: '❌ Invalid channel ID. Channel not found.',
      ephemeral: true,
    });
    return;
  }

  // Store channel in session
  await query(
    `UPDATE setup_sessions SET welcome_channel = $1, step = $2 WHERE id = $3`,
    [channelId, 'embed_link', sessionId]
  );

  // Show embed link options
  await showEmbedLinkSelection(interaction, sessionId);
}

/**
 * Show embed linking selection
 */
export async function showEmbedLinkSelection(
  interaction: ModalSubmitInteraction | ButtonInteraction | any,
  sessionId: string
): Promise<void> {
  // Fetch all custom embeds in this guild
  const embeds = await getMany(
    `SELECT * FROM embeds WHERE guild_id = $1 ORDER BY name ASC`,
    [interaction.guildId!]
  );

  const embedLinkEmbed = new EmbedBuilder()
    .setTitle('Link Custom Embed')
    .setColor(0x5865f2);

  if (embeds.length === 0) {
    embedLinkEmbed.setDescription(
      '⚠️ You do not have any custom embeds configured. Would you like to proceed without linking an embed?\n\n*(You can create custom embeds using `/embed create` and link them to panels later).*'
    );

    const proceedBtn = new ButtonBuilder()
      .setCustomId(`welcome_embed_skip_${sessionId}`)
      .setLabel('Proceed to Confirmation')
      .setStyle(ButtonStyle.Primary);

    const cancelBtn = new ButtonBuilder()
      .setCustomId(`welcome_cancel_${sessionId}`)
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(proceedBtn, cancelBtn);

    if (interaction instanceof ModalSubmitInteraction) {
      await interaction.reply({
        embeds: [embedLinkEmbed],
        components: [row],
        ephemeral: true,
      });
    } else {
      await interaction.update({
        embeds: [embedLinkEmbed],
        components: [row],
      });
    }
  } else {
    const { StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = await import('discord.js');

    embedLinkEmbed.setDescription(
      'Select a custom embed from the dropdown menu to link to this welcome message, or click **Skip** to send only the text message.'
    );

    const select = new StringSelectMenuBuilder()
      .setCustomId(`welcome_embed_select_${sessionId}`)
      .setPlaceholder('Choose a custom embed...');

    select.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel('None / No Embed')
        .setDescription('Do not attach an embed to this welcome panel.')
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

    const selectRow = new ActionRowBuilder<any>().addComponents(select);

    const skipBtn = new ButtonBuilder()
      .setCustomId(`welcome_embed_skip_${sessionId}`)
      .setLabel('Skip / No Embed')
      .setStyle(ButtonStyle.Secondary);

    const cancelBtn = new ButtonBuilder()
      .setCustomId(`welcome_cancel_${sessionId}`)
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Danger);

    const btnRow = new ActionRowBuilder<ButtonBuilder>().addComponents(skipBtn, cancelBtn);

    if (interaction instanceof ModalSubmitInteraction) {
      await interaction.reply({
        embeds: [embedLinkEmbed],
        components: [selectRow, btnRow],
        ephemeral: true,
      });
    } else {
      await interaction.update({
        embeds: [embedLinkEmbed],
        components: [selectRow, btnRow],
      });
    }
  }
}

/**
 * Show confirmation screen
 */
export async function showPanelConfirmationScreen(
  interaction: any,
  sessionId: string
): Promise<void> {
  const session = await getOne(
    `SELECT * FROM setup_sessions WHERE id = $1`,
    [sessionId]
  );
  if (!session) {
    await interaction.reply({ content: '❌ Session expired. Please try again.', ephemeral: true });
    return;
  }

  let embedName = 'None';
  if (session.embed_id) {
    const embedData = await getOne(`SELECT name FROM embeds WHERE id = $1`, [session.embed_id]);
    if (embedData) {
      embedName = embedData.name;
    }
  }

  const confirmEmbed = new EmbedBuilder()
    .setTitle('Confirm Panel Setup')
    .setDescription(
      `**Message:** ${session.message}\n\n**Channel:** <#${session.welcome_channel}>\n\n**Auto-delete:** ${session.auto_delete_ms ? `${session.auto_delete_ms}ms` : 'Disabled'}\n\n**Attached Embed:** ${embedName}`
    )
    .setColor(0x5865f2);

  const confirmBtn = new ButtonBuilder()
    .setCustomId(`welcome_confirm_${sessionId}`)
    .setLabel('Create Panel')
    .setStyle(ButtonStyle.Success);

  const cancelBtn = new ButtonBuilder()
    .setCustomId(`welcome_cancel_${sessionId}`)
    .setLabel('Cancel')
    .setStyle(ButtonStyle.Danger);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(confirmBtn, cancelBtn);

  await interaction.update({
    embeds: [confirmEmbed],
    components: [row],
  });
}

/**
 * Handle confirmation and create the panel
 */
export async function handlePanelConfirmation(interaction: ButtonInteraction, sessionId: string): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  const session = await getOne(
    `SELECT * FROM setup_sessions WHERE id = $1`,
    [sessionId]
  );
  if (!session || !session.message || !session.welcome_channel) {
    await interaction.editReply({ content: '❌ Session incomplete. Please try again.' });
    return;
  }

  // Find a unique default name that does not already exist
  const result = await getOne(
    `SELECT COUNT(*) as count FROM welcome_panels WHERE guild_id = $1`,
    [interaction.guildId!]
  );
  const panelCount = result?.count || 0;

  let panelName = '';
  let counter = panelCount + 1;
  let nameExists = true;
  while (nameExists) {
    panelName = `panel-${counter}`;
    const check = await getOne(
      `SELECT id FROM welcome_panels WHERE guild_id = $1 AND panel_name = $2`,
      [interaction.guildId!, panelName]
    );
    if (!check) {
      nameExists = false;
    } else {
      counter++;
    }
  }
  const panelId = uuidv4();

  // Create the panel with optional embed_id
  await query(
    `INSERT INTO welcome_panels (id, guild_id, panel_name, message, welcome_channel, auto_delete_ms, embed_id) 
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [panelId, interaction.guildId!, panelName, session.message, session.welcome_channel, session.auto_delete_ms, session.embed_id]
  );

  let embedName = 'None';
  if (session.embed_id) {
    const embedData = await getOne(`SELECT name FROM embeds WHERE id = $1`, [session.embed_id]);
    if (embedData) {
      embedName = embedData.name;
    }
  }

  // Clean up session
  await query(`DELETE FROM setup_sessions WHERE id = $1`, [sessionId]);

  // Send a visible plain-text confirmation to the configured channel (no embed)
  try {
    const channel = (await interaction.client.channels.fetch(session.welcome_channel)) as TextChannel | null;
    if (channel && channel.isTextBased()) {
      const content = `✅ Welcome panel **${panelName}** created successfully!\n\nMessage: ${session.message.slice(0, 1500)}\n\nChannel: <#${session.welcome_channel}>\nAuto-delete: ${session.auto_delete_ms ? `${session.auto_delete_ms}ms` : 'Disabled'}\nAttached Embed: ${embedName}`;
      const sent = await channel.send({ content });
      if (session.auto_delete_ms && typeof session.auto_delete_ms === 'number') {
        setTimeout(() => sent.delete().catch(() => undefined), session.auto_delete_ms);
      }
    }
  } catch (err) {
    // ignore channel send errors
  }

  await interaction.editReply({ content: `✅ Welcome panel **${panelName}** created successfully!` });
}

/**
 * Handle cancellation
 */
export async function handlePanelCancellation(interaction: ButtonInteraction, sessionId: string): Promise<void> {
  await query(`DELETE FROM setup_sessions WHERE id = $1`, [sessionId]).catch(() => undefined);
  await interaction.reply({ content: '❌ Setup cancelled.', ephemeral: true });
}

/**
 * Handle customized option - show configuration hub
 */
export async function handleCustomizedSelection(interaction: ButtonInteraction, sessionId: string): Promise<void> {
  await showCustomizedHub(interaction, sessionId);
}

/**
 * Show the customized configuration hub where users can set up each field in any order
 */
export async function showCustomizedHub(
  interaction: ButtonInteraction | ModalSubmitInteraction | StringSelectMenuInteraction,
  sessionId: string
): Promise<void> {
  const session = await getOne(
    `SELECT * FROM setup_sessions WHERE id = $1`,
    [sessionId]
  );
  if (!session) {
    await interaction.reply({ content: '❌ Session expired. Please try again.', ephemeral: true });
    return;
  }

  const messageStatus = session.message
    ? '✅ Set'
    : '❌ Not set *(required)*';

  let embedStatus = '⬜ None';
  if (session.embed_id) {
    const embedData = await getOne(`SELECT name FROM embeds WHERE id = $1`, [session.embed_id]);
    if (embedData) {
      embedStatus = `✅ ${embedData.name}`;
    }
  }

  const channelStatus = session.welcome_channel
    ? `✅ <#${session.welcome_channel}>`
    : '❌ Not set *(required)*';

  let autoDeleteStatus = '⬜ Disabled';
  if (session.auto_delete_ms) {
    const seconds = Math.round(session.auto_delete_ms / 1000);
    autoDeleteStatus = seconds >= 60 ? `✅ ${Math.round(seconds / 60)}m` : `✅ ${seconds}s`;
  }

  const hubEmbed = new EmbedBuilder()
    .setTitle('Customized Welcome Panel')
    .setDescription(
      `Configure your welcome panel below. Click any button to set or change a value.\n\n` +
      `**Welcome Message:** ${messageStatus}\n` +
      `**Embed:** ${embedStatus}\n` +
      `**Channel:** ${channelStatus}\n` +
      `**Auto-Delete:** ${autoDeleteStatus}`
    )
    .setColor(0x5865f2);

  if (session.message) {
    hubEmbed.addFields({ name: 'Message Preview', value: session.message.slice(0, 1024) });
  }

  const editMessageBtn = new ButtonBuilder()
    .setCustomId(`welcome_cust_message_${sessionId}`)
    .setLabel('Edit Welcome Message')
    .setStyle(session.message ? ButtonStyle.Secondary : ButtonStyle.Primary);

  const connectEmbedBtn = new ButtonBuilder()
    .setCustomId(`welcome_cust_embed_${sessionId}`)
    .setLabel(session.embed_id ? 'Change Embed' : 'Connect Embed')
    .setStyle(ButtonStyle.Secondary);

  const setChannelBtn = new ButtonBuilder()
    .setCustomId(`welcome_cust_channel_${sessionId}`)
    .setLabel('Set Channel')
    .setStyle(session.welcome_channel ? ButtonStyle.Secondary : ButtonStyle.Primary);

  const setAutoDeleteBtn = new ButtonBuilder()
    .setCustomId(`welcome_cust_autodelete_${sessionId}`)
    .setLabel('Set Auto-Delete')
    .setStyle(ButtonStyle.Secondary);

  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(editMessageBtn, connectEmbedBtn);
  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(setChannelBtn, setAutoDeleteBtn);

  const canCreate = !!(session.message && session.welcome_channel);

  const createBtn = new ButtonBuilder()
    .setCustomId(`welcome_cust_confirm_${sessionId}`)
    .setLabel('Create Panel')
    .setStyle(ButtonStyle.Success)
    .setDisabled(!canCreate);

  const cancelBtn = new ButtonBuilder()
    .setCustomId(`welcome_cancel_${sessionId}`)
    .setLabel('Cancel')
    .setStyle(ButtonStyle.Danger);

  const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(createBtn, cancelBtn);

  const payload = {
    embeds: [hubEmbed],
    components: [row1, row2, row3],
  };

  if (interaction instanceof ModalSubmitInteraction) {
    await interaction.reply({ ...payload, ephemeral: true });
  } else {
    await interaction.update(payload);
  }
}

/**
 * Handle "Edit Welcome Message" button from customized hub
 */
export async function handleCustomizedMessage(interaction: ButtonInteraction, sessionId: string): Promise<void> {
  const session = await getOne(`SELECT * FROM setup_sessions WHERE id = $1`, [sessionId]);
  if (!session) {
    await interaction.reply({ content: '❌ Session expired. Please try again.', ephemeral: true });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId(`welcome_cust_message_modal_${sessionId}`)
    .setTitle('Welcome Message');

  const messageInput = new TextInputBuilder()
    .setCustomId('welcome_message')
    .setLabel('Welcome Message')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Use {{server_name}}, {{user}}, {{user_mention}}, {{mem_count}}')
    .setRequired(true);

  if (session.message) {
    messageInput.setValue(session.message);
  }

  const row = new ActionRowBuilder<TextInputBuilder>().addComponents(messageInput);
  modal.addComponents(row);

  await interaction.showModal(modal);
}

/**
 * Handle message modal submission from customized hub
 */
export async function handleCustomizedMessageSubmit(interaction: ModalSubmitInteraction, sessionId: string): Promise<void> {
  const session = await getOne(`SELECT * FROM setup_sessions WHERE id = $1`, [sessionId]);
  if (!session) {
    await interaction.reply({ content: '❌ Session expired. Please try again.', ephemeral: true });
    return;
  }

  const message = interaction.fields.getTextInputValue('welcome_message');

  const securityCheck = validateWelcomeMessageSecurity(message);
  if (!securityCheck.valid && securityCheck.errors) {
    await interaction.reply({
      content: `❌ Message contains forbidden content:\n${securityCheck.errors.map(e => `• ${e}`).join('\n')}`,
      ephemeral: true,
    });
    return;
  }

  const validation = validateMessage(message);
  if (!validation.valid && validation.invalidVars) {
    await interaction.reply({
      content: `❌ Invalid variables: \`${validation.invalidVars.join(', ')}\`\n\nValid variables: \`{{server_name}}\`, \`{{user}}\`, \`{{user_mention}}\`, \`{{mem_count}}\``,
      ephemeral: true,
    });
    return;
  }

  await query(`UPDATE setup_sessions SET message = $1 WHERE id = $2`, [message, sessionId]);

  await showCustomizedHub(interaction, sessionId);
}

/**
 * Handle "Connect Embed" button from customized hub
 */
export async function handleCustomizedEmbed(interaction: ButtonInteraction, sessionId: string): Promise<void> {
  const session = await getOne(`SELECT * FROM setup_sessions WHERE id = $1`, [sessionId]);
  if (!session) {
    await interaction.reply({ content: '❌ Session expired. Please try again.', ephemeral: true });
    return;
  }

  const embeds = await getMany(
    `SELECT * FROM embeds WHERE guild_id = $1 ORDER BY name ASC`,
    [interaction.guildId!]
  );

  if (embeds.length === 0) {
    const noEmbedEmbed = new EmbedBuilder()
      .setTitle('No Embeds Available')
      .setDescription('You do not have any custom embeds configured.\nCreate one first with `/embed create`.')
      .setColor(0xff9800);

    const backBtn = new ButtonBuilder()
      .setCustomId(`welcome_cust_back_${sessionId}`)
      .setLabel('Back')
      .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(backBtn);

    await interaction.update({
      embeds: [noEmbedEmbed],
      components: [row],
    });
    return;
  }

  const selectEmbed = new EmbedBuilder()
    .setTitle('Connect Embed')
    .setDescription('Select a custom embed to attach to this welcome panel.')
    .setColor(0x5865f2);

  const select = new StringSelectMenuBuilder()
    .setCustomId(`welcome_cust_embed_select_${sessionId}`)
    .setPlaceholder('Choose a custom embed...');

  select.addOptions(
    new StringSelectMenuOptionBuilder()
      .setLabel('None / No Embed')
      .setDescription('Do not attach an embed.')
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

  const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);

  const backBtn = new ButtonBuilder()
    .setCustomId(`welcome_cust_back_${sessionId}`)
    .setLabel('Back')
    .setStyle(ButtonStyle.Secondary);

  const btnRow = new ActionRowBuilder<ButtonBuilder>().addComponents(backBtn);

  await interaction.update({
    embeds: [selectEmbed],
    components: [selectRow, btnRow],
  });
}

/**
 * Handle embed selection from customized hub
 */
export async function handleCustomizedEmbedSelect(interaction: StringSelectMenuInteraction, sessionId: string): Promise<void> {
  const embedId = interaction.values[0] === 'none' ? null : interaction.values[0];
  await query(`UPDATE setup_sessions SET embed_id = $1 WHERE id = $2`, [embedId, sessionId]);
  await showCustomizedHub(interaction, sessionId);
}

/**
 * Handle "Set Channel" button from customized hub
 */
export async function handleCustomizedChannel(interaction: ButtonInteraction, sessionId: string): Promise<void> {
  const session = await getOne(`SELECT * FROM setup_sessions WHERE id = $1`, [sessionId]);
  if (!session) {
    await interaction.reply({ content: '❌ Session expired. Please try again.', ephemeral: true });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId(`welcome_cust_channel_modal_${sessionId}`)
    .setTitle('Welcome Channel');

  const channelInput = new TextInputBuilder()
    .setCustomId('channel_id')
    .setLabel('Channel ID')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g., 123456789...')
    .setRequired(true);

  if (session.welcome_channel) {
    channelInput.setValue(session.welcome_channel);
  }

  const row = new ActionRowBuilder<TextInputBuilder>().addComponents(channelInput);
  modal.addComponents(row);

  await interaction.showModal(modal);
}

/**
 * Handle channel modal submission from customized hub
 */
export async function handleCustomizedChannelSubmit(interaction: ModalSubmitInteraction, sessionId: string): Promise<void> {
  const session = await getOne(`SELECT * FROM setup_sessions WHERE id = $1`, [sessionId]);
  if (!session) {
    await interaction.reply({ content: '❌ Session expired. Please try again.', ephemeral: true });
    return;
  }

  const channelId = interaction.fields.getTextInputValue('channel_id');

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

  await query(`UPDATE setup_sessions SET welcome_channel = $1 WHERE id = $2`, [channelId, sessionId]);

  await showCustomizedHub(interaction, sessionId);
}

/**
 * Handle "Set Auto-Delete" button from customized hub
 */
export async function handleCustomizedAutoDelete(interaction: ButtonInteraction, sessionId: string): Promise<void> {
  const session = await getOne(`SELECT * FROM setup_sessions WHERE id = $1`, [sessionId]);
  if (!session) {
    await interaction.reply({ content: '❌ Session expired. Please try again.', ephemeral: true });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId(`welcome_cust_autodelete_modal_${sessionId}`)
    .setTitle('Auto-Delete Setup');

  const autoDeleteInput = new TextInputBuilder()
    .setCustomId('autodelete_value')
    .setLabel('Auto-delete time (e.g., 10s, 1m, or "skip")')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('skip, 10s, 15s, 1m, etc.')
    .setRequired(true);

  if (session.auto_delete_ms) {
    autoDeleteInput.setValue(`${Math.round(session.auto_delete_ms / 1000)}s`);
  }

  const row = new ActionRowBuilder<TextInputBuilder>().addComponents(autoDeleteInput);
  modal.addComponents(row);

  await interaction.showModal(modal);
}

/**
 * Handle auto-delete modal submission from customized hub
 */
export async function handleCustomizedAutoDeleteSubmit(interaction: ModalSubmitInteraction, sessionId: string): Promise<void> {
  const session = await getOne(`SELECT * FROM setup_sessions WHERE id = $1`, [sessionId]);
  if (!session) {
    await interaction.reply({ content: '❌ Session expired. Please try again.', ephemeral: true });
    return;
  }

  const autoDeleteStr = interaction.fields.getTextInputValue('autodelete_value');
  const autoDeleteMs = parseAutoDeleteValue(autoDeleteStr);

  if (autoDeleteMs === 'invalid') {
    await interaction.reply({
      content: '❌ Invalid format. Use `skip`, `10s`, `15s`, `1m`, etc.',
      ephemeral: true,
    });
    return;
  }

  await query(`UPDATE setup_sessions SET auto_delete_ms = $1 WHERE id = $2`, [autoDeleteMs, sessionId]);

  await showCustomizedHub(interaction, sessionId);
}
