/**
 * next.config — the Next.js settings of the web app, which Express runs in its own process (D-068).
 *
 * Why: the app is the chrome around the H5P pages (D-067). It has no image optimiser, no telemetry and no
 *      `X-Powered-By`; the monorepo root is named so builds trace files from the workspace, not a parent folder.
 * Spec: UD-030, DATA-011
 * Invariants:
 *   - `images.unoptimized`: the image optimisation endpoint stays off (it had remote-code advisories, D-068).
 *   - Security headers and the nonce policy come from Express (apps/server/src/web), not from this file.
 * Collaborators: apps/server/src/web/nextWebApp.ts, package.json (`build`).
 * Tests: apps/server/test/web/webApp.browser.int.test.ts
 */
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));

/** @type {import('next').NextConfig} */
const config = {
  poweredByHeader: false,
  reactStrictMode: true,
  // SECURITY: no `/_next/image` endpoint; images are static files (D-068).
  images: { unoptimized: true },
  // A11Y: the development badge adds a floating control that is not part of the product.
  devIndicators: false,
  outputFileTracingRoot: root,
  turbopack: { root },
};

export default config;
