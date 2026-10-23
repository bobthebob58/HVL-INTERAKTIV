/**
 * ltijsLogger — sends ltijs's log calls to our pino logger.
 *
 * Why: ltijs logs through a three-method `Logger` interface with a component name and a text message. Routing it
 *      through our logger means its lines get the same shape and the same personal-data and token redaction as
 *      every other line (DATA-009), instead of going to the console.
 * Spec: DATA-009, LTI-001
 * Invariants:
 *   - Messages pass through our logger, whose hooks redact tokens and e-mail addresses in text (./logging).
 *   - The component is kept as a field (`ltijsComponent`), never interpolated into the message.
 * Collaborators: ./LtiProviderFactory.ts, ../logging/logger.ts.
 * Tests: apps/server/test/lti/ltijsLogger.test.ts
 */
import type { Logger as LtijsLogger } from 'ltijs';
import type { Logger } from 'pino';

/**
 * Adapts our logger to ltijs.
 * @param logger - The application logger.
 * @returns The logger ltijs calls.
 */
export function ltijsLogger(logger: Logger): LtijsLogger {
  const child = logger.child({ module: 'ltijs' });
  return {
    debug: (component, message) => child.debug({ ltijsComponent: component }, message),
    warn: (component, message) => child.warn({ ltijsComponent: component }, message),
    error: (component, message) => child.error({ ltijsComponent: component }, message),
  };
}
