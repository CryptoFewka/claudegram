import { vi } from 'vitest';

export interface ExecFileResponse {
  stdout?: string;
  stderr?: string;
  error?: Error;
  exitCode?: number;
}

export interface ExecFilePattern {
  command: string;
  args?: string[];
  response: ExecFileResponse;
}

/**
 * Create a mock for child_process.execFile that matches command patterns.
 *
 * @param patterns - Array of command/args patterns and their responses
 * @returns A vi.fn() that can be used to mock execFile
 *
 * @example
 * const mockExecFile = createExecFileMock([
 *   {
 *     command: 'curl',
 *     args: ['-sS', '-L'],
 *     response: { stdout: '<html>...</html>' }
 *   },
 *   {
 *     command: 'ffmpeg',
 *     response: { stdout: '', exitCode: 0 }
 *   }
 * ]);
 */
export function createExecFileMock(patterns: ExecFilePattern[]) {
  return vi.fn((cmd: string, args: string[], options: any, callback: any) => {
    // Find matching pattern
    const pattern = patterns.find(p => {
      if (p.command !== cmd) return false;
      if (!p.args) return true;
      // Check if args contain the pattern args
      return p.args.every(arg => args.includes(arg));
    });

    if (!pattern) {
      // No pattern matched - return generic error
      const error = new Error(`Mock execFile: no pattern for ${cmd} ${args.join(' ')}`);
      callback(error, '', '');
      return;
    }

    const { stdout = '', stderr = '', error, exitCode = 0 } = pattern.response;

    if (error) {
      callback(error, stdout, stderr);
    } else if (exitCode !== 0) {
      const err = Object.assign(new Error(`Command failed with exit code ${exitCode}`), {
        code: exitCode,
      });
      callback(err, stdout, stderr);
    } else {
      callback(null, stdout, stderr);
    }
  });
}

/**
 * Helper to create a failing command mock.
 *
 * @example
 * const mockExecFile = createFailingExecFileMock('curl', 'Connection timeout');
 */
export function createFailingExecFileMock(command: string, errorMessage: string) {
  return createExecFileMock([
    {
      command,
      response: { error: new Error(errorMessage) },
    },
  ]);
}
