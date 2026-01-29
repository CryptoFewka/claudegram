/**
 * Allowed external domains for video embeds.
 * Only URLs from these domains (or their subdomains) are permitted.
 */
export const EXTERNAL_EMBED_DOMAINS = new Set([
  'redgifs.com',
  'imgur.com',
  'gfycat.com',
  'streamable.com',
  'v.redd.it',
]);

/**
 * Validates URL for common SSRF attack patterns.
 * Checks protocol, userinfo, hostname, and control characters.
 *
 * @param urlString - The URL to validate
 * @throws Error if URL is unsafe
 *
 * @example
 * ```ts
 * validateUrlSafety('https://example.com/video'); // OK
 * validateUrlSafety('file:///etc/passwd'); // throws
 * validateUrlSafety('http://user:pass@example.com'); // throws
 * ```
 */
export function validateUrlSafety(urlString: string): void {
  let url: URL;

  // Parse URL
  try {
    url = new URL(urlString);
  } catch {
    throw new Error('Invalid URL format');
  }

  // Validate protocol
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`Unsafe protocol: ${url.protocol}`);
  }

  // Validate no userinfo (credentials in URL)
  if (url.username !== '' || url.password !== '') {
    throw new Error('URLs with userinfo (user:pass@) are not allowed');
  }

  // Validate hostname is not empty
  if (!url.hostname || url.hostname.trim() === '') {
    throw new Error('URL hostname cannot be empty');
  }

  // Validate no control characters in URL string
  // Control characters: 0x00-0x1F and 0x7F
   
  if (/[\x00-\x1F\x7F]/.test(urlString)) {
    throw new Error('URLs with control characters are not allowed');
  }
}

/**
 * Checks if a URL's domain is in the allowed external embed domains list.
 * Supports both exact matches and subdomain matches.
 *
 * @param urlString - The URL to check
 * @returns true if domain is allowed, false otherwise
 *
 * @example
 * ```ts
 * isAllowedExternalDomain('https://redgifs.com/video'); // true
 * isAllowedExternalDomain('https://sub.redgifs.com/video'); // true
 * isAllowedExternalDomain('https://evil.com/video'); // false
 * ```
 */
export function isAllowedExternalDomain(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    const hostname = url.hostname.toLowerCase();

    // Check exact match
    if (EXTERNAL_EMBED_DOMAINS.has(hostname)) {
      return true;
    }

    // Check if it's a subdomain of any allowed domain
    for (const allowedDomain of EXTERNAL_EMBED_DOMAINS) {
      if (hostname.endsWith(`.${allowedDomain}`)) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}
