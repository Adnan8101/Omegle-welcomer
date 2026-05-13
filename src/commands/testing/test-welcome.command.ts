import { ChatInputCommandInteraction, PermissionFlagsBits, SlashCommandBuilder, TextChannel } from 'discord.js';
import { getOne } from '../../services/neon.service.js';
import { replaceVariables } from '../../utils/variables.js';

export const definition = new SlashCommandBuilder()
  .setName('test-welcome')
  .setDescription('Test the welcome message (Admin only)')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addUserOption((opt) =>
    opt.setName('user').setDescription('The user to test welcoming for').setRequired(true)
  );

export async function handleTestWelcomeCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply({ ephemeral: true });

  const { guildId, guild, options } = interaction;
  if (!guildId || !guild) {
    await interaction.editReply('❌ This command can only be used in a server.');
    return;
  }

  const user = options.getUser('user', true);
  
  try {
    const member = await guild.members.fetch(user.id);

    const config = await getOne(
      `SELECT * FROM guild_config WHERE guild_id = $1`,
      [guildId]
    );
    if (!config) {
      await interaction.editReply('❌ **Error:** System not configured. Please run `/setup enable` first.');
      return;
    }
    
    if (!config.welcome_enabled) {
      await interaction.editReply('⚠️ **Warning:** The welcoming system is currently disabled. Run `/setup enable` to enable it.');
    }

    // Get first enabled panel
    const panel = await getOne(
      `SELECT * FROM welcome_panels WHERE guild_id = $1 AND enabled = true LIMIT 1`,
      [guildId]
    );

    if (!panel) {
      await interaction.editReply('❌ No enabled welcome panel found. Create one with `/welcome create`.');
      return;
    }

    // Get channel
    const channel = guild.channels.cache.get(panel.welcome_channel) as TextChannel | undefined;
    if (!channel?.isTextBased()) {
      await interaction.editReply('❌ Welcome channel not found or not text-based.');
      return;
    }

    // Replace variables and send plain text; respect auto-delete if configured
    const message = replaceVariables(panel.message, { guild, member });
    const sent = await channel.send({ content: message });
    if (panel.auto_delete_ms && typeof panel.auto_delete_ms === 'number') {
      setTimeout(() => sent.delete().catch(() => undefined), panel.auto_delete_ms);
    }
    await interaction.editReply(`✅ Test welcome sent to <#${panel.welcome_channel}>`);

  } catch (err) {
    await interaction.editReply(`❌ **Error fetching member:** Make sure the user is actually in the server.\n\`\`\`${err}\`\`\``);
  }
}
