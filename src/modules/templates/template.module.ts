import { GuildMember } from 'discord.js';

export interface TemplateVars {
  new_user: string;
  server_name: string;
}

const DEFAULT_TEMPLATE = 'Welcome {{new_user}} to **{{server_name}}**! 👋';

/** Replaces {{variables}} in a template string. */
export function renderTemplate(template: string, vars: TemplateVars): string {
  return template
    .replace(/\{\{new_user\}\}/g, vars.new_user)
    .replace(/\{\{server_name\}\}/g, vars.server_name);
}

/** Get a simple welcome template. */
export function getTemplate(): { message: string } {
  return { message: DEFAULT_TEMPLATE };
}

/** Build template vars from members. */
export function buildVars(guildName: string, newMember: GuildMember): TemplateVars {
  return {
    new_user: `<@${newMember.id}>`,
    server_name: guildName,
  };
}

