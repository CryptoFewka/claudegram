import { describe, it, expect } from 'vitest';
import * as os from 'os';
import { sanitizeError } from '../../../src/utils/sanitize.js';

describe('Error Sanitization', () => {
  const HOME_DIR = os.homedir();

  describe('Error object handling', () => {
    it('should convert Error object to sanitized string', () => {
      const error = new Error('Test error message');
      const result = sanitizeError(error);
      expect(typeof result).toBe('string');
      expect(result).toBe('Test error message');
    });

    it('should sanitize Error with home directory in message', () => {
      const error = new Error(`File not found: ${HOME_DIR}/secret.txt`);
      const result = sanitizeError(error);
      expect(result).toBe('File not found: ~/secret.txt');
      expect(result).not.toContain(HOME_DIR);
    });

    it('should handle TypeError', () => {
      const error = new TypeError('Cannot read property of undefined');
      const result = sanitizeError(error);
      expect(result).toBe('Cannot read property of undefined');
    });

    it('should handle custom Error subclasses', () => {
      class CustomError extends Error {
        constructor(message: string) {
          super(message);
          this.name = 'CustomError';
        }
      }
      const error = new CustomError('Custom error occurred');
      const result = sanitizeError(error);
      expect(result).toBe('Custom error occurred');
    });
  });

  describe('String handling', () => {
    it('should sanitize plain string', () => {
      const errorString = 'Simple error message';
      const result = sanitizeError(errorString);
      expect(result).toBe('Simple error message');
    });

    it('should sanitize string with home directory', () => {
      const errorString = `Access denied to ${HOME_DIR}/private`;
      const result = sanitizeError(errorString);
      expect(result).toBe('Access denied to ~/private');
      expect(result).not.toContain(HOME_DIR);
    });

    it('should handle empty string', () => {
      const result = sanitizeError('');
      expect(result).toBe('');
    });
  });

  describe('Unknown type handling', () => {
    it('should return "Unknown error" for number', () => {
      const result = sanitizeError(404 as any);
      expect(result).toBe('Unknown error');
    });

    it('should return "Unknown error" for null', () => {
      const result = sanitizeError(null);
      expect(result).toBe('Unknown error');
    });

    it('should return "Unknown error" for undefined', () => {
      const result = sanitizeError(undefined);
      expect(result).toBe('Unknown error');
    });

    it('should return "Unknown error" for boolean', () => {
      const result = sanitizeError(false as any);
      expect(result).toBe('Unknown error');
    });

    it('should return "Unknown error" for plain object', () => {
      const result = sanitizeError({ message: 'error' } as any);
      expect(result).toBe('Unknown error');
    });

    it('should return "Unknown error" for array', () => {
      const result = sanitizeError(['error', 'list'] as any);
      expect(result).toBe('Unknown error');
    });

    it('should return "Unknown error" for Symbol', () => {
      const result = sanitizeError(Symbol('error') as any);
      expect(result).toBe('Unknown error');
    });
  });

  describe('Edge cases', () => {
    it('should handle Error with very long message', () => {
      const longMessage = 'a'.repeat(10000);
      const error = new Error(longMessage);
      const result = sanitizeError(error);
      expect(result).toBe(longMessage);
      expect(result.length).toBe(10000);
    });

    it('should handle Error with multiline message', () => {
      const error = new Error('Line 1\nLine 2\nLine 3');
      const result = sanitizeError(error);
      expect(result).toBe('Line 1\nLine 2\nLine 3');
    });

    it('should handle Error with special characters', () => {
      const error = new Error('Error: $pecial ch@racters! & symbols');
      const result = sanitizeError(error);
      expect(result).toBe('Error: $pecial ch@racters! & symbols');
    });

    it('should handle string with username in path', () => {
      const username = os.userInfo().username;
      const homeDir = os.homedir();
      if (username.length > 2) {
        const errorString = `/home/${username}/file.txt not found`;
        const result = sanitizeError(errorString);

        // Verify username is sanitized (either as ~ or <user>, depending on if it matches HOME_DIR)
        expect(result).not.toContain(username);

        // Should be sanitized to either ~ or /home/<user>
        if (errorString.includes(homeDir)) {
          expect(result.includes('~')).toBe(true);
        } else {
          expect(result).toBe('/home/<user>/file.txt not found');
        }
      }
    });
  });
});
