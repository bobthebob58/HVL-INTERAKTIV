/**
 * Probe P5 (Mustache part): how Mustache 4.2.0 lists a template's tags, renders with a per-render escape function,
 * and treats missing values, for the pedagogisk mappe template loader and renderer (D-094).
 *
 * Why: the loader checks every tag of `content/mappe/template.*.md` against an allowlist and refuses unescaped tags,
 *      partials and delimiter changes; the renderer swaps Mustache's HTML escaper for the Markdown escaper without
 *      touching the global `Mustache.escape`. These tests pin the facts both are written from: `{{{x}}}` and
 *      `{{&x}}` both parse as '&' (there is no '{' type), closing tags vanish from the tree, errors carry a character
 *      offset, a missing value renders as nothing, a name missing on a list item falls through to the parent, and
 *      `Mustache.parse` hands out the cached spans that `render` reuses, so the loader must not edit them.
 * Spec: MAPPE-002
 * Collaborators: mustache 4.2.0; src/learningDesign/mappe/markdownEscape.ts; markdown-it 14.3.3 (to read results).
 * Tests: this file.
 */
import MarkdownIt from 'markdown-it';
import Mustache, { type TemplateSpans } from 'mustache';
import { describe, expect, it } from 'vitest';
import { escapeMarkdownValue } from '../../../src/learningDesign/mappe/markdownEscape.js';

/** A Markdown render option set that escapes values for Markdown and pins the delimiters for this call only. */
const MARKDOWN = { escape: escapeMarkdownValue, tags: ['{{', '}}'] as [string, string] };

/** Lists every tag (not text) as `type name`, with ` in a/b` naming the sections around it, and its offset. */
function listTags(spans: TemplateSpans, sections: string[] = []): string[] {
  return spans.flatMap((span) => {
    const [type, name] = span;
    if (type === 'text') return [];
    const own = `${type} ${name}${sections.length > 0 ? ` in ${sections.join('/')}` : ''}`;
    // WHY: a section's children are at index 4; a partial keeps its indentation (a string) there.
    const children: unknown = (span as unknown[])[4];
    return Array.isArray(children)
      ? [own, ...listTags(children as TemplateSpans, [...sections, name])]
      : [own];
  });
}

const TEMPLATE = [
  '## {{ title }}',
  '{{! a comment }}',
  '{{#activities}}',
  '### {{name}} {{{raw}}} {{&amp}} {{.}} {{course.code}}',
  '{{^outcomes}}Ingen{{/outcomes}}',
  '{{/activities}}',
  '{{> partial}}',
].join('\n');

