import { describe, it, expect } from 'vitest';
import { isValidUrl } from '../../../src/media/extract.js';
import { SSRF_ATTACK_VECTORS, PRIVATE_IP_RANGES } from '../../helpers/security.js';

describe('URL Validation Security', () => {
  describe('Protocol validation', () => {
    it('should allow http URLs', () => {
      expect(isValidUrl('http://example.com')).toBe(true);
    });

    it('should allow https URLs', () => {
      expect(isValidUrl('https://example.com')).toBe(true);
      expect(isValidUrl('https://reddit.com/r/test')).toBe(true);
    });

    it('should reject file:// protocol', () => {
      expect(isValidUrl('file:///etc/passwd')).toBe(false);
      expect(isValidUrl('file://localhost/etc/passwd')).toBe(false);
    });

    it('should reject ftp:// protocol', () => {
      expect(isValidUrl('ftp://malicious.example.com/file.txt')).toBe(false);
    });

    it('should reject gopher:// protocol', () => {
      expect(isValidUrl('gopher://malicious.example.com/_GET%20/HTTP/1.1')).toBe(false);
    });

    it('should reject data: protocol', () => {
      expect(isValidUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
    });

    it('should reject javascript: protocol', () => {
      expect(isValidUrl('javascript:alert(1)')).toBe(false);
    });

    it('should reject dict:// protocol', () => {
      expect(isValidUrl('dict://localhost:11211/stats')).toBe(false);
    });

    it('should reject ldap:// protocol', () => {
      expect(isValidUrl('ldap://localhost:389/dc=example,dc=com')).toBe(false);
    });

    it('should reject tftp:// protocol', () => {
      expect(isValidUrl('tftp://192.168.1.1/config')).toBe(false);
    });

    it('should reject jar: protocol', () => {
      expect(isValidUrl('jar:http://example.com/evil.jar!/file.txt')).toBe(false);
    });

    it('should reject all SSRF attack vectors', () => {
      for (const attackUrl of SSRF_ATTACK_VECTORS) {
        expect(isValidUrl(attackUrl)).toBe(false);
      }
    });
  });

  describe('Malformed URL handling', () => {
    it('should reject empty string', () => {
      expect(isValidUrl('')).toBe(false);
    });

    it('should reject non-URL string', () => {
      expect(isValidUrl('not-a-url')).toBe(false);
    });

    it('should reject URL without protocol', () => {
      expect(isValidUrl('://missing-protocol')).toBe(false);
    });

    it('should reject invalid URL format', () => {
      expect(isValidUrl('http://')).toBe(false);
      expect(isValidUrl('https://')).toBe(false);
    });
  });

  describe('Edge cases', () => {
    it('should allow URL with port', () => {
      expect(isValidUrl('https://example.com:8080')).toBe(true);
    });

    it('should allow URL with authentication', () => {
      expect(isValidUrl('https://user:pass@example.com')).toBe(true);
    });

    it('should allow URL with fragment', () => {
      expect(isValidUrl('https://example.com#fragment')).toBe(true);
    });

    it('should allow URL with query parameters', () => {
      expect(isValidUrl('https://example.com?foo=bar&baz=qux')).toBe(true);
    });

    it('should allow URL with path', () => {
      expect(isValidUrl('https://example.com/path/to/resource')).toBe(true);
    });
  });

  describe('SSRF documentation (known gaps)', () => {
    // Current isValidUrl only checks protocol, not resolved IP.
    // These tests document the gap for the security audit in Phase 1 Plan 02.
    // Private IPs with http/https protocol will PASS validation (protocol is valid).
    // This is a known limitation that should be flagged during audit.

    it('should allow http://127.0.0.1 (documenting gap - protocol is http)', () => {
      expect(isValidUrl('http://127.0.0.1')).toBe(true);
    });

    it('should allow http://localhost (documenting gap - protocol is http)', () => {
      expect(isValidUrl('http://localhost')).toBe(true);
    });

    it('should allow http://169.254.169.254 (documenting gap - AWS metadata)', () => {
      expect(isValidUrl('http://169.254.169.254')).toBe(true);
    });

    it('should allow private IP ranges with http/https (documenting gap)', () => {
      // These all return TRUE because protocol is valid (http/https)
      // This documents that isValidUrl does NOT protect against SSRF to private IPs
      for (const privateUrl of PRIVATE_IP_RANGES) {
        expect(isValidUrl(privateUrl)).toBe(true);
      }
    });
  });
});

// Note: isValidProtocol in src/reddit/vreddit.ts is a private function with
// identical logic to isValidUrl. It is tested indirectly through the
// executeVReddit function or can be considered covered by these tests.
// We do NOT modify source code to export it - that's Phase 2 work.
