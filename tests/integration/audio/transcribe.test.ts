import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { transcribeFile, downloadTelegramAudio } from '../../../src/audio/transcribe.js';
import * as childProcess from 'child_process';
import * as fs from 'fs';

// Mock modules
vi.mock('child_process');
vi.mock('fs');
vi.mock('../../../src/config.js', () => ({
  config: {
    GROQ_API_KEY: 'test-api-key',
    VOICE_TIMEOUT_MS: 30000,
    VOICE_LANGUAGE: 'en'
  }
}));
vi.mock('../../../src/utils/download.js', () => ({
  downloadFileSecure: vi.fn(),
  getTelegramFileUrl: vi.fn((token: string, filePath: string) => `https://api.telegram.org/file/bot${token}/${filePath}`)
}));

describe('Voice Transcription (Regression)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Transcription happy path', () => {
    it('transcribes audio file and returns text', async () => {
      const mockTranscript = {
        text: 'Hello, this is a test transcription of the audio file.'
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockTranscript
      });

      vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from('fake audio data'));

      const result = await transcribeFile('/tmp/test-audio.mp3');

      expect(result).toBe('Hello, this is a test transcription of the audio file.');
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('groq.com'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-api-key'
          })
        })
      );
    });

    it('uses correct API endpoint and headers', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ text: 'Test' })
      });

      vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from('audio'));

      await transcribeFile('/tmp/audio.mp3');

      expect(fetch).toHaveBeenCalledWith(
        'https://api.groq.com/openai/v1/audio/transcriptions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-api-key'
          })
        })
      );
    });

    it('accepts custom timeout option', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ text: 'Transcribed with custom timeout' })
      });

      vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from('audio'));

      const result = await transcribeFile('/tmp/audio.mp3', {
        timeoutMs: 60000
      });

      expect(result).toBe('Transcribed with custom timeout');
    });
  });

  describe('Error handling', () => {
    it('throws on 400 bad request', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => 'Invalid audio format'
      });

      vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from('invalid audio'));

      await expect(
        transcribeFile('/tmp/invalid.mp3')
      ).rejects.toThrow('Groq Whisper API error 400');
    });

    it('throws on 429 rate limited', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        text: async () => 'Rate limit exceeded'
      });

      vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from('audio'));

      await expect(
        transcribeFile('/tmp/audio.mp3')
      ).rejects.toThrow('Groq Whisper API error 429');
    });

    it('throws on 500 server error', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal server error'
      });

      vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from('audio'));

      await expect(
        transcribeFile('/tmp/audio.mp3')
      ).rejects.toThrow('Groq Whisper API error 500');
    });

    it('throws on network timeout', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Timeout'));

      vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from('audio'));

      await expect(
        transcribeFile('/tmp/audio.mp3')
      ).rejects.toThrow('Timeout');
    });

    it('throws when file not found', async () => {
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error('ENOENT: no such file or directory');
      });

      await expect(
        transcribeFile('/tmp/nonexistent.mp3')
      ).rejects.toThrow('ENOENT');
    });

    it('throws on empty transcription when allowEmpty is false', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ text: '' })
      });

      vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from('audio'));

      await expect(
        transcribeFile('/tmp/audio.mp3', { allowEmpty: false })
      ).rejects.toThrow('Empty transcription result');
    });

    it('returns empty string when allowEmpty is true', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ text: '' })
      });

      vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from('audio'));

      const result = await transcribeFile('/tmp/audio.mp3', { allowEmpty: true });

      expect(result).toBe('');
    });

    it('requires GROQ_API_KEY to be configured', async () => {
      // Note: We cannot easily test missing API key since config is loaded at module import time
      // This test verifies that the happy path requires the key we mocked
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ text: 'Test' })
      });

      vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from('audio'));

      const result = await transcribeFile('/tmp/audio.mp3');

      expect(result).toBe('Test');
      expect(fetch).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-api-key'
          })
        })
      );
    });
  });

  describe('File validation', () => {
    it('handles large files', async () => {
      // Create a large buffer (30MB)
      const largeBuffer = Buffer.alloc(30 * 1024 * 1024);

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ text: 'Large file transcribed' })
      });

      vi.mocked(fs.readFileSync).mockReturnValue(largeBuffer);

      const result = await transcribeFile('/tmp/large-audio.mp3');

      expect(result).toBe('Large file transcribed');
    });

    it('handles empty file gracefully', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ text: '' })
      });

      vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from(''));

      const result = await transcribeFile('/tmp/empty.mp3', { allowEmpty: true });

      expect(result).toBe('');
    });
  });

  describe('Telegram audio download', () => {
    it('downloads audio file using download utility', async () => {
      const { downloadFileSecure } = await import('../../../src/utils/download.js');

      vi.mocked(downloadFileSecure).mockResolvedValue(undefined);

      await downloadTelegramAudio('test-bot-token', 'path/to/audio.ogg', '/tmp/download.ogg');

      expect(downloadFileSecure).toHaveBeenCalledWith(
        expect.stringContaining('api.telegram.org'),
        '/tmp/download.ogg'
      );
    });

    it('throws on download failure', async () => {
      const { downloadFileSecure } = await import('../../../src/utils/download.js');

      vi.mocked(downloadFileSecure).mockRejectedValue(new Error('Download failed'));

      await expect(
        downloadTelegramAudio('test-bot-token', 'path/to/audio.ogg', '/tmp/download.ogg')
      ).rejects.toThrow('Download failed');
    });
  });
});
