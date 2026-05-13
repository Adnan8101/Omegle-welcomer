import { ChatInputCommandInteraction, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { getOne, query } from '../../services/neon.service';

export const definition = new SlashCommandBuilder()
  .setName('config')
  .setDescription('Configure the welcome system')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand((sub) =>
    sub
      .setName('system')
      .setDescription('Enable or disable the entire welcoming system')
      .addBooleanOption((opt) => opt.setName('enabled').setDescription('true = on, false = off').setRequired(true))
  );

export async function handleConfigCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply({ ephemeral: true });

  const { guildId, options } = interaction;
  if (!guildId) {
    await interaction.editReply('❌ This command can only be used in a server.');
    return;
  }

  const enabled = options.getBoolean('enabled', true);

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

  await interaction.editReply(`✅ Welcome system is now **${enabled ? 'enabled' : 'disabled'}**`);
}
