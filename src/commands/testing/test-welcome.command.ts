import { ChatInputCommandInteraction, PermissionFlagsBits, SlashCommandBuilder, TextChannel } from 'discord.js';
import { getMany, getOne } from '../../services/neon.service.js';
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

    // Get all enabled panels
    const panels = await getMany(
      `SELECT * FROM welcome_panels WHERE guild_id = $1 AND enabled = true ORDER BY created_at ASC`,
      [guildId]
    );

    if (panels.length === 0) {
      await interaction.editReply('❌ No enabled welcome panels found. Create one with `/welcome create`.');
      return;
    }

    const sentPanels: Array<{ name: string; channel: string }> = [];
    const failedPanels: Array<{ name: string; channel: string; reason: string }> = [];

    for (const panel of panels) {
      let channel = guild.channels.cache.get(panel.welcome_channel) as TextChannel | null | undefined;
      if (!channel) {
        const fetched = await guild.channels.fetch(panel.welcome_channel).catch(() => null);
        channel = fetched as TextChannel | null | undefined;
      }

      if (!channel?.isTextBased()) {
        failedPanels.push({
          name: panel.panel_name,
          channel: panel.welcome_channel,
          reason: 'Channel not found or not text-based',
        });
        continue;
      }

      // Replace variables and send plain text; respect auto-delete if configured
      const message = replaceVariables(panel.message, { guild, member });
      const sent = await channel.send({ content: message });
      if (panel.auto_delete_ms && typeof panel.auto_delete_ms === 'number') {
        setTimeout(() => sent.delete().catch(() => undefined), panel.auto_delete_ms);
      }
      sentPanels.push({ name: panel.panel_name, channel: panel.welcome_channel });
    }

    const replyLines: string[] = [];
    replyLines.push(`✅ Sent ${sentPanels.length} test welcome${sentPanels.length === 1 ? '' : 's'}.`);

    if (sentPanels.length > 0) {
      replyLines.push(
        sentPanels
          .map((panel) => `• ${panel.name} → <#${panel.channel}>`)
          .join('\n')
      );
    }

    if (failedPanels.length > 0) {
      replyLines.push(
        `⚠️ Skipped ${failedPanels.length} panel${failedPanels.length === 1 ? '' : 's'}:`
      );
      replyLines.push(
        failedPanels
          .map((panel) => `• ${panel.name} → <#${panel.channel}> (${panel.reason})`)
          .join('\n')
      );
    }

    await interaction.editReply(replyLines.join('\n'));

  } catch (err) {
    await interaction.editReply(`❌ **Error fetching member:** Make sure the user is actually in the server.\n\`\`\`${err}\`\`\``);
  }
}
