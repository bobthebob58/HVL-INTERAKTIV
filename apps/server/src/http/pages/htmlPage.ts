/**
 * htmlPage — builds the small server-rendered pages of Session 3 with an escaping `markup` template.
 *
 * Why: the Deep Linking picker, the portal start page and the friendly message pages stay server-rendered (D-067);
 *      the H5P player has its own template (../../h5p/render/playerPage.ts). Building them with an auto-escaping
 *      template means a title or message that contains `<`, quotes or `&` can never inject markup (XSS), whatever
 *      its source.
 * Spec: LTI-003, PROD-004, UD-013, UD-006
 * Invariants:
 *   - Every interpolated value is escaped unless it is a `SafeHtml` built by `markup` itself; arrays are joined,
 *     and `undefined`, `null` and `false` render as nothing.
 *   - The page declares its language and a viewport, has one `<main>` and one `<h1>` (A11Y), and loads no
 *     inline script or style: scripts are static files from our own origin (`script-src 'self'`, D-048).
 *   - Styles are the design tokens and the server pages' stylesheets, all same-origin files (D-067).
 *   - With a `help` link the page starts like the web app's: a skip link to `<main>`, then the `banner` header with
 *     the site name and **Hjelp** in a labelled `nav` (UD-013, UD-006); texts come from the locale files. Hjelp
 *     carries the page's locale (`?lang=`), because a new tab from Canvas has no launch to take it from (D-076).
 *   - The `ltik` and the CSRF token are never put in the page by this module; callers pass them as data
 *     attributes only where D-058 allows.
 * Collaborators: ./messagePage.ts, ./portalHomeRoutes.ts, ../../lti/pages/deepLinkPickerPage.ts, ./helpLink.ts,
 *   ./pageAssetRoutes.ts (the stylesheet), ../routes/staticRoutes.ts (`/h5p/theme/tokens.css`).
 * Tests: apps/server/test/http/pages/htmlPage.test.ts, apps/server/test/http/pages/serverPages.browser.test.ts
 */
import { t, type Locale } from '../../i18n/translate.js';
import { HELP_PATH, type HelpLink } from './helpLink.js';
import { SERVER_CHROME_STYLESHEET, SERVER_PAGES_STYLESHEET } from './pageAssetRoutes.js';

/** The design tokens, served by the H5P router's theme route without a session. */
const TOKENS_STYLESHEET = '/h5p/theme/tokens.css';

/** Markup that is already safe: built by `markup`, so its parts were escaped. */
export class SafeHtml {
  /**
   * @param value - The markup.
   */
  constructor(readonly value: string) {}

  /** @returns The markup. */
  toString(): string {
    return this.value;
  }
}

const ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * Escapes text for use in HTML content and quoted attribute values.
 * @param text - Any text.
 * @returns The text with `& < > " '` replaced by entities.
 */
export const escapeHtml = (text: string): string => text.replace(/[&<>"']/g, (c) => ENTITIES[c] ?? c);

/** What may be interpolated into `markup`. */
export type HtmlValue = SafeHtml | string | number | boolean | null | undefined | readonly HtmlValue[];

const render = (value: HtmlValue): string => {
  if (value instanceof SafeHtml) return value.value;
  if (Array.isArray(value)) return value.map((item: HtmlValue) => render(item)).join('');
  if (value === undefined || value === null || value === false) return '';
  return escapeHtml(String(value));
};

/**
 * Tagged template that escapes every interpolated value.
 * @param strings - The literal parts (trusted: written in our code).
 * @param values - The interpolated values (escaped unless SafeHtml).
 * @returns The markup.
 */
export function markup(strings: TemplateStringsArray, ...values: HtmlValue[]): SafeHtml {
  return new SafeHtml(
    strings.reduce((out, part, i) => out + part + (i < values.length ? render(values[i]) : ''), ''),
  );
}

/** What a page consists of. */
export interface PageInput {
  /** Language of the page (`lang` attribute). */
  readonly locale: Locale;
  /** Text for `<title>`; the site name is appended. */
  readonly title: string;
  /** The content of `<main>`; it must contain the page's one `<h1>`. */
  readonly main: SafeHtml;
  /** Same-origin paths of static scripts, loaded with `defer` at the end of the body. */
  readonly scripts?: readonly string[];
  /** Attributes for `<body>` (data attributes for page scripts), as name → value. */
  readonly bodyData?: Readonly<Record<string, string>>;
  /** The Hjelp link of the header (./helpLink.ts); without it the page has no header. */
  readonly help?: HelpLink | undefined;
}

/**
 * The skip link and the header with the site name and Hjelp, like the web app's SiteHeader.
 * @param locale - The page language.
 * @param siteName - The site name.
 * @param help - How the link opens.
 * @returns The markup before `<main>`.
 */
function siteHeader(locale: Locale, siteName: string, help: HelpLink): SafeHtml {
  // WHY: /hjelp follows an allowlisted `?lang=` when there is no launch (D-076 amendment), so nb and en stay nb and en.
  // SECURITY: a new tab cannot reach this window, and gets no Referer (UD-007, as apps/web's ExternalLink).
  const link = help.newTab
    ? markup`<a href="${HELP_PATH}?lang=${locale}" target="_blank" rel="noopener noreferrer">${t('page.help.link', {}, locale)}<span aria-hidden="true"> ↗</span><span class="hvl-visually-hidden"> ${t('page.help.newTab', {}, locale)}</span></a>`
    : markup`<a href="${HELP_PATH}?lang=${locale}" target="_top">${t('page.help.link', {}, locale)}</a>`;
  return markup`<a class="hvl-skip-link" href="#main">${t('page.skipToMain', {}, locale)}</a>
<header class="hvl-site-header">
<div class="hvl-site-header-bar">
<span class="hvl-site-name">${siteName}</span>
<nav aria-label="${t('page.help.nav', {}, locale)}"><ul><li>${link}</li></ul></nav>
</div>
</header>
`;
}

/**
 * Builds a complete HTML document.
 * @param input - Language, title, main content, scripts and body data attributes.
 * @param siteName - The site name for the title.
 * @returns The document as a string.
 */
export function htmlPage(input: PageInput, siteName: string): string {
  const data = Object.entries(input.bodyData ?? {}).map(([name, value]) => {
    if (!/^[a-z][a-z0-9-]*$/.test(name)) throw new Error(`invalid data attribute name: ${name}`);
    return markup` data-${new SafeHtml(name)}="${value}"`;
  });
  const scripts = (input.scripts ?? []).map((src) => {
    // SECURITY: only our own static files (D-048: script-src 'self'), never a URL from input.
    if (!/^\/static\/(?!.*\.\.)[a-zA-Z0-9/_.-]+\.js$/.test(src))
      throw new Error(`invalid script path: ${src}`);
    return markup`<script src="${src}" defer></script>`;
  });
  const chrome = input.help && {
    style: markup`<link rel="stylesheet" href="${SERVER_CHROME_STYLESHEET}">\n`,
    header: siteHeader(input.locale, siteName, input.help),
  };
  return markup`<!doctype html>
<html lang="${input.locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer">
<title>${input.title} – ${siteName}</title>
<link rel="stylesheet" href="${TOKENS_STYLESHEET}">
<link rel="stylesheet" href="${SERVER_PAGES_STYLESHEET}">
${chrome?.style}</head>
<body${data}>
${chrome?.header}<main id="main">
${input.main}
</main>
${scripts}
</body>
</html>
`.value;
}
