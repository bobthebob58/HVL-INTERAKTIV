/**
 * cli — runs the mock Feide and the mock Canvas by hand and prints the tool environment that points at them:
 * `node tools/mock-platform/cli.mjs --tool-url http://localhost:3000 --canvas-port 4100 --feide-port 4200`.
 *
 * Why: developers and reviewers try the Feide login and the Canvas launch in a browser without HVL's Feide client
 *      or TeCopp's Canvas (D-049). The printed lines can be pasted into apps/server/.env.
 * Spec: LTI-001, LTI-008, LTI-012, AUTH-001
 * Invariants:
 *   - Prints `NAME=value` lines (LTI_PLATFORMS single-quoted), then the Canvas home page, the Canvas service
 *     controls under `/__mock/` (faults, line-item deletion, token revocation, recorded scores) and the Feide users.
 *   - SIGINT and SIGTERM close both servers and exit with code 0; bad arguments exit with code 2 and the usage.
 *   - Prints no secret beyond the mock's own fixed client secret, which the mock does not check.
 * Collaborators: ./mockPlatform.mjs, ./mockCanvas.mjs (`toolBaseUrl` checks the tool URL).
 * Tests: tools/mock-platform/test/cli.test.mjs
 */
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { toolBaseUrl } from './mockCanvas.mjs';
import { startMockPlatform } from './mockPlatform.mjs';

/** How to call the CLI. */
export const USAGE =
  'usage: node tools/mock-platform/cli.mjs --tool-url <http(s) URL> [--canvas-port <port>] [--feide-port <port>]';

const port = (raw, name) => {
  const value = Number(raw ?? 0);
  if (!Number.isInteger(value) || value < 0 || value > 65535)
    throw new RangeError(`--${name} must be a port`);
  return value;
};

/**
 * Parses the command line.
 * @param {string[]} argv - Arguments after the script name.
 * @returns {{toolUrl: string, canvasPort: number, feidePort: number}} The options.
 * @throws {Error} For unknown options, a missing or non-http(s) `--tool-url`, or a bad port.
 */
export function parseCliArgs(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      'tool-url': { type: 'string' },
      'canvas-port': { type: 'string' },
      'feide-port': { type: 'string' },
    },
    strict: true,
  });
  if (!values['tool-url']) throw new Error('--tool-url is required');
  return {
    toolUrl: toolBaseUrl(values['tool-url']),
    canvasPort: port(values['canvas-port'], 'canvas-port'),
    feidePort: port(values['feide-port'], 'feide-port'),
  };
}

/**
 * The environment as `.env` lines.
 * @param {Record<string, string>} env - From `startMockPlatform`.
 * @returns {string[]} One `NAME=value` line per variable; JSON values are single-quoted.
 */
export const envLines = (env) =>
  Object.entries(env).map(([name, value]) =>
    value.startsWith('[') ? `${name}='${value}'` : `${name}=${value}`,
  );

async function main() {
  let options;
  try {
    options = parseCliArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`${error.message}\n${USAGE}`);
    process.exit(2);
  }
  const platform = await startMockPlatform(options);
  console.log('# HVL Interaktiv mock platform (D-049): add these lines to apps/server/.env');
  for (const line of envLines(platform.env)) console.log(line);
  const { origin } = platform.canvas;
  console.log(`# Mock Canvas home page with demo launches: ${origin}/`);
  console.log(
    `# Mock Canvas services (AGS, NRPS): line items, scores and token requests at ${origin}/__mock/services`,
  );
  console.log(`#   next score posts fail: POST ${origin}/__mock/faults?target=scores&status=503&count=2`);
  console.log('#   (targets token, scores, lineItems, memberships; also retryAfter, delayMs, error)');
  console.log(`#   delete a line item: POST ${origin}/__mock/line-items/delete?url=<line item URL>`);
  console.log(`#   forget every access token: POST ${origin}/__mock/tokens/revoke`);
  console.log(`# Mock Feide users: ${[...platform.feide.users.keys()].join(', ')}`);
  console.log(`#   choose the next one with ${platform.feide.issuer}/__mock/next-login?user=<key>`);
  console.log('# Press Ctrl+C to stop.');
  const stop = async (signal) => {
    await platform.close();
    console.log(`# Mock platform stopped (${signal}).`);
    process.exit(0);
  };
  process.once('SIGINT', () => void stop('SIGINT'));
  process.once('SIGTERM', () => void stop('SIGTERM'));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`mock platform failed to start: ${error.message}`);
    process.exit(1);
  });
}
