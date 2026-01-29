import { Context } from 'grammy';
import { vi } from 'vitest';

/**
 * Create a mock Grammy Context for testing bot handlers.
 */
export function createMockContext(overrides?: Partial<Context>): Context {
  const mockContext = {
    // Message reply methods
    reply: vi.fn().mockResolvedValue({ message_id: 1 }),
    replyWithChatAction: vi.fn().mockResolvedValue(true),
    replyWithVideo: vi.fn().mockResolvedValue({ message_id: 2 }),
    replyWithDocument: vi.fn().mockResolvedValue({ message_id: 3 }),
    replyWithVoice: vi.fn().mockResolvedValue({ message_id: 4 }),

    // API methods
    api: {
      deleteMessage: vi.fn().mockResolvedValue(true),
      editMessageText: vi.fn().mockResolvedValue({ message_id: 1 }),
      getFile: vi.fn().mockResolvedValue({ file_id: 'mock-file-id', file_path: 'mock/path.jpg' }),
    },

    // Message structure
    message: {
      message_id: 100,
      chat: {
        id: 12345,
        type: 'private',
      },
      from: {
        id: 67890,
        is_bot: false,
        first_name: 'TestUser',
      },
      text: '',
      date: Math.floor(Date.now() / 1000),
    },

    // Chat reference
    chat: {
      id: 12345,
      type: 'private',
    },

    // Override with any custom values
    ...overrides,
  } as unknown as Context;

  return mockContext;
}
