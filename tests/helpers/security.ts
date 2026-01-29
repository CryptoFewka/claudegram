/**
 * Security testing utilities for timing measurements and attack vectors.
 */

/**
 * Measure execution time of a function.
 * Useful for timing-based security tests (e.g., detecting ReDoS vulnerabilities).
 *
 * @returns Object with result and execution duration in milliseconds
 */
export async function measureExecution<T>(
  fn: () => T | Promise<T>
): Promise<{ result: T; durationMs: number }> {
  const start = performance.now();
  const result = await fn();
  const end = performance.now();
  const durationMs = end - start;
  return { result, durationMs };
}

/**
 * Known SSRF (Server-Side Request Forgery) attack vectors.
 * These protocols should be rejected by URL validation functions.
 */
export const SSRF_ATTACK_VECTORS = [
  'file:///etc/passwd',
  'file://localhost/etc/passwd',
  'ftp://malicious.example.com/file.txt',
  'gopher://malicious.example.com/_GET%20/HTTP/1.1',
  'data:text/html,<script>alert(1)</script>',
  'javascript:alert(1)',
  'dict://localhost:11211/stats',
  'ldap://localhost:389/dc=example,dc=com',
  'tftp://192.168.1.1/config',
  'jar:http://example.com/evil.jar!/file.txt',
];

/**
 * Path traversal attack vectors.
 * Used to test path sanitization functions.
 */
export const PATH_TRAVERSAL_VECTORS = [
  '../../../etc/passwd',
  '..%2f..%2f..%2fetc%2fpasswd',
  '....//....//....//etc/passwd',
  '..\\..\\..\\windows\\system32\\config\\sam',
  '/../../../../../../etc/passwd',
  'file:///etc/passwd',
  '/home/user/../../../etc/passwd',
];

/**
 * Private IP address ranges and internal hostnames.
 * Used to test SSRF protections (though current implementation only validates protocol).
 */
export const PRIVATE_IP_RANGES = [
  'http://127.0.0.1',
  'http://localhost',
  'http://169.254.169.254', // AWS metadata service
  'http://169.254.169.254/latest/meta-data/',
  'http://10.0.0.1',
  'http://172.16.0.1',
  'http://192.168.1.1',
  'http://[::1]', // IPv6 localhost
  'http://[fd00::1]', // IPv6 private range
];
