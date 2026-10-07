import { Guild, GuildMember, ChannelType, CategoryChannel } from 'discord.js';
import { getMany } from '../services/neon.service.js';

export interface VariableContext {
  guild: Guild;
  member: GuildMember;
}

const AVAILABLE_VARIABLES: Record<string, string> = {
  user: 'The username of the user',
  username: 'The username of the user',
  usermention: 'Mention the user',
  userid: 'The Discord ID of the user',
  usericon: 'The avatar URL of the user',
  server: 'The name of the server',
  membercount: 'The total number of members in the server',
  createdat: 'The account creation date of the user',
  ruser: 'Mention a random member from configured roles (/smart ruser)',
  rvc: 'Link a random voice channel from configured categories (/smart rvc)',
  // Backward compatibility
  server_name: 'The name of the server (legacy)',
  user_mention: 'Mention the user who joined (legacy)',
  mem_count: 'The total number of members in the server (legacy)',
};

export function getAvailableVariables(): Record<string, string> {
  return AVAILABLE_VARIABLES;
}

async function resolveRandomUser(guild: Guild): Promise<string> {
  const roles = await getMany(
    `SELECT role_id FROM ruser_roles WHERE guild_id = $1`,
    [guild.id]
  );
  if (roles.length === 0) return '';

  const candidates: GuildMember[] = [];
  for (const { role_id } of roles) {
    const role = guild.roles.cache.get(role_id);
    if (role) {
      role.members.forEach(member => {
        if (!member.user.bot && !candidates.some(c => c.id === member.id)) {
          candidates.push(member);
        }
      });
    }
  }

  if (candidates.length === 0) return '';
  const picked = candidates[Math.floor(Math.random() * candidates.length)];
  return `<@${picked.id}>`;
}

async function resolveRandomVC(guild: Guild): Promise<string> {
  const categories = await getMany(
    `SELECT category_id FROM rvc_categories WHERE guild_id = $1`,
    [guild.id]
  );
  if (categories.length === 0) return '';

  const voiceChannels: { id: string }[] = [];
  for (const { category_id } of categories) {
    const category = guild.channels.cache.get(category_id);
    if (category && category.type === ChannelType.GuildCategory) {
      (category as CategoryChannel).children.cache.forEach(ch => {
        if (ch.type === ChannelType.GuildVoice || ch.type === ChannelType.GuildStageVoice) {
          voiceChannels.push(ch);
        }
      });
    }
  }

  if (voiceChannels.length === 0) return '';
  const picked = voiceChannels[Math.floor(Math.random() * voiceChannels.length)];
  return `<#${picked.id}>`;
}

export async function replaceVariables(message: string, context: VariableContext): Promise<string> {
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
    server_name: context.guild.name,
    user_mention: `<@${context.member.id}>`,
    mem_count: context.guild.memberCount.toString(),
  };

  if (message.includes('{ruser}') || message.includes('{{ruser}}')) {
    vars.ruser = await resolveRandomUser(context.guild);
  }
  if (message.includes('{rvc}') || message.includes('{{rvc}}')) {
    vars.rvc = await resolveRandomVC(context.guild);
  }

  let rendered = message;
  for (const [key, val] of Object.entries(vars)) {
    rendered = rendered.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), val);
    rendered = rendered.replace(new RegExp(`\\{${key}\\}`, 'g'), val);
  }
  return rendered;
}

export async function getPreview(message: string, context: VariableContext): Promise<string> {
  return replaceVariables(message, context);
}

export function validateMessage(message: string): { valid: boolean; invalidVars?: string[] } {
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
