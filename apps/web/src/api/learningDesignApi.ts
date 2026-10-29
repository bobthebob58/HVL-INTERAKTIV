/**
 * learningDesignApi — typed calls of the learning-design routes: an activity's metadata, the author's course codes,
 * the outcomes already used in a course, the alignment planner, and the studio overview the forms take the phase
 * labels from.
 *
 * Why: the **Læringsdesign** tab (PED-030), the publish prompt (D-087) and the planner (PED-031) read and write
 *      through these routes; the server decides every right and checks every limit again (D-087, D-088). Phase labels
 *      come only from content (PED-001), so the forms read them from `GET /api/studio`.
 * Spec: PED-030, PED-031, PED-001, DOC-012
 * Invariants:
 *   - Only `import type` from the contract, so zod stays out of the browser bundle.
 *   - The activity ID and the course code are percent-encoded into the address.
 *   - A replace sends the `updatedAt` it read; the answer to a stale one is 409 `hvl:learning-design-conflict`.
 * Collaborators: ./apiRequest.ts, apps/server/src/learningDesign/http/learningDesignRoutes.ts,
 *   apps/server/src/learningDesign/http/studioContentRoutes.ts (`GET /api/studio`).
 * Tests: apps/web/test/features/LearningDesignPanel.test.tsx, apps/web/test/features/PlannerView.test.tsx
 */
import type {
  CourseCodeSuggestions,
  CourseOutcomes,
  LearningDesign,
  LearningDesignUpdate,
  Planner,
  StudioOverview,
} from '@hvl-interaktiv/api-contract';
import { apiRequest, type ApiAuth, type ApiResult } from './apiRequest';

const metadataPath = (contentId: string): string =>
  `/api/content/${encodeURIComponent(contentId)}/learning-design`;
const courseQuery = (courseCode: string): string => `?courseCode=${encodeURIComponent(courseCode)}`;

/**
 * An activity's learning-design metadata.
 * @param contentId - The activity.
 * @param auth - The credential.
 * @returns The metadata (`updatedAt` null while none is stored), or 403/404 for someone who may not edit it.
 */
export const getLearningDesign = (contentId: string, auth: ApiAuth): Promise<ApiResult<LearningDesign>> =>
  apiRequest<LearningDesign>(metadataPath(contentId), auth);

/**
 * Replaces an activity's learning-design metadata.
 * @param contentId - The activity.
 * @param body - Every editable field and the `updatedAt` read.
 * @param auth - The credential.
 * @returns The stored metadata, or 409 `hvl:learning-design-conflict` when it changed meanwhile.
 */
export const replaceLearningDesign = (
  contentId: string,
  body: LearningDesignUpdate,
  auth: ApiAuth,
): Promise<ApiResult<LearningDesign>> =>
  apiRequest<LearningDesign>(metadataPath(contentId), auth, { method: 'PUT', body });

/**
 * The author's course codes: in use in their activities, and from their Canvas placements.
 * @param auth - The credential.
 * @returns Both lists.
 */
export const getCourseCodes = (auth: ApiAuth): Promise<ApiResult<CourseCodeSuggestions>> =>
  apiRequest<CourseCodeSuggestions>('/api/learning-design/course-codes', auth);

/**
 * The outcomes the author already uses in a course.
 * @param courseCode - A normalised course code.
 * @param auth - The credential.
 * @returns The distinct outcomes.
 */
export const getCourseOutcomes = (courseCode: string, auth: ApiAuth): Promise<ApiResult<CourseOutcomes>> =>
  apiRequest<CourseOutcomes>(`/api/learning-design/outcomes${courseQuery(courseCode)}`, auth);

/**
 * The alignment planner of one course.
 * @param courseCode - A normalised course code.
 * @param auth - The credential.
 * @returns The grid, the gaps and the untagged activities.
 */
export const getPlanner = (courseCode: string, auth: ApiAuth): Promise<ApiResult<Planner>> =>
  apiRequest<Planner>(`/api/learning-design/planner${courseQuery(courseCode)}`, auth);

/**
 * The studio overview, for the phase labels from content (PED-001) and the pattern names.
 * @param auth - The credential (the route is public; the session is sent as on every call).
 * @returns The overview.
 */
export const getStudioPhases = (auth: ApiAuth): Promise<ApiResult<StudioOverview>> =>
  apiRequest<StudioOverview>('/api/studio', auth);
