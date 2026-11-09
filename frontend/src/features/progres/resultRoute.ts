/**
 * The result screen for a session (FRONTEND_ROUTING): tryout results and practice summaries are one
 * `ScoreResult` read by two routes, so this mapping lives in one place.
 */
export function resultRouteFor(mode: 'tryout' | 'latihan', sessionId: string): string {
  return mode === 'tryout' ? `/tryout/sesi/${sessionId}/hasil` : `/latihan/sesi/${sessionId}/hasil`
}
