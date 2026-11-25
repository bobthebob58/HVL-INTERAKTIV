/**
 * Tests of the web forms' cleaning of typed and pasted text (D-142): what the cleaners return is what the
 * server's rule accepts, for every character the rule names; visible text stays; and the learning-design form,
 * the publish reasons and the co-author search send cleaned text.
 *
 * Spec: PED-030, PED-032, UD-022, PROD-007
 */
// @vitest-environment jsdom
import {
  FREE_TEXT_PATTERN,
  ONE_LINE_TEXT_PATTERN,
  learningDesignUpdateSchema,
  type FindingWithAcknowledgement,
} from '@hvl-interaktiv/api-contract';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { reasonProblems, reasonText } from '../../src/components/publishReasons';
import { cleanFreeText, cleanOneLine } from '../../src/config/typedText';
import { formFrom, formProblems, updateFrom } from '../../src/features/learningDesign/learningDesignForm';
import { PeopleSearch, SEARCH_PAUSE_MS } from '../../src/features/sharing/PeopleSearch';
import { fakeFetch } from '../support/fakeFetch';

/** Every character of the classes the server's rule names, found by the rule's own properties. */
const REFUSED: string[] = [];
for (let code = 0; code <= 0x2fff; code += 1) {
  const character = String.fromCharCode(code);
  if (/[\p{Cc}\p{Zl}\p{Zp}\p{Bidi_Control}]/u.test(character)) REFUSED.push(character);
}
const VISIBLE = 'Øv på blodtrykk – «kvifor»? 👩‍⚕️ lærings­utbyte é 100 %';

describe('[PED-030] cleaning typed and pasted text', () => {
  it('[PED-030] what the cleaners return, the server’s rule accepts, for every character it names', () => {
    // Act
    const free = REFUSED.map((character) => cleanFreeText(`a${character}b${character}`));
    const oneLine = REFUSED.map((character) => cleanOneLine(`a${character}b${character}`));
    // Assert: 65 control characters, 2 separators and 12 bidirectional controls below U+3000
    expect(REFUSED).toHaveLength(79);
    expect(free.filter((text) => !FREE_TEXT_PATTERN.test(text))).toEqual([]);
    // WHY: a CR or LF stays in one line for the form's own «one line» message, as before.
    expect(oneLine.filter((text) => !ONE_LINE_TEXT_PATTERN.test(text.replace(/[\r\n]/g, '')))).toEqual([]);
    expect(oneLine.filter((text) => /[\r\n]/.test(text))).toHaveLength(2);
  });

  it('[PED-030] a hidden line break becomes a line break or a space; a direction control goes; the rest is a space', () => {
    // Act + Assert
    expect(cleanFreeText(' Fyrste andre tredje\tmed\u0000null‮og‏merke ')).toBe(
      'Fyrste\nandre\ntredje\tmed null' + 'og' + 'merke',
    );
    expect(cleanOneLine(' Fyrste andre\tmed\u0000null‮og ')).toBe('Fyrste andre med null' + 'og');
    expect(cleanFreeText('linje\r\nlinje\n')).toBe('linje\r\nlinje');
  });

  it('[PED-030] visible text, a soft hyphen and the joiner inside an emoji stay as typed', () => {
    // Act + Assert
    expect([cleanFreeText(VISIBLE), cleanOneLine(VISIBLE)]).toEqual([VISIBLE, VISIBLE]);
    expect([cleanFreeText(''), cleanOneLine(' \t ')]).toEqual(['', '']);
  });

  it('[PED-030] cleaning takes time in step with the length', () => {
    // Arrange
    const long = 'a\u0000‮  '.repeat(100_000);
    // Act
    const started = performance.now();
    const cleaned = [cleanFreeText(long), cleanOneLine(long)];
    // Assert
    // WHY: four characters are left of each five, and the trim takes the last three of the whole text.
    expect(cleaned.map((text) => text.length)).toEqual([399_997, 399_997]);
    expect(performance.now() - started).toBeLessThan(1000);
  });
});

describe('[PED-032] the forms send cleaned text', () => {
  const pasted = 'Forklare‮ blodtrykk og\u0000 puls';
  const finding = { ruleId: 'V-IMG-ALT', path: 'params.image' } as FindingWithAcknowledgement;
  const ids = { courseCode: 'c', rationale: 'r', minutes: 'm', purpose: 'p', outcome: (key: string) => key };

  it('[PED-030] the learning-design form counts and sends outcomes, rationale and purpose cleaned', () => {
    // Arrange
    const form = {
      ...formFrom({ outcomes: [{ text: pasted, category: 'kunnskap' }], updatedAt: null }),
      rationale: pasted,
      purpose: pasted,
    };
    // Act
    const body = updateFrom(form, null);
    // Assert: the server's own schema takes the body
    expect(formProblems(form, ids, 'nn')).toEqual([]);
    expect(body.outcomes[0]?.text).toBe('Forklare blodtrykk\nog  puls');
    expect(body.rationale).toBe('Forklare blodtrykk\nog  puls');
    expect(body.learnerPurpose).toBe('Forklare blodtrykk og  puls');
    expect(learningDesignUpdateSchema.safeParse(body).success).toBe(true);
  });

  it('[UD-022] a reason for publishing is checked and sent cleaned; one of only hidden characters is missing', () => {
    // Act
    const sent = reasonText({ 'V-IMG-ALT|params.image': ` ${pasted} ` }, finding);
    const empty = reasonProblems([finding], { 'V-IMG-ALT|params.image': '‮\u0000 ' }, () => 'f', 'nn');
    // Assert
    expect(sent).toBe('Forklare blodtrykk\nog  puls');
    expect(FREE_TEXT_PATTERN.test(sent)).toBe(true);
    expect(empty).toHaveLength(1);
    expect(reasonText({}, finding)).toBe('');
  });

  it('[PROD-007] the co-author search sends the query cleaned, and counts its three characters cleaned', async () => {
    // Arrange
    const requests = fakeFetch({ 'GET /api/people?q=Kari': { status: 200, body: { people: [] } } });
    render(<PeopleSearch exclude={new Set()} onAdd={() => undefined} />);
    const type = (value: string) =>
      fireEvent.change(screen.getByRole('searchbox', { name: 'Søk etter tilsette ved HVL' }), {
        target: { value },
      });
    const pause = () => new Promise((resolve) => setTimeout(resolve, SEARCH_PAUSE_MS + 100));
    // Act: two letters and two hidden characters are not yet three characters
    type('Ka‮‏');
    await pause();
    type('‮Kar‏i');
    await pause();
    // Assert
    expect(requests.map((request) => request.path)).toEqual(['/api/people?q=Kari']);
  });
});
