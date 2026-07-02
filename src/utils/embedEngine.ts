import { EmbedBuilder, Guild, GuildMember } from 'discord.js';
import { replaceVariables } from './variables.js';

export interface EmbedData {
  title?: string | null;
  description?: string | null;
  color?: string | null;
  thumbnail?: string | null;
  image?: string | null;
  author_name?: string | null;
  author_icon?: string | null;
  author_url?: string | null;
  footer_text?: string | null;
  footer_icon?: string | null;
  timestamp_enabled?: boolean | null;
}

export function isValidHexColor(colorStr: string): boolean {
  return /^#?[0-9A-Fa-f]{6}$/.test(colorStr);
}

export function resolveColor(colorStr: string | null | undefined): number | null {
  if (!colorStr) return null;
  const hex = colorStr.replace('#', '').trim();
  const num = parseInt(hex, 16);
  if (isNaN(num)) return null;
  return num;
}

export function isValidUrl(urlStr: string): boolean {
  if (!urlStr) return false;
  try {
    new URL(urlStr);
    return true;
  } catch {
    return false;
  }
}

export function renderEmbed(
  embedData: EmbedData,
  context: { guild: Guild; member: GuildMember }
): EmbedBuilder {
  const embed = new EmbedBuilder();

  if (embedData.title) {
    embed.setTitle(replaceVariables(embedData.title, context));
  }
  if (embedData.description) {
    embed.setDescription(replaceVariables(embedData.description, context));
  }
  if (embedData.color && isValidHexColor(embedData.color)) {
    const colorVal = resolveColor(embedData.color);
    if (colorVal !== null) {
      embed.setColor(colorVal);
    }
  }
  if (embedData.thumbnail) {
    const resolvedUrl = replaceVariables(embedData.thumbnail, context);
    if (isValidUrl(resolvedUrl)) {
      embed.setThumbnail(resolvedUrl);
    }
  }
  if (embedData.image) {
    const resolvedUrl = replaceVariables(embedData.image, context);
    if (isValidUrl(resolvedUrl)) {
      embed.setImage(resolvedUrl);
    }
  }
  if (embedData.author_name) {
    const name = replaceVariables(embedData.author_name, context);
    const iconURL = embedData.author_icon ? replaceVariables(embedData.author_icon, context) : undefined;
    const url = embedData.author_url ? replaceVariables(embedData.author_url, context) : undefined;
    embed.setAuthor({
      name,
      iconURL: iconURL && isValidUrl(iconURL) ? iconURL : undefined,
      url: url && isValidUrl(url) ? url : undefined,
    });
  }
  if (embedData.footer_text) {
    const text = replaceVariables(embedData.footer_text, context);
    const iconURL = embedData.footer_icon ? replaceVariables(embedData.footer_icon, context) : undefined;
    embed.setFooter({
      text,
      iconURL: iconURL && isValidUrl(iconURL) ? iconURL : undefined,
    });
  }
  if (embedData.timestamp_enabled) {
    embed.setTimestamp();
  }

  // Fallback if embed is empty (Discord throws error for empty embeds)
  if (
    !embedData.title &&
    !embedData.description &&
    !embedData.author_name &&
    !embedData.footer_text &&
    !embedData.image &&
    !embedData.thumbnail
  ) {
    embed.setTitle('Empty Embed Preview');
    embed.setDescription('Use the buttons below to customize this embed.');
  }

  return embed;
}
