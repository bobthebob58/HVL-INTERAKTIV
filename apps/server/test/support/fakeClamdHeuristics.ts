/**
 * fakeClamdHeuristics — what a clamd with `AlertEncrypted yes` and `AlertExceedsMax yes` reports for a stream it
 * cannot scan in full, for ./fakeClamd.ts: a ZIP whose entry needs a password, a PDF with an `/Encrypt` entry, and
 * stored ZIPs nested past clamd's default limit.
 *
 * Why: the clamd settings probe (../../src/security/malware/ClamdSettingsProbe.ts) needs a fake that answers its
 *      streams as a strict clamd does and, on request, as a lax one. Reading the streams' structure rather than
 *      comparing bytes keeps the fake right for every nonce the probe draws (D-110 amendment of 2026-11-06).
 * Spec: SEC-006
 * Invariants:
 *   - Reads only outer structure: a ZIP's first local header, a PDF's `/Encrypt` key, and stored ZIPs one inside the
 *     other; any other stream has no heuristic.
 *   - Nesting is counted as ClamAV 1.4.6 does at its default `MaxRecursion 17`: 16 ZIPs deep and more are reported,
 *     15 are not (measured with fresh streams).
 * Collaborators: ./fakeClamd.ts; the streams of ../../src/security/malware/clamdProbeStreams.ts.
 * Tests: used by apps/server/test/security/malware/FailClosedMalwareScanner.settings.test.ts and the other
 *   fake-clamd tests.
 */

const LOCAL_HEADER = 0x04034b50;
const DEEPEST_SCANNED_NESTING = 15;

/** Whether `data` starts with a ZIP local file header. */
const isZip = (data: Buffer): boolean => data.length >= 30 && data.readUInt32LE(0) === LOCAL_HEADER;

/** The data of a ZIP's first entry when it is stored (not compressed), otherwise undefined. */
function storedEntry(data: Buffer): Buffer | undefined {
  if (!isZip(data) || data.readUInt16LE(8) !== 0) return undefined;
  const start = 30 + data.readUInt16LE(26) + data.readUInt16LE(28);
  return data.subarray(start, start + data.readUInt32LE(18));
}

/**
 * The heuristic a strict clamd reports for `data`, if any.
 * @param data - A completed `INSTREAM`.
 * @returns `Heuristics.Encrypted.Zip`, `Heuristics.Encrypted.PDF`, `Heuristics.Limits.Exceeded.MaxRecursion`, or
 *   undefined when a strict clamd would scan it in full.
 */
export function strictHeuristic(data: Buffer): string | undefined {
  if (isZip(data) && (data.readUInt16LE(6) & 0x0001) === 1) return 'Heuristics.Encrypted.Zip';
  if (data.subarray(0, 5).toString('latin1') === '%PDF-' && data.includes('/Encrypt')) {
    return 'Heuristics.Encrypted.PDF';
  }
  let depth = 0;
  for (let inner = storedEntry(data); inner !== undefined; inner = storedEntry(inner)) depth += 1;
  return depth > DEEPEST_SCANNED_NESTING ? 'Heuristics.Limits.Exceeded.MaxRecursion' : undefined;
}
