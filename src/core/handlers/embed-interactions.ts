import {
  ChatInputCommandInteraction,
  ButtonInteraction,
  ModalSubmitInteraction,
  ButtonBuilder,
  ActionRowBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ContainerBuilder,
  SectionBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  GuildMember,
  PermissionFlagsBits,
  MessageFlags,
} from 'discord.js';
import { getOne, query } from '../../services/neon.service.js';
import { isValidHexColor, isValidUrl, resolveColor } from '../../utils/embedEngine.js';
import { v4 as uuidv4 } from 'uuid';

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 3) + '...';
}

function fieldDisplay(val: string | null | undefined, placeholder = 'Not set'): string {
  if (!val) return `-# ${placeholder}`;
  return truncate(val, 200);
}

function buildEditorComponents(sessionId: string, session: any): any[] {
  const accentColor = session.color ? resolveColor(session.color) ?? 0x5865F2 : 0x5865F2;

  const editor = new ContainerBuilder()
    .setAccentColor(accentColor)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `# ✏️ Embed Editor\n**Name:** \`${session.name}\``
      )
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
    )
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`**Title**\n${fieldDisplay(session.title)}`)
        )
        .setButtonAccessory(
          new ButtonBuilder()
            .setCustomId(`embed_edit_title_${sessionId}`)
            .setLabel('Edit')
            .setStyle(ButtonStyle.Secondary)
        )
    )
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`**Description**\n${fieldDisplay(session.description)}`)
        )
        .setButtonAccessory(
          new ButtonBuilder()
            .setCustomId(`embed_edit_description_${sessionId}`)
            .setLabel('Edit')
            .setStyle(ButtonStyle.Secondary)
        )
    )
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`**Color**\n${fieldDisplay(session.color)}`)
        )
        .setButtonAccessory(
          new ButtonBuilder()
            .setCustomId(`embed_edit_color_${sessionId}`)
            .setLabel('Edit')
            .setStyle(ButtonStyle.Secondary)
        )
    )
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`**Thumbnail**\n${fieldDisplay(session.thumbnail)}`)
        )
        .setButtonAccessory(
          new ButtonBuilder()
            .setCustomId(`embed_edit_thumbnail_${sessionId}`)
            .setLabel('Edit')
            .setStyle(ButtonStyle.Secondary)
        )
    )
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`**Image**\n${fieldDisplay(session.image)}`)
        )
        .setButtonAccessory(
          new ButtonBuilder()
            .setCustomId(`embed_edit_image_${sessionId}`)
            .setLabel('Edit')
            .setStyle(ButtonStyle.Secondary)
        )
    )
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `**Author**\n${fieldDisplay(session.author_name)}` +
            (session.author_icon ? `\n-# Icon: ${truncate(session.author_icon, 60)}` : '') +
            (session.author_url ? `\n-# URL: ${truncate(session.author_url, 60)}` : '')
          )
        )
        .setButtonAccessory(
          new ButtonBuilder()
            .setCustomId(`embed_edit_author_${sessionId}`)
            .setLabel('Edit')
            .setStyle(ButtonStyle.Secondary)
        )
    )
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `**Footer**\n${fieldDisplay(session.footer_text)}` +
            (session.footer_icon ? `\n-# Icon: ${truncate(session.footer_icon, 60)}` : '')
          )
        )
        .setButtonAccessory(
          new ButtonBuilder()
            .setCustomId(`embed_edit_footer_${sessionId}`)
            .setLabel('Edit')
            .setStyle(ButtonStyle.Secondary)
        )
    )
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `**Timestamp**\n${session.timestamp_enabled ? '✅ Enabled' : '❌ Disabled'}`
          )
        )
        .setButtonAccessory(
          new ButtonBuilder()
            .setCustomId(`embed_edit_timestamp_${sessionId}`)
            .setLabel('Toggle')
            .setStyle(session.timestamp_enabled ? ButtonStyle.Success : ButtonStyle.Secondary)
        )
    );

  const actions = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        '-# 💡 Variables: `{user}` `{usermention}` `{server}` `{membercount}` `{usericon}` `{createdat}`'
      )
    )
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`embed_edit_save_${sessionId}`)
          .setLabel('Save Embed')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`embed_edit_cancel_${sessionId}`)
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Danger)
      )
    );

  return [editor, actions];
}

