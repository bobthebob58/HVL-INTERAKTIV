/**
 * clientScripts — runs the editor page's browser scripts (src/h5p/render/client) without a browser, for unit tests.
 *
 * Why: the scripts only define page-level functions; the tests load them in the page's order into a bare VM context
 *      and call those functions, so one loader keeps the folder and the joining in one place.
 * Spec: PROD-003, UD-006
 * Tests: used by ./editorFieldChain.test.ts, ./editorFieldsScript.test.ts and ./editorPageScript.test.ts.
 */
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const read = (name: string): string =>
  readFileSync(new URL(`../../../src/h5p/render/client/${name}`, import.meta.url), 'utf8');

/** Runs the named scripts, joined in the given order, in a fresh context of `globals`, and returns that context. */
export function runClientScripts<T>(names: readonly string[], globals: Record<string, unknown>): T {
  runInNewContext(names.map(read).join('\n'), globals);
  return globals as unknown as T;
}
