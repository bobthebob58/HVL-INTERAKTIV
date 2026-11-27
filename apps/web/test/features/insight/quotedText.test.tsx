/**
 * Tests for a sentence that quotes a text from the activity: its text is exactly what `t()` writes, the quoted range
 * is found by its place in the message, not by searching for the value, and a repeated announcement of it still
 * changes the status region while only the quoted part carries the activity's language.
 *
 * Spec: UD-010, UD-006
 */
// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AuthoredLanguageContext } from '../../../src/features/insight/authoredLanguage';
import { plainText, quotedSentence, type QuotedText } from '../../../src/features/insight/quotedText';
import { useQuotedAnnouncement } from '../../../src/features/insight/useQuotedAnnouncement';
import { NO_BREAK_SPACE } from '../../../src/components/useAnnouncement';
import { t } from '../../../src/i18n/translate';

/** The quoted part of a sentence, or undefined when it quotes nothing. */
const quotedPart = ({ text, quoted }: QuotedText) => (quoted ? text.slice(...quoted) : undefined);

/** A status region announcing the message on each press. */
function Region({ message }: { readonly message: QuotedText }) {
  const [announcement, announce] = useQuotedAnnouncement();
  return (
    <>
      <button type="button" onClick={() => announce(message)}>
        Say
      </button>
      <p role="status">{announcement}</p>
    </>
  );
}

describe('[UD-010] quotedSentence', () => {
  it('[UD-010] finds the quoted value by its place, also when the same text occurs earlier in the sentence', () => {
    // Act
    const gap = quotedSentence(
      'insight.gaps.summary',
      'nn',
      { number: 1, answer: '1', count: '1' },
      'answer',
    );
    // Assert
    expect(gap.text).toBe(t('insight.gaps.summary', 'nn', { number: 1, answer: '1', count: '1' }));
    expect(gap.text).toBe('Luke 1: vanlegaste feilsvar av dei som kan visast, er «1» (1 studentar).');
    expect(gap.quoted).toEqual([gap.text.indexOf('«') + 1, gap.text.indexOf('»')]);
    expect(quotedPart(gap)).toBe('1');
  });

  it('[UD-010] gives no range without an authored param, and the same text as t()', () => {
    // Arrange
    const params = { option: 'A', count: 'A' };
    // Act
    const plainSentence = quotedSentence('insight.choice.summary', 'en', params);
    const option = quotedSentence('insight.choice.summary', 'en', params, 'option');
    // Assert
    expect(plainSentence).toEqual({ text: t('insight.choice.summary', 'en', params) });
    expect(option.text).toBe(plainSentence.text);
    expect(quotedPart(option)).toBe('A');
    expect(option.quoted?.[0]).toBe(option.text.indexOf('“') + 1);
    expect(plainText('Ferdig.')).toEqual({ text: 'Ferdig.' });
  });

  it('[UD-010][UD-006] a repeated announcement changes the region, and only the quoted text is marked', () => {
    // Arrange
    const message = quotedSentence('insight.shortlist.addedOne', 'nn', { question: 'Why?' }, 'question');
    render(
      <AuthoredLanguageContext.Provider value="en">
        <Region message={message} />
      </AuthoredLanguageContext.Provider>,
    );
    const region = screen.getByRole('status');
    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Say' }));
    const first = region.textContent;
    fireEvent.click(screen.getByRole('button', { name: 'Say' }));
    // Assert
    expect(first).toBe(message.text);
    expect(region.textContent).toBe(`${message.text}${NO_BREAK_SPACE}`);
    expect([...region.querySelectorAll('[lang="en"]')].map((part) => part.textContent)).toEqual(['Why?']);
  });

  it.each([
    ['a sentence that quotes nothing', plainText('Oppdatert.')],
    [
      'a sentence with a quoted part',
      quotedSentence('insight.shortlist.addedOne', 'nn', { question: 'Why?' }, 'question'),
    ],
    ['a sentence that ends with its quoted part', { text: 'Sjå: Why?', quoted: [5, 9] } as QuotedText],
  ])(
    '[UD-006] a third and a fourth repeat of %s change a text, never add or remove a node',
    (_name, message) => {
      // Arrange: a live region speaks for added nodes and changed text, not for a removed node (WCAG 4.1.3)
      render(
        <AuthoredLanguageContext.Provider value="en">
          <Region message={message} />
        </AuthoredLanguageContext.Provider>,
      );
      const region = screen.getByRole('status');
      const nodes = () => document.createTreeWalker(region, NodeFilter.SHOW_ALL);
      const count = () => {
        let found = 0;
        for (const walker = nodes(); walker.nextNode();) found += 1;
        return found;
      };
      // Act
      const said = [1, 2, 3, 4].map(() => {
        fireEvent.click(screen.getByRole('button', { name: 'Say' }));
        return { text: region.textContent, nodes: count() };
      });
      // Assert
      expect(said.map(({ text }) => text)).toEqual([
        message.text,
        `${message.text}${NO_BREAK_SPACE}`,
        message.text,
        `${message.text}${NO_BREAK_SPACE}`,
      ]);
      expect(new Set(said.map(({ nodes: seen }) => seen)).size).toBe(1);
    },
  );
});
