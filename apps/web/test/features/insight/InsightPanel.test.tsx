/**
 * Tests for the Innsikt tab's panel: its headings and notes, participation with shown, hidden and unavailable values,
 * the requests it makes in the portal and in Canvas, and the states with nothing to show (no learning data, an empty
 * period, a refused view). The validator's findings beside the results are tested in ./InsightFindings.test.tsx.
 *
 * Spec: PROD-010, INS-001, INS-006, INS-007, LTI-006, LTI-013
 */
// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ApiAuthProvider } from '../../../src/api/ApiAuthContext';
import { InsightPanel } from '../../../src/features/insight/InsightPanel';
import { errorBody, fakeFetch, type FakeRoutes } from '../../support/fakeFetch';
import {
  CANVAS_PATH,
  CONTEXTS,
  CONTEXTS_PATH,
  FINDINGS_PATH,
  HIDDEN,
  ID,
  plain,
  PORTAL_PATH,
  REPORT,
  scope,
  SYK_KEY,
} from './insightAnswers';
import { EMPTY_REPORT, FINDINGS, HOTSPOTS_REPORT, VIDEO_REPORT } from './insightOtherAnswers';

/**
 * The portal's answers.
 * @param report - The view.
 * @returns The routes.
 */
const portal = (report = REPORT): FakeRoutes => ({
  [`GET ${PORTAL_PATH}`]: { status: 200, body: report },
  [`GET ${CONTEXTS_PATH}`]: { status: 200, body: { contexts: CONTEXTS } },
  [`GET ${FINDINGS_PATH}`]: { status: 200, body: FINDINGS },
});

const headingsUpTo3 = () =>
  screen
    .getAllByRole('heading')
    .filter((h) => h.tagName === 'H2' || h.tagName === 'H3')
    .map((h) => `${h.tagName} ${h.textContent}`);

