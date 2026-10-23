/**
 * svgRules — the element, reference and CSS rules that decide what may stay in an uploaded SVG.
 *
 * Why: D-044 allows only in-document references and raster data images, and no script, event handlers,
 *      attribute animation of links, or external loads from CSS. The DOMPurify pass (./svgPurify.ts) applies
 *      these rules and the final check (./svgFinalCheck.ts) verifies them again on the result, so both must
 *      use the very same functions.
 * Spec: SEC-001
 * Invariants:
 *   - `href`/`xlink:href` (any prefix) may only be `#id`, or a base64 PNG/JPEG/GIF/WebP data URL on
 *     `<image>`/`<feImage>` whose bytes really start with that format's magic number.
 *   - CSS may contain no backslash escape, `@import`, external `url()`, resource-fetching function,
 *     legacy binding or script URL; `neutraliseCss` either returns CSS that passes `findCssViolation` or undefined.
 *   - Every rule is a pure function of names and values; no I/O and no DOM access.
 * Collaborators: ./svgPurify.ts, ./svgFinalCheck.ts.
 * Tests: apps/server/test/security/SvgSanitizer.test.ts, apps/server/test/security/SvgSanitizer.bypass.test.ts
 */

/** The SVG namespace; every element of a stored SVG is in it. */
export const SVG_NS = 'http://www.w3.org/2000/svg';
/** The XLink namespace (`xlink:href`, `xlink:title`). */
export const XLINK_NS = 'http://www.w3.org/1999/xlink';
/** The XML namespace (`xml:space`, `xml:lang`). */
export const XML_NS = 'http://www.w3.org/XML/1998/namespace';
/** The namespace of `xmlns` declarations. */
export const XMLNS_NS = 'http://www.w3.org/2000/xmlns/';

/** Elements that run script, embed other documents or rewrite attributes; lower-case local names. */
export const FORBIDDEN_ELEMENTS: ReadonlySet<string> = new Set([
  'script',
  'foreignobject',
  'set',
  'handler',
  'listener',
  'iframe',
  'embed',
  'object',
]);
/** SMIL animation elements, which may change another attribute over time. */
export const ANIMATION_ELEMENTS: ReadonlySet<string> = new Set([
  'animate',
  'animatecolor',
  'animatemotion',
  'animatetransform',
  'set',
]);

