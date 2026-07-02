import {
  ChatInputCommandInteraction,
  ButtonInteraction,
  ModalSubmitInteraction,
  EmbedBuilder,
  ButtonBuilder,
  ActionRowBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  Message,
  Client,
  Guild,
  GuildMember,
  PermissionFlagsBits,
} from 'discord.js';
import { getOne, getMany, query } from '../../services/neon.service.js';
import { renderEmbed, isValidHexColor, isValidUrl } from '../../utils/embedEngine.js';
import { logger } from '../../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Helper to build interactive editor buttons
 */
function getEditorButtons(sessionId: string): ActionRowBuilder<ButtonBuilder>[] {
  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`embed_edit_title_${sessionId}`).setLabel('Edit Title').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`embed_edit_description_${sessionId}`).setLabel('Edit Description').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`embed_edit_color_${sessionId}`).setLabel('Edit Color').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`embed_edit_thumbnail_${sessionId}`).setLabel('Edit Thumbnail').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`embed_edit_image_${sessionId}`).setLabel('Edit Image').setStyle(ButtonStyle.Primary)
  );

  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`embed_edit_author_${sessionId}`).setLabel('Edit Author').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`embed_edit_footer_${sessionId}`).setLabel('Edit Footer').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`embed_edit_timestamp_${sessionId}`).setLabel('Toggle Timestamp').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`embed_edit_save_${sessionId}`).setLabel('Save').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`embed_edit_cancel_${sessionId}`).setLabel('Cancel').setStyle(ButtonStyle.Danger)
  );

  return [row1, row2];
}

/**
 * Start embed creation flow
 */
