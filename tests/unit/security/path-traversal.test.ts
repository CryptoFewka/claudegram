import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { validatePathWithinRoot, PathValidationError } from '../../../src/validation/path.js';

describe('validatePathWithinRoot', () => {
  const testRoot = '/workspace';

  describe('valid paths', () => {
    it('should accept valid relative path', () => {
      const result = validatePathWithinRoot(testRoot, 'src/index.ts');
      expect(result).toBe(path.join(testRoot, 'src/index.ts'));
    });

    it('should accept path equal to root', () => {
      const result = validatePathWithinRoot(testRoot, '.');
      expect(result).toBe(testRoot);
    });

    it('should accept path with .. that stays within root', () => {
      const result = validatePathWithinRoot(testRoot, 'src/../src/index.ts');
      expect(result).toBe(path.join(testRoot, 'src/index.ts'));
    });

    it('should accept deeply nested path', () => {
      const result = validatePathWithinRoot(testRoot, 'a/b/c/d/e/file.txt');
      expect(result).toBe(path.join(testRoot, 'a/b/c/d/e/file.txt'));
    });
  });

  describe('path traversal attempts', () => {
    it('should reject ../../etc/passwd traversal', () => {
      expect(() => {
        validatePathWithinRoot(testRoot, '../../etc/passwd');
      }).toThrow(PathValidationError);
    });

    it('should reject absolute path /etc/passwd', () => {
      expect(() => {
        validatePathWithinRoot(testRoot, '/etc/passwd');
      }).toThrow(PathValidationError);
    });

    it('should reject traversal to parent directory', () => {
      expect(() => {
        validatePathWithinRoot(testRoot, '..');
      }).toThrow(PathValidationError);
    });

    it('should reject traversal with multiple levels', () => {
      expect(() => {
        validatePathWithinRoot(testRoot, '../../../../../../../etc/passwd');
      }).toThrow(PathValidationError);
    });

    it('should reject path that starts inside but escapes', () => {
      expect(() => {
        validatePathWithinRoot(testRoot, 'src/../../etc/passwd');
      }).toThrow(PathValidationError);
    });
  });

  describe('edge cases', () => {
    it('should reject empty path', () => {
      expect(() => {
        validatePathWithinRoot(testRoot, '');
      }).toThrow(PathValidationError);
    });

    it('should reject whitespace-only path', () => {
      expect(() => {
        validatePathWithinRoot(testRoot, '   ');
      }).toThrow(PathValidationError);
    });

    it('should handle path with special characters', () => {
      // Test that paths with special characters are resolved correctly
      // If they resolve within root, they're allowed (file system will reject invalid chars)
      const result = validatePathWithinRoot(testRoot, 'dir/file-name.txt');
      expect(result).toBe(path.join(testRoot, 'dir/file-name.txt'));
    });
  });

  describe('error messages', () => {
    it('should include descriptive error message', () => {
      try {
        validatePathWithinRoot(testRoot, '../../etc/passwd');
        expect.fail('Should have thrown PathValidationError');
      } catch (err) {
        expect(err).toBeInstanceOf(PathValidationError);
        expect((err as Error).message).toContain('Path traversal detected');
        expect((err as Error).message).toContain('../../etc/passwd');
      }
    });
  });
});
