import { leavesOf } from '../shared/taxonomy'
import type { Test } from '../../types/contracts'

/**
 * Generatable competencies — every taxonomy leaf with its Indonesian label. Leaves only: a domain
 * roll-up (e.g. `TIU.VERBAL`) is a grouping, not a competency a question can target.
 */
export const COMPETENCIES: Array<{ id: string; label: string; test: Test }> = (['TWK', 'TIU', 'TKP'] as const).flatMap((t) =>
  leavesOf(t).map((n) => ({ id: n.id, label: `${n.label.id} (${t})`, test: t })),
)
