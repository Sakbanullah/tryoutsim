import type { Package, PackageDefinition, Test } from '../../types/contracts'
import { labelOf, nodeOf } from './taxonomy'

/**
 * Plain-Indonesian wording for a package's contract fields (PACKAGE_SPECIFICATION §1). Display only:
 * every number is a returned field, nothing is re-derived (FRONTEND_DATA_CONTRACTS §4).
 */

/** Subtest for a definition: the explicit `test`, else the common test of its competencies. */
export function testOf(d: PackageDefinition): Test | null {
  if (d.test) return d.test
  const tests = [...new Set((d.competencyIds ?? []).map((id) => nodeOf(id)?.test))]
  return tests.length === 1 ? (tests[0] ?? null) : null
}

export function definitionTitle(d: PackageDefinition): string {
  if (d.kind === 'full_simulation') return 'Simulasi SKD lengkap'
  const test = testOf(d)
  if (d.kind === 'subtest') return test ? `Subtes ${test}` : 'Subtes'
  return (d.competencyIds ?? []).map(labelOf).join(', ') || 'Latihan submateri'
}

export function difficultyMixText(d: PackageDefinition): string {
  if (!d.difficultyMix) return 'Tidak diatur'
  return `${d.difficultyMix.easy} mudah · ${d.difficultyMix.medium} sedang · ${d.difficultyMix.hard} sulit`
}

export function repeatPolicyText(d: PackageDefinition): string {
  return d.repeatPolicy === 'avoid_answered' ? 'Soal yang sudah dikerjakan dihindari.' : 'Soal boleh diulang.'
}

/** The REQUIRED sentence when a start would repeat items (FRONTEND_DATA_CONTRACTS §4). */
export function repeatStatement(p: Package): string | null {
  if (p.availability.repeatCount <= 0) return null
  return `${p.availability.repeatCount} soal di sesi ini akan diulang karena stok soal baru belum cukup.`
}

/** The one availability line: ready, short stock, or nothing at all. */
export function availabilityText(p: Package): string {
  const a = p.availability
  if (a.startable) return `${a.requiredStock} soal siap dikerjakan`
  if (a.eligibleStock === 0) return 'Belum cukup soal'
  return `Stok soal baru kurang: ${a.eligibleStock} dari ${a.requiredStock} soal.`
}

/** A disabled start explains itself; without a server reason the stock line does. */
export function unavailableReason(p: Package): string {
  return p.availability.unavailableReason ?? availabilityText(p)
}

/** One sentence for a failed `startSession` / `drill` call. */
export function startFailureText(): string {
  return 'Sesi belum bisa dimulai. Periksa stok soal dan konfigurasi ujian, lalu coba lagi.'
}
