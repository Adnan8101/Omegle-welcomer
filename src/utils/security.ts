/**
 * Validate welcome message for dangerous mentions
 * Prevents @everyone, @here, and role mentions
 */
export function validateWelcomeMessageSecurity(message: string): {
  valid: boolean;
  errors?: string[];
} {
  const errors: string[] = [];

  // Check for @everyone
  if (message.includes('@everyone')) {
    errors.push('Cannot use @everyone mentions');
  }

  // Check for @here
  if (message.includes('@here')) {
    errors.push('Cannot use @here mentions');
  }

  // Check for role mentions (<@&ROLE_ID>)
  if (/<@&\d+>/.test(message)) {
    errors.push('Cannot use role mentions');
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Sanitize message by removing dangerous mentions
 * This is a safety measure, but validation should be enforced first
 */
export function sanitizeWelcomeMessage(message: string): string {
  return message
    .replace(/@everyone/g, '[everyone]')
    .replace(/@here/g, '[here]')
    .replace(/<@&\d+>/g, '[role]');
}