function buildShowComponents(embedData: any, useCount: number): any[] {
  const accentColor = embedData.color ? resolveColor(embedData.color) ?? 0x5865F2 : 0x5865F2;

  const info = new ContainerBuilder()
    .setAccentColor(0x5865F2)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`# 📋 Embed: ${embedData.name}`)
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `**Created By:** <@${embedData.created_by}>\n` +
        `**Usage:** ${useCount > 0 ? `✅ Linked to ${useCount} Welcome Panel(s)` : '⚠️ Unused'}\n` +
        `**Created:** ${new Date(embedData.created_at).toUTCString()}\n` +
        `**Updated:** ${new Date(embedData.updated_at).toUTCString()}`
      )
    );

  const preview = new ContainerBuilder()
    .setAccentColor(accentColor)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('### Preview')
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
    );

  const previewLines: string[] = [];
  if (embedData.author_name) previewLines.push(`-# 👤 ${embedData.author_name}`);
  if (embedData.title) previewLines.push(`**${embedData.title}**`);
  if (embedData.description) previewLines.push(embedData.description);
  if (embedData.color) previewLines.push(`\n-# 🎨 Color: ${embedData.color}`);
  if (embedData.thumbnail) previewLines.push(`-# 🖼️ Thumbnail: ${truncate(embedData.thumbnail, 60)}`);
  if (embedData.image) previewLines.push(`-# 🖼️ Image: ${truncate(embedData.image, 60)}`);
  if (embedData.footer_text) previewLines.push(`\n-# ${embedData.footer_text}`);
  if (embedData.timestamp_enabled) previewLines.push(`-# 🕐 Timestamp enabled`);

  if (previewLines.length === 0) {
    previewLines.push('-# Empty embed — no fields configured');
  }

  preview.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(previewLines.join('\n'))
  );

  return [info, preview];
}

function buildDeleteComponents(embedData: any): any[] {
  const container = new ContainerBuilder()
    .setAccentColor(0xDA373C)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `# ⚠️ Delete Embed\nAre you sure you want to permanently delete **${embedData.name}**?\n-# This action cannot be undone.`
      )
    )
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`embed_delete_confirm_${embedData.id}`)
          .setLabel('Delete Permanently')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`embed_delete_cancel_${embedData.id}`)
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Secondary)
      )
    );

  return [container];
}

