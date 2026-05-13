/**
 * Shared TypeScript types used across the project.
 * GuildConfig mirrors the Prisma model so files can reference it
 * without depending on the generated @prisma/client (which requires
 * prisma generate to have been run).
 */
export interface GuildConfig {
  guildId: string;
  welcomeChannel: string | null;
  onboardingRole: string | null;
  cooldownLimit: number;
  raidThreshold: number;
  activityEnabled: boolean;
  vcEnabled: boolean;
  roleEnabled: boolean;
}

export interface Template {
  id: string;
  guildId: string;
  message: string;
}
