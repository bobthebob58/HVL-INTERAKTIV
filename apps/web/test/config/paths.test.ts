/**
 * Tests for the addresses the web app links to and frames: same-origin paths, encoded activity IDs, and the ltik only
 * in the two LTI frame addresses.
 *
 * Spec: UD-013, DATA-006, LTI-006, AUTH-001
 */
import { describe, expect, it } from 'vitest';
import {
  activityPath,
  editorPath,
  HELP_PATH,
  infoHref,
  loginHref,
  ltiFramePath,
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
});
