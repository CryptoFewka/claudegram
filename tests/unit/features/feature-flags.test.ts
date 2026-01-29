import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isFeatureEnabled, requireFeature, FeatureDisabledError } from '../../../src/features/flags.js';

// Mock the config module
vi.mock('../../../src/config.js', () => ({
  config: {
    FEATURE_REDDIT: true,
    FEATURE_MEDIUM: true,
    FEATURE_TTS: true,
    FEATURE_EXTRACT: true,
  },
}));

describe('Feature Flags', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  describe('isFeatureEnabled', () => {
    it('should return true when feature is enabled', async () => {
      const { config } = await import('../../../src/config.js');
      config.FEATURE_REDDIT = true;

      const { isFeatureEnabled } = await import('../../../src/features/flags.js');
      expect(isFeatureEnabled('reddit')).toBe(true);
    });

    it('should return false when feature is disabled', async () => {
      const { config } = await import('../../../src/config.js');
      config.FEATURE_REDDIT = false;

      const { isFeatureEnabled } = await import('../../../src/features/flags.js');
      expect(isFeatureEnabled('reddit')).toBe(false);
    });

    it('should check all four features', async () => {
      const { config } = await import('../../../src/config.js');
      config.FEATURE_REDDIT = true;
      config.FEATURE_MEDIUM = true;
      config.FEATURE_TTS = true;
      config.FEATURE_EXTRACT = true;

      const { isFeatureEnabled } = await import('../../../src/features/flags.js');
      expect(isFeatureEnabled('reddit')).toBe(true);
      expect(isFeatureEnabled('medium')).toBe(true);
      expect(isFeatureEnabled('tts')).toBe(true);
      expect(isFeatureEnabled('extract')).toBe(true);
    });
  });

  describe('requireFeature', () => {
    it('should not throw when feature is enabled', async () => {
      const { config } = await import('../../../src/config.js');
      config.FEATURE_REDDIT = true;

      const { requireFeature } = await import('../../../src/features/flags.js');
      expect(() => requireFeature('reddit')).not.toThrow();
    });

    it('should throw FeatureDisabledError when feature is disabled', async () => {
      const { config } = await import('../../../src/config.js');
      config.FEATURE_REDDIT = false;

      const { requireFeature, FeatureDisabledError } = await import('../../../src/features/flags.js');
      expect(() => requireFeature('reddit')).toThrow(FeatureDisabledError);
    });

    it('should throw error with correct message', async () => {
      const { config } = await import('../../../src/config.js');
      config.FEATURE_MEDIUM = false;

      const { requireFeature } = await import('../../../src/features/flags.js');
      expect(() => requireFeature('medium')).toThrow('medium feature is currently disabled');
    });
  });

  describe('FeatureDisabledError', () => {
    it('should have correct properties', () => {
      const error = new FeatureDisabledError('reddit');
      expect(error.name).toBe('FeatureDisabledError');
      expect(error.feature).toBe('reddit');
      expect(error.message).toBe('reddit feature is currently disabled');
    });
  });
});
