import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchMediumArticle, isMediumUrl, toFreediumUrl } from '../../../src/medium/freedium.js';

describe('Medium Article Parsing (Regression)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('URL detection (isMediumUrl)', () => {
    it('detects medium.com URLs', () => {
      expect(isMediumUrl('https://medium.com/@user/article-title')).toBe(true);
      expect(isMediumUrl('https://www.medium.com/@user/article-title')).toBe(true);
    });

    it('detects *.medium.com subdomains', () => {
      expect(isMediumUrl('https://blog.medium.com/article')).toBe(true);
      expect(isMediumUrl('https://engineering.medium.com/article')).toBe(true);
    });

    it('detects known Medium publication domains', () => {
      expect(isMediumUrl('https://towardsdatascience.com/article')).toBe(true);
      expect(isMediumUrl('https://betterprogramming.pub/article')).toBe(true);
      expect(isMediumUrl('https://uxdesign.cc/article')).toBe(true);
      expect(isMediumUrl('https://javascript.plainenglish.io/article')).toBe(true);
    });

    it('rejects non-Medium URLs', () => {
      expect(isMediumUrl('https://reddit.com/r/test')).toBe(false);
      expect(isMediumUrl('https://dev.to/article')).toBe(false);
      expect(isMediumUrl('https://example.com/medium-in-path')).toBe(false);
    });

    it('handles edge cases', () => {
      expect(isMediumUrl('')).toBe(false);
      expect(isMediumUrl('not-a-url')).toBe(false);
      expect(isMediumUrl('https://mediumfake.com/article')).toBe(false);
    });
  });

  describe('Freedium URL conversion (toFreediumUrl)', () => {
    it('converts medium.com URL to freedium proxy URL', () => {
      const mediumUrl = 'https://medium.com/@user/article-title-123abc';
      const freediumUrl = toFreediumUrl(mediumUrl);

      expect(freediumUrl).toMatch(/freedium/i);
      expect(freediumUrl).toContain(mediumUrl);
    });

    it('handles URLs with query params', () => {
      const mediumUrl = 'https://medium.com/@user/article?source=home';
      const freediumUrl = toFreediumUrl(mediumUrl);

      expect(freediumUrl).toMatch(/freedium/i);
      expect(freediumUrl).toContain('source=home');
    });

    it('handles URLs with fragments', () => {
      const mediumUrl = 'https://medium.com/@user/article#section-2';
      const freediumUrl = toFreediumUrl(mediumUrl);

      expect(freediumUrl).toMatch(/freedium/i);
      expect(freediumUrl).toContain('#section-2');
    });
  });

  describe('Article fetch happy path (fetchMediumArticle)', () => {
    it('fetches and parses article with title, author, and content', async () => {
      const mockHtml = `
        <html>
          <head><title>Test Article</title></head>
          <body>
            <h1 class="title">Amazing Article Title</h1>
            <a class="author-link">John Doe</a>
            <div class="main-content">
              <p>This is the article content with some interesting information.</p>
              <p>Multiple paragraphs of text.</p>
              <h2>Section Header</h2>
              <p>More content here.</p>
            </div>
          </body>
        </html>
      `;

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => mockHtml
      });

      const mediumUrl = 'https://medium.com/@user/test-article';
      const article = await fetchMediumArticle(mediumUrl);

      expect(article.title).toBe('Amazing Article Title');
      expect(article.author).toBe('John Doe');
      expect(article.markdown).toContain('article content');
      expect(article.markdown).toContain('Section Header');
      expect(article.url).toBe(mediumUrl);
    });

    it('converts HTML to readable Markdown', async () => {
      const mockHtml = `
        <html>
          <body>
            <h1>Title</h1>
            <a class="author-link">Author</a>
            <div class="main-content">
              <h2>Heading Two</h2>
              <p>Paragraph with <strong>bold</strong> and <em>italic</em> text.</p>
              <ul>
                <li>Item one</li>
                <li>Item two</li>
              </ul>
              <pre>const code = 'example';</pre>
            </div>
          </body>
        </html>
      `;

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => mockHtml
      });

      const article = await fetchMediumArticle('https://medium.com/@user/test');

      // Verify markdown conversion (basic checks - turndown handles specifics)
      expect(article.markdown).toContain('## Heading Two');
      expect(article.markdown).toContain('**bold**');
      expect(article.markdown).toContain('_italic_');
      expect(article.markdown).toContain('Item one'); // May or may not have dash prefix depending on turndown
      expect(article.markdown).toContain('```');
    });

    it('uses fallback selectors when main-content is missing', async () => {
      const mockHtml = `
        <html>
          <body>
            <h1>Fallback Article</h1>
            <article>
              <p>Content in article tag instead of main-content div.</p>
            </article>
          </body>
        </html>
      `;

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => mockHtml
      });

      const article = await fetchMediumArticle('https://medium.com/@user/test');

      expect(article.markdown).toContain('Content in article tag');
    });

    it('strips scripts and styles from content', async () => {
      const mockHtml = `
        <html>
          <body>
            <h1>Title</h1>
            <div class="author">Author</div>
            <div class="main-content">
              <p>Clean content</p>
              <script>alert('malicious')</script>
              <style>.hidden { display: none; }</style>
              <p>More content</p>
            </div>
          </body>
        </html>
      `;

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => mockHtml
      });

      const article = await fetchMediumArticle('https://medium.com/@user/test');

      expect(article.markdown).not.toContain('script');
      expect(article.markdown).not.toContain('alert');
      expect(article.markdown).not.toContain('style');
      expect(article.markdown).toContain('Clean content');
      expect(article.markdown).toContain('More content');
    });
  });

  describe('Error handling', () => {
    it('throws on 404 response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      await expect(
        fetchMediumArticle('https://medium.com/@user/nonexistent')
      ).rejects.toThrow('HTTP 404');
    });

    it('throws on 500 server error', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });

      await expect(
        fetchMediumArticle('https://medium.com/@user/test')
      ).rejects.toThrow('HTTP 500');
    });

    it('throws on network timeout', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Timeout'));

      await expect(
        fetchMediumArticle('https://medium.com/@user/test')
      ).rejects.toThrow('Timeout');
    });

    it('handles malformed HTML gracefully', async () => {
      const malformedHtml = `
        <html>
          <body>
            <h1>Title</h1>
            <div class="author">Author</div>
            <div class="main-content">
              <p>Unclosed tags everywhere
              <div>Nested <div> wrongly </p> structured
            </div>
          </body>
      `;

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => malformedHtml
      });

      // Should not crash on malformed HTML (cheerio is lenient)
      const article = await fetchMediumArticle('https://medium.com/@user/test');

      expect(article.title).toBeTruthy();
      expect(article.markdown).toBeTruthy();
    });

    it('throws when no article content is found', async () => {
      const emptyHtml = `
        <html>
          <body>
            <h1>Title</h1>
            <p>Some random text but no main-content or article tag</p>
          </body>
        </html>
      `;

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => emptyHtml
      });

      await expect(
        fetchMediumArticle('https://medium.com/@user/test')
      ).rejects.toThrow('Could not find article content');
    });

    it('handles empty article content', async () => {
      const emptyContentHtml = `
        <html>
          <body>
            <h1>Empty Article</h1>
            <div class="author">Author</div>
            <div class="main-content">
              <!-- No actual content -->
            </div>
          </body>
        </html>
      `;

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => emptyContentHtml
      });

      const article = await fetchMediumArticle('https://medium.com/@user/test');

      // Should return article with empty or minimal markdown
      expect(article.title).toBe('Empty Article');
      expect(article.markdown).toBeDefined();
    });
  });
});
