import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { getAvailableVariables } from '../../utils/variables.js';

export const definition = new SlashCommandBuilder()
  .setName('variables')
  .setDescription('Show all available placeholders / variables');

export async function handleVariablesCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const vars = getAvailableVariables();
  const embed = new EmbedBuilder()
    .setTitle('Available Placeholders')
    .setDescription('You can use the following placeholders in your welcome messages and custom embeds. They will be replaced dynamically with user/server/joining information.')
    .setColor(0x5865F2);

  const formattedVars = Object.entries(vars)
    .filter(([name]) => !['server_name', 'user_mention', 'mem_count'].includes(name))
    .map(([name, desc]) => `• **{${name}}** - ${desc}`)
    .join('\n');

  embed.addFields({ name: 'Variables', value: formattedVars });

  await interaction.editReply({ embeds: [embed] });
}
