import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { executeVReddit } from '../../../src/reddit/vreddit.js';
import { createMockContext } from '../../mocks/grammy.js';
import { createExecFileMock } from '../../mocks/child-process.js';
import { measureExecution } from '../../helpers/security.js';
import * as childProcess from 'child_process';
import * as fs from 'fs';

// Mock modules
vi.mock('child_process');
vi.mock('fs');

describe('Reddit Video Extraction (Regression)', () => {
  let mockExecFile: ReturnType<typeof vi.fn>;
  let mockContext: ReturnType<typeof createMockContext>;

  beforeEach(() => {
    mockContext = createMockContext();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('URL validation and resolution', () => {
    it('rejects invalid URL (not a URL string)', async () => {
      mockExecFile = vi.fn();
      vi.mocked(childProcess.execFile).mockImplementation(mockExecFile);

      await executeVReddit(mockContext, 'not-a-valid-url-at-all');

      expect(mockContext.reply).toHaveBeenCalledWith(
        expect.stringContaining('No video found'),
        expect.anything()
      );
      expect(mockExecFile).not.toHaveBeenCalled();
    });

    it('rejects dangerous protocol (file://)', async () => {
      mockExecFile = vi.fn();
      vi.mocked(childProcess.execFile).mockImplementation(mockExecFile);

      await executeVReddit(mockContext, 'file:///etc/passwd');

      expect(mockContext.reply).toHaveBeenCalledWith(
        expect.stringContaining('No video found'),
        expect.anything()
      );
      expect(mockExecFile).not.toHaveBeenCalled();
    });

    it('accepts valid Reddit URL and proceeds to fetch HTML', async () => {
      mockExecFile = createExecFileMock([
        {
          command: 'curl',
          args: ['-sS', '-L'],
          response: { stdout: 'https://old.reddit.com/r/test/comments/abc123' }
        },
        {
          command: 'curl',
          args: ['-sS', '-L', '-f'],
          response: { stdout: '<html>No video here</html>' }
        }
      ]);
      vi.mocked(childProcess.execFile).mockImplementation(mockExecFile);

      await executeVReddit(mockContext, 'https://www.reddit.com/r/test/comments/abc123');

      // Should call curl to resolve URL
      expect(mockExecFile).toHaveBeenCalledWith(
        'curl',
        expect.arrayContaining(['-L', expect.stringContaining('reddit.com')]),
        expect.anything(),
        expect.any(Function)
      );
    });
  });

  describe('DASH video extraction happy path', () => {
    it('extracts and merges DASH video with audio', async () => {
      const mockDashManifest = `<?xml version="1.0"?>
<MPD>
  <Period>
    <AdaptationSet contentType="video">
      <Representation bandwidth="2000000">
        <BaseURL>video_720.mp4</BaseURL>
      </Representation>
    </AdaptationSet>
    <AdaptationSet contentType="audio">
      <Representation bandwidth="128000">
        <BaseURL>audio.mp4</BaseURL>
      </Representation>
    </AdaptationSet>
  </Period>
</MPD>`;

      // Mock all curl/ffmpeg calls in sequence
      let callCount = 0;
      mockExecFile = vi.fn((cmd: string, args: string[], opts: any, callback: any) => {
        callCount++;
        if (cmd === 'curl' && args.includes('-w') && callCount === 1) {
          // resolveFinalUrl call
          callback(null, 'https://old.reddit.com/r/test/comments/abc123', '');
        } else if (cmd === 'curl' && args.includes('-f') && callCount === 2) {
          // fetchHtml call
          callback(null, '<html>https://v.redd.it/abc123/DASHPlaylist.mpd</html>', '');
        } else if (cmd === 'curl' && callCount > 2) {
          // downloadFile calls (video and audio)
          callback(null, '', '');
        } else if (cmd === 'ffmpeg') {
          // mergeVideoAudio call
          callback(null, '', '');
        } else {
          callback(new Error(`Unexpected command: ${cmd} ${args.join(' ')}`), '', '');
        }
      });
      vi.mocked(childProcess.execFile).mockImplementation(mockExecFile);

      // Mock global fetch for DASH manifest
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => mockDashManifest
      });

      // Mock fs operations
      vi.mocked(fs.mkdtempSync).mockReturnValue('/tmp/claudegram-test-123');
      vi.mocked(fs.statSync).mockReturnValue({ size: 5 * 1024 * 1024 } as fs.Stats);
      vi.mocked(fs.rmSync).mockImplementation(() => {});

      await executeVReddit(mockContext, 'https://old.reddit.com/r/test/comments/abc123');

      expect(mockContext.replyWithVideo).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ supports_streaming: true })
      );
    });

    it('handles video-only (no audio) DASH manifest', async () => {
      const mockDashManifest = `<?xml version="1.0"?>
<MPD>
  <Period>
    <AdaptationSet contentType="video">
      <Representation bandwidth="2000000">
        <BaseURL>video_720.mp4</BaseURL>
      </Representation>
    </AdaptationSet>
  </Period>
</MPD>`;

      let callCount = 0;
      mockExecFile = vi.fn((cmd: string, args: string[], opts: any, callback: any) => {
        callCount++;
        if (cmd === 'curl' && args.includes('-w') && callCount === 1) {
          callback(null, 'https://old.reddit.com/r/test/comments/abc123', '');
        } else if (cmd === 'curl' && args.includes('-f') && callCount === 2) {
          callback(null, '<html>https://v.redd.it/abc123/DASHPlaylist.mpd</html>', '');
        } else if (cmd === 'curl') {
          callback(null, '', '');
        } else {
          callback(new Error(`Unexpected: ${cmd}`), '', '');
        }
      });
      vi.mocked(childProcess.execFile).mockImplementation(mockExecFile);

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => mockDashManifest
      });

      vi.mocked(fs.mkdtempSync).mockReturnValue('/tmp/claudegram-test-123');
      vi.mocked(fs.statSync).mockReturnValue({ size: 5 * 1024 * 1024 } as fs.Stats);
      vi.mocked(fs.rmSync).mockImplementation(() => {});

      await executeVReddit(mockContext, 'https://old.reddit.com/r/test/comments/abc123');

      expect(mockContext.replyWithVideo).toHaveBeenCalled();
      // ffmpeg should NOT be called for video-only
      expect(mockExecFile).not.toHaveBeenCalledWith(
        'ffmpeg',
        expect.anything(),
        expect.anything(),
        expect.any(Function)
      );
    });
  });

  describe('External video embed fallback (yt-dlp)', () => {
    it('uses yt-dlp for external embed URLs', async () => {
      let callCount = 0;
      mockExecFile = vi.fn((cmd: string, args: string[], opts: any, callback: any) => {
        callCount++;
        if (cmd === 'curl' && args.includes('-w') && callCount === 1) {
          callback(null, 'https://old.reddit.com/r/test/comments/abc123', '');
        } else if (cmd === 'curl' && args.includes('-f') && callCount === 2) {
          callback(null, '<html>data-url="https://redgifs.com/watch/example"</html>', '');
        } else if (cmd === 'yt-dlp') {
          callback(null, '', '');
        } else {
          callback(new Error(`Unexpected: ${cmd}`), '', '');
        }
      });
      vi.mocked(childProcess.execFile).mockImplementation(mockExecFile);

      vi.mocked(fs.mkdtempSync).mockReturnValue('/tmp/claudegram-test-123');
      vi.mocked(fs.statSync).mockReturnValue({ size: 5 * 1024 * 1024 } as fs.Stats);
      vi.mocked(fs.rmSync).mockImplementation(() => {});

      await executeVReddit(mockContext, 'https://old.reddit.com/r/test/comments/abc123');

      expect(mockExecFile).toHaveBeenCalledWith(
        'yt-dlp',
        expect.arrayContaining([expect.stringContaining('redgifs.com')]),
        expect.anything(),
        expect.any(Function)
      );
      expect(mockContext.replyWithVideo).toHaveBeenCalled();
    });
  });

  describe('Error handling', () => {
    it('handles curl fetch failure with error message', async () => {
      let callCount = 0;
      mockExecFile = vi.fn((cmd: string, args: string[], opts: any, callback: any) => {
        callCount++;
        if (cmd === 'curl' && args.includes('-w') && callCount === 1) {
          callback(new Error('Connection timeout'), '', 'timeout');
        } else {
          callback(new Error('Unexpected'), '', '');
        }
      });
      vi.mocked(childProcess.execFile).mockImplementation(mockExecFile);

      await executeVReddit(mockContext, 'https://old.reddit.com/r/test/comments/abc123');

      expect(mockContext.reply).toHaveBeenCalledWith(
        expect.stringContaining('Failed to download video'),
        expect.anything()
      );
      // Note: No temp dir created since error happens during URL resolution
    });

    it('handles ffmpeg merge failure gracefully', async () => {
      const mockDashManifest = `<?xml version="1.0"?>
<MPD>
  <Period>
    <AdaptationSet contentType="video">
      <Representation bandwidth="2000000">
        <BaseURL>video_720.mp4</BaseURL>
      </Representation>
    </AdaptationSet>
    <AdaptationSet contentType="audio">
      <Representation bandwidth="128000">
        <BaseURL>audio.mp4</BaseURL>
      </Representation>
    </AdaptationSet>
  </Period>
</MPD>`;

      let callCount = 0;
      mockExecFile = vi.fn((cmd: string, args: string[], opts: any, callback: any) => {
        callCount++;
        if (cmd === 'curl' && args.includes('-w') && callCount === 1) {
          callback(null, 'https://old.reddit.com/r/test/comments/abc123', '');
        } else if (cmd === 'curl' && args.includes('-f') && callCount === 2) {
          callback(null, '<html>https://v.redd.it/abc123/DASHPlaylist.mpd</html>', '');
        } else if (cmd === 'curl') {
          callback(null, 'video/audio data', '');
        } else if (cmd === 'ffmpeg') {
          callback(new Error('ffmpeg merge failed'), '', 'Error merging');
        } else {
          callback(new Error('Unexpected command'), '', '');
        }
      });
      vi.mocked(childProcess.execFile).mockImplementation(mockExecFile);

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => mockDashManifest
      });

      vi.mocked(fs.mkdtempSync).mockReturnValue('/tmp/claudegram-test-123');
      vi.mocked(fs.statSync).mockReturnValue({ size: 5 * 1024 * 1024 } as fs.Stats);
      vi.mocked(fs.rmSync).mockImplementation(() => {});

      await executeVReddit(mockContext, 'https://old.reddit.com/r/test/comments/abc123');

      // Should still send video (without audio) if merge fails
      expect(mockContext.replyWithVideo).toHaveBeenCalled();
    });

    it('rejects video exceeding 50MB Telegram limit', async () => {
      const mockDashManifest = `<?xml version="1.0"?>
<MPD>
  <Period>
    <AdaptationSet contentType="video">
      <Representation bandwidth="2000000">
        <BaseURL>video_720.mp4</BaseURL>
      </Representation>
    </AdaptationSet>
  </Period>
</MPD>`;

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => mockDashManifest
      });

      vi.mocked(fs.mkdtempSync).mockReturnValue('/tmp/claudegram-test-123');
      // Mock file size exceeding 50MB limit
      vi.mocked(fs.statSync).mockReturnValue({ size: 60 * 1024 * 1024 } as fs.Stats);
      vi.mocked(fs.rmSync).mockImplementation(() => {});
      vi.mocked(fs.mkdirSync).mockImplementation(() => '');
      vi.mocked(fs.copyFileSync).mockImplementation(() => {});

      // Mock compression attempts failing
      let callCount = 0;
      mockExecFile = vi.fn((cmd: string, args: string[], opts: any, callback: any) => {
        callCount++;
        if (cmd === 'curl' && args.includes('-w') && callCount === 1) {
          callback(null, 'https://old.reddit.com/r/test/comments/abc123', '');
        } else if (cmd === 'curl' && args.includes('-f') && callCount === 2) {
          callback(null, '<html>https://v.redd.it/abc123/DASHPlaylist.mpd</html>', '');
        } else if (cmd === 'curl') {
          callback(null, 'video data', '');
        } else if (cmd === 'ffmpeg') {
          callback(new Error('Compression failed'), '', '');
        } else {
          callback(null, '', '');
        }
      });
      vi.mocked(childProcess.execFile).mockImplementation(mockExecFile);

      await executeVReddit(mockContext, 'https://old.reddit.com/r/test/comments/abc123');

      expect(mockContext.reply).toHaveBeenCalledWith(
        expect.stringContaining('Failed to compress video'),
        expect.anything()
      );
    });

    it('cleans up temp files after download error', async () => {
      const mockDashManifest = `<?xml version="1.0"?>
<MPD>
  <Period>
    <AdaptationSet contentType="video">
      <Representation bandwidth="2000000">
        <BaseURL>video_720.mp4</BaseURL>
      </Representation>
    </AdaptationSet>
  </Period>
</MPD>`;

      let callCount = 0;
      mockExecFile = vi.fn((cmd: string, args: string[], opts: any, callback: any) => {
        callCount++;
        if (cmd === 'curl' && args.includes('-w') && callCount === 1) {
          callback(null, 'https://old.reddit.com/r/test/comments/abc123', '');
        } else if (cmd === 'curl' && args.includes('-f') && callCount === 2) {
          callback(null, '<html>https://v.redd.it/abc123/DASHPlaylist.mpd</html>', '');
        } else if (cmd === 'curl') {
          // downloadFile fails
          callback(new Error('Network error during download'), '', 'network failure');
        } else {
          callback(new Error('Unexpected'), '', '');
        }
      });
      vi.mocked(childProcess.execFile).mockImplementation(mockExecFile);

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => mockDashManifest
      });

      const mockTempDir = '/tmp/claudegram-test-456';
      vi.mocked(fs.mkdtempSync).mockReturnValue(mockTempDir);
      vi.mocked(fs.rmSync).mockImplementation(() => {});

      await executeVReddit(mockContext, 'https://old.reddit.com/r/test/comments/abc123');

      expect(fs.rmSync).toHaveBeenCalledWith(
        mockTempDir,
        expect.objectContaining({ recursive: true, force: true })
      );
    });
  });

  describe('ReDoS resilience', () => {
    it('DASH manifest parsing completes in <200ms with large input', async () => {
      // Create a large DASH manifest with many representations
      const createLargeManifest = () => {
        let manifest = '<?xml version="1.0"?><MPD><Period>';
        for (let i = 0; i < 50; i++) {
          manifest += `<AdaptationSet contentType="video">`;
          for (let j = 0; j < 10; j++) {
            manifest += `<Representation bandwidth="${1000000 + j * 100000}">
              <BaseURL>video_${i}_${j}.mp4</BaseURL>
            </Representation>`;
          }
          manifest += `</AdaptationSet>`;
        }
        manifest += '</Period></MPD>';
        return manifest;
      };

      const largeManifest = createLargeManifest();

      let callCount = 0;
      mockExecFile = vi.fn((cmd: string, args: string[], opts: any, callback: any) => {
        callCount++;
        if (cmd === 'curl' && args.includes('-w') && callCount === 1) {
          callback(null, 'https://old.reddit.com/r/test/comments/abc123', '');
        } else if (cmd === 'curl' && args.includes('-f') && callCount === 2) {
          callback(null, '<html>https://v.redd.it/abc123/DASHPlaylist.mpd</html>', '');
        } else {
          callback(null, '', '');
        }
      });
      vi.mocked(childProcess.execFile).mockImplementation(mockExecFile);

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => largeManifest
      });

      vi.mocked(fs.mkdtempSync).mockReturnValue('/tmp/claudegram-test-789');
      vi.mocked(fs.rmSync).mockImplementation(() => {});

      const { durationMs } = await measureExecution(async () => {
        await executeVReddit(mockContext, 'https://old.reddit.com/r/test/comments/abc123');
      });

      // Parsing should complete quickly despite large manifest
      expect(durationMs).toBeLessThan(200);
    });

    it('HTML parsing for DASH URL completes in <100ms with pathological input', async () => {
      // Create pathological HTML with many v.redd.it references
      const createPathologicalHtml = () => {
        let html = '<html><body>';
        for (let i = 0; i < 1000; i++) {
          html += `<div>https://v.redd.it/abc${i}/DASHPlaylist.mpd</div>`;
        }
        html += '</body></html>';
        return html;
      };

      const pathologicalHtml = createPathologicalHtml();

      let callCount = 0;
      mockExecFile = vi.fn((cmd: string, args: string[], opts: any, callback: any) => {
        callCount++;
        if (cmd === 'curl' && args.includes('-w') && callCount === 1) {
          callback(null, 'https://old.reddit.com/r/test/comments/abc123', '');
        } else if (cmd === 'curl' && args.includes('-f') && callCount === 2) {
          callback(null, pathologicalHtml, '');
        } else {
          callback(null, '', '');
        }
      });
      vi.mocked(childProcess.execFile).mockImplementation(mockExecFile);

      vi.mocked(fs.mkdtempSync).mockReturnValue('/tmp/claudegram-test-999');
      vi.mocked(fs.rmSync).mockImplementation(() => {});

      const { durationMs } = await measureExecution(async () => {
        await executeVReddit(mockContext, 'https://old.reddit.com/r/test/comments/abc123');
      });

      // HTML regex parsing should complete quickly
      expect(durationMs).toBeLessThan(100);
    });
  });
});
