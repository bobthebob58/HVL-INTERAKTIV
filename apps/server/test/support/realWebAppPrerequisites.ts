/**
 * realWebAppPrerequisites — a describe block for the end-to-end flows that run on ./realWebApp.ts: the services,
 * the real H5P packages and the built web app must be there.
 *
 * Why: the S4 flows (publishing with a reason, the Canvas page with Spel and Rediger) mean nothing on stand-ins: they
 *      need the Next.js pages (D-068) and real content types (D-078). Locally a missing prerequisite skips the block
 *      and says which command provides it; in CI (`CI=true`) it is an error, never a silent skip, like the
 *      accessibility suite (apps/server/a11y/support/a11ySuite.ts).
 * Spec: NFR-004, PROD-003, LTI-006
 * Invariants:
 *   - The prerequisites are checked when the file loads, so a skipped block says why.
 *   - Nothing is started here; each flow starts its own Chromium (full Chromium where Canvas is involved, D-065).
 * Collaborators: ./services.ts, ./realPackages.ts, ../../src/web/nextWebApp.ts, ./realWebApp.ts.
 * Tests: apps/server/e2e/publishWithReason.e2e.test.ts, apps/server/e2e/appPlayEditor.e2e.test.ts
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe } from 'vitest';
import { WEB_APP_DIR } from '../../src/web/nextWebApp.js';
import { hasRealPackages } from './realPackages.js';
import { describeWithServices } from './services.js';

/** Why the flows cannot run here, or undefined when everything is in place. */
function missingPrerequisite(): string | undefined {
  // WHY: services.ts already fails in CI without them; outside CI it hands out `describe.skip`.
  if (describeWithServices !== describe) {
    return 'the services are not configured (copy apps/server/.env.example to apps/server/.env, D-023)';
  }
  if (!hasRealPackages()) return 'the real H5P packages are missing (run npm run h5p:fetch-libraries)';
  if (!existsSync(join(WEB_APP_DIR, '.next', 'BUILD_ID')))
    return 'the web app is not built (run npm run build)';
  return undefined;
}

const missing = missingPrerequisite();
if (missing && process.env.CI === 'true') throw new Error(`CI must run the web app e2e flows: ${missing}`);

/**
 * A describe block for a flow on the real web app, or a skipped block that says what is missing (outside CI).
 * @param name - The block's title; it starts with a requirement ID.
 * @param body - Defines the flow's hooks and tests.
 */
export function describeWithRealWebApp(name: string, body: () => void): void {
  if (missing) describe.skip(`${name} (skipped: ${missing})`, body);
  else describe(name, body);
}
