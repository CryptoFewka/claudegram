import { z } from 'zod';

/**
 * URL schema with security validations.
 * - Rejects null bytes, newlines, and control characters
 * - Only allows http/https protocols
 * - Max length 2048 characters
 */
export const urlSchema = z
  .string()
  .min(1, 'URL cannot be empty')
  .max(2048, 'URL too long (max 2048 characters)')
  .refine((s) => !s.includes('\0'), { message: 'Null bytes not allowed in URL' })
  .refine(
    (s) => !s.includes('\n') && !s.includes('\r'),
    { message: 'Newlines not allowed in URL' }
  )
  .refine(
    (s) => {
      try {
        const u = new URL(s);
        return u.protocol === 'http:' || u.protocol === 'https:';
      } catch {
        return false;
      }
    },
    { message: 'Only http/https URLs allowed' }
  );

/**
 * File path schema with security validations.
 * - Rejects null bytes and newlines
 * - Max length 500 characters
 */
export const filePathSchema = z
  .string()
  .min(1, 'Path cannot be empty')
  .max(500, 'Path too long (max 500 characters)')
  .refine((s) => !s.includes('\0'), { message: 'Null bytes not allowed in path' })
  .refine((s) => !s.includes('\n'), { message: 'Newlines not allowed in path' });

/**
 * Reddit input schema for URL or post ID.
 * - Trims whitespace
 * - Max length 2048 characters
 */
export const redditInputSchema = z
  .string()
  .min(1, 'Reddit input cannot be empty')
  .max(2048, 'Reddit input too long')
  .trim();

/**
 * Creates a content size limit schema.
 * Validates that string length doesn't exceed the specified byte limit.
 *
 * @param maxBytes - Maximum allowed byte size
 * @returns Zod schema that validates string length
 */
export function contentSizeLimitSchema(maxBytes: number) {
  return z.string().refine(
    (s) => s.length <= maxBytes,
    {
      message: `Content too large (max ${maxBytes} bytes)`,
    }
  );
}
