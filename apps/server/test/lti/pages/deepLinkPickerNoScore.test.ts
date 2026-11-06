/**
 * Unit tests for the Deep Linking picker's note on activities that can never send Canvas a score (D-115): the reason
 * in text, tied to the input (also beside a draft's reason), in nn, nb and en, and nothing for other activities.
 *
 * Spec: LTI-005, LTI-013, UD-013
 */
import { describe, expect, it } from 'vitest';
import { LOCALES, t } from '../../../src/i18n/translate.js';
import type { PickerActivity } from '../../../src/lti/deepLinking/deepLinkActivities.js';
import { deepLinkPickerPage } from '../../../src/lti/pages/deepLinkPickerPage.js';

const scored: PickerActivity = {
  id: 'a0',
  title: 'Brøkar',
  mainLibrary: 'H5P.MultiChoice',
  selectable: true,
};
const video: PickerActivity = {
  id: 'a1',
  title: 'Video',
  mainLibrary: 'H5P.InteractiveVideo',
  selectable: true,
  noScore: 'noSubmitScreen',
};
const hotspotsDraft: PickerActivity = {
  id: 'a2',
  title: 'Klikkpunkt',
  mainLibrary: 'H5P.ImageHotspots',
  selectable: false,
  noScore: 'noStatements',
};
const page = (locale: (typeof LOCALES)[number] = 'nn') =>
  deepLinkPickerPage({ locale, activities: [scored, video, hotspotsDraft], multiple: false, graded: true });

describe('[LTI-005] the picker’s note on activities that send no score', () => {
  it('[LTI-005] the note says why, is tied to the input and leaves the activity selectable', () => {
    // Act
    const html = page();
    // Assert
    expect(html).toContain('value="a1" aria-describedby="activity-1-no-score">');
    expect(html).toContain(
      `<span id="activity-1-no-score">${t('deepLinkGrading.noScore.noSubmitScreen', {}, 'nn')}</span>`,
    );
    expect(html).not.toMatch(/value="a1"[^>]*disabled/);
  });

  it('[LTI-005] a draft that sends no score names both reasons', () => {
    const html = page();
    expect(html).toContain('value="a2" disabled aria-describedby="activity-2-draft activity-2-no-score"');
    expect(html).toContain(t('deepLinkGrading.noScore.noStatements', {}, 'nn'));
  });

  it('[LTI-005] an activity that can send a score gets no note', () => {
    const html = page();
    expect(html).toMatch(/value="a0">/);
    expect(html).not.toContain('activity-0-no-score');
  });

  it.each(LOCALES)('[LTI-013] the note is written in %s', (locale) => {
    const html = page(locale);
    expect(html).toContain(t('deepLinkGrading.noScore.noSubmitScreen', {}, locale));
    expect(html).toContain(t('deepLinkGrading.noScore.noStatements', {}, locale));
  });

  it('[LTI-013] every reason has its own text in all three languages', () => {
    for (const reason of ['noStatements', 'noSubmitScreen', 'noScoring'] as const) {
      const texts = LOCALES.map((locale) => t(`deepLinkGrading.noScore.${reason}`, {}, locale));
      expect(new Set(texts).size).toBe(LOCALES.length);
      expect(texts.every((text) => !text.startsWith('deepLinkGrading.'))).toBe(true);
    }
  });
});