describe('[PROD-010] the Innsikt tab', () => {
  it('[PROD-010][LTI-013] has one h2, the formative and privacy notes and a section per part, named by its h3', async () => {
    // Arrange
    fakeFetch(portal());
    // Act
    render(<InsightPanel contentId={ID} title="Celler og vev" />);
    await screen.findByRole('heading', { name: 'Deltaking' });
    // Assert
    expect(headingsUpTo3()).toEqual([
      'H2 Innsikt før samlinga',
      'H3 ℹ︎ Til undervegsvurdering',
      'H3 Berre samla tal',
      'H3 Deltaking',
      'H3 Spørsmål, vanskelegast først',
      'H3 Misoppfatningar',
      'H3 Ta opp i samlinga (0 spørsmål)',
      'H3 Tilgjengelegheit og kvalitet',
    ]);
    const formative = screen.getByRole('region', { name: 'Til undervegsvurdering' });
    expect(formative.textContent).toContain('ikkje for eksamen eller karakterar');
    expect(formative.textContent).toContain('ikkje karakterar eller dokumentasjon til eksamen');
    const privacy = screen.getByRole('region', { name: 'Berre samla tal' });
    expect(privacy.textContent).toContain('færre enn 5 studentar, blir vist som «< 5»');
    expect(plain(screen.getByText(/^Viser /).textContent)).toBe(
      'Viser Portalen (spelt utanom Canvas), siste 7 dagar (frå 28. okt. 2026), versjon 3.',
    );
  });

  it('[INS-001] names each participation value and the base of the completion rate', async () => {
    // Arrange
    fakeFetch(portal());
    // Act
    render(<InsightPanel contentId={ID} title="Celler og vev" />);
    const section = await screen.findByRole('region', { name: 'Deltaking' });
    // Assert
    const pairs = within(section)
      .getAllByRole('term')
      .map((term) => `${term.textContent}: ${plain(term.nextElementSibling?.textContent)}`);
    expect(pairs).toEqual([
      'Starta: 24',
      'Fullført: 18',
      'Fullføringsgrad: 75 % av dei som starta',
      'Median tid på aktiviteten: 4,5 min',
      'Median tal på forsøk: 1,5',
    ]);
  });

  it('[INS-001][INS-006] shows «< k» with the reason for a hidden value and «Ikkje tilgjengeleg» for one the type cannot send', async () => {
    // Arrange: a video (no final result) where the learners are hidden, with k = 7
    const report = {
      ...VIDEO_REPORT,
      scope: scope({ k: 7 }),
      participation: { ...VIDEO_REPORT.participation, started: HIDDEN, medianMinutesOnTask: HIDDEN },
    };
    fakeFetch(portal(report));
    // Act
    render(<InsightPanel contentId={ID} title="Celler og vev" />);
    const section = await screen.findByRole('region', { name: 'Deltaking' });
    // Assert
    const values = within(section)
      .getAllByRole('definition')
      .map((value) => value.textContent);
    expect(values).toEqual([
      '< 7 (skjult av omsyn til personvernet)',
      'Ikkje tilgjengeleg',
      'Ikkje tilgjengeleg',
      '< 7 (skjult av omsyn til personvernet)',
      'Ikkje tilgjengeleg',
    ]);
    expect(within(section).getByText(/sender ikkje noko sluttresultat/)).toBeTruthy();
    expect(screen.getByText(/Færre enn 7 studentar har gjort aktiviteten/)).toBeTruthy();
    // INS-006: the privacy note gives the view's own k, and says a value hidden with another may be larger
    const note = screen.getByRole('region', { name: 'Berre samla tal' }).textContent ?? '';
    expect(note).toContain('færre enn 7 studentar, blir vist som «< 7»');
    expect(note).toContain('vist som «< 7», sjølv om det er større');
  });

  it('[INS-007] in the portal asks for the last 7 days of the portal’s plays and offers the activity’s contexts', async () => {
    // Arrange
    const requests = fakeFetch(portal());
    // Act
    render(<InsightPanel contentId={ID} title="Celler og vev" />);
    await screen.findByRole('heading', { name: 'Deltaking' });
    // Assert
    expect(requests.map((request) => request.path)).toContain(PORTAL_PATH);
    const context = screen.getByRole('combobox', { name: 'Emne' });
    expect(
      [...context.querySelectorAll('option')].map((option) => [option.value, option.textContent]),
    ).toEqual([
      ['portal', 'Portalen (spelt utanom Canvas)'],
      [SYK_KEY, 'SYK110 i Canvas'],
      [CONTEXTS[2]?.key, 'Canvas-emne utan emnekode'],
    ]);
  });

  it('[LTI-006][INS-007] in Canvas sends no context, carries the Bearer ltik and names the launch’s course instead of a choice', async () => {
    // Arrange
    const report = { ...REPORT, scope: scope({ context: { key: SYK_KEY, label: 'SYK110' } }) };
    const requests = fakeFetch({
      [`GET ${CANVAS_PATH}`]: { status: 200, body: report },
      [`GET ${FINDINGS_PATH}`]: { status: 200, body: FINDINGS },
    });
    // Act
    render(
      <ApiAuthProvider auth={{ kind: 'lti', ltik: 'ltik-1' }}>
        <InsightPanel contentId={ID} title="Celler og vev" fixedContext />
      </ApiAuthProvider>,
    );
    await screen.findByRole('heading', { name: 'Deltaking' });
    // Assert
    expect(requests.map((request) => request.path)).not.toContain(CONTEXTS_PATH);
    const view = requests.find((request) => request.path === CANVAS_PATH);
    expect(view?.headers.Authorization).toBe('Bearer ltik-1');
    expect(view?.credentials).toBe('omit');
    expect(screen.queryByRole('combobox', { name: 'Emne' })).toBeNull();
    expect(screen.getByText(/^Emne: SYK110 i Canvas\. I Canvas ser du berre innsikta/)).toBeTruthy();
  });

  it('[INS-001] an ImageHotspots activity says it sends no learning data, and an empty period says nobody played', async () => {
    // Arrange and act
    fakeFetch(portal(HOTSPOTS_REPORT));
    const { unmount } = render(<InsightPanel contentId={ID} title="Celler og vev" />);
    // Assert
    expect(
      await screen.findByText(
        'Bilete med klikkpunkt sender ingen læringsdata, så det finst inga innsikt å vise for denne aktiviteten.',
      ),
    ).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Deltaking' })).toBeNull();
    unmount();
    fakeFetch(portal(EMPTY_REPORT));
    render(<InsightPanel contentId={ID} title="Celler og vev" />);
    expect(await screen.findByText(/^Ingen studentar har gjort aktiviteten i denne perioden/)).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Deltaking' })).toBeNull();
  });

  it('[INS-007] a refused view says the person has no access and offers no choices', async () => {
    // Arrange
    fakeFetch({
      ...portal(),
      [`GET ${PORTAL_PATH}`]: { status: 403, body: errorBody(403, 'error.forbidden') },
    });
    // Act
    render(<InsightPanel contentId={ID} title="Celler og vev" />);
    // Assert
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Du har ikkje tilgang til innsikta for denne aktiviteten.',
    );
    expect(screen.queryByRole('button', { name: 'Vis innsikt' })).toBeNull();
  });
});