export async function startEmbedCreation(interaction: ChatInputCommandInteraction): Promise<void> {
  const name = interaction.options.getString('name', true).trim();
  const guildId = interaction.guildId!;
  const userId = interaction.user.id;

  // Check if embed with this name already exists
  const existing = await getOne(
    `SELECT * FROM embeds WHERE guild_id = $1 AND name = $2`,
    [guildId, name]
  );
  if (existing) {
    await interaction.reply({
      content: `❌ An embed with the name **${name}** already exists in this server.`,
      ephemeral: true,
    });
    return;
  }

  const sessionId = uuidv4();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins expiry

  // Insert setup session
  await query(
    `INSERT INTO embed_setup_sessions (id, guild_id, user_id, name, title, description, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [sessionId, guildId, userId, name, 'Draft Embed', 'Use the buttons below to customize this embed.', expiresAt]
  );

  const session = await getOne(`SELECT * FROM embed_setup_sessions WHERE id = $1`, [sessionId]);
  const preview = renderEmbed(session, { guild: interaction.guild!, member: interaction.member as GuildMember });
  const components = getEditorButtons(sessionId);

  await interaction.reply({
    embeds: [preview],
    components: components,
  });
}

/**
 * Start embed editing flow
 */
export async function startEmbedEdit(interaction: ChatInputCommandInteraction): Promise<void> {
  const name = interaction.options.getString('embed', true).trim();
  const guildId = interaction.guildId!;
  const userId = interaction.user.id;

  // Fetch the existing embed
  const existing = await getOne(
    `SELECT * FROM embeds WHERE guild_id = $1 AND name = $2`,
    [guildId, name]
  );
  if (!existing) {
    await interaction.reply({
      content: `❌ Custom embed **${name}** not found.`,
      ephemeral: true,
    });
    return;
  }

  const sessionId = uuidv4();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins expiry

  // Insert session copying existing values
  await query(
    `INSERT INTO embed_setup_sessions (
       id, guild_id, user_id, embed_id, name, title, description, color, 
       thumbnail, image, author_name, author_icon, author_url, 
       footer_text, footer_icon, timestamp_enabled, expires_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
    [
      sessionId,
      guildId,
      userId,
      existing.id,
      existing.name,
      existing.title,
      existing.description,
      existing.color,
      existing.thumbnail,
      existing.image,
      existing.author_name,
      existing.author_icon,
      existing.author_url,
      existing.footer_text,
      existing.footer_icon,
      existing.timestamp_enabled,
      expiresAt,
    ]
  );

  const session = await getOne(`SELECT * FROM embed_setup_sessions WHERE id = $1`, [sessionId]);
  const preview = renderEmbed(session, { guild: interaction.guild!, member: interaction.member as GuildMember });
  const components = getEditorButtons(sessionId);

  await interaction.reply({
    embeds: [preview],
    components: components,
  });
}

/**
 * Show details of an existing custom embed
 */
export async function handleEmbedShow(interaction: ChatInputCommandInteraction): Promise<void> {
  const name = interaction.options.getString('embed', true).trim();
  const guildId = interaction.guildId!;

  const embedData = await getOne(
    `SELECT * FROM embeds WHERE guild_id = $1 AND name = $2`,
    [guildId, name]
  );
  if (!embedData) {
    await interaction.reply({ content: `❌ Custom embed **${name}** not found.`, ephemeral: true });
    return;
  }

  // Count usage in welcome panels
  const usage = await getOne(
    `SELECT COUNT(*) as count FROM welcome_panels WHERE embed_id = $1`,
    [embedData.id]
  );
  const useCount = usage?.count || 0;

  const infoEmbed = new EmbedBuilder()
    .setTitle(`Embed: ${embedData.name}`)
    .setColor(0x5865F2)
    .addFields(
      { name: 'Created By', value: `<@${embedData.created_by}>`, inline: true },
      { name: 'Usage Status', value: useCount > 0 ? `✅ Linked to ${useCount} Welcome Panel(s)` : '⚠️ Unused/Orphaned', inline: true },
      { name: 'Created At', value: new Date(embedData.created_at).toUTCString(), inline: false },
      { name: 'Last Updated', value: new Date(embedData.updated_at).toUTCString(), inline: false }
    );

  const renderedPreview = renderEmbed(embedData, { guild: interaction.guild!, member: interaction.member as GuildMember });

  await interaction.reply({
    embeds: [infoEmbed, renderedPreview],
  });
}

/**
 * Delete an existing custom embed
 */
export async function handleEmbedDelete(interaction: ChatInputCommandInteraction): Promise<void> {
  const name = interaction.options.getString('embed', true).trim();
  const guildId = interaction.guildId!;

  const embedData = await getOne(
    `SELECT * FROM embeds WHERE guild_id = $1 AND name = $2`,
    [guildId, name]
  );
  if (!embedData) {
    await interaction.reply({ content: `❌ Custom embed **${name}** not found.`, ephemeral: true });
    return;
  }

  const confirmEmbed = new EmbedBuilder()
    .setTitle('Confirm Deletion')
    .setDescription(`Are you sure you want to permanently delete custom embed **${name}**? This cannot be undone.`)
    .setColor(0xda373c);

  const confirmId = `embed_delete_confirm_${embedData.id}`;
  const cancelId = `embed_delete_cancel_${embedData.id}`;

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(confirmId).setLabel('Delete Permanently').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(cancelId).setLabel('Cancel').setStyle(ButtonStyle.Secondary)
  );

  await interaction.reply({
    embeds: [confirmEmbed],
    components: [row],
  });
}

/**
 * Handle button interactions for embeds
 */
