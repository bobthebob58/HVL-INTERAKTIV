/**
 * openFiles — tells a test which files the server process still holds open.
 *
 * Why: a request that fails must let go of its files; a file that is deleted while still held open keeps its disk
 *      space until the process ends (SEC-005). The in-process test server shares the test's process, so the
 *      process's own descriptor table shows what a request left behind.
 * Spec: SEC-005
 * Invariants:
 *   - Reads Linux's `/proc/self/fd`; on a platform without it `canListOpenFiles` is false and tests skip.
 *   - A descriptor that closes while the list is read is left out, never an error.
 * Collaborators: none.
 * Tests: used by apps/server/test/http/packageImportOpenFiles.int.test.ts
 */
import { existsSync, readdirSync, readlinkSync } from 'node:fs';

const FD_DIR = '/proc/self/fd';

/** True where the process's open files can be listed. */
export const canListOpenFiles = existsSync(FD_DIR);

/**
 * Lists what the process's descriptors point at.
 * @returns One entry per open descriptor, e.g. `/tmp/hvli-upload-ab12/upload.h5p (deleted)`.
 */
export function openFileTargets(): string[] {
  const targets: string[] = [];
  for (const fd of readdirSync(FD_DIR)) {
    try {
      targets.push(readlinkSync(`${FD_DIR}/${fd}`));
    } catch {
      // The descriptor closed between the listing and the read.
    }
  }
  return targets;
}

/**
 * Lists the open files whose path contains a marker.
 * @param marker - Part of the path, e.g. `hvli-upload-`.
 * @returns The matching targets; empty when nothing with that path is held open.
 */
export const openFilesUnder = (marker: string): string[] =>
  openFileTargets().filter((target) => target.includes(marker));
