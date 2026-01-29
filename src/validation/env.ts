/**
 * Creates a minimal environment object for child processes.
 * Filters out sensitive variables (API keys, tokens) to prevent leakage.
 *
 * Only allows essential system variables:
 * - PATH: Required for finding executables
 * - HOME: User home directory
 * - USER: Current user name
 * - TMPDIR: Temporary directory location
 * - LANG, LC_ALL: Locale settings
 * - TZ: Timezone
 *
 * @returns Filtered environment object safe for child processes
 *
 * @example
 * ```ts
 * import { execFile } from 'child_process';
 * import { createMinimalEnv } from './validation/env.js';
 *
 * // Safe: API keys won't leak to child process
 * execFile('curl', args, { env: createMinimalEnv() });
 * ```
 */
export function createMinimalEnv(): Record<string, string> {
  const allowedKeys = ['PATH', 'HOME', 'USER', 'TMPDIR', 'LANG', 'LC_ALL', 'TZ'];

  const minimalEnv: Record<string, string> = {};

  for (const key of allowedKeys) {
    const value = process.env[key];
    if (value !== undefined) {
      minimalEnv[key] = value;
    }
  }

  return minimalEnv;
}
