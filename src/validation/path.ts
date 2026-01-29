import * as path from 'path';

/**
 * Error thrown when path validation fails (path traversal attempt)
 */
export class PathValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PathValidationError';
  }
}

/**
 * Validates that a user-provided path stays within the specified root directory.
 * Prevents path traversal attacks (e.g., ../../etc/passwd).
 *
 * @param rootDir - The root directory that the path must stay within
 * @param userPath - The user-provided path to validate
 * @returns The resolved absolute path if validation passes
 * @throws {PathValidationError} If the path attempts to escape the root directory
 *
 * @example
 * ```ts
 * // Valid: stays within root
 * validatePathWithinRoot('/workspace', 'src/index.ts')
 * // => '/workspace/src/index.ts'
 *
 * // Invalid: traversal attempt
 * validatePathWithinRoot('/workspace', '../../etc/passwd')
 * // => throws PathValidationError
 * ```
 */
export function validatePathWithinRoot(rootDir: string, userPath: string): string {
  // Handle empty paths
  if (!userPath || userPath.trim() === '') {
    throw new PathValidationError('Path cannot be empty');
  }

  // Resolve root to absolute path
  const resolvedRoot = path.resolve(rootDir);

  // Resolve target path relative to root
  const resolvedPath = path.resolve(rootDir, userPath);

  // Check if resolved path is within root directory
  // Must start with root + separator OR be exactly equal to root
  const isWithinRoot =
    resolvedPath.startsWith(resolvedRoot + path.sep) ||
    resolvedPath === resolvedRoot;

  if (!isWithinRoot) {
    throw new PathValidationError(
      `Path traversal detected: "${userPath}" resolves outside allowed directory`
    );
  }

  return resolvedPath;
}
