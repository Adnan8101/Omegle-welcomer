import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
} from 'discord.js';
import { getAvailableVariables } from '../../utils/variables.js';

export const definition = new SlashCommandBuilder()
  .setName('variables')
  .setDescription('Show all available placeholders / variables');

export async function handleVariablesCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const vars = getAvailableVariables();

  const standardVars = Object.entries(vars)
    .filter(([name]) => !['server_name', 'user_mention', 'mem_count', 'username'].includes(name))
    .map(([name, desc]) => `\`{${name}}\` — ${desc}`)
    .join('\n');

  const container = new ContainerBuilder()
    .setAccentColor(0x5865F2)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('# 📝 Available Variables')
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        'Use these placeholders in welcome messages and custom embeds. They are replaced dynamically when a member joins.'
      )
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(standardVars)
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        '-# Both `{variable}` and `{{variable}}` syntax are supported.'
      )
    );

  await interaction.reply({
    components: [container],
    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
  });
}
