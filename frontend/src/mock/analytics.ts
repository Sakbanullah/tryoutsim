import type { AnalyticsSnapshot, MetricValue } from '../types/contracts'
import { PROVISIONAL_CONFIG_ID } from './configs'

/**
 * `MOCK DATA — NOT FROM API`
 * One `AnalyticsSnapshot` exercising every metric state (ANALYTICS_ENGINE §6):
 * `reportable`, `insufficient_data`, `zero_correct`, `zero_attainment`. Hand-written numbers; no
 * formula runs here. `sessionCount` is 2 so the "butuh ≥3 sesi" rule has something to bite on.
 */

/** `n = answeredCount` and the state are checked against each other so the fixture cannot lie. */function metric(percent: number | null, numerator: number, denominator: number, answeredCount: number, correctZero = false, attainment = false): MetricValue {
  if (answeredCount < 5) {
    if (percent !== null) throw new Error('insufficient_data must carry percent null')
    return { percent: null, numerator, denominator, answeredCount, sessionCount: 2, state: 'insufficient_data', sampleNote: 'Belum cukup data (n=' + answeredCount + ')' }
  }
  if (numerator === 0) {
    return { percent: 0, numerator, denominator, answeredCount, sessionCount: 2, state: correctZero ? 'zero_correct' : attainment ? 'zero_attainment' : 'insufficient_data' }
  }
  return { percent, numerator, denominator, answeredCount, sessionCount: 2, state: 'reportable' }
}

export function mockAnalytics(): AnalyticsSnapshot {
  return {
    configId: PROVISIONAL_CONFIG_ID,
    configVersion: 1,
    scoringVersion: 1,
    perTest: {
      TWK: { ...metric(72, 18, 25, 25), metric: 'accuracy' },
      TIU: { ...metric(58, 14, 24, 24), metric: 'accuracy' },
      // TKP: attainment, not accuracy. correctCount is never used for this card.
      TKP: { ...metric(64, 58, 90, 30), metric: 'attainment' },
    },
    perCompetency: {
      'TWK.NASIONALISME': { ...metric(80, 8, 10, 10), metric: 'accuracy' },
      'TWK.INTEGRITAS': { ...metric(67, 4, 6, 6), metric: 'accuracy' },
      'TWK.BELA_NEGARA': { ...metric(50, 2, 4, 4), metric: 'accuracy' },
      'TWK.PILAR_NEGARA': { ...metric(75, 3, 4, 4), metric: 'accuracy' },
      'TWK.BAHASA_NEGARA': { ...metric(100, 1, 1, 1), metric: 'accuracy' },
      'TIU.VERBAL': { ...metric(60, 6, 10, 10), metric: 'accuracy' },
      'TIU.VERBAL.ANALOGI': { ...metric(75, 3, 4, 4), metric: 'accuracy' },
      'TIU.VERBAL.SILOGISME': { ...metric(50, 2, 4, 4), metric: 'accuracy' },
      'TIU.VERBAL.ANALITIS': { ...metric(50, 1, 2, 2), metric: 'accuracy' },
      'TIU.NUMERIK': { ...metric(55, 5, 9, 9), metric: 'accuracy' },
      'TIU.NUMERIK.BERHITUNG': { ...metric(60, 3, 5, 5), metric: 'accuracy' },
      'TIU.NUMERIK.DERET': { ...metric(0, 0, 4, 4), metric: 'accuracy' },
      'TIU.NUMERIK.SOAL_CERITA': { ...metric(null, 1, 1, 1), metric: 'accuracy' },
      'TIU.FIGURAL': { ...metric(60, 3, 5, 5), metric: 'accuracy' },
      'TIU.FIGURAL.ANALOGI': { ...metric(60, 3, 5, 5), metric: 'accuracy' },
      'TKP.PELAYANAN_PUBLIK': { ...metric(70, 21, 30, 6), metric: 'attainment' },
      'TKP.JEJARING_KERJA': { ...metric(0, 0, 20, 4, false, true), metric: 'attainment' },
      'TKP.SOSIAL_BUDAYA': { ...metric(55, 11, 20, 4), metric: 'attainment' },
      'TKP.PROFESIONALISME': { ...metric(62, 13, 21, 4), metric: 'attainment' },
      'TKP.ANTI_RADIKALISME': { ...metric(null, 0, 0, 0), metric: 'attainment' },
    },
    difficulty: {
      TWK: {
        easy: metric(80, 8, 10, 10),
        medium: metric(70, 7, 10, 10),
        hard: metric(60, 3, 5, 5),
      },
      TIU: {
        easy: metric(75, 6, 8, 8),
        medium: metric(56, 5, 9, 9),
        hard: metric(43, 3, 7, 7),
      },
      TKP: {
        easy: metric(65, 13, 20, 4),
        medium: metric(62, 28, 45, 9),
        hard: metric(68, 17, 25, 5),
      },
    },
    responseTime: { medianSeconds: 108, answeredCount: 79 },
    testMean: { TWK: 72, TIU: 58, TKP: 64 },
    comparability: {
      mixed: true,
      versions: [
        { configId: PROVISIONAL_CONFIG_ID, configVersion: 1, scoringVersion: 1, sessionCount: 2 },
        { configId: 'skd-cpns-2024', configVersion: 1, scoringVersion: 1, sessionCount: 1 },
      ],
    },
  }
}
