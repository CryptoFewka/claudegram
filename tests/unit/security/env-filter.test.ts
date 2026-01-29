import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createMinimalEnv } from '../../../src/validation/env.js';

describe('createMinimalEnv', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original env
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    // Restore original env
    process.env = originalEnv;
  });

  it('should return only allowed keys that exist in process.env', () => {
    process.env = {
      PATH: '/usr/bin',
      HOME: '/home/user',
      USER: 'testuser',
      TMPDIR: '/tmp',
      LANG: 'en_US.UTF-8',
      LC_ALL: 'en_US.UTF-8',
      TZ: 'UTC',
    };

    const result = createMinimalEnv();

    expect(result).toEqual({
      PATH: '/usr/bin',
      HOME: '/home/user',
      USER: 'testuser',
      TMPDIR: '/tmp',
      LANG: 'en_US.UTF-8',
      LC_ALL: 'en_US.UTF-8',
      TZ: 'UTC',
    });
  });

  it('should NOT include TELEGRAM_BOT_TOKEN', () => {
    process.env = {
      PATH: '/usr/bin',
      TELEGRAM_BOT_TOKEN: 'secret-token-12345',
    };

    const result = createMinimalEnv();

    expect(result).toEqual({ PATH: '/usr/bin' });
    expect(result.TELEGRAM_BOT_TOKEN).toBeUndefined();
  });

  it('should NOT include ANTHROPIC_API_KEY', () => {
    process.env = {
      PATH: '/usr/bin',
      ANTHROPIC_API_KEY: 'sk-ant-secret-key',
    };

    const result = createMinimalEnv();

    expect(result).toEqual({ PATH: '/usr/bin' });
    expect(result.ANTHROPIC_API_KEY).toBeUndefined();
  });

  it('should NOT include GROQ_API_KEY', () => {
    process.env = {
      PATH: '/usr/bin',
      GROQ_API_KEY: 'gsk-secret-key',
    };

    const result = createMinimalEnv();

    expect(result).toEqual({ PATH: '/usr/bin' });
    expect(result.GROQ_API_KEY).toBeUndefined();
  });

  it('should NOT include OPENAI_API_KEY', () => {
    process.env = {
      PATH: '/usr/bin',
      OPENAI_API_KEY: 'sk-openai-secret',
    };

    const result = createMinimalEnv();

    expect(result).toEqual({ PATH: '/usr/bin' });
    expect(result.OPENAI_API_KEY).toBeUndefined();
  });

  it('should handle missing allowed keys gracefully', () => {
    process.env = {
      PATH: '/usr/bin',
      // Other allowed keys are missing
    };

    const result = createMinimalEnv();

    expect(result).toEqual({ PATH: '/usr/bin' });
    expect(Object.keys(result)).toHaveLength(1);
  });

  it('should return empty object if no allowed keys exist', () => {
    process.env = {
      TELEGRAM_BOT_TOKEN: 'secret',
      ANTHROPIC_API_KEY: 'secret',
      RANDOM_VAR: 'value',
    };

    const result = createMinimalEnv();

    expect(result).toEqual({});
    expect(Object.keys(result)).toHaveLength(0);
  });

  it('should not be affected by additional environment variables', () => {
    process.env = {
      PATH: '/usr/bin',
      HOME: '/home/user',
      DANGEROUS_VAR: 'malicious',
      AWS_SECRET_KEY: 'secret',
      DATABASE_PASSWORD: 'password',
    };

    const result = createMinimalEnv();

    expect(result).toEqual({
      PATH: '/usr/bin',
      HOME: '/home/user',
    });
    expect(result.DANGEROUS_VAR).toBeUndefined();
    expect(result.AWS_SECRET_KEY).toBeUndefined();
  });
});
