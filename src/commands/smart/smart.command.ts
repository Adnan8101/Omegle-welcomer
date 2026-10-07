import {
  ChatInputCommandInteraction,
  ButtonInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
  ChannelType,
  ContainerBuilder,
  SectionBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  MessageFlags,
} from 'discord.js';
import { getOne, getMany, query } from '../../services/neon.service.js';

export const definition = new SlashCommandBuilder()
  .setName('smart')
  .setDescription('Configure smart welcome variables ({ruser}, {rvc})')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommandGroup((group) =>
    group
      .setName('ruser')
      .setDescription('Configure random user variable')
      .addSubcommand((sub) =>
        sub
          .setName('add')
          .setDescription('Add a role to the random user pool')
          .addRoleOption((opt) =>
            opt.setName('role').setDescription('The role to add').setRequired(true)
          )
      )
      .addSubcommand((sub) =>
        sub.setName('show').setDescription('Show configured roles for {ruser}')
      )
      .addSubcommand((sub) =>
        sub
          .setName('remove')
          .setDescription('Remove a role from the random user pool')
          .addRoleOption((opt) =>
            opt.setName('role').setDescription('The role to remove').setRequired(true)
          )
      )
  )
  .addSubcommandGroup((group) =>
    group
      .setName('rvc')
      .setDescription('Configure random voice channel variable')
      .addSubcommand((sub) =>
        sub
          .setName('add')
          .setDescription('Add a category to the random VC pool')
          .addChannelOption((opt) =>
            opt
              .setName('category')
              .setDescription('The category to add')
              .setRequired(true)
              .addChannelTypes(ChannelType.GuildCategory)
          )
      )
      .addSubcommand((sub) =>
        sub.setName('show').setDescription('Show configured categories for {rvc}')
      )
      .addSubcommand((sub) =>
        sub
          .setName('remove')
          .setDescription('Remove a category from the random VC pool')
          .addChannelOption((opt) =>
            opt
              .setName('category')
              .setDescription('The category to remove')
              .setRequired(true)
              .addChannelTypes(ChannelType.GuildCategory)
          )
      )
  );

function buildRuserShowComponents(roles: any[], guildId: string): any[] {
  const container = new ContainerBuilder()
    .setAccentColor(0x5865F2)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        '# 👥 Random User Roles\n-# Members from these roles will be randomly picked for `{ruser}`'
      )
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
    );

  if (roles.length === 0) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        'No roles configured yet.\n-# Use `/smart ruser add` to add roles.'
      )
    );
    return [container];
  }

  const maxSections = 7;
  const shown = roles.slice(0, maxSections);

  for (const role of shown) {
    container.addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`<@&${role.role_id}>`)
        )
        .setButtonAccessory(
          new ButtonBuilder()
            .setCustomId(`smart_ruser_remove_${role.role_id}`)
            .setLabel('Remove')
            .setStyle(ButtonStyle.Danger)
        )
    );
  }

  if (roles.length > maxSections) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `-# ...and ${roles.length - maxSections} more role(s)`
      )
    );
  }

  return [container];
}

function buildRvcShowComponents(categories: any[]): any[] {
  const container = new ContainerBuilder()
    .setAccentColor(0x5865F2)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        '# 🔊 Random VC Categories\n-# Voice channels from these categories will be randomly picked for `{rvc}`'
      )
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
    );

  if (categories.length === 0) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        'No categories configured yet.\n-# Use `/smart rvc add` to add categories.'
      )
    );
    return [container];
  }

  const maxSections = 7;
  const shown = categories.slice(0, maxSections);

  for (const cat of shown) {
    container.addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`<#${cat.category_id}>`)
        )
        .setButtonAccessory(
          new ButtonBuilder()
            .setCustomId(`smart_rvc_remove_${cat.category_id}`)
            .setLabel('Remove')
            .setStyle(ButtonStyle.Danger)
        )
    );
  }

  if (categories.length > maxSections) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `-# ...and ${categories.length - maxSections} more categorie(s)`
      )
    );
  }

  return [container];
}

function successContainer(text: string): any[] {
  return [
    new ContainerBuilder()
      .setAccentColor(0x57F287)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(text)),
  ];
}

function errorContainer(text: string): any[] {
  return [
    new ContainerBuilder()
      .setAccentColor(0xDA373C)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(text)),
  ];
}

