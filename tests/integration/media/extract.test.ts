import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { extractMedia, detectPlatform, isValidUrl, cleanupExtractResult } from '../../../src/media/extract.js';
import * as childProcess from 'child_process';
import * as fs from 'fs';

// Mock modules
vi.mock('child_process');
vi.mock('fs');

describe('Media Extract Pipeline (Regression)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Platform detection (detectPlatform)', () => {
    it('detects YouTube URLs', () => {
      expect(detectPlatform('https://youtube.com/watch?v=abc123')).toBe('youtube');
      expect(detectPlatform('https://www.youtube.com/watch?v=abc123')).toBe('youtube');
      expect(detectPlatform('https://youtu.be/abc123')).toBe('youtube');
      expect(detectPlatform('https://youtube.com/shorts/abc123')).toBe('youtube');
      expect(detectPlatform('https://youtube-nocookie.com/embed/abc123')).toBe('youtube');
    });

    it('detects Instagram URLs', () => {
      expect(detectPlatform('https://instagram.com/p/abc123')).toBe('instagram');
      expect(detectPlatform('https://www.instagram.com/reel/abc123')).toBe('instagram');
      expect(detectPlatform('https://instagr.am/p/abc123')).toBe('instagram');
    });

    it('detects TikTok URLs', () => {
      expect(detectPlatform('https://tiktok.com/@user/video/123')).toBe('tiktok');
      expect(detectPlatform('https://www.tiktok.com/@user/video/123')).toBe('tiktok');
      expect(detectPlatform('https://vm.tiktok.com/abc123')).toBe('tiktok');
    });

    it('returns unknown for unrecognized URLs', () => {
      expect(detectPlatform('https://example.com/video')).toBe('unknown');
      expect(detectPlatform('https://vimeo.com/123456')).toBe('unknown');
    });
  });

  describe('URL validation (isValidUrl)', () => {
    it('accepts valid http/https URLs', () => {
      expect(isValidUrl('https://example.com')).toBe(true);
      expect(isValidUrl('http://example.com')).toBe(true);
    });

    it('rejects invalid protocols', () => {
      expect(isValidUrl('file:///etc/passwd')).toBe(false);
      expect(isValidUrl('ftp://example.com')).toBe(false);
      expect(isValidUrl('javascript:alert(1)')).toBe(false);
    });

    it('rejects malformed URLs', () => {
      expect(isValidUrl('not-a-url')).toBe(false);
      expect(isValidUrl('')).toBe(false);
      expect(isValidUrl('htp://example.com')).toBe(false);
    });
  });

  describe('extractMedia happy path', () => {
    it('extracts video with metadata', async () => {
      // Mock yt-dlp metadata fetch
      let callCount = 0;
      const mockExecFile = vi.fn((cmd: string, args: string[], opts: any, callback: any) => {
        callCount++;
        if (cmd === 'yt-dlp' && args.includes('--no-download')) {
          // Metadata fetch
          callback(null, 'Test Video Title\n120.5', '');
        } else if (cmd === 'yt-dlp') {
          // Video download
          callback(null, '', '');
        } else {
          callback(new Error(`Unexpected command: ${cmd}`), '', '');
        }
      });
      vi.mocked(childProcess.execFile).mockImplementation(mockExecFile);

      vi.mocked(fs.mkdtempSync).mockReturnValue('/tmp/claudegram-extract-123');
      vi.mocked(fs.readdirSync).mockReturnValue(['video.mp4'] as any);
      vi.mocked(fs.statSync).mockReturnValue({ size: 10 * 1024 * 1024 } as fs.Stats);
      vi.mocked(fs.existsSync).mockReturnValue(false); // No cookies

      const result = await extractMedia({
        url: 'https://youtube.com/watch?v=abc123',
        mode: 'video'
      });

      expect(result.platform).toBe('youtube');
      expect(result.title).toBe('Test Video Title');
      expect(result.duration).toBeCloseTo(120.5);
      expect(result.videoPath).toContain('video.mp4');
    });

    it('extracts audio with metadata', async () => {
      let callCount = 0;
      const mockExecFile = vi.fn((cmd: string, args: string[], opts: any, callback: any) => {
        callCount++;
        if (cmd === 'yt-dlp' && args.includes('--no-download')) {
          callback(null, 'Audio Track\n180', '');
        } else if (cmd === 'yt-dlp' && args.includes('-x')) {
          // Audio extraction
          callback(null, '', '');
        } else {
          callback(new Error(`Unexpected: ${cmd}`), '', '');
        }
      });
      vi.mocked(childProcess.execFile).mockImplementation(mockExecFile);

      vi.mocked(fs.mkdtempSync).mockReturnValue('/tmp/claudegram-extract-456');
      vi.mocked(fs.readdirSync).mockReturnValue(['audio.mp3'] as any);
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const result = await extractMedia({
        url: 'https://youtube.com/watch?v=abc123',
        mode: 'audio'
      });

      expect(result.platform).toBe('youtube');
      expect(result.audioPath).toContain('audio.mp3');
    });

    it('provides cleanup function', async () => {
      const mockExecFile = vi.fn((cmd: string, args: string[], opts: any, callback: any) => {
        if (cmd === 'yt-dlp' && args.includes('--no-download')) {
          callback(null, 'Title\n60', '');
        } else if (cmd === 'yt-dlp') {
          callback(null, '', '');
        } else {
          callback(new Error('Unexpected'), '', '');
        }
      });
      vi.mocked(childProcess.execFile).mockImplementation(mockExecFile);

      vi.mocked(fs.mkdtempSync).mockReturnValue('/tmp/claudegram-extract-789');
      vi.mocked(fs.readdirSync).mockReturnValue(['video.mp4'] as any);
      vi.mocked(fs.statSync).mockReturnValue({ size: 5 * 1024 * 1024 } as fs.Stats);
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.rmSync).mockImplementation(() => {});

      const result = await extractMedia({
        url: 'https://youtube.com/watch?v=abc123',
        mode: 'video'
      });

      expect(result._tempDir).toBe('/tmp/claudegram-extract-789');

      cleanupExtractResult(result);

      expect(fs.rmSync).toHaveBeenCalledWith(
        '/tmp/claudegram-extract-789',
        expect.objectContaining({ recursive: true, force: true })
      );
    });
  });

  describe('extractMedia error cases', () => {
    it('adds warning when video download fails', async () => {
      const mockExecFile = vi.fn((cmd: string, args: string[], opts: any, callback: any) => {
        if (cmd === 'yt-dlp' && args.includes('--no-download')) {
          callback(null, 'Title\n60', '');
        } else if (cmd === 'yt-dlp') {
          callback(new Error('yt-dlp download failed: Video unavailable'), '', 'Video unavailable');
        } else {
          callback(new Error('Unexpected'), '', '');
        }
      });
      vi.mocked(childProcess.execFile).mockImplementation(mockExecFile);

      vi.mocked(fs.mkdtempSync).mockReturnValue('/tmp/claudegram-extract-999');
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const result = await extractMedia({
        url: 'https://youtube.com/watch?v=invalid',
        mode: 'video'
      });

      // Should add warning about video download failure
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toMatch(/video download failed/i);
    });

    it('adds warning on yt-dlp timeout', async () => {
      const mockExecFile = vi.fn((cmd: string, args: string[], opts: any, callback: any) => {
        if (cmd === 'yt-dlp' && args.includes('--no-download')) {
          callback(null, 'Title\n60', '');
        } else if (cmd === 'yt-dlp') {
          const error: any = new Error('yt-dlp failed: Timeout');
          error.killed = true;
          callback(error, '', '');
        } else {
          callback(new Error('Unexpected'), '', '');
        }
      });
      vi.mocked(childProcess.execFile).mockImplementation(mockExecFile);

      vi.mocked(fs.mkdtempSync).mockReturnValue('/tmp/claudegram-extract-timeout');
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const result = await extractMedia({
        url: 'https://youtube.com/watch?v=slow',
        mode: 'video'
      });

      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('warns when video exceeds Telegram limit', async () => {
      const mockExecFile = vi.fn((cmd: string, args: string[], opts: any, callback: any) => {
        if (cmd === 'yt-dlp' && args.includes('--no-download')) {
          callback(null, 'Large Video\n300', '');
        } else if (cmd === 'yt-dlp') {
          callback(null, '', '');
        } else {
          callback(new Error('Unexpected'), '', '');
        }
      });
      vi.mocked(childProcess.execFile).mockImplementation(mockExecFile);

      vi.mocked(fs.mkdtempSync).mockReturnValue('/tmp/claudegram-extract-large');
      vi.mocked(fs.readdirSync).mockReturnValue(['video.mp4'] as any);
      vi.mocked(fs.statSync).mockReturnValue({ size: 60 * 1024 * 1024 } as fs.Stats); // 60MB
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const result = await extractMedia({
        url: 'https://youtube.com/watch?v=large',
        mode: 'video'
      });

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => /telegram.*50mb/i.test(w))).toBe(true);
    });

    it('handles invalid URL gracefully', async () => {
      const mockExecFile = vi.fn((cmd: string, args: string[], opts: any, callback: any) => {
        // Even invalid URLs get passed to yt-dlp
        if (cmd === 'yt-dlp' && args.includes('--no-download')) {
          callback(new Error('yt-dlp failed: Invalid URL'), '', 'Invalid URL');
        } else {
          callback(new Error('Unexpected'), '', '');
        }
      });
      vi.mocked(childProcess.execFile).mockImplementation(mockExecFile);

      vi.mocked(fs.mkdtempSync).mockReturnValue('/tmp/claudegram-extract-invalid');
      vi.mocked(fs.existsSync).mockReturnValue(false);

      // extractMedia doesn't pre-validate URLs, relies on yt-dlp
      const result = await extractMedia({
        url: 'invalid://bad-url',
        mode: 'video'
      });

      // Should have metadata fetch failure
      expect(result.title).toBe('Untitled');
      expect(result.duration).toBeNull();
    });
  });

  describe('Cleanup', () => {
    it('cleanupExtractResult removes temp files', () => {
      vi.mocked(fs.rmSync).mockImplementation(() => {});

      const result = {
        platform: 'youtube' as const,
        title: 'Test',
        url: 'https://youtube.com/watch?v=abc',
        duration: 60,
        warnings: [],
        _tempDir: '/tmp/claudegram-extract-cleanup'
      };

      cleanupExtractResult(result);

      expect(fs.rmSync).toHaveBeenCalledWith(
        '/tmp/claudegram-extract-cleanup',
        expect.objectContaining({ recursive: true, force: true })
      );
    });

    it('cleanup does not throw if files already deleted', () => {
      vi.mocked(fs.rmSync).mockImplementation(() => {
        throw new Error('ENOENT: no such file or directory');
      });

      const result = {
        platform: 'youtube' as const,
        title: 'Test',
        url: 'https://youtube.com/watch?v=abc',
        duration: 60,
        warnings: [],
        _tempDir: '/tmp/claudegram-extract-missing'
      };

      // Should not throw
      expect(() => cleanupExtractResult(result)).not.toThrow();
    });
  });
});