export async function handleEmbedButton(interaction: ButtonInteraction): Promise<void> {
  const customId = interaction.customId;
  const guildId = interaction.guildId!;
  const userId = interaction.user.id;

  // Protect against non-admins
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ content: '❌ You must be an administrator to edit embeds.', ephemeral: true });
    return;
  }

  // Handle direct deletion buttons
  if (customId.startsWith('embed_delete_confirm_')) {
    const embedId = customId.replace('embed_delete_confirm_', '');
    await query(`DELETE FROM embeds WHERE id = $1`, [embedId]);
    await interaction.update({
      content: '✅ Custom embed deleted permanently.',
      embeds: [],
      components: [],
    });
    return;
  }
  if (customId.startsWith('embed_delete_cancel_')) {
    await interaction.update({
      content: '❌ Deletion cancelled.',
      embeds: [],
      components: [],
    });
    return;
  }

  // Retrieve Setup Session
  const buttonActions = [
    'embed_edit_title_',
    'embed_edit_description_',
    'embed_edit_color_',
    'embed_edit_thumbnail_',
    'embed_edit_image_',
    'embed_edit_author_',
    'embed_edit_footer_',
    'embed_edit_timestamp_',
    'embed_edit_save_',
    'embed_edit_cancel_',
  ];

  const prefix = buttonActions.find((a) => customId.startsWith(a));
  if (!prefix) return;

  const sessionId = customId.replace(prefix, '');
  const session = await getOne(
    `SELECT * FROM embed_setup_sessions WHERE id = $1`,
    [sessionId]
  );

  if (!session) {
    await interaction.reply({ content: '❌ Editing session has expired. Please try again.', ephemeral: true });
    return;
  }

  // Prevent other users from messing with it
  if (session.user_id !== userId) {
    await interaction.reply({ content: '❌ Only the administrator who started this session can edit it.', ephemeral: true });
    return;
  }

  switch (prefix) {
    case 'embed_edit_title_': {
      const modal = new ModalBuilder()
        .setCustomId(`embed_modal_title_${sessionId}`)
        .setTitle('Edit Title');
      const titleInput = new TextInputBuilder()
        .setCustomId('title')
        .setLabel('Title')
        .setStyle(TextInputStyle.Short)
        .setValue(session.title || '')
        .setRequired(false);
      modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput));
      await interaction.showModal(modal);
      break;
    }
    case 'embed_edit_description_': {
      const modal = new ModalBuilder()
        .setCustomId(`embed_modal_description_${sessionId}`)
        .setTitle('Edit Description');
      const descInput = new TextInputBuilder()
        .setCustomId('description')
        .setLabel('Description')
        .setStyle(TextInputStyle.Paragraph)
        .setValue(session.description || '')
        .setRequired(false);
      modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(descInput));
      await interaction.showModal(modal);
      break;
    }
    case 'embed_edit_author_': {
      const modal = new ModalBuilder()
        .setCustomId(`embed_modal_author_${sessionId}`)
        .setTitle('Edit Author');
      const nameInput = new TextInputBuilder()
        .setCustomId('name')
        .setLabel('Author Name')
        .setStyle(TextInputStyle.Short)
        .setValue(session.author_name || '')
        .setRequired(false);
      const iconInput = new TextInputBuilder()
        .setCustomId('icon')
        .setLabel('Author Icon URL (Optional)')
        .setStyle(TextInputStyle.Short)
        .setValue(session.author_icon || '')
        .setRequired(false);
      const urlInput = new TextInputBuilder()
        .setCustomId('url')
        .setLabel('Author link URL (Optional)')
        .setStyle(TextInputStyle.Short)
        .setValue(session.author_url || '')
        .setRequired(false);

      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(iconInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(urlInput)
      );
      await interaction.showModal(modal);
      break;
    }
    case 'embed_edit_footer_': {
      const modal = new ModalBuilder()
        .setCustomId(`embed_modal_footer_${sessionId}`)
        .setTitle('Edit Footer');
      const textInput = new TextInputBuilder()
        .setCustomId('text')
        .setLabel('Footer Text')
        .setStyle(TextInputStyle.Short)
        .setValue(session.footer_text || '')
        .setRequired(false);
      const iconInput = new TextInputBuilder()
        .setCustomId('icon')
        .setLabel('Footer Icon URL (Optional)')
        .setStyle(TextInputStyle.Short)
        .setValue(session.footer_icon || '')
        .setRequired(false);

      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(textInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(iconInput)
      );
      await interaction.showModal(modal);
      break;
    }
    case 'embed_edit_color_': {
      await handleMessageBasedInput(interaction, session, 'Color', 'HEX color you want to use (e.g. #5865F2 or "clear" to remove)');
      break;
    }
    case 'embed_edit_thumbnail_': {
      await handleMessageBasedInput(interaction, session, 'Thumbnail URL', 'Thumbnail image URL (or "clear" to remove)');
      break;
    }
    case 'embed_edit_image_': {
      await handleMessageBasedInput(interaction, session, 'Image URL', 'Image URL (or "clear" to remove)');
      break;
    }
    case 'embed_edit_timestamp_': {
      const newVal = !session.timestamp_enabled;
      await query(`UPDATE embed_setup_sessions SET timestamp_enabled = $1 WHERE id = $2`, [newVal, sessionId]);
      session.timestamp_enabled = newVal;
      const updatedPreview = renderEmbed(session, { guild: interaction.guild!, member: interaction.member as GuildMember });
      await interaction.update({ embeds: [updatedPreview] });
      break;
    }
    case 'embed_edit_save_': {
      await interaction.deferUpdate();
      if (!session.embed_id) {
        // Creating a new embed
        const newEmbedId = uuidv4();
        await query(
          `INSERT INTO embeds (
             id, guild_id, name, title, description, color, thumbnail, image,
             author_name, author_icon, author_url, footer_text, footer_icon, 
             timestamp_enabled, created_by
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
          [
            newEmbedId,
            session.guild_id,
            session.name,
            session.title,
            session.description,
            session.color,
            session.thumbnail,
            session.image,
            session.author_name,
            session.author_icon,
            session.author_url,
            session.footer_text,
            session.footer_icon,
            session.timestamp_enabled,
            userId,
          ]
        );
      } else {
        // Editing existing embed
        await query(
          `UPDATE embeds 
           SET name = $1, title = $2, description = $3, color = $4, thumbnail = $5, image = $6,
               author_name = $7, author_icon = $8, author_url = $9, footer_text = $10, footer_icon = $11,
               timestamp_enabled = $12, updated_at = NOW()
           WHERE id = $13`,
          [
            session.name,
            session.title,
            session.description,
            session.color,
            session.thumbnail,
            session.image,
            session.author_name,
            session.author_icon,
            session.author_url,
            session.footer_text,
            session.footer_icon,
            session.timestamp_enabled,
            session.embed_id,
          ]
        );
      }

      await query(`DELETE FROM embed_setup_sessions WHERE id = $1`, [sessionId]);

      const finalPreview = renderEmbed(session, { guild: interaction.guild!, member: interaction.member as GuildMember });
      await interaction.editReply({
        content: `✅ Embed **${session.name}** saved successfully!`,
        embeds: [finalPreview],
        components: [],
      });
      break;
    }
    case 'embed_edit_cancel_': {
      await query(`DELETE FROM embed_setup_sessions WHERE id = $1`, [sessionId]);
      await interaction.update({
        content: '❌ Editing session cancelled. Unsaved changes discarded.',
        embeds: [],
        components: [],
      });
      break;
    }
  }
}

/**
 * Handle Message-Based input flows (HEX colors, URLs)
 */
async function handleMessageBasedInput(
  interaction: ButtonInteraction,
  session: any,
  fieldName: string,
  promptText: string
): Promise<void> {
  const sessionId = session.id;

  // Ask for input
  const promptMsg = await interaction.reply({
    content: `💬 Send the ${promptText}.`,
    ephemeral: false,
  });

  const filter = (m: Message) => m.author.id === interaction.user.id;
  const collector = (interaction.channel as any)?.createMessageCollector({ filter, max: 1, time: 60000 });

  collector?.on('collect', async (userMsg: Message) => {
    const value = userMsg.content.trim();

    // Check for clear/none/remove
    const isClear = ['clear', 'none', 'remove'].includes(value.toLowerCase());
    let dbValue: string | null = isClear ? null : value;
    let isValid = true;
    let errorMsg = '';

    if (!isClear) {
      if (fieldName === 'Color') {
        if (!value.startsWith('#')) {
          dbValue = '#' + value;
        }
        if (!isValidHexColor(dbValue!)) {
          isValid = false;
          errorMsg = '❌ Invalid HEX color format. Please use standard hexadecimal (e.g. #5865F2).';
        }
      } else {
        // Validation for URL (Thumbnail URL, Image URL)
        if (!isValidUrl(value)) {
          isValid = false;
          errorMsg = '❌ Invalid URL. Please provide a fully qualified image URL starting with http:// or https://.';
        }
      }
    }

    if (!isValid) {
      // Send error and self delete
      const err = await userMsg.reply({ content: errorMsg });
      setTimeout(() => {
        err.delete().catch(() => undefined);
        userMsg.delete().catch(() => undefined);
      }, 5000);
      return;
    }

    // Save database
    const dbField = fieldName === 'Color' ? 'color' : (fieldName === 'Thumbnail URL' ? 'thumbnail' : 'image');
    await query(`UPDATE embed_setup_sessions SET ${dbField} = $1 WHERE id = $2`, [dbValue, sessionId]);

    // Retrieve updated session
    const updatedSession = await getOne(`SELECT * FROM embed_setup_sessions WHERE id = $1`, [sessionId]);

    // Delete messages
    await promptMsg.delete().catch(() => undefined);
    await userMsg.delete().catch(() => undefined);

    // Re-render preview on the main message
    const preview = renderEmbed(updatedSession, { guild: interaction.guild!, member: interaction.member as GuildMember });
    await interaction.message.edit({ embeds: [preview] }).catch(() => undefined);
  });

  collector?.on('end', async (collected: any, reason: string) => {
    if (reason === 'time') {
      await promptMsg.edit({ content: '⏱️ Session timed out waiting for message input.', components: [] });
      setTimeout(() => promptMsg.delete().catch(() => undefined), 5000);
    }
  });
}

/**
 * Handle Modal Submissions
 */
export async function handleEmbedModal(interaction: ModalSubmitInteraction): Promise<void> {
  const customId = interaction.customId;
  const userId = interaction.user.id;

  if (!customId.startsWith('embed_modal_')) return;

  const modalActions = [
    'embed_modal_title_',
    'embed_modal_description_',
    'embed_modal_author_',
    'embed_modal_footer_',
  ];

  const prefix = modalActions.find((a) => customId.startsWith(a));
  if (!prefix) return;

  const sessionId = customId.replace(prefix, '');
  const session = await getOne(
    `SELECT * FROM embed_setup_sessions WHERE id = $1`,
    [sessionId]
  );

  if (!session) {
    await interaction.reply({ content: '❌ Editing session has expired. Please try again.', ephemeral: true });
    return;
  }

  // Defer update so we can edit the original message
  await interaction.deferUpdate();

  switch (prefix) {
    case 'embed_modal_title_': {
      const title = interaction.fields.getTextInputValue('title').trim() || null;
      await query(`UPDATE embed_setup_sessions SET title = $1 WHERE id = $2`, [title, sessionId]);
      break;
    }
    case 'embed_modal_description_': {
      const description = interaction.fields.getTextInputValue('description').trim() || null;
      await query(`UPDATE embed_setup_sessions SET description = $1 WHERE id = $2`, [description, sessionId]);
      break;
    }
    case 'embed_modal_author_': {
      const name = interaction.fields.getTextInputValue('name').trim() || null;
      const icon = interaction.fields.getTextInputValue('icon').trim() || null;
      const url = interaction.fields.getTextInputValue('url').trim() || null;

      await query(
        `UPDATE embed_setup_sessions SET author_name = $1, author_icon = $2, author_url = $3 WHERE id = $4`,
        [name, icon, url, sessionId]
      );
      break;
    }
    case 'embed_modal_footer_': {
      const text = interaction.fields.getTextInputValue('text').trim() || null;
      const icon = interaction.fields.getTextInputValue('icon').trim() || null;

      await query(
        `UPDATE embed_setup_sessions SET footer_text = $1, footer_icon = $2 WHERE id = $3`,
        [text, icon, sessionId]
      );
      break;
    }
  }

  // Refresh preview
  const updatedSession = await getOne(`SELECT * FROM embed_setup_sessions WHERE id = $1`, [sessionId]);
  const preview = renderEmbed(updatedSession, { guild: interaction.guild!, member: interaction.member as GuildMember });

  await interaction.editReply({
    embeds: [preview],
  });
}