export async function handleSmartCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const group = interaction.options.getSubcommandGroup(true);
  const sub = interaction.options.getSubcommand(true);
  const guildId = interaction.guildId!;

  if (group === 'ruser') {
    switch (sub) {
      case 'add': {
        const role = interaction.options.getRole('role', true);

        const existing = await getOne(
          `SELECT * FROM ruser_roles WHERE guild_id = $1 AND role_id = $2`,
          [guildId, role.id]
        );
        if (existing) {
          await interaction.reply({
            components: errorContainer(`<@&${role.id}> is already in the random user pool.`),
            flags: MessageFlags.IsComponentsV2,
          });
          return;
        }

        await query(
          `INSERT INTO ruser_roles (guild_id, role_id) VALUES ($1, $2)`,
          [guildId, role.id]
        );

        await interaction.reply({
          components: successContainer(
            `### ✅ Role Added\n<@&${role.id}> has been added to the \`{ruser}\` pool.\n-# Members with this role can now appear in welcome messages.`
          ),
          flags: MessageFlags.IsComponentsV2,
        });
        break;
      }
      case 'show': {
        const roles = await getMany(
          `SELECT * FROM ruser_roles WHERE guild_id = $1 ORDER BY created_at ASC`,
          [guildId]
        );
        await interaction.reply({
          components: buildRuserShowComponents(roles, guildId),
          flags: MessageFlags.IsComponentsV2,
        });
        break;
      }
      case 'remove': {
        const role = interaction.options.getRole('role', true);

        const existing = await getOne(
          `SELECT * FROM ruser_roles WHERE guild_id = $1 AND role_id = $2`,
          [guildId, role.id]
        );
        if (!existing) {
          await interaction.reply({
            components: errorContainer(`<@&${role.id}> is not in the random user pool.`),
            flags: MessageFlags.IsComponentsV2,
          });
          return;
        }

        await query(
          `DELETE FROM ruser_roles WHERE guild_id = $1 AND role_id = $2`,
          [guildId, role.id]
        );

        await interaction.reply({
          components: successContainer(`### ✅ Role Removed\n<@&${role.id}> has been removed from the \`{ruser}\` pool.`),
          flags: MessageFlags.IsComponentsV2,
        });
        break;
      }
    }
  } else if (group === 'rvc') {
    switch (sub) {
      case 'add': {
        const channel = interaction.options.getChannel('category', true);

        const existing = await getOne(
          `SELECT * FROM rvc_categories WHERE guild_id = $1 AND category_id = $2`,
          [guildId, channel.id]
        );
        if (existing) {
          await interaction.reply({
            components: errorContainer(`<#${channel.id}> is already in the random VC pool.`),
            flags: MessageFlags.IsComponentsV2,
          });
          return;
        }

        await query(
          `INSERT INTO rvc_categories (guild_id, category_id) VALUES ($1, $2)`,
          [guildId, channel.id]
        );

        await interaction.reply({
          components: successContainer(
            `### ✅ Category Added\n<#${channel.id}> has been added to the \`{rvc}\` pool.\n-# Voice channels in this category can now appear in welcome messages.`
          ),
          flags: MessageFlags.IsComponentsV2,
        });
        break;
      }
      case 'show': {
        const categories = await getMany(
          `SELECT * FROM rvc_categories WHERE guild_id = $1 ORDER BY created_at ASC`,
          [guildId]
        );
        await interaction.reply({
          components: buildRvcShowComponents(categories),
          flags: MessageFlags.IsComponentsV2,
        });
        break;
      }
      case 'remove': {
        const channel = interaction.options.getChannel('category', true);

        const existing = await getOne(
          `SELECT * FROM rvc_categories WHERE guild_id = $1 AND category_id = $2`,
          [guildId, channel.id]
        );
        if (!existing) {
          await interaction.reply({
            components: errorContainer(`<#${channel.id}> is not in the random VC pool.`),
            flags: MessageFlags.IsComponentsV2,
          });
          return;
        }

        await query(
          `DELETE FROM rvc_categories WHERE guild_id = $1 AND category_id = $2`,
          [guildId, channel.id]
        );

        await interaction.reply({
          components: successContainer(`### ✅ Category Removed\n<#${channel.id}> has been removed from the \`{rvc}\` pool.`),
          flags: MessageFlags.IsComponentsV2,
        });
        break;
      }
    }
  }
}

export async function handleSmartButton(interaction: ButtonInteraction): Promise<void> {
  const customId = interaction.customId;
  const guildId = interaction.guildId!;

  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({
      content: 'You must be an administrator to manage smart variables.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (customId.startsWith('smart_ruser_remove_')) {
    const roleId = customId.replace('smart_ruser_remove_', '');
    await query(
      `DELETE FROM ruser_roles WHERE guild_id = $1 AND role_id = $2`,
      [guildId, roleId]
    );

    const roles = await getMany(
      `SELECT * FROM ruser_roles WHERE guild_id = $1 ORDER BY created_at ASC`,
      [guildId]
    );
    await interaction.update({
      components: buildRuserShowComponents(roles, guildId),
      flags: MessageFlags.IsComponentsV2,
    });
  } else if (customId.startsWith('smart_rvc_remove_')) {
    const categoryId = customId.replace('smart_rvc_remove_', '');
    await query(
      `DELETE FROM rvc_categories WHERE guild_id = $1 AND category_id = $2`,
      [guildId, categoryId]
    );

    const categories = await getMany(
      `SELECT * FROM rvc_categories WHERE guild_id = $1 ORDER BY created_at ASC`,
      [guildId]
    );
    await interaction.update({
      components: buildRvcShowComponents(categories),
      flags: MessageFlags.IsComponentsV2,
    });
  }
}
