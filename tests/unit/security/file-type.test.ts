import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { detectImageType, isValidImageFile, getFileType } from '../../../src/utils/file-type.js';

// Mock fs module
vi.mock('fs', () => ({
  default: {
    openSync: vi.fn(),
    readSync: vi.fn(),
    closeSync: vi.fn(),
    statSync: vi.fn(),
  },
  openSync: vi.fn(),
  readSync: vi.fn(),
  closeSync: vi.fn(),
  statSync: vi.fn(),
}));

describe('File Type Detection Security', () => {
  describe('Magic byte detection - detectImageType', () => {
    it('should detect JPEG by magic bytes (0xFF 0xD8 0xFF)', () => {
      const jpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46]);
      const result = detectImageType(jpegBuffer);
      expect(result).toEqual({ extension: '.jpg', mimeType: 'image/jpeg' });
    });

    it('should detect PNG by magic bytes', () => {
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
      const result = detectImageType(pngBuffer);
      expect(result).toEqual({ extension: '.png', mimeType: 'image/png' });
    });

    it('should detect GIF87a by magic bytes', () => {
      const gif87Buffer = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x37, 0x61]);
      const result = detectImageType(gif87Buffer);
      expect(result).toEqual({ extension: '.gif', mimeType: 'image/gif' });
    });

    it('should detect GIF89a by magic bytes', () => {
      const gif89Buffer = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
      const result = detectImageType(gif89Buffer);
      expect(result).toEqual({ extension: '.gif', mimeType: 'image/gif' });
    });

    it('should detect WebP by magic bytes (RIFF + WEBP)', () => {
      const webpBuffer = Buffer.from([
        0x52, 0x49, 0x46, 0x46, // RIFF
        0x00, 0x00, 0x00, 0x00, // size
        0x57, 0x45, 0x42, 0x50, // WEBP
      ]);
      const result = detectImageType(webpBuffer);
      expect(result).toEqual({ extension: '.webp', mimeType: 'image/webp' });
    });

    it('should detect BMP by magic bytes (0x42 0x4D)', () => {
      const bmpBuffer = Buffer.from([0x42, 0x4D, 0x00, 0x00]);
      const result = detectImageType(bmpBuffer);
      expect(result).toEqual({ extension: '.bmp', mimeType: 'image/bmp' });
    });

    it('should detect TIFF (little endian) by magic bytes', () => {
      const tiffLEBuffer = Buffer.from([0x49, 0x49, 0x2A, 0x00]);
      const result = detectImageType(tiffLEBuffer);
      expect(result).toEqual({ extension: '.tiff', mimeType: 'image/tiff' });
    });

    it('should detect TIFF (big endian) by magic bytes', () => {
      const tiffBEBuffer = Buffer.from([0x4D, 0x4D, 0x00, 0x2A]);
      const result = detectImageType(tiffBEBuffer);
      expect(result).toEqual({ extension: '.tiff', mimeType: 'image/tiff' });
    });
  });

  describe('Rejection cases - detectImageType', () => {
    it('should return null for empty buffer', () => {
      const emptyBuffer = Buffer.from([]);
      const result = detectImageType(emptyBuffer);
      expect(result).toBeNull();
    });

    it('should return null for 1-byte buffer', () => {
      const tinyBuffer = Buffer.from([0xFF]);
      const result = detectImageType(tinyBuffer);
      expect(result).toBeNull();
    });

    it('should return null for random bytes', () => {
      const randomBuffer = Buffer.from([0x01, 0x02, 0x03, 0x04, 0x05]);
      const result = detectImageType(randomBuffer);
      expect(result).toBeNull();
    });

    it('should return null for text content', () => {
      const textBuffer = Buffer.from('hello world');
      const result = detectImageType(textBuffer);
      expect(result).toBeNull();
    });

    it('should return null for ELF binary header', () => {
      const elfBuffer = Buffer.from([0x7F, 0x45, 0x4C, 0x46]); // ELF magic
      const result = detectImageType(elfBuffer);
      expect(result).toBeNull();
    });

    it('should return null for PDF header', () => {
      const pdfBuffer = Buffer.from('%PDF-1.4');
      const result = detectImageType(pdfBuffer);
      expect(result).toBeNull();
    });

    it('should return null for ZIP header', () => {
      const zipBuffer = Buffer.from([0x50, 0x4B, 0x03, 0x04]); // PK zip
      const result = detectImageType(zipBuffer);
      expect(result).toBeNull();
    });

    it('should return null for HTML content', () => {
      const htmlBuffer = Buffer.from('<!DOCTYPE html>');
      const result = detectImageType(htmlBuffer);
      expect(result).toBeNull();
    });

    it('should not detect WebP with only RIFF header (missing WEBP signature)', () => {
      const incompleteWebP = Buffer.from([
        0x52, 0x49, 0x46, 0x46, // RIFF
        0x00, 0x00, 0x00, 0x00, // size
      ]);
      const result = detectImageType(incompleteWebP);
      expect(result).toBeNull();
    });
  });

  describe('isValidImageFile with mocked fs', () => {
    beforeEach(async () => {
      // Clear all mocks before each test
      vi.clearAllMocks();
    });

    afterEach(() => {
      // Reset mocks after each test
      vi.resetAllMocks();
    });

    it('should return true for valid JPEG file', async () => {
      const jpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46]);

      const { openSync, readSync, closeSync } = await import('fs');
      vi.mocked(openSync).mockReturnValue(3 as any);
      vi.mocked(readSync).mockImplementation((fd, buffer: any) => {
        jpegBuffer.copy(buffer);
        return jpegBuffer.length;
      });
      vi.mocked(closeSync).mockImplementation(() => {});

      const result = isValidImageFile('/fake/path/image.jpg');
      expect(result).toBe(true);
    });

    it('should return true for valid PNG file', async () => {
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

      const { openSync, readSync, closeSync } = await import('fs');
      vi.mocked(openSync).mockReturnValue(3 as any);
      vi.mocked(readSync).mockImplementation((fd, buffer: any) => {
        pngBuffer.copy(buffer);
        return pngBuffer.length;
      });
      vi.mocked(closeSync).mockImplementation(() => {});

      const result = isValidImageFile('/fake/path/image.png');
      expect(result).toBe(true);
    });

    it('should return false for non-image file', async () => {
      const textBuffer = Buffer.from('This is text');

      const { openSync, readSync, closeSync } = await import('fs');
      vi.mocked(openSync).mockReturnValue(3 as any);
      vi.mocked(readSync).mockImplementation((fd, buffer: any) => {
        textBuffer.copy(buffer);
        return textBuffer.length;
      });
      vi.mocked(closeSync).mockImplementation(() => {});

      const result = isValidImageFile('/fake/path/text.txt');
      expect(result).toBe(false);
    });

    it('should return false when file open throws error', async () => {
      const { openSync } = await import('fs');
      vi.mocked(openSync).mockImplementation(() => {
        throw new Error('ENOENT: no such file');
      });

      const result = isValidImageFile('/nonexistent/file.jpg');
      expect(result).toBe(false);
    });

    it('should return false for file with less than 2 bytes', async () => {
      const { openSync, readSync, closeSync } = await import('fs');
      vi.mocked(openSync).mockReturnValue(3 as any);
      vi.mocked(readSync).mockReturnValue(1 as any); // Only 1 byte read
      vi.mocked(closeSync).mockImplementation(() => {});

      const result = isValidImageFile('/fake/path/tiny.dat');
      expect(result).toBe(false);
    });

    it('should handle read errors gracefully', async () => {
      const { openSync, readSync, closeSync } = await import('fs');
      vi.mocked(openSync).mockReturnValue(3 as any);
      vi.mocked(readSync).mockImplementation(() => {
        throw new Error('Read error');
      });
      vi.mocked(closeSync).mockImplementation(() => {});

      const result = isValidImageFile('/fake/path/error.jpg');
      expect(result).toBe(false);
    });
  });

  describe('getFileType with mocked fs', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    afterEach(() => {
      vi.resetAllMocks();
    });

    it('should return file type for valid image', async () => {
      const jpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]);

      const { openSync, readSync, closeSync } = await import('fs');
      vi.mocked(openSync).mockReturnValue(3 as any);
      vi.mocked(readSync).mockImplementation((fd, buffer: any) => {
        jpegBuffer.copy(buffer);
        return jpegBuffer.length;
      });
      vi.mocked(closeSync).mockImplementation(() => {});

      const result = getFileType('/fake/path/image.jpg');
      expect(result).toEqual({ extension: '.jpg', mimeType: 'image/jpeg' });
    });

    it('should return null for non-image file', async () => {
      const textBuffer = Buffer.from('text');

      const { openSync, readSync, closeSync } = await import('fs');
      vi.mocked(openSync).mockReturnValue(3 as any);
      vi.mocked(readSync).mockImplementation((fd, buffer: any) => {
        textBuffer.copy(buffer);
        return textBuffer.length;
      });
      vi.mocked(closeSync).mockImplementation(() => {});

      const result = getFileType('/fake/path/text.txt');
      expect(result).toBeNull();
    });

    it('should return null when file access fails', async () => {
      const { openSync } = await import('fs');
      vi.mocked(openSync).mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const result = getFileType('/restricted/file.jpg');
      expect(result).toBeNull();
    });
  });
});
