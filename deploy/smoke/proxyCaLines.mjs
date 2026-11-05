/**
 * proxyCaLines — `node deploy/smoke/proxyCaLines.mjs <proxy CA bundle> <known roots PEM>`: prints the base64 lines of
 * the certificates in the proxy CA bundle that are not public roots the image already knows, so the smoke test can
 * search the image's files for them.
 *
 * Why: the development sandbox passes its agent proxy's CA bundle to the build as an optional BuildKit secret (D-110,
 *      probe P3), and it must never reach a layer. `docker history` shows only instructions, not file contents, so the
 *      smoke test searches every file of the image for the proxy's own certificates. The bundle also holds the public
 *      roots, which Node's binary and some packages carry anyway, so those are left out by comparing whole
 *      certificates, not lines (Node wraps its roots at another width).
 * Spec: NFR-007
 * Invariants:
 *   - Prints only base64 lines of certificates (public data), one per line, without repeats; a count goes to stderr.
 *   - A certificate is "known" only when its whole base64 body equals one in the known roots.
 * Collaborators: ./smokeBuild.sh (`check_no_proxy_ca`), the image's `tls.rootCertificates`.
 * Tests: it is a check of the smoke test (./dockerSmoke.sh); a CA copied into a test image was found, and none was
 *   found in the smoke image (D-110 amendment of 2026-11-05).
 */
import { readFileSync } from 'node:fs';

const [bundleFile, knownFile] = process.argv.slice(2);
const bodies = (text) =>
  [...text.matchAll(/-----BEGIN CERTIFICATE-----([\s\S]*?)-----END CERTIFICATE-----/g)].map(
    (match) => match[1],
  );
const flat = (body) => body.replace(/\s+/g, '');

const known = new Set(bodies(readFileSync(knownFile, 'utf8')).map(flat));
const own = bodies(readFileSync(bundleFile, 'utf8')).filter((body) => !known.has(flat(body)));
const lines = new Set(
  own.flatMap((body) =>
    body
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => /^[A-Za-z0-9+/=]{40,}$/.test(line)),
  ),
);
process.stderr.write(`proxy CA: ${own.length} certificates of its own, ${lines.size} lines to look for\n`);
process.stdout.write([...lines].map((line) => `${line}\n`).join(''));
