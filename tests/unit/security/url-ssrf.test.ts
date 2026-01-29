import { describe, it, expect } from 'vitest';
import { validateUrlSafety, isAllowedExternalDomain, EXTERNAL_EMBED_DOMAINS } from '../../../src/validation/url.js';

describe('validateUrlSafety', () => {
  it('accepts valid https URL', () => {
    expect(() => validateUrlSafety('https://example.com/path')).not.toThrow();
  });

  it('accepts valid http URL', () => {
    expect(() => validateUrlSafety('http://example.com/path')).not.toThrow();
  });

  it('rejects file:// protocol', () => {
    expect(() => validateUrlSafety('file:///etc/passwd')).toThrow('Unsafe protocol');
  });

  it('rejects ftp:// protocol', () => {
    expect(() => validateUrlSafety('ftp://example.com/file')).toThrow('Unsafe protocol');
  });

  it('rejects javascript: protocol', () => {
    expect(() => validateUrlSafety('javascript:alert(1)')).toThrow('Unsafe protocol');
  });

  it('rejects URL with userinfo', () => {
    expect(() => validateUrlSafety('https://user:pass@example.com/path')).toThrow('userinfo');
  });

  it('rejects URL with username only', () => {
    expect(() => validateUrlSafety('https://user@example.com/path')).toThrow('userinfo');
  });

  it('accepts URL with path starting with slash (parsed as hostname)', () => {
    // Note: 'https:///path' is parsed as hostname='path', not empty hostname
    // This test verifies the URL parser behavior
    expect(() => validateUrlSafety('https:///path')).not.toThrow();
  });

  it('rejects URL with null byte', () => {
    expect(() => validateUrlSafety('https://example.com/\0path')).toThrow('control characters');
  });

  it('rejects URL with newline', () => {
    expect(() => validateUrlSafety('https://example.com/\npath')).toThrow('control characters');
  });

  it('rejects URL with carriage return', () => {
    expect(() => validateUrlSafety('https://example.com/\rpath')).toThrow('control characters');
  });

  it('rejects URL with tab character', () => {
    expect(() => validateUrlSafety('https://example.com/\tpath')).toThrow('control characters');
  });

  it('rejects malformed URL', () => {
    expect(() => validateUrlSafety('not a url')).toThrow('Invalid URL format');
  });

  it('accepts URL with query parameters', () => {
    expect(() => validateUrlSafety('https://example.com/path?foo=bar&baz=qux')).not.toThrow();
  });

  it('accepts URL with fragment', () => {
    expect(() => validateUrlSafety('https://example.com/path#section')).not.toThrow();
  });
});

describe('isAllowedExternalDomain', () => {
  it('returns true for exact match', () => {
    expect(isAllowedExternalDomain('https://redgifs.com/video')).toBe(true);
  });

  it('returns true for subdomain match', () => {
    expect(isAllowedExternalDomain('https://sub.redgifs.com/video')).toBe(true);
  });

  it('returns true for nested subdomain', () => {
    expect(isAllowedExternalDomain('https://a.b.redgifs.com/video')).toBe(true);
  });

  it('returns false for non-allowed domain', () => {
    expect(isAllowedExternalDomain('https://evil.com/video')).toBe(false);
  });

  it('returns false for similar but different domain', () => {
    expect(isAllowedExternalDomain('https://fakeredgifs.com/video')).toBe(false);
  });

  it('returns false for domain that contains allowed domain but is not subdomain', () => {
    expect(isAllowedExternalDomain('https://notredgifs.com/video')).toBe(false);
  });

  it('returns false for malformed URL', () => {
    expect(isAllowedExternalDomain('not a url')).toBe(false);
  });

  it('is case insensitive', () => {
    expect(isAllowedExternalDomain('https://RedGifs.COM/video')).toBe(true);
  });

  it('works for all allowed domains', () => {
    for (const domain of EXTERNAL_EMBED_DOMAINS) {
      expect(isAllowedExternalDomain(`https://${domain}/video`)).toBe(true);
    }
  });

  it('returns true for imgur.com', () => {
    expect(isAllowedExternalDomain('https://imgur.com/gallery/abc')).toBe(true);
  });

  it('returns true for v.redd.it', () => {
    expect(isAllowedExternalDomain('https://v.redd.it/abc123')).toBe(true);
  });

  it('returns true for streamable.com subdomain', () => {
    expect(isAllowedExternalDomain('https://cdn.streamable.com/video')).toBe(true);
  });
});
