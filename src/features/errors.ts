import { sanitizeError } from '../utils/sanitize.js';

export class ServiceUnavailableError extends Error {
  public readonly service: string;
  constructor(service: string, cause?: unknown) {
    super(`${service} is currently unavailable`);
    this.name = 'ServiceUnavailableError';
    this.service = service;
    this.cause = cause;
  }
}

/**
 * Wrap an external service call with error handling.
 * Logs full error, throws ServiceUnavailableError with friendly message.
 */
export async function callExternalService<T>(
  serviceName: string,
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    console.error(`[${serviceName}] Service error:`, sanitizeError(error));
    throw new ServiceUnavailableError(serviceName, error);
  }
}

/**
 * Format a service error for user-facing reply.
 * Returns a user-friendly message string.
 */
export function formatServiceError(error: unknown): string {
  if (error instanceof ServiceUnavailableError) {
    return `${error.service} is temporarily unavailable. Please try again later.`;
  }
  return sanitizeError(error);
}
