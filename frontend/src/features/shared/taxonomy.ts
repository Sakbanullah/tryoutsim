import type { Test, TaxonomyNode } from '../../types/contracts'

/**
 * Competency taxonomy — verbatim ids and Indonesian labels from
 * docs/examination/COMPETENCY_TAXONOMY.md §3–§5. Tiers are the document's own (Sekolah Kedinasan
 * assessment year, not a CPNS 2026 kisi-kisi), which the UI must show as a caveat (GAP-F13).
 * No id here is invented and none of the withdrawn ids (TWK.PANCASILA etc.) appear.
 *
 * Static contract data (the canonical document), not mock data: it lives with the feature layer so no
 * screen depends on the mock folder. The bootstrap route repeats it; this copy keeps a label on every
 * screen until the client carries it.
 */
const TIER = 'VERIFIED-2026-SEKOLAH-KEDINASAN' as const

const leaf = (id: string, labelId: string, labelEn: string, parentId: string | null): TaxonomyNode => ({
  id,
  test: id.split('.')[0] as Test,
  parentId,
  label: { id: labelId, en: labelEn },
  tier: TIER,
  deprecated: false,
})

export const TAXONOMY: TaxonomyNode[] = [
  leaf('TWK.NASIONALISME', 'Nasionalisme', 'Nationalism', null),
  leaf('TWK.INTEGRITAS', 'Integritas', 'Integrity', null),
  leaf('TWK.BELA_NEGARA', 'Bela negara', 'State defence', null),
  leaf('TWK.PILAR_NEGARA', 'Pilar negara', 'State pillars', null),
  leaf('TWK.BAHASA_NEGARA', 'Bahasa negara', 'State language', null),

  leaf('TIU.VERBAL', 'Verbal', 'Verbal', null),
  leaf('TIU.VERBAL.ANALOGI', 'Analogi', 'Analogy', 'TIU.VERBAL'),
  leaf('TIU.VERBAL.SILOGISME', 'Silogisme', 'Syllogism', 'TIU.VERBAL'),
  leaf('TIU.VERBAL.ANALITIS', 'Analitis', 'Analytical', 'TIU.VERBAL'),
  leaf('TIU.NUMERIK', 'Numerik', 'Numerical', null),
  leaf('TIU.NUMERIK.BERHITUNG', 'Berhitung', 'Arithmetic', 'TIU.NUMERIK'),
  leaf('TIU.NUMERIK.DERET', 'Deret angka', 'Number series', 'TIU.NUMERIK'),
  leaf('TIU.NUMERIK.PERBANDINGAN_KUANTITATIF', 'Perbandingan kuantitatif', 'Quantitative comparison', 'TIU.NUMERIK'),
  leaf('TIU.NUMERIK.SOAL_CERITA', 'Soal cerita', 'Word problems', 'TIU.NUMERIK'),
  leaf('TIU.FIGURAL', 'Figural', 'Figural', null),
  leaf('TIU.FIGURAL.ANALOGI', 'Figural — analogi', 'Figural analogy', 'TIU.FIGURAL'),
  leaf('TIU.FIGURAL.KETIDAKSAMAAN', 'Figural — ketidaksamaan', 'Figural difference', 'TIU.FIGURAL'),
  leaf('TIU.FIGURAL.SERIAL', 'Figural — serial', 'Figural series', 'TIU.FIGURAL'),

  leaf('TKP.PELAYANAN_PUBLIK', 'Pelayanan publik', 'Public service', null),
  leaf('TKP.JEJARING_KERJA', 'Jejaring kerja', 'Networking', null),
  leaf('TKP.SOSIAL_BUDAYA', 'Sosial budaya', 'Social culture', null),
  leaf('TKP.TIK', 'Teknologi informasi dan komunikasi', 'Information technology', null),
  leaf('TKP.PROFESIONALISME', 'Profesionalisme', 'Professionalism', null),
  leaf('TKP.ANTI_RADIKALISME', 'Anti radikalisme', 'Anti-radicalism', null),
]

const byId = new Map(TAXONOMY.map((n) => [n.id, n]))

/** Label for any node id; ids are never shown, so an unknown id must degrade to something readable. */
export function labelOf(id: string): string {
  const node = byId.get(id)
  if (node) return node.label.id
  return id
    .split('.')
    .slice(1)
    .map((s) => s.charAt(0) + s.slice(1).toLowerCase().replaceAll('_', ' '))
    .join(' · ')
}

export function nodeOf(id: string): TaxonomyNode | undefined {
  return byId.get(id)
}

/** Leaves of one test, in taxonomy order — used to group practice and Progres rows. */
export function leavesOf(test: Test): TaxonomyNode[] {
  return TAXONOMY.filter((n) => n.test === test && n.parentId !== null)
}
