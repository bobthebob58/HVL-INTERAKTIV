/**
 * jsonFileCheck — tells whether a file is UTF-8 text that `JSON.parse` would accept, reading it in portions.
 *
 * Why: the check of an uploaded `.json` file read the whole file and parsed it on the request thread: the file,
 *      its text and the parsed value were in memory at once, and no other request was served during the parse,
 *      twice for each editor upload (D-143). Here the file is read a portion at a time and only its syntax is
 *      followed (./jsonSyntax.ts).
 * Spec: SEC-002
 * Invariants:
 *   - The answer is exactly that of `JSON.parse` on the file decoded as UTF-8 with one leading byte-order mark
 *     removed, which is what the check did before.
 *   - Memory: one buffer of `JSON_PORTION` bytes and its text, plus what ./jsonSyntax.ts keeps.
 *   - The file is read with asynchronous reads, so other requests are served between the portions.
 *   - Fails closed: a read error or a byte sequence that is not UTF-8 is "not JSON".
 * Collaborators: ./jsonSyntax.ts, ./textFormats.ts (the only caller).
 * Tests: apps/server/test/security/sniff/jsonFileCheck.test.ts, apps/server/test/security/FileTypeSniffer.test.ts
 */
import { open } from 'node:fs/promises';
import { JsonSyntax } from './jsonSyntax.js';

/** How many bytes of the file are read and checked at a time. */
export const JSON_PORTION = 64 * 1024;

/**
 * Tells whether a file is valid UTF-8 and valid JSON, in memory that does not grow with the file.
 * @param path - Path of the file.
 * @returns True when `JSON.parse` would accept the file's text.
 * @spec SEC-002
 */
export async function isJsonFile(path: string): Promise<boolean> {
  const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: false });
  const syntax = new JsonSyntax();
  const buffer = Buffer.alloc(JSON_PORTION);
  try {
    const handle = await open(path, 'r');
    try {
      for (;;) {
        const { bytesRead } = await handle.read(buffer, 0, JSON_PORTION, null);
        if (bytesRead === 0) break;
        if (!syntax.push(decoder.decode(buffer.subarray(0, bytesRead), { stream: true }))) return false;
      }
    } finally {
      await handle.close();
    }
    // WHY: the last call tells the decoder that no byte follows, so a cut-off character is refused.
    return syntax.push(decoder.decode()) && syntax.end();
  } catch {
    return false;
  }
}