export async function startEmbedCreation(interaction: ChatInputCommandInteraction): Promise<void> {
  const name = interaction.options.getString('name', true).trim();
  const guildId = interaction.guildId!;
  const userId = interaction.user.id;

  const existing = await getOne(
    `SELECT * FROM embeds WHERE guild_id = $1 AND name = $2`,
    [guildId, name]
  );
  if (existing) {
    await interaction.reply({
      content: `An embed with the name **${name}** already exists in this server.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const sessionId = uuidv4();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  await query(
    `INSERT INTO embed_setup_sessions (id, guild_id, user_id, name, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [sessionId, guildId, userId, name, expiresAt]
  );

  const session = await getOne(`SELECT * FROM embed_setup_sessions WHERE id = $1`, [sessionId]);
  const components = buildEditorComponents(sessionId, session);

  await interaction.reply({
    components,
    flags: MessageFlags.IsComponentsV2,
  });
}

export async function startEmbedEdit(interaction: ChatInputCommandInteraction): Promise<void> {
  const name = interaction.options.getString('embed', true).trim();
  const guildId = interaction.guildId!;
  const userId = interaction.user.id;

  const existing = await getOne(
    `SELECT * FROM embeds WHERE guild_id = $1 AND name = $2`,
    [guildId, name]
  );
  if (!existing) {
    await interaction.reply({
      content: `Custom embed **${name}** not found.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const sessionId = uuidv4();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  await query(
    `INSERT INTO embed_setup_sessions (
       id, guild_id, user_id, embed_id, name, title, description, color,
       thumbnail, image, author_name, author_icon, author_url,
       footer_text, footer_icon, timestamp_enabled, expires_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
    [
      sessionId, guildId, userId, existing.id,
      existing.name, existing.title, existing.description, existing.color,
      existing.thumbnail, existing.image,
      existing.author_name, existing.author_icon, existing.author_url,
      existing.footer_text, existing.footer_icon, existing.timestamp_enabled,
      expiresAt,
    ]
  );

  const session = await getOne(`SELECT * FROM embed_setup_sessions WHERE id = $1`, [sessionId]);
  const components = buildEditorComponents(sessionId, session);

  await interaction.reply({
    components,
    flags: MessageFlags.IsComponentsV2,
  });
}

export async function handleEmbedShow(interaction: ChatInputCommandInteraction): Promise<void> {
  const name = interaction.options.getString('embed', true).trim();
  const guildId = interaction.guildId!;

  const embedData = await getOne(
    `SELECT * FROM embeds WHERE guild_id = $1 AND name = $2`,
    [guildId, name]
  );
  if (!embedData) {
    await interaction.reply({ content: `Custom embed **${name}** not found.`, flags: MessageFlags.Ephemeral });
    return;
  }

  const usage = await getOne(
    `SELECT COUNT(*) as count FROM welcome_panels WHERE embed_id = $1`,
    [embedData.id]
  );
  const useCount = parseInt(usage?.count ?? '0', 10);

  const components = buildShowComponents(embedData, useCount);

  await interaction.reply({
    components,
    flags: MessageFlags.IsComponentsV2,
  });
}

export async function handleEmbedDelete(interaction: ChatInputCommandInteraction): Promise<void> {
  const name = interaction.options.getString('embed', true).trim();
  const guildId = interaction.guildId!;

  const embedData = await getOne(
    `SELECT * FROM embeds WHERE guild_id = $1 AND name = $2`,
    [guildId, name]
  );
  if (!embedData) {
    await interaction.reply({ content: `Custom embed **${name}** not found.`, flags: MessageFlags.Ephemeral });
    return;
  }

  const components = buildDeleteComponents(embedData);

  await interaction.reply({
    components,
    flags: MessageFlags.IsComponentsV2,
  });
}

export async function handleEmbedButton(interaction: ButtonInteraction): Promise<void> {
  const customId = interaction.customId;
  const userId = interaction.user.id;

  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ content: 'You must be an administrator to manage embeds.', flags: MessageFlags.Ephemeral });
    return;
  }

  if (customId.startsWith('embed_delete_confirm_')) {
    const embedId = customId.replace('embed_delete_confirm_', '');
    await query(`DELETE FROM embeds WHERE id = $1`, [embedId]);

    const done = new ContainerBuilder()
      .setAccentColor(0x57F287)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent('### ✅ Embed Deleted\nThe custom embed has been permanently removed.')
      );

    await interaction.update({
      components: [done],
      flags: MessageFlags.IsComponentsV2,
    });
    return;
  }

  if (customId.startsWith('embed_delete_cancel_')) {
    const done = new ContainerBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent('-# Deletion cancelled.')
      );

    await interaction.update({
      components: [done],
      flags: MessageFlags.IsComponentsV2,
    });
    return;
  }

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
    await interaction.reply({ content: 'Editing session has expired. Please try again.', flags: MessageFlags.Ephemeral });
    return;
  }

  if (session.user_id !== userId) {
    await interaction.reply({ content: 'Only the administrator who started this session can edit it.', flags: MessageFlags.Ephemeral });
    return;
  }

  switch (prefix) {
    case 'embed_edit_title_': {
      const modal = new ModalBuilder()
        .setCustomId(`embed_modal_title_${sessionId}`)
        .setTitle('Edit Title');
      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('title')
            .setLabel('Title')
            .setStyle(TextInputStyle.Short)
            .setValue(session.title || '')
            .setRequired(false)
        )
      );
      await interaction.showModal(modal);
      break;
    }
    case 'embed_edit_description_': {
      const modal = new ModalBuilder()
        .setCustomId(`embed_modal_description_${sessionId}`)
        .setTitle('Edit Description');
      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('description')
            .setLabel('Description')
            .setStyle(TextInputStyle.Paragraph)
            .setValue(session.description || '')
            .setRequired(false)
        )
      );
      await interaction.showModal(modal);
      break;
    }
    case 'embed_edit_color_': {
      const modal = new ModalBuilder()
        .setCustomId(`embed_modal_color_${sessionId}`)
        .setTitle('Edit Color');
      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('color')
            .setLabel('HEX Color (e.g. #FFD700 or "clear")')
            .setStyle(TextInputStyle.Short)
            .setValue(session.color || '')
            .setRequired(false)
        )
      );
      await interaction.showModal(modal);
      break;
    }
    case 'embed_edit_thumbnail_': {
      const modal = new ModalBuilder()
        .setCustomId(`embed_modal_thumbnail_${sessionId}`)
        .setTitle('Edit Thumbnail');
      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('thumbnail')
            .setLabel('Thumbnail Image URL (or "clear")')
            .setStyle(TextInputStyle.Short)
            .setValue(session.thumbnail || '')
            .setRequired(false)
        )
      );
      await interaction.showModal(modal);
      break;
    }
    case 'embed_edit_image_': {
      const modal = new ModalBuilder()
        .setCustomId(`embed_modal_image_${sessionId}`)
        .setTitle('Edit Image');
      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('image')
            .setLabel('Image URL (or "clear")')
            .setStyle(TextInputStyle.Short)
            .setValue(session.image || '')
            .setRequired(false)
        )
      );
      await interaction.showModal(modal);
      break;
    }
    case 'embed_edit_author_': {
      const modal = new ModalBuilder()
        .setCustomId(`embed_modal_author_${sessionId}`)
        .setTitle('Edit Author');
      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('name')
            .setLabel('Author Name')
            .setStyle(TextInputStyle.Short)
            .setValue(session.author_name || '')
            .setRequired(false)
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('icon')
            .setLabel('Author Icon URL (Optional)')
            .setStyle(TextInputStyle.Short)
            .setValue(session.author_icon || '')
            .setRequired(false)
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('url')
            .setLabel('Author Link URL (Optional)')
            .setStyle(TextInputStyle.Short)
            .setValue(session.author_url || '')
            .setRequired(false)
        )
      );
      await interaction.showModal(modal);
      break;
    }
    case 'embed_edit_footer_': {
      const modal = new ModalBuilder()
        .setCustomId(`embed_modal_footer_${sessionId}`)
        .setTitle('Edit Footer');
      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('text')
            .setLabel('Footer Text')
            .setStyle(TextInputStyle.Short)
            .setValue(session.footer_text || '')
            .setRequired(false)
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('icon')
            .setLabel('Footer Icon URL (Optional)')
            .setStyle(TextInputStyle.Short)
            .setValue(session.footer_icon || '')
            .setRequired(false)
        )
      );
      await interaction.showModal(modal);
      break;
    }
    case 'embed_edit_timestamp_': {
      const newVal = !session.timestamp_enabled;
      await query(`UPDATE embed_setup_sessions SET timestamp_enabled = $1 WHERE id = $2`, [newVal, sessionId]);
      session.timestamp_enabled = newVal;
      const components = buildEditorComponents(sessionId, session);
      await interaction.update({ components, flags: MessageFlags.IsComponentsV2 });
      break;
    }
    case 'embed_edit_save_': {
      await interaction.deferUpdate();

      if (!session.embed_id) {
        const newEmbedId = uuidv4();
        await query(
          `INSERT INTO embeds (
             id, guild_id, name, title, description, color, thumbnail, image,
             author_name, author_icon, author_url, footer_text, footer_icon,
             timestamp_enabled, created_by
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
          [
            newEmbedId, session.guild_id, session.name,
            session.title, session.description, session.color,
            session.thumbnail, session.image,
            session.author_name, session.author_icon, session.author_url,
            session.footer_text, session.footer_icon, session.timestamp_enabled,
            userId,
          ]
        );
      } else {
        await query(
          `UPDATE embeds
           SET name = $1, title = $2, description = $3, color = $4, thumbnail = $5, image = $6,
               author_name = $7, author_icon = $8, author_url = $9, footer_text = $10, footer_icon = $11,
               timestamp_enabled = $12, updated_at = NOW()
           WHERE id = $13`,
          [
            session.name, session.title, session.description, session.color,
            session.thumbnail, session.image,
            session.author_name, session.author_icon, session.author_url,
            session.footer_text, session.footer_icon, session.timestamp_enabled,
            session.embed_id,
          ]
        );
      }

      await query(`DELETE FROM embed_setup_sessions WHERE id = $1`, [sessionId]);

      const accentColor = session.color ? resolveColor(session.color) ?? 0x57F287 : 0x57F287;
      const saved = new ContainerBuilder()
        .setAccentColor(accentColor)
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `### ✅ Embed Saved\n**${session.name}** has been saved successfully.\n-# Use \`/embed show ${session.name}\` to view it or link it to a welcome panel.`
          )
        );

      await interaction.editReply({
        components: [saved],
        flags: MessageFlags.IsComponentsV2,
      });
      break;
    }
    case 'embed_edit_cancel_': {
      await query(`DELETE FROM embed_setup_sessions WHERE id = $1`, [sessionId]);

      const cancelled = new ContainerBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent('-# Editing session cancelled. Unsaved changes discarded.')
        );

      await interaction.update({
        components: [cancelled],
        flags: MessageFlags.IsComponentsV2,
      });
      break;
    }
  }
}

