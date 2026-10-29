/**
 * Unit tests for the studio's services: built once from createApp's inputs with the start-up content unchanged, a
 * duplicator, the pattern creator (which logs a skeleton it cannot build to the server's logger) and one slot per
 * workstream service, and closed at shutdown, every resource even when one fails.
 *
 * Spec: PED-001, PROD-001, PROD-007, MAPPE-004
 */
import { describe, expect, it, vi } from 'vitest';
import { loadEnv } from '../../src/config/env.js';
import type { HvlH5PEditor } from '../../src/h5p/HvlH5PEditor.js';
import { ContentDuplicator } from '../../src/learningDesign/collaboration/ContentDuplicator.js';
import { loadStudioContent } from '../../src/learningDesign/content/loadStudioContent.js';
import { createLogger } from '../../src/logging/logger.js';
import { PatternCreator } from '../../src/learningDesign/patterns/PatternCreator.js';
import {
  closeStudioServices,
  createStudioServices,
  type StudioServiceInputs,
  type StudioServices,
} from '../../src/server/studioServices.js';
import { VALID_ENV } from '../support/authEnv.js';

// WHY: building must contact nothing, so the clients can be empty stand-ins; the configuration and the logger are
// real, because a service may read a setting (PDF_MAX_CONCURRENCY) or make a child logger while it is built.
const inputs = (): StudioServiceInputs =>
  ({
    db: {},
    redis: {},
    access: {},
    publishing: {},
    hasher: {},
    env: loadEnv(VALID_ENV),
    logger: createLogger({ level: 'silent' }),
    h5p: { editor: { libraryManager: {} } as HvlH5PEditor },
    studioContent: loadStudioContent(),
  }) as unknown as StudioServiceInputs;

const closable = (close: () => Promise<void>) => ({ close: vi.fn(close) });

describe('[PED-001] createStudioServices', () => {
  it('[PED-001] keeps the content loaded at start-up as it is, frozen, and builds a frozen set of services', () => {
    // Arrange
    const given = inputs();
    // Act
    const services = createStudioServices(given);
    // Assert
    expect(services.content).toBe(given.studioContent);
    expect(Object.isFrozen(services.content)).toBe(true);
    expect(Object.isFrozen(services)).toBe(true);
  });

  it('[PROD-007] builds one duplicator over the given editor and activity facts, and a slot per pending service', () => {
    // Act
    const services = createStudioServices(inputs());
    // Assert
    expect(services.duplicator).toBeInstanceOf(ContentDuplicator);
    // WHY: a workstream may add services next to its slot, so this checks the slots, not the whole list.
    expect(Object.keys(services)).toEqual(
      expect.arrayContaining([
        'content',
        'duplicator',
        'patternCreator',
        'learningDesignStore',
        'peopleDirectory',
        'mappeRenderer',
        'pdfRenderer',
      ]),
    );
  });

  it('[PROD-001] builds the pattern creator over the patterns loaded at start-up, without contacting the editor', async () => {
    // Arrange
    const given = inputs();
    // Act
    const services = createStudioServices(given);
    // Assert
    expect(services.patternCreator).toBeInstanceOf(PatternCreator);
    await expect(services.patternCreator.availability('no-such-pattern')).resolves.toBeUndefined();
  });

  it('[PED-001] gives the pattern creator the server’s logger, so a skeleton that cannot be built is logged once', async () => {
    // Arrange: an installed library whose semantics do not parse (D-085 amendment 2026-10-29, S5 review)
    const given = inputs();
    const warn = vi.spyOn(given.logger, 'warn');
    const libraryManager = {
      libraryExists: async () => true,
      getSemantics: async () => Promise.reject(new SyntaxError('Unexpected token in semantics.json')),
      getLanguage: async () => null,
    };
    const services = createStudioServices({
      ...given,
      h5p: { editor: { libraryManager } as unknown as HvlH5PEditor },
    });
    const [first] = given.studioContent.patterns.patterns;
    if (!first) throw new Error('no pattern in content/');
    // Act
    await services.patternCreator.availability(first.id);
    await services.patternCreator.availability(first.id);
    // Assert
    expect(warn.mock.calls.map(([fields]) => fields)).toEqual(
      first.skeletons.map(({ contentType }) => ({
        patternId: first.id,
        contentType,
        errorName: 'SyntaxError',
      })),
    );
  });
});

describe('[MAPPE-004] closeStudioServices', () => {
  it('[MAPPE-004] closes every service that holds a resource, once, and leaves the others alone', async () => {
    // Arrange
    const browser = closable(async () => undefined);
    const timer = closable(async () => undefined);
    const services = {
      ...createStudioServices(inputs()),
      pdfRenderer: browser,
      peopleDirectory: timer,
    } as unknown as StudioServices;
    // Act
    await closeStudioServices(services);
    // Assert
    expect(browser.close).toHaveBeenCalledOnce();
    expect(timer.close).toHaveBeenCalledOnce();
  });

  it('[MAPPE-004] closes a service that two fields share only once', async () => {
    // Arrange
    const browser = closable(async () => undefined);
    const services = {
      ...createStudioServices(inputs()),
      pdfRenderer: browser,
      mappeRenderer: browser,
    } as unknown as StudioServices;
    // Act
    await closeStudioServices(services);
    // Assert
    expect(browser.close).toHaveBeenCalledOnce();
  });

  it('[MAPPE-004] still closes the others when one close fails, then reports every failure', async () => {
    // Arrange
    const failing = closable(async () => Promise.reject(new Error('browser gone')));
    const other = closable(async () => undefined);
    const services = {
      ...createStudioServices(inputs()),
      pdfRenderer: failing,
      mappeRenderer: other,
    } as unknown as StudioServices;
    // Act
    const outcome = closeStudioServices(services);
    // Assert
    await expect(outcome).rejects.toBeInstanceOf(AggregateError);
    await expect(outcome).rejects.toMatchObject({ errors: [new Error('browser gone')] });
    expect(other.close).toHaveBeenCalledOnce();
  });

  it('[MAPPE-004] has nothing to close while no workstream service holds a resource', async () => {
    await expect(closeStudioServices(createStudioServices(inputs()))).resolves.toBeUndefined();
  });
});
