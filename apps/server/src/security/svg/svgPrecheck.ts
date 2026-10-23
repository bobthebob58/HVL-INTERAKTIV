/**
 * svgPrecheck — step 1 of SVG sanitising: refuses DTD tricks and strips the prolog parts nobody needs.
 *
 * Why: an internal DTD subset can define entities (external entities, "billion laughs") that an XML parser
 *      expands before any sanitiser sees the tree, and an `xml-stylesheet` instruction can load CSS or XSLT
 *      from anywhere. Inkscape and Illustrator write a harmless public DOCTYPE, which is simply removed (D-044).
 * Spec: SEC-001
 * Invariants:
 *   - Any `<!ENTITY` (any case, anywhere, even in a comment) is refused.
 *   - A DOCTYPE without an internal subset (name, optional PUBLIC/SYSTEM literals) is removed; any other
 *     DOCTYPE that remains afterwards (internal subset, malformed) is refused.
 *   - Every `<?xml-stylesheet ...?>` instruction is removed, also an unterminated one.
 *   - Works on text only; never parses XML, so nothing is expanded or fetched.
 * Collaborators: ../SvgSanitizer.ts (first step), ../RejectedUploadError.ts.
 * Tests: apps/server/test/security/SvgSanitizer.test.ts, apps/server/test/security/SvgSanitizer.bypass.test.ts
 */
import { RejectedUploadError } from '../RejectedUploadError.js';

const ENTITY_DECLARATION = /<!ENTITY/i;
const LITERAL = `(?:"[^"]*"|'[^']*')`;
const PLAIN_DOCTYPE = new RegExp(
  `<!DOCTYPE\\s+[^\\s>[\\]"']+(?:\\s+(?:PUBLIC\\s+${LITERAL}(?:\\s+${LITERAL})?|SYSTEM\\s+${LITERAL}))?\\s*>`,
  'gi',
);
const ANY_DOCTYPE = /<!DOCTYPE/i;
const XML_STYLESHEET = /<\?xml-stylesheet[\s\S]*?(?:\?>|$)/gi;

/**
 * Checks and pre-cleans the raw SVG text.
 * @param raw - The uploaded file, decoded as UTF-8.
 * @returns The text without a plain DOCTYPE and without `xml-stylesheet` instructions.
 * @throws RejectedUploadError `upload.file.svgRejected` for an entity declaration or an internal DTD subset.
 */
export function precheckSvg(raw: string): string {
  if (ENTITY_DECLARATION.test(raw)) throw new RejectedUploadError('upload.file.svgRejected');
  const withoutDoctype = raw.replace(PLAIN_DOCTYPE, '');
  if (ANY_DOCTYPE.test(withoutDoctype)) throw new RejectedUploadError('upload.file.svgRejected');
  return withoutDoctype.replace(XML_STYLESHEET, '');
}
