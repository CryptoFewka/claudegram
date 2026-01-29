import { describe, it, expect, vi } from 'vitest';
import {
  callExternalService,
  ServiceUnavailableError,
  formatServiceError,
} from '../../../src/features/errors.js';

describe('Graceful Degradation', () => {
  describe('callExternalService', () => {
    it('should return result when operation succeeds', async () => {
      const operation = vi.fn(async () => 'success');
      const result = await callExternalService('TestService', operation);
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should throw ServiceUnavailableError when operation fails', async () => {
      const operation = vi.fn(async () => {
        throw new Error('network error');
      });

      await expect(
        callExternalService('TestService', operation)
      ).rejects.toThrow(ServiceUnavailableError);
    });

    it('should set service property on error', async () => {
      const operation = vi.fn(async () => {
        throw new Error('network error');
      });

      try {
        await callExternalService('TestService', operation);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ServiceUnavailableError);
        if (error instanceof ServiceUnavailableError) {
          expect(error.service).toBe('TestService');
        }
      }
    });

    it('should preserve original error as cause', async () => {
      const originalError = new Error('network error');
      const operation = vi.fn(async () => {
        throw originalError;
      });

      try {
        await callExternalService('TestService', operation);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ServiceUnavailableError);
        if (error instanceof ServiceUnavailableError) {
          expect(error.cause).toBe(originalError);
        }
      }
    });

    it('should log error before throwing', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const operation = vi.fn(async () => {
        throw new Error('network error');
      });

      try {
        await callExternalService('TestService', operation);
      } catch {
        // Expected
      }

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[TestService] Service error:',
        expect.any(String)
      );
      consoleErrorSpy.mockRestore();
    });
  });

  describe('formatServiceError', () => {
    it('should format ServiceUnavailableError with friendly message', () => {
      const error = new ServiceUnavailableError('Groq');
      const formatted = formatServiceError(error);
      expect(formatted).toBe('Groq is temporarily unavailable. Please try again later.');
    });

    it('should sanitize generic errors', () => {
      const error = new Error('raw error message');
      const formatted = formatServiceError(error);
      expect(formatted).toContain('raw error message');
    });

    it('should handle different service names', () => {
      const freediumError = new ServiceUnavailableError('Freedium');
      expect(formatServiceError(freediumError)).toContain('Freedium');

      const redditError = new ServiceUnavailableError('Reddit');
      expect(formatServiceError(redditError)).toContain('Reddit');
    });
  });

  describe('ServiceUnavailableError', () => {
    it('should have correct properties', () => {
      const error = new ServiceUnavailableError('TestService');
      expect(error.name).toBe('ServiceUnavailableError');
      expect(error.service).toBe('TestService');
      expect(error.message).toBe('TestService is currently unavailable');
    });

    it('should accept optional cause parameter', () => {
      const cause = new Error('underlying error');
      const error = new ServiceUnavailableError('TestService', cause);
      expect(error.cause).toBe(cause);
    });
  });
});