describe('[MAPPE-002] probe P5: Mustache 4.2.0 template tags, escaping and missing values', () => {
  it('[MAPPE-002] Mustache.parse lists every tag with its type and section; {{{x}}} and {{&x}} are both "&"', () => {
    // Act
    const spans = Mustache.parse(TEMPLATE, ['{{', '}}']);
    // Assert
    expect(listTags(spans)).toEqual([
      'name title', // WHY: the space inside `{{ title }}` is trimmed.
      '! a comment',
      '# activities',
      'name name in activities',
      '& raw in activities',
      '& amp in activities',
      'name . in activities',
      'name course.code in activities',
      '^ outcomes in activities',
      '> partial',
    ]);
    // WHY: only the source tells the two '&' forms apart; the offsets (index 2 and 3) point into it.
    const section = spans.find(([type]) => type === '#');
    const children = (section as unknown[] | undefined)?.[4] as TemplateSpans;
    const ampersands = children
      .filter(([type]) => type === '&')
      .map(([, , start, end]) => TEMPLATE.slice(start, end));
    expect(ampersands).toEqual(['{{{raw}}}', '{{&amp}}']);
  });

  it('[MAPPE-002] a delimiter change is an "=" tag; later tags use the new delimiters and old braces become text', () => {
    const spans = Mustache.parse('{{=<% %>=}}\n<% after %> {{before}}', ['{{', '}}']);
    expect(listTags(spans)).toEqual(['= <% %>', 'name after']);
  });

  it.each([
    ['{{a', 'Unclosed tag at 3'],
    ['{{{a}}', 'Unclosed tag at 6'],
    ['{{#a}}x', 'Unclosed section "a" at 7'],
    ['{{/a}}', 'Unopened section "a" at 0'],
    ['{{#a}}{{/b}}', 'Unclosed section "a" at 6'],
    ['{{=<% %>}}', 'Unclosed tag at 10'],
  ])(
    '[MAPPE-002] a broken template %j throws with a character offset the loader turns into a line',
    (template, message) => {
      expect(() => Mustache.parse(template, ['{{', '}}'])).toThrow(message);
    },
  );

  it('[MAPPE-002] the per-render escape option escapes for Markdown and leaves the global HTML escaper alone', () => {
    // Arrange
    const view = { title: '# Ikkje ei overskrift', activities: [{ name: '[lenke](https://evil.example)' }] };
    // Act
    const markdown = Mustache.render(
      '## {{title}}\n{{#activities}}\n- {{name}}\n{{/activities}}\n',
      view,
      {},
      MARKDOWN,
    );
    // Assert
    expect(markdown).toBe('## \\# Ikkje ei overskrift\n- \\[lenke\\](https://evil.example)\n');
    const tokens = new MarkdownIt().parse(markdown, {});
    expect(tokens.filter((token) => token.type.endsWith('_open')).map((token) => token.tag)).toEqual([
      'h2',
      'ul',
      'li',
      'p',
    ]);
    expect(Mustache.escape('<a>')).toBe('&lt;a&gt;');
    expect(Mustache.render('{{v}}', { v: '<a>' })).toBe('&lt;a&gt;');
  });

  it('[MAPPE-002] "&" tags bypass the escape option, so the loader must refuse {{{x}}} and {{&x}}', () => {
    const view = { v: '# x' };
    expect(Mustache.render('{{v}}|{{{v}}}|{{&v}}', view, {}, MARKDOWN)).toBe('\\# x|# x|# x');
  });

  it('[MAPPE-002] a custom escape receives numbers and booleans as they are; the default one stringifies numbers', () => {
    // Arrange
    const seen: string[] = [];
    const spy = (value: unknown): string => {
      seen.push(typeof value);
      return String(value);
    };
    // Act
    const rendered = Mustache.render('{{n}} {{b}} {{s}}', { n: -1, b: false, s: 'x' }, {}, { escape: spy });
    // Assert
    expect([rendered, seen]).toEqual(['-1 false x', ['number', 'boolean', 'string']]);
    expect(Mustache.render('{{n}}', { n: -1 }, {}, MARKDOWN)).toBe('\\-1');
  });

  it('[MAPPE-002] a missing or null value renders as nothing without an error, and so does a missing partial', () => {
    // Act
    const rendered = Mustache.render(
      '[{{missing}}][{{nil}}][{{#missing}}S{{/missing}}][{{^missing}}inv{{/missing}}][{{^empty}}tom{{/empty}}][{{> p}}]',
      { nil: null, empty: [] },
      {},
      MARKDOWN,
    );
    // Assert
    expect(rendered).toBe('[][][][inv][tom][]');
  });

  it('[MAPPE-002] a name missing on a list item falls through to the parent; an own null key stops it', () => {
    const view = { title: 'ROOT', items: [{ title: 'a' }, {}, { title: null }] };
    expect(Mustache.render('{{#items}}[{{title}}]{{/items}}', view, {}, MARKDOWN)).toBe('[a][ROOT][]');
  });

  it('[MAPPE-002] prototype names resolve on a plain view, so only an allowlist keeps them out of a template', () => {
    // Act and assert
    expect(Mustache.render('{{toString}}|{{title.length}}', { title: 'abc' }, {}, MARKDOWN)).toBe(
      '\\[object Object\\]|3',
    );
    // WHY: `constructor` is called as a lambda and returns an object, which the Markdown escaper refuses.
    expect(() => Mustache.render('{{constructor}}', {}, {}, MARKDOWN)).toThrow(TypeError);
    expect(Mustache.render('[{{constructor}}]', Object.create(null) as object, {}, MARKDOWN)).toBe('[]');
  });

  it('[MAPPE-002] parse returns the cached spans render reuses, and a {} partials map resolves prototype names', () => {
    // Arrange
    const template = 'A {{x}} B';
    const spans = Mustache.parse(template, ['{{', '}}']);
    // Act
    const same = spans === Mustache.parse(template, ['{{', '}}']);
    (spans[1] as unknown[])[0] = '&'; // WHY: a loader that edits the spans in place changes every later render.
    let afterEdit: string;
    try {
      afterEdit = Mustache.render(template, { x: '# h' }, {}, MARKDOWN);
    } finally {
      Mustache.clearCache();
    }
    // Assert
    expect([same, afterEdit]).toEqual([true, 'A # h B']);
    // WHY: `{}` has `toString`, so pass `undefined` (or a null-prototype map) as the partials argument.
    expect(() => Mustache.render('{{> toString}}', {}, {}, MARKDOWN)).toThrow(TypeError);
    expect(Mustache.render('[{{> toString}}]', {}, undefined, MARKDOWN)).toBe('[]');
  });

  it('[MAPPE-002] a section or comment tag alone on its line disappears with its line ending', () => {
    const rendered = Mustache.render('A\n{{#s}}\nB\n{{/s}}\n{{! note }}\nC\n', { s: true }, {}, MARKDOWN);
    expect(rendered).toBe('A\nB\nC\n');
  });
});
