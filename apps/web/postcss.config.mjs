/**
 * postcss.config — runs Tailwind CSS v4 over the web app's stylesheet when Next.js builds it.
 *
 * Why: the web app styles with Tailwind classes generated from HVL's design tokens (D-072); Tailwind v4 plugs into
 *      Next.js through PostCSS only. The token theme itself is imported in src/app/globals.css.
 * Spec: UD-001, UD-002
 * Invariants:
 *   - Tailwind is the only plugin; no plugin may add colours or fonts outside packages/design-tokens.
 * Collaborators: src/app/globals.css, packages/design-tokens/dist/tailwind-theme.css, next.config.mjs.
 * Tests: apps/server/test/web/webPages.browser.int.test.ts (the built pages load their stylesheet without errors)
 */
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};

export default config;
