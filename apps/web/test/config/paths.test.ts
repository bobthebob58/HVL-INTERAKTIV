/**
 * Tests for the addresses the web app links to and frames: same-origin paths, encoded activity IDs, the ltik only in
 * the two LTI frame addresses, the activity page's `?fane=`, and the studio's pages with their filters and course in
 * the query.
 *
 * Spec: UD-013, DATA-006, LTI-006, AUTH-001, PED-003, PED-031
 */
import { describe, expect, it } from 'vitest';
import {
  activityPath,
  BANK_PATH,
  CATALOGUE_ID,
  catalogueHref,
  editorPath,
  GUIDE_PATH,
  HELP_PATH,
  infoHref,
  loginHref,
  ltiFramePath,
  MAPPE_PATH,
  patternPath,
  plannerHref,
  PLANNER_PATH,
  playerPath,
  PRIVACY_PATH,
} from '../../src/config/paths';

describe('[UD-013] web app addresses', () => {
  it('[UD-013] help and privacy have fixed addresses', () => {
    expect(HELP_PATH).toBe('/hjelp');
    expect(PRIVACY_PATH).toBe('/personvern');
  });

  it('[DATA-006] help and privacy links name the linking page’s language', () => {
    expect(infoHref(PRIVACY_PATH, 'en')).toBe('/personvern?lang=en');
    expect(infoHref(HELP_PATH, 'nb')).toBe('/hjelp?lang=nb');
  });

  it('[LTI-006] activity, player and editor addresses encode the ID', () => {
    expect(activityPath('a/b?c')).toBe('/aktivitet/a%2Fb%3Fc');
    expect(playerPath('id-1')).toBe('/h5p/play/id-1');
    expect(editorPath('id-1')).toBe('/h5p/edit/id-1');
  });

  it('[LTI-006] the LTI frames carry the encoded ltik in their query', () => {
    expect(ltiFramePath('play', 'a.b+c/d')).toBe('/lti/play?ltik=a.b%2Bc%2Fd');
    expect(ltiFramePath('edit', 'x')).toBe('/lti/edit?ltik=x');
  });

  it('[AUTH-001] the login link returns to the page, except from the start page', () => {
    expect(loginHref('/aktivitet/ny')).toBe('/auth/feide/login?returnTo=%2Faktivitet%2Fny');
    expect(loginHref('/')).toBe('/auth/feide/login');
    expect(loginHref()).toBe('/auth/feide/login');
  });

  it('[LTI-006] the activity page can be opened on a tab, with the tab encoded', () => {
    expect(activityPath('id-1', 'edit')).toBe('/aktivitet/id-1?fane=edit');
    expect(activityPath('id-1', 'a&b')).toBe('/aktivitet/id-1?fane=a%26b');
    expect(activityPath('id-1', '')).toBe('/aktivitet/id-1');
  });
});

describe('[PED-003] studio addresses', () => {
  it('[PED-003] the studio pages have fixed addresses under /laeringsdesign, and /mappe', () => {
    expect([GUIDE_PATH, PLANNER_PATH, BANK_PATH, MAPPE_PATH]).toEqual([
      '/laeringsdesign',
      '/laeringsdesign/planlegg',
      '/laeringsdesign/innhaldsbank',
      '/mappe',
    ]);
  });

  it('[PED-003] the catalogue carries its filters in the query and scrolls to the catalogue', () => {
    // Act
    const all = catalogueHref();
    const filtered = catalogueHref({
      phase: 'etterarbeid',
      type: 'H5P.MultiChoice',
      buildTime: 30,
      course: 'SYK110',
    });
    // Assert
    expect(all).toBe(`/laeringsdesign#${CATALOGUE_ID}`);
    expect(filtered).toBe(
      '/laeringsdesign?fase=etterarbeid&type=H5P.MultiChoice&tid=30&emne=SYK110#monsterkatalog',
    );
  });

  it('[PED-031] a pattern page and the planner carry the phase and course, encoded', () => {
    expect(patternPath('fa-video')).toBe('/laeringsdesign/monster/fa-video');
    expect(patternPath('a/b', { phase: 'forarbeid', course: 'ÆØÅ100' })).toBe(
      '/laeringsdesign/monster/a%2Fb?fase=forarbeid&emne=%C3%86%C3%98%C3%85100',
    );
    expect(plannerHref('SYK110')).toBe('/laeringsdesign/planlegg?emne=SYK110');
    expect(plannerHref()).toBe('/laeringsdesign/planlegg');
  });
});
