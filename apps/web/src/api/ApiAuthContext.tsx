/**
 * ApiAuthContext — tells the client components on a page which credential their API requests carry.
 *
 * Why: the same components (the formative notice, the publish dialog) run on portal pages, where requests carry the
 *      session cookie and CSRF token, and on the Canvas page, where they carry the ltik (D-069). The page decides once.
 * Spec: AUTH-003, LTI-003
 * Invariants:
 *   - Without a provider requests are portal requests without a CSRF token, so unsafe requests fail closed (401).
 *   - The ltik lives only in this React state and the Authorization header; never in storage or a URL we write.
 * Collaborators: ./apiRequest.ts, ../components/Notice.tsx, ../components/PublishDialog.tsx, ../features/*.
 * Tests: apps/web/test/components/Notice.test.tsx
 */
'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { ApiAuth } from './apiRequest';

const PORTAL_WITHOUT_TOKEN: ApiAuth = { kind: 'portal' };
const ApiAuthContext = createContext<ApiAuth>(PORTAL_WITHOUT_TOKEN);

/**
 * Provides the page's credential to the components below it.
 * @param props - The credential and the tree that uses it.
 * @returns The provider.
 */
export function ApiAuthProvider({
  auth,
  children,
}: {
  readonly auth: ApiAuth;
  readonly children: ReactNode;
}) {
  return <ApiAuthContext.Provider value={auth}>{children}</ApiAuthContext.Provider>;
}

/**
 * The credential of the page's API requests.
 * @returns The portal or LTI credential.
 */
export const useApiAuth = (): ApiAuth => useContext(ApiAuthContext);
