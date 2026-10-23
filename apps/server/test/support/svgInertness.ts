/**
 * svgInertness — an independent judge of sanitised SVG: lists everything in it that could run script or load
 * something from outside, as seen by an XML parser (how browsers read image/svg+xml) and by an HTML parser
 * (in case a file is ever served as HTML).
 *
 * Why: the SEC-001 tests must not trust the sanitiser's own rules (src/security/svg/svgRules.ts), so this file
 *      re-implements the checks from the acceptance criteria in a simpler, separate way.
 * Spec: SEC-001
 * Tests: used by apps/server/test/security/SvgSanitizer.test.ts and SvgSanitizer.bypass.test.ts.
 */
import { JSDOM } from 'jsdom';

const { window } = new JSDOM('');
const FORBIDDEN = ['script', 'foreignobject', 'iframe', 'object', 'embed', 'set', 'handler', 'listener'];
const ANIMATIONS = ['animate', 'animatemotion', 'animatetransform', 'animatecolor', 'set'];
const SCRIPT_URL = /javascript:|vbscript:|data:text\/html|data:application\/xhtml|data:image\/svg/i;
const SAFE_HREF = /^(?:#[\w.:-]+|data:image\/(?:png|jpeg|gif|webp);base64,[A-Za-z0-9+/=\s]+)$/;
const EXTERNAL_URL = /url\s*\(\s*(?!['"]?#)/i;

/** Problems in one parsed document. */
function documentProblems(document: Document, parser: string): string[] {
  const problems: string[] = [];
  const say = (what: string) => problems.push(`${parser}: ${what}`);
  for (const element of [...document.querySelectorAll('*')]) {
    const name = element.localName.toLowerCase();
    if (FORBIDDEN.includes(name)) say(`<${name}> element`);
    if (ANIMATIONS.includes(name) && /href|^\s*on|style/i.test(element.getAttribute('attributeName') ?? '')) {
      say(`<${name}> animates a link, handler or style`);
    }
    if (
      name === 'style' &&
      (/@import/i.test(element.textContent ?? '') || EXTERNAL_URL.test(element.textContent ?? ''))
    ) {
      say('<style> loads external CSS or resources');
    }
    for (const attr of [...element.attributes]) {
      const value = [...attr.value].filter((c) => c > ' ').join('');
      if (/^on/i.test(attr.localName)) say(`${attr.name} event handler`);
      if (SCRIPT_URL.test(value)) say(`${attr.name} has a script URL`);
      if (attr.localName.toLowerCase() === 'href' && !SAFE_HREF.test(attr.value))
        say(`${attr.name}="${attr.value}"`);
      if (EXTERNAL_URL.test(attr.value) || /\\/.test(attr.value))
        say(`${attr.name} has an external or escaped url()`);
    }
  }
  return problems;
}

/**
 * Lists the reasons a sanitised SVG is not inert.
 * @param text - The sanitiser's output.
 * @returns An empty array when the SVG is inert.
 */
export function svgProblems(text: string): string[] {
  const problems: string[] = [];
  if (/<!DOCTYPE|<!ENTITY|<!ATTLIST|<\?xml-stylesheet/i.test(text))
    problems.push('DTD or stylesheet instruction');
  if (!/^<svg[\s>/]/.test(text)) problems.push('does not start with <svg');
  const xml = new window.DOMParser().parseFromString(text, 'image/svg+xml');
  if (
    xml.documentElement.localName !== 'svg' ||
    xml.documentElement.namespaceURI !== 'http://www.w3.org/2000/svg'
  ) {
    problems.push('not a well-formed SVG document');
  }
  for (const element of [...xml.querySelectorAll('*')]) {
    if (element.namespaceURI !== 'http://www.w3.org/2000/svg')
      problems.push(`xml: ${element.tagName} outside SVG`);
  }
  problems.push(...documentProblems(xml, 'xml'));
  problems.push(...documentProblems(new JSDOM(text).window.document, 'html'));
  return problems;
}

/**
 * Names of the SVG-namespace elements of a document, in document order, as an XML parser sees them.
 * @param text - SVG markup (the DOCTYPE is removed first, since the XML parser here does not load DTDs).
 * @returns Local names such as ["svg", "defs", "linearGradient", …].
 */
export function svgElementNames(text: string): string[] {
  const xml = new window.DOMParser().parseFromString(text.replace(/<!DOCTYPE[^>]*>/i, ''), 'image/svg+xml');
  return [...xml.querySelectorAll('*')]
    .filter((element) => element.namespaceURI === 'http://www.w3.org/2000/svg')
    .map((element) => element.localName);
}
