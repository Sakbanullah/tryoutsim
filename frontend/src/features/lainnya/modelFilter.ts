/**
 * Case-insensitive substring match over the model ids an endpoint listed (AI_PROVIDER_ARCHITECTURE §5: the list is a
 * picker, the typed id stays available). Every model is kept in the result set; the query only narrows what is shown,
 * and an empty query shows all of them. Pure, so the picker's filter is checked without a browser.
 */
export function filterModels(models: readonly string[], query: string): string[] {
  const needle = query.trim().toLowerCase()
  if (needle === '') return [...models]
  return models.filter((m) => m.toLowerCase().includes(needle))
}
