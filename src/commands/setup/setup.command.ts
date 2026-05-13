import { ChatInputCommandInteraction, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { getOne, query } from '../../services/neon.service';

export const definition = new SlashCommandBuilder()
  .setName('setup')
  .setDescription('Configure the welcome bot for this server')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand((sub) =>
    sub
      .setName('enable')
      .setDescription('Enable the welcome system')
  )
  .addSubcommand((sub) =>
    sub
      .setName('disable')
      .setDescription('Disable the welcome system')
  );

export async function handleSetupCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply({ ephemeral: true });

  const { guildId, options } = interaction;
  if (!guildId) {
    await interaction.editReply('❌ This command can only be used in a server.');
    return;
  }

  const subcommand = options.getSubcommand();
  const enabled = subcommand === 'enable';

  // Check if config exists
  const existingConfig = await getOne(
    `SELECT * FROM guild_config WHERE guild_id = $1`,
    [guildId]
  );

  if (existingConfig) {
    // Update existing config
    await query(
      `UPDATE guild_config SET welcome_enabled = $1, updated_at = NOW() WHERE guild_id = $2`,
      [enabled, guildId]
    );
  } else {
    // Create new config
    await query(
      `INSERT INTO guild_config (id, guild_id, welcome_enabled) VALUES ($1, $2, $3)`,
      [`config_${guildId}`, guildId, enabled]
    );
  }

  if (enabled) {
    await interaction.editReply('✅ Welcome system enabled. Use `/welcome create` to set up your first panel.');
  } else {
    await interaction.editReply('✅ Welcome system disabled.');
  }
}
