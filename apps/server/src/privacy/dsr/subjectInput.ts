/**
 * subjectInput — reads the data subject from standard input, with a size limit and, at a terminal, a prompt.
 *
 * Why: D-108's amendment of 2026-11-04 has the operator paste the person's identifiers into the CLI's standard input,
 *      never into its arguments, which stay in the shell's history and show in the host's process list (DATA-008).
 * Spec: DATA-008, DATA-009
 * Invariants:
 *   - Reads to the end of the input, at most `MAX_SUBJECT_BYTES`; more is refused without echoing any of it.
 *   - The prompt goes to standard error, so standard output carries only the result.
 *   - PRIVACY: the text is returned in memory only; nothing here stores or prints it.
 * Collaborators: ./dsrCli.ts (the caller), ./dataSubject.ts (parses the text).
 * Tests: apps/server/test/privacy/dsr/subjectInput.test.ts
 */
import { DataSubjectInputError } from './dataSubject.js';

/** The most bytes read from standard input. */
export const MAX_SUBJECT_BYTES = 64 * 1024;

/** A readable input such as `process.stdin`. */
export type SubjectInputStream = AsyncIterable<Buffer | string> & { readonly isTTY?: boolean };

/**
 * Reads the input to its end.
 * @param input - The stream (`process.stdin` in production).
 * @param prompt - Prints the prompt shown at a terminal (standard error in production).
 * @returns The text, as UTF-8.
 * @throws DataSubjectInputError when the input is larger than `MAX_SUBJECT_BYTES`.
 * @spec DATA-008
 */
export async function readSubjectInput(
  input: SubjectInputStream,
  prompt: (line: string) => void,
): Promise<string> {
  if (input.isTTY) prompt('Paste the data subject as one JSON object, then press Ctrl-D on a new line:');
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of input) {
    const bytes = typeof chunk === 'string' ? Buffer.from(chunk, 'utf8') : chunk;
    size += bytes.length;
    if (size > MAX_SUBJECT_BYTES) throw new DataSubjectInputError('standard input is larger than 64 KiB');
    chunks.push(bytes);
  }
  return Buffer.concat(chunks).toString('utf8');
}