export async function handleEmbedModal(interaction: ModalSubmitInteraction): Promise<void> {
  const customId = interaction.customId;

  if (!customId.startsWith('embed_modal_')) return;

  const modalActions = [
    'embed_modal_title_',
    'embed_modal_description_',
    'embed_modal_author_',
    'embed_modal_footer_',
    'embed_modal_color_',
    'embed_modal_thumbnail_',
    'embed_modal_image_',
  ];

  const prefix = modalActions.find((a) => customId.startsWith(a));
  if (!prefix) return;

  const sessionId = customId.replace(prefix, '');
  const session = await getOne(
    `SELECT * FROM embed_setup_sessions WHERE id = $1`,
    [sessionId]
  );

  if (!session) {
    await interaction.reply({ content: 'Editing session has expired. Please try again.', flags: MessageFlags.Ephemeral });
    return;
  }

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
    case 'embed_modal_color_': {
      const colorInput = interaction.fields.getTextInputValue('color').trim();
      let color: string | null = colorInput || null;
      if (color) {
        if (['clear', 'none', 'remove'].includes(color.toLowerCase())) {
          color = null;
        } else {
          if (!color.startsWith('#')) color = '#' + color;
          if (!isValidHexColor(color)) {
            await interaction.followUp({ content: 'Invalid HEX color format. (e.g. #FFD700)', flags: MessageFlags.Ephemeral });
            return;
          }
        }
      }
      await query(`UPDATE embed_setup_sessions SET color = $1 WHERE id = $2`, [color, sessionId]);
      break;
    }
    case 'embed_modal_thumbnail_': {
      const thumbnailInput = interaction.fields.getTextInputValue('thumbnail').trim();
      let thumbnail: string | null = thumbnailInput || null;
      if (thumbnail) {
        if (['clear', 'none', 'remove'].includes(thumbnail.toLowerCase())) {
          thumbnail = null;
        } else if (!isValidUrl(thumbnail)) {
          await interaction.followUp({ content: 'Invalid URL format.', flags: MessageFlags.Ephemeral });
          return;
        }
      }
      await query(`UPDATE embed_setup_sessions SET thumbnail = $1 WHERE id = $2`, [thumbnail, sessionId]);
      break;
    }
    case 'embed_modal_image_': {
      const imageInput = interaction.fields.getTextInputValue('image').trim();
      let image: string | null = imageInput || null;
      if (image) {
        if (['clear', 'none', 'remove'].includes(image.toLowerCase())) {
          image = null;
        } else if (!isValidUrl(image)) {
          await interaction.followUp({ content: 'Invalid URL format.', flags: MessageFlags.Ephemeral });
          return;
        }
      }
      await query(`UPDATE embed_setup_sessions SET image = $1 WHERE id = $2`, [image, sessionId]);
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

  const updatedSession = await getOne(`SELECT * FROM embed_setup_sessions WHERE id = $1`, [sessionId]);
  const components = buildEditorComponents(sessionId, updatedSession);

  await interaction.editReply({
    components,
    flags: MessageFlags.IsComponentsV2,
  });
}
