/**
 * insightFindingsAnswer — the activity's validator findings as insight shows them (INS-010): the check tab's findings,
 * with each acknowledgement's reason kept only for a reader who may edit the activity.
 *
 * Why: INS-010 shows the current findings and acknowledgements (UD-022) beside the results, so accessibility debt stays
 *      visible, and the check-and-publish flow already computes them for the stored activity
 *      (../../content/ContentPublisher.ts `findings`), so insight reuses it rather than validating on its own. A Canvas
 *      teacher of a course the activity is placed in may see its insight without editing it (D-106, LTI-007); a
 *      reason is an author's own text, which the data inventory shows to the activity's editors, so it is withheld
 *      from anyone else: they see that, when and until when an error was acknowledged.
 * Spec: INS-010, UD-022, PROD-003
 * Invariants:
 *   - The findings always come from the validator on the stored activity, never from the request (PROD-003).
 *   - PRIVACY: a reader who may not edit gets `reason: null`; nothing names who acknowledged an error.
 * Collaborators: ../../content/ContentPublisher.ts, @hvl-interaktiv/api-contract (`insightFindings.ts`),
 *   ./insightRoutes.ts.
 * Tests: apps/server/test/insight/http/insightFindings.int.test.ts
 */
import type { FindingsResponse, InsightFindingsResponse } from '@hvl-interaktiv/api-contract';

/**
 * The insight answer of the check tab's findings.
 * @param findings - The findings of the stored activity, with their acknowledgements.
 * @param mayEdit - Whether the reader may edit the activity (H5P-006 Edit).
 * @returns The same findings, each reason kept for an editor and null for anyone else.
 * @spec INS-010
 */
export function insightFindingsAnswer(findings: FindingsResponse, mayEdit: boolean): InsightFindingsResponse {
  return {
    updatedAt: findings.updatedAt,
    findings: findings.findings.map((finding) => ({
      ...finding,
      acknowledgement: finding.acknowledgement && {
        ...finding.acknowledgement,
        // PRIVACY: an author's reason is shown to the activity's editors only (DATA-INVENTORY, `reason`).
        reason: mayEdit ? finding.acknowledgement.reason : null,
      },
    })),
  };
}
