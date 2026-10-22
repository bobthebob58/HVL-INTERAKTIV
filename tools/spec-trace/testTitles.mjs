/**
 * testTitles — finds the titles of describe/it/test calls in a test file, and which of them run.
 *
 * Why: an `[ID]` counts as tested only when it opens the title of a test that runs (DOC-004, D-033).
 *      A plain regex also matched commented-out calls, calls inside strings and tests in `describe.skip`.
 * Spec: DOC-004, DOC-006
 * Invariants:
 *   - Comments, string contents and regex literals are blanked before calls are matched; offsets are kept.
 *   - A test is inactive when it, or an enclosing describe, uses `skip`, `todo` or `skipIf`, or the `x`
 *     prefix (`xit`, `xdescribe`); `it.fails` is inactive too, since it passes only when the test fails.
 *   - `.each(table)(title)`, `.for(table)(title)`, `.skipIf(c)(title)` and `.runIf(c)(title)` read the
 *     title from the second call.
 * Collaborators: ./specTrace.mjs, ../doc-lint/checks/testReadability.mjs.
 * Tests: tools/spec-trace/test/testTitles.test.mjs
 */

const SKIPPING = new Set(['skip', 'todo', 'skipIf', 'fails']);
const TWO_CALLS = new Set(['each', 'for', 'skipIf', 'runIf']);
const CALL = /(?<![\w$.])(x?)(describe|it|test)((?:\.\w+)*)\s*\(/g;
const BEFORE_REGEX = /(?:[(,=:[!&|?{};+\-*%<>~^]|\b(?:return|typeof|case|in|of|void|throw|yield|await))$/;

const blank = (text) => text.replace(/[^\n]/g, ' ');

/** End offset (exclusive) of the string or template literal opening at `start`. */
function literalEnd(text, start) {
  const quote = text[start];
  let depth = 0;
  for (let i = start + 1; i < text.length; i += 1) {
    const c = text[i];
    if (c === '\\') i += 1;
    else if (depth > 0) depth += c === '{' ? 1 : c === '}' ? -1 : 0;
    else if (quote === '`' && c === '$' && text[i + 1] === '{') [depth, i] = [1, i + 1];
    else if (c === quote || (c === '\n' && quote !== '`')) return i + 1;
  }
  return text.length;
}

/** End offset (exclusive) of the `//` or `/*` comment opening at `start`. */
function commentEnd(text, start) {
  const line = text[start + 1] === '/';
  const close = text.indexOf(line ? '\n' : '*/', start + 2);
  if (close < 0) return text.length;
  return line ? close : close + 2;
}

/** End offset (exclusive) of the regex literal opening at `start`, flags excluded. */
function regexEnd(text, start) {
  let inClass = false;
  for (let i = start + 1; i < text.length; i += 1) {
    const c = text[i];
    if (c === '\\') i += 1;
    else if (c === '\n') return i;
    else if (inClass) inClass = c !== ']';
    else if (c === '[') inClass = true;
    else if (c === '/') return i + 1;
  }
  return text.length;
}

/** The last 12 non-blank characters of the code so far, to tell a regex from a division. */
function before(code) {
  let end = code.length;
  while (end > 0 && /\s/.test(code[end - 1])) end -= 1;
  return code.slice(Math.max(0, end - 12), end);
}

/**
 * Blanks comments, string contents and regex literals, keeping every offset.
 * @param {string} text - Source code.
 * @returns {{code: string, strings: Map<number, string>}} The blanked code, and the content of each
 *   string literal by the offset of its opening quote.
 */
export function blankLiterals(text) {
  let code = '';
  const strings = new Map();
  let i = 0;
  const push = (part, to) => {
    code += part;
    i = to;
  };
  while (i < text.length) {
    const [c, next] = [text[i], text[i + 1]];
    if (c === '/' && (next === '/' || next === '*')) {
      const stop = commentEnd(text, i);
      push(blank(text.slice(i, stop)), stop);
    } else if (c === "'" || c === '"' || c === '`') {
      const stop = literalEnd(text, i);
      strings.set(i, text.slice(i + 1, stop - 1));
      push(c + blank(text.slice(i + 1, stop - 1)) + text.slice(Math.max(i + 1, stop - 1), stop), stop);
    } else if (c === '/' && (before(code) === '' || BEFORE_REGEX.test(before(code)))) {
      const stop = regexEnd(text, i);
      push(`/${blank(text.slice(i + 1, stop - 1))}${stop - 1 > i ? '/' : ''}`, stop);
    } else push(c, i + 1);
  }
  return { code, strings };
}

/** Offset of the `)` matching the `(` at `open`, or the end of the code. */
function closeOf(code, open) {
  let depth = 0;
  for (let i = open; i < code.length; i += 1) {
    if (code[i] === '(') depth += 1;
    else if (code[i] === ')' && --depth === 0) return i;
  }
  return code.length;
}

const nextNonSpace = (code, from) => from + (/^\s*/.exec(code.slice(from))?.[0].length ?? 0);

/**
 * Lists the describe/it/test calls whose title is a string literal.
 * @param {string} text - Contents of a test file.
 * @returns {{fn: string, title: string, active: boolean}[]} One entry per call, in source order.
 */
export function testTitles(text) {
  const { code, strings } = blankLiterals(text);
  const calls = [];
  for (const m of code.matchAll(CALL)) {
    const modifiers = m[3].split('.').filter(Boolean);
    let open = m.index + m[0].length - 1;
    if (modifiers.some((mod) => TWO_CALLS.has(mod))) {
      open = nextNonSpace(code, closeOf(code, open) + 1);
      if (code[open] !== '(') continue;
    }
    const title = strings.get(nextNonSpace(code, open + 1));
    if (title === undefined) continue;
    const skipped = m[1] === 'x' || modifiers.some((mod) => SKIPPING.has(mod));
    calls.push({ fn: m[2], title, start: m.index, end: closeOf(code, open), skipped });
  }
  const skippedGroups = calls.filter((c) => c.fn === 'describe' && c.skipped);
  return calls.map(({ fn, title, start, skipped }) => ({
    fn,
    title,
    active: !skipped && !skippedGroups.some((g) => g.start < start && start < g.end),
  }));
}

/**
 * The requirement IDs in the bracket group that opens a title: `[SEC-001][SEC-002] …`.
 * @param {string} title - A test title.
 * @returns {string[]} The IDs, or none when the title does not open with brackets.
 */
export function leadingIds(title) {
  const group = /^(?:\[[A-Z][A-Z0-9]*-\d{3}\])+/.exec(title)?.[0] ?? '';
  return [...group.matchAll(/\[([A-Z][A-Z0-9]*-\d{3})\]/g)].map((m) => m[1]);
}
