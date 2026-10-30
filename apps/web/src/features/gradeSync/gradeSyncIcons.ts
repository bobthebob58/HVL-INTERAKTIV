/**
 * gradeSyncIcons — the icon shown before each grade-sync state and before the panel's feedback.
 *
 * Why: UD-003 and CLAUDE.md §1: a state is never told by colour alone; each has words and an icon that repeats them,
 *      the ✓ and ✗ the rest of the web app uses for success and problems (../../components/ErrorSummary.tsx).
 * Spec: UD-003
 * Invariants:
 *   - Decorative only: every use is `aria-hidden`, and the words carry the meaning.
 *   - Each state has its own icon, so no two states look alike in grey scale or forced colours.
 * Collaborators: ./GradeSyncCounts.tsx, ./GradeSyncPlacementSection.tsx.
 * Tests: apps/web/test/features/gradeSync/GradeSyncPanel.test.tsx
 */
import { ERROR_ICON } from '../../components/ErrorSummary';

/** The icon of each job state and of the panel's feedback. */
export const GRADE_SYNC_ICONS = {
  sent: '✓',
  pending: '◷',
  failed: ERROR_ICON,
  orphaned: '⊘',
  /** Before a retry's outcome. */
  done: '✓',
  /** Before a problem, such as a refused retry. */
  problem: ERROR_ICON,
} as const;
