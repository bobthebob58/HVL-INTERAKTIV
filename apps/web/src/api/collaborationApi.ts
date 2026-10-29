/**
 * collaborationApi — typed calls of the collaboration routes: an activity's visibility, people search, co-authors,
 * the content bank and duplicating an activity.
 *
 * Why: the **Deling** tab and the content bank page (PROD-007, D-089) share, find colleagues, list in the bank and
 *      copy. The server decides every right (D-090, D-091, D-092); these functions only carry the requests, typed by
 *      packages/api-contract (D-077).
 * Spec: PROD-007, PROD-006, DOC-012
 * Invariants:
 *   - Only `import type` from the contract, so zod stays out of the browser bundle.
 *   - Path parts (activity and user IDs) and the search query are percent-encoded.
 *   - PRIVACY: the search query goes only into the request's address, which the server never logs (D-090).
 * Collaborators: ./apiRequest.ts, apps/server/src/learningDesign/http/collaborationRoutes.ts,
 *   apps/server/src/http/api/contentSharingRoutes.ts.
 * Tests: apps/web/test/features/SharingPanel.test.tsx, apps/web/test/features/BankView.test.tsx
 */
import type {
  BankList,
  BankListing,
  CoAuthorList,
  DuplicateResponse,
  PeopleSearchResponse,
  SharingResponse,
  Visibility,
} from '@hvl-interaktiv/api-contract';
import { apiRequest, type ApiAuth, type ApiResult } from './apiRequest';

const contentPath = (contentId: string, rest: string): string =>
  `/api/content/${encodeURIComponent(contentId)}${rest}`;

/**
 * Changes who can find an activity.
 * @param contentId - The activity.
 * @param visibility - Only me and co-authors, all of HVL, or every Feide user.
 * @param auth - The credential.
 * @returns The new visibility, or 403 `hvl:sharing-not-allowed` / 409 `hvl:sharing-changed`.
 */
export const changeVisibility = (
  contentId: string,
  visibility: Visibility,
  auth: ApiAuth,
): Promise<ApiResult<SharingResponse>> =>
  apiRequest<SharingResponse>(contentPath(contentId, '/sharing'), auth, {
    method: 'PATCH',
    body: { visibility },
  });

/**
 * Finds HVL staff who may be co-authors.
 * @param query - At least three letters of a name, or a whole Feide ID.
 * @param auth - The credential.
 * @returns At most 10 people, or 429 `hvl:rate-limited`.
 */
export const searchPeople = (query: string, auth: ApiAuth): Promise<ApiResult<PeopleSearchResponse>> =>
  apiRequest<PeopleSearchResponse>(`/api/people?q=${encodeURIComponent(query)}`, auth);

/**
 * An activity's owner and co-authors.
 * @param contentId - The activity.
 * @param auth - The credential.
 * @returns The list, for people who may edit it.
 */
export const getCoAuthors = (contentId: string, auth: ApiAuth): Promise<ApiResult<CoAuthorList>> =>
  apiRequest<CoAuthorList>(contentPath(contentId, '/coauthors'), auth);

/**
 * Adds a co-author, as the owner.
 * @param contentId - The activity.
 * @param userId - A person from people search.
 * @param auth - The credential.
 * @returns The list after the change.
 */
export const addCoAuthor = (
  contentId: string,
  userId: string,
  auth: ApiAuth,
): Promise<ApiResult<CoAuthorList>> =>
  apiRequest<CoAuthorList>(contentPath(contentId, '/coauthors'), auth, { method: 'POST', body: { userId } });

/**
 * Removes a co-author: the owner anyone, a co-author themself.
 * @param contentId - The activity.
 * @param userId - The co-author.
 * @param auth - The credential.
 * @returns The list after the change.
 */
export const removeCoAuthor = (
  contentId: string,
  userId: string,
  auth: ApiAuth,
): Promise<ApiResult<CoAuthorList>> =>
  apiRequest<CoAuthorList>(contentPath(contentId, `/coauthors/${encodeURIComponent(userId)}`), auth, {
    method: 'DELETE',
  });

/**
 * Whether an activity is in the content bank, and whether it may be listed now.
 * @param contentId - The activity.
 * @param auth - The credential.
 * @returns The listing.
 */
export const getBankListing = (contentId: string, auth: ApiAuth): Promise<ApiResult<BankListing>> =>
  apiRequest<BankListing>(contentPath(contentId, '/bank'), auth);

/**
 * Lists an activity in the content bank, as its owner who accepted the consent text.
 * @param contentId - The activity.
 * @param consentVersion - The version of the consent text shown (`BANK_CONSENT_VERSION`).
 * @param auth - The credential.
 * @returns The listing, or 409 `hvl:bank-not-eligible`.
 */
export const listInBank = (
  contentId: string,
  consentVersion: number,
  auth: ApiAuth,
): Promise<ApiResult<BankListing>> =>
  apiRequest<BankListing>(contentPath(contentId, '/bank'), auth, { method: 'PUT', body: { consentVersion } });

/**
 * Takes an activity out of the content bank, as its owner.
 * @param contentId - The activity.
 * @param auth - The credential.
 * @returns The listing after the change.
 */
export const unlistFromBank = (contentId: string, auth: ApiAuth): Promise<ApiResult<BankListing>> =>
  apiRequest<BankListing>(contentPath(contentId, '/bank'), auth, { method: 'DELETE' });

/**
 * The HVL content bank, for HVL staff authors.
 * @param auth - The credential.
 * @returns The entries, or 403 (`hvl:sharing-not-allowed` for a student author).
 */
export const getBank = (auth: ApiAuth): Promise<ApiResult<BankList>> =>
  apiRequest<BankList>('/api/bank', auth);

/**
 * Copies an activity as the person's own private draft.
 * @param contentId - The activity to copy.
 * @param auth - The credential.
 * @returns The copy's ID.
 */
export const duplicateContent = (contentId: string, auth: ApiAuth): Promise<ApiResult<DuplicateResponse>> =>
  apiRequest<DuplicateResponse>(contentPath(contentId, '/duplicate'), auth, { method: 'POST' });
