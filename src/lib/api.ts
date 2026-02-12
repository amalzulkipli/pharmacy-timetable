/**
 * Prepends the Next.js basePath to API URLs.
 *
 * In the browser, fetch('/api/staff') ignores Next.js basePath and hits
 * the bare domain. This helper ensures all API calls include the basePath.
 */
const basePath = process.env.__NEXT_ROUTER_BASEPATH || '/timetable';

export function apiUrl(path: string): string {
  return `${basePath}${path}`;
}
