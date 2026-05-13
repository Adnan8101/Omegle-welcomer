import { Guild, GuildMember } from 'discord.js';

export interface VariableContext {
  guild: Guild;
  member: GuildMember;
}

const AVAILABLE_VARIABLES = {
  server_name: 'The name of the server',
  user: 'The username of the user joining',
  user_mention: 'Mention the user who joined',
  mem_count: 'The total number of members in the server',
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
  return message
    .replace(/\{\{server_name\}\}/g, context.guild.name)
    .replace(/\{\{user\}\}/g, context.member.user.username)
    .replace(/\{\{user_mention\}\}/g, `<@${context.member.id}>`)
    .replace(/\{\{mem_count\}\}/g, context.guild.memberCount.toString());
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
  const variablePattern = /\{\{([^}]+)\}\}/g;
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