const FRAGMENT = /^#[\p{L}\p{N}_.:-]+$/u;
const RASTER_DATA_URL = /^data:image\/(png|jpeg|gif|webp);base64,([A-Za-z0-9+/=\s]+)$/i;
const DATA_URL_ELEMENTS: ReadonlySet<string> = new Set(['image', 'feimage']);
const MAGIC: Readonly<Record<string, (bytes: Buffer) => boolean>> = {
  png: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  jpeg: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  gif: (b) => /^GIF8[79]a$/.test(b.toString('latin1', 0, 6)),
  webp: (b) => b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP',
};
// SECURITY: browsers strip tabs, newlines and control characters inside URLs ("java\tscript:"), so they are
// removed before matching.
const SCRIPT_SCHEME = /(?:java|vb|live)script:|data:(?:text\/html|application\/xhtml|image\/svg)/i;
const CSS_COMMENT = /\/\*[\s\S]*?(?:\*\/|$)/g;
const URL_START = /url\s*\(/gi;
const URL_FUNCTION = /url\s*\(\s*(?:"([^"]*)"|'([^']*)'|([^"'()\s]*))\s*\)/gi;
const FETCHING_FUNCTION = /(?:image-set|image|cross-fade|element|src|attr|expression|paint)\s*\(/i;
const LEGACY_BINDING = /-moz-binding|behavior\s*:/i;

/** Drops spaces and C0/C1 control characters, which browsers ignore inside a URL scheme. */
const withoutControlCharacters = (value: string): string =>
  Array.from(value)
    .filter((c) => {
      const code = c.codePointAt(0) ?? 0;
      return code > 0x20 && (code < 0x7f || code > 0x9f);
    })
    .join('');

/**
 * Tells whether a value names a script-capable URL scheme.
 * @param value - An attribute value or CSS text.
 * @returns True for javascript:, vbscript:, livescript:, data:text/html, data:application/xhtml and data:image/svg.
 */
export const hasScriptScheme = (value: string): boolean =>
  SCRIPT_SCHEME.test(withoutControlCharacters(value));

/**
 * Tells whether a link target is allowed on an element (D-044).
 * @param value - The `href`/`xlink:href` value.
 * @param element - Lower-case local name of the element that carries it.
 * @returns True for `#id`, or a raster data URL with matching magic bytes on `<image>`/`<feImage>`.
 */
export function isAllowedHref(value: string, element: string): boolean {
  if (FRAGMENT.test(value)) return true;
  const data = RASTER_DATA_URL.exec(value);
  if (!data?.[1] || !data[2] || !DATA_URL_ELEMENTS.has(element)) return false;
  const bytes = Buffer.from(data[2].replace(/\s/g, ''), 'base64');
  return MAGIC[data[1].toLowerCase()]?.(bytes) ?? false;
}

/**
 * Tells whether an animation element targets an attribute that must never be animated.
 * @param attributeName - The element's `attributeName`, or null when it has none.
 * @returns True for href (any prefix), event handlers and style.
 */
export function isUnsafeAnimationTarget(attributeName: string | null): boolean {
  if (attributeName === null) return false;
  const local = attributeName
    .trim()
    .toLowerCase()
    .replace(/^[^:]*:/, '');
  return local === 'href' || local.startsWith('on') || local === 'style';
}

const withoutComments = (css: string): string => css.replace(CSS_COMMENT, ' ');

/**
 * Finds the first forbidden construct in CSS text (a `<style>` element, a `style` or presentation attribute).
 * @param css - The CSS text as the DOM holds it.
 * @returns A short reason, or undefined when the CSS is acceptable.
 */
export function findCssViolation(css: string): string | undefined {
  const text = withoutComments(css);
  if (text.includes('\\')) return 'escape';
  if (/@import/i.test(text)) return 'import';
  if (FETCHING_FUNCTION.test(text) || LEGACY_BINDING.test(text)) return 'fetching function';
  if (hasScriptScheme(text)) return 'script url';
  const urls = [...text.matchAll(URL_START)].length;
  const local = [...text.matchAll(URL_FUNCTION)].filter((m) => FRAGMENT.test(m[1] ?? m[2] ?? m[3] ?? ''));
  return urls === local.length ? undefined : 'external url';
}

/**
 * Removes `@import` rules and external `url()` references from CSS (D-044).
 * @param css - The CSS text as the DOM holds it.
 * @returns The cleaned CSS (comments become spaces, external url() becomes `none`), or undefined when it
 *   still has a forbidden construct and must be dropped as a whole.
 */
export function neutraliseCss(css: string): string | undefined {
  const text = withoutComments(css)
    .replace(/@import[^;]*;?/gi, ' ')
    .replace(URL_FUNCTION, (match, ...groups: (string | undefined)[]) =>
      FRAGMENT.test(groups[0] ?? groups[1] ?? groups[2] ?? '') ? match : 'none',
    );
  return findCssViolation(text) === undefined ? text : undefined;
}

/**
 * Decides what happens to one attribute.
 * @param element - Lower-case local name of the element.
 * @param name - Lower-case qualified attribute name, e.g. `xlink:href`, `style`, `xmlns:xlink`.
 * @param value - The attribute value as the DOM holds it.
 * @returns The value to keep (possibly rewritten for `style`), or undefined to drop the attribute.
 */
export function cleanAttribute(element: string, name: string, value: string): string | undefined {
  const local = name.slice(name.lastIndexOf(':') + 1);
  if (name.startsWith('on') || local.startsWith('on')) return undefined;
  if (name === 'xmlns' || name.startsWith('xmlns:')) {
    return value === SVG_NS || value === XLINK_NS ? value : undefined;
  }
  if (local === 'href') return isAllowedHref(value, element) ? value : undefined;
  if (hasScriptScheme(value)) return undefined;
  if (name === 'style') return neutraliseCss(value);
  return findCssViolation(value) === undefined ? value : undefined;
}
