/**
 * manualBlocks tests — the parts of the conformance report that people write are read byte for byte, anything the
 * generator cannot read for certain stops it instead of losing text, and no verdict stands without a dated HVL
 * evaluation.
 * Spec: UD-040
 */
import { describe, expect, it } from 'vitest';
import {
  VERDICTS,
  checkCriterionBlock,
  manualBlock,
  parseManualBlocks,
  resolveBlocks,
  seededCriterionBody,
  verdictOf,
} from '../manualBlocks.mjs';

const start = (id) => `<!-- manual:${'start'} ${id} -->`;
const end = (id) => `<!-- manual:${'end'} ${id} -->`;

describe('[UD-040] manual blocks of the conformance report', () => {
  it('[UD-040] reads each block byte for byte, blank lines, tables, trailing spaces and headings included', () => {
    const body = '\n**Verdict:** Supports  \n\n\n| a | b |\n|---|---|\n### not a heading of ours\n\ttab\n';
    const text = `# Report\n\n${start('sc-1.1.1')}${body}${end('sc-1.1.1')}\n\n${start('scope')}x${end('scope')}\n`;

    // Act
    const blocks = parseManualBlocks(text);

    // Assert
    expect([...blocks.keys()]).toEqual(['sc-1.1.1', 'scope']);
    expect(blocks.get('sc-1.1.1')).toBe(body);
    expect(blocks.get('scope')).toBe('x');
    expect(manualBlock('sc-1.1.1', body)).toBe(`${start('sc-1.1.1')}${body}${end('sc-1.1.1')}`);
  });

  it.each([
    ['a misspelt marker', `<!-- manual:begin scope -->x${end('scope')}`, /not a manual marker/],
    ['a marker without its end', `<!-- manual:start scope\nx${end('scope')}`, /not a manual marker/],
    ['an ID with upper case', `${start('Scope')}x${end('Scope')}`, /not a manual marker/],
    [
      'a marker in other letter case',
      `<!-- Manual:start scope -->x<!-- MANUAL:end scope -->`,
      /not a manual marker/,
    ],
    ['a start inside a block', `${start('a')}${start('b')}x${end('b')}${end('a')}`, /starts inside "a"/],
    ['an end without its start', `x${end('scope')}`, /no matching start/],
    ['an end of another block', `${start('a')}x${end('b')}`, /no matching start/],
    ['a block left open', `${start('scope')}x`, /never closed/],
    ['an ID used twice', `${start('a')}x${end('a')}${start('a')}y${end('a')}`, /appears twice/],
  ])('[UD-040] stops on %s instead of dropping or guessing text', (_name, text, message) => {
    expect(() => parseManualBlocks(text)).toThrow(message);
  });

  it('[UD-040] reads every verdict of the five, and stops on a missing or unknown one', () => {
    for (const verdict of VERDICTS)
      expect(verdictOf('sc-1.1.1', `\n**Verdict:** ${verdict}\n`)).toBe(verdict);
    expect(() => verdictOf('sc-1.1.1', '\nVerdict: Supports\n')).toThrow(/has no line/);
    expect(() => verdictOf('sc-1.1.1', '\n**Verdict:** Supported\n')).toThrow(/not one of/);
    expect(() => verdictOf('sc-1.1.1', '\n**Verdict:** Supports\n\n**Verdict:** Does not support\n')).toThrow(
      /has 2 lines/,
    );
  });

  it('[UD-040] stops on a verdict that no dated HVL evaluation stands behind', () => {
    const dated = '\n**Verdict:** Supports\n\n**Evaluated by HVL:** 2027-01-15, ALU (KH), AT-1.\n';
    const untested = '\n**Verdict:** Supports\n\n**Evaluated by HVL:** Not yet tested by HVL.\n';

    // Act and assert: a dated verdict and an undecided one pass; an undated verdict stops the generator

    expect(checkCriterionBlock('sc-1.4.3', dated)).toBe('Supports');
    expect(checkCriterionBlock('sc-1.4.3', '\n**Verdict:** Not yet determined\n')).toBe('Not yet determined');
    expect(() => checkCriterionBlock('sc-1.4.3', untested)).toThrow(
      /no line "\*\*Evaluated by HVL:\*\* YYYY-MM-DD/,
    );
    expect(() => checkCriterionBlock('sc-1.2.4', '\n**Verdict:** Not applicable\n')).toThrow(
      /Evaluated by HVL/,
    );
    expect(() => resolveBlocks(new Map([['sc-1.4.3', untested]]), ['sc-1.4.3'], [])).toThrow(
      /no line "\*\*Evaluated by HVL/,
    );
  });

  it('[UD-040] seeds a missing block as not yet determined and not yet tested by HVL, without a date', () => {
    // Act
    const applicable = '\n**Verdict:** Not applicable\n\n**Evaluated by HVL:** 2027-02-01, ALU (KH).\n';
    const resolved = resolveBlocks(new Map([['sc-1.1.2', applicable]]), ['sc-1.1.1', 'sc-1.1.2'], ['scope']);

    // Assert
    expect(resolved.get('sc-1.1.1')).toBe(seededCriterionBody());
    expect(verdictOf('sc-1.1.1', resolved.get('sc-1.1.1'))).toBe('Not yet determined');
    expect(resolved.get('sc-1.1.1')).toContain('Not yet tested by HVL');
    expect(resolved.get('sc-1.1.2')).toBe(applicable);
    expect(resolved.get('scope')).toContain('Not yet tested by HVL');
    expect([resolved.get('sc-1.1.1'), resolved.get('scope')].join('')).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it('[UD-040] stops on a block no section owns, so its text is never lost', () => {
    expect(() => resolveBlocks(new Map([['sc-9.9.9', 'text']]), ['sc-1.1.1'], ['scope'])).toThrow(
      /belongs to no section/,
    );
  });

  it('[UD-040] stops on a criterion block whose verdict was removed', () => {
    expect(() => resolveBlocks(new Map([['sc-1.1.1', '\nsome notes\n']]), ['sc-1.1.1'], [])).toThrow(
      /has no line/,
    );
  });
});
