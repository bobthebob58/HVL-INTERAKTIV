/**
 * svgFinalCheck — step 4 of SVG sanitising: parses the result as a browser would and refuses it if anything
 * forbidden is left.
 *
 * Why: sanitisers have had bypasses (mutation XSS, namespace confusion). D-044 therefore re-checks the final
 *      text independently: it is parsed with an XML parser, as a browser parses `image/svg+xml`, and every
 *      node is checked against the same rules (./svgRules.ts). Anything unexpected fails closed.
 * Spec: SEC-001
 * Invariants:
 *   - The text holds no markup declaration (`<!` other than a comment) and no processing instruction (`<?`).
 *   - It is well-formed XML with exactly one root, `<svg>` in the SVG namespace; every element is in the SVG
 *     namespace and not forbidden; no animation targets href, an event handler or style.
 *   - Attributes are in no namespace, XLink or XML; `xmlns` declarations name only the SVG or XLink namespace;
 *     every attribute passes `cleanAttribute` unchanged; `<style>` holds only text that passes the CSS rules.
 * Collaborators: jsdom 26 (DOMParser), ./svgRules.ts, ../SvgSanitizer.ts, ../RejectedUploadError.ts.
 * Tests: apps/server/test/security/SvgSanitizer.test.ts, apps/server/test/security/SvgSanitizer.bypass.test.ts
 */
import { JSDOM } from 'jsdom';
import { RejectedUploadError } from '../RejectedUploadError.js';
import {
  ANIMATION_ELEMENTS,
  cleanAttribute,
  FORBIDDEN_ELEMENTS,
  isUnsafeAnimationTarget,
  SVG_NS,
  XLINK_NS,
  XML_NS,
  XMLNS_NS,
} from './svgRules.js';

const { window } = new JSDOM('');

/** Qualified name for the rules: real prefixes may differ, so XLink and XML attributes get their usual one. */
function ruleName(attribute: Attr): string | undefined {
  const local = attribute.localName.toLowerCase();
  if (attribute.namespaceURI === null) return local;
  if (attribute.namespaceURI === XLINK_NS) return `xlink:${local}`;
  if (attribute.namespaceURI === XML_NS) return `xml:${local}`;
  return undefined;
}

/** Reason the element breaks a rule, or undefined. */
function elementViolation(element: Element): string | undefined {
  const name = element.localName.toLowerCase();
  if (element.namespaceURI !== SVG_NS) return 'foreign namespace';
  if (FORBIDDEN_ELEMENTS.has(name)) return 'forbidden element';
  if (ANIMATION_ELEMENTS.has(name) && isUnsafeAnimationTarget(element.getAttribute('attributeName'))) {
    return 'unsafe animation';
  }
  if (name === 'style' && (element.childElementCount > 0 || cleanStyle(element) === false)) return 'style';
  for (const attribute of [...element.attributes]) {
    if (attribute.namespaceURI === XMLNS_NS) {
      if (attribute.value !== SVG_NS && attribute.value !== XLINK_NS) return 'namespace declaration';
      continue;
    }
    const qualified = ruleName(attribute);
    if (qualified === undefined) return 'attribute namespace';
    if (cleanAttribute(name, qualified, attribute.value) !== attribute.value) return 'attribute';
  }
  return undefined;
}

/** False when the CSS of a `<style>` element would be changed by the rules. */
function cleanStyle(element: Element): boolean {
  const css = element.textContent ?? '';
  return cleanAttribute('style', 'style', css) === css;
}

/** Reason the whole text breaks a rule, or undefined. */
function documentViolation(text: string): string | undefined {
  if (/<!(?!--)/.test(text) || text.includes('<?')) return 'declaration or instruction';
  const document = new window.DOMParser().parseFromString(text, 'image/svg+xml');
  const root = document.documentElement;
  if (root.namespaceURI !== SVG_NS || root.localName !== 'svg') return 'root';
  for (const node of [...document.childNodes]) {
    if (node !== root && node.nodeType !== window.Node.COMMENT_NODE) return 'node outside root';
  }
  for (const element of [root, ...root.querySelectorAll('*')]) {
    const violation = elementViolation(element);
    if (violation) return violation;
  }
  return undefined;
}

/**
 * Verifies a sanitised SVG.
 * @param text - The output of ./svgPurify.ts.
 * @throws RejectedUploadError `upload.file.svgRejected` when anything forbidden is left or the XML is not
 *   well-formed (a parse error becomes a `<parsererror>` root, which fails the root check).
 */
export function assertSafeSvg(text: string): void {
  if (text.trim() === '' || documentViolation(text) !== undefined) {
    throw new RejectedUploadError('upload.file.svgRejected');
  }
}
