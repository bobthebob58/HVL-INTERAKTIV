/**
 * saveDownloadedFile — hands a file the page received (the portfolio's Markdown or PDF) to the browser to save.
 *
 * Why: the export is a POST with the CSRF token (MAPPE-001, D-099), so a plain link cannot download it; the page
 *      fetches the file and then lets the browser save it under the name the server suggested.
 * Spec: MAPPE-001, MAPPE-003
 * Invariants:
 *   - PRIVACY: the file lives only in this page's memory: an object URL that is revoked right after the save starts;
 *     nothing goes into storage (MAPPE-003).
 *   - The name is the bare name `filenameFromDisposition` gave (no folder, no control or direction characters).
 * Collaborators: ./MappeDownloads.tsx, ../../api/contentDisposition.ts.
 * Tests: apps/web/test/features/MappeDownloads.test.tsx
 */

/**
 * Saves a file through the browser's download.
 * @param blob - The file.
 * @param filename - The name to save it under.
 */
export function saveDownloadedFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.hidden = true;
  document.body.append(link);
  try {
    link.click();
  } finally {
    link.remove();
    // WHY: the browser has taken the file once the click is handled; a later revoke would only keep it in memory.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}
