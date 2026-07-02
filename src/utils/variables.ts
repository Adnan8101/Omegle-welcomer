import { Guild, GuildMember } from 'discord.js';

export interface VariableContext {
  guild: Guild;
  member: GuildMember;
}

const AVAILABLE_VARIABLES = {
  user: 'The username of the user',
  username: 'The username of the user',
  usermention: 'Mention the user',
  userid: 'The Discord ID of the user',
  usericon: 'The avatar URL of the user',
  server: 'The name of the server',
  membercount: 'The total number of members in the server',
  createdat: 'The account creation date of the user',
  // Backward compatibility
  server_name: 'The name of the server (legacy)',
  user_mention: 'Mention the user who joined (legacy)',
  mem_count: 'The total number of members in the server (legacy)',
};

/**
 * Get list of available variables
 */
export function getAvailableVariables(): Record<string, string> {
  return AVAILABLE_VARIABLES;
}

/**
 * Replace all variables in a message with actual values
 */
export function replaceVariables(message: string, context: VariableContext): string {
  if (!message) return '';
  const vars: Record<string, string> = {
    user: context.member.user.username,
    username: context.member.user.username,
    usermention: `<@${context.member.id}>`,
    userid: context.member.id,
    usericon: context.member.user.displayAvatarURL({ forceStatic: false }) || '',
    server: context.guild.name,
    membercount: context.guild.memberCount.toString(),
    createdat: context.member.user.createdAt.toDateString(),
    // Backward compatibility
    server_name: context.guild.name,
    user_mention: `<@${context.member.id}>`,
    mem_count: context.guild.memberCount.toString(),
  };

  let rendered = message;
  for (const [key, val] of Object.entries(vars)) {
    // Escape regex characters just in case, though key contains only safe chars
    rendered = rendered.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), val);
    rendered = rendered.replace(new RegExp(`\\{${key}\\}`, 'g'), val);
  }
  return rendered;
}

/**
 * Get a preview of the message with sample data
 */
export function getPreview(message: string, context: VariableContext): string {
  return replaceVariables(message, context);
}

/**
 * Validate if a message contains only valid variables
 */
export function validateMessage(message: string): { valid: boolean; invalidVars?: string[] } {
  // Regex to match both {{var}} and {var}
  const variablePattern = /\{+([a-zA-Z0-9_]+)\}+/g;
  const matches = message.matchAll(variablePattern);
  
  const invalidVars: string[] = [];
  for (const match of matches) {
    const varName = match[1];
    if (!AVAILABLE_VARIABLES.hasOwnProperty(varName)) {
      invalidVars.push(varName);
    }
  }

  return {
    valid: invalidVars.length === 0,
    invalidVars: invalidVars.length > 0 ? invalidVars : undefined,
  };
}
