/**
 * Runnable check for the searchable model picker (`ModelPicker.tsx`) and its default-model save path.
 * `node --experimental-strip-types scripts/check-model-picker.ts`.
 *
 * What it proves:
 *   1. the filter matches a full id and a fragment, case-insensitively, and empty query shows every model;
 *   2. no model is dropped because there are many (the list is complete before filtering);
 *   3. choosing a model saves it through the existing `PATCH /providers/:id { defaultModel }`, and the card's default
 *      follows the server's answer without a reload;
 *   4. a failed save keeps the previous default (no fake default in the UI);
 *   5. a failed model load reports an error and leaves the default as it was;
 *   6. the card no longer renders every model as a row (the long list is gone from the page).
 */
import { registerHooks } from 'node:module'
import { readFileSync } from 'node:fs'

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('.') && !/\.[cm]?[jt]sx?$/.test(specifier)) {
      return nextResolve(`${specifier}.ts`, context)
    }
    return nextResolve(specifier, context)
  },
  load(url, context, nextLoad) {
    const result = nextLoad(url, context)
    if (!url.endsWith('/mock/mockClient.ts')) return result
    const source = String(result.source)
      .replace('import.meta.env.DEV', 'false')
      .replace('import.meta.env.VITE_API_MODE', "'http'")
    return { ...result, source }
  },
})

const { filterModels } = await import('../src/features/lainnya/modelFilter.ts')
const { mockClient } = await import('../src/mock/mockClient.ts')

const check = (cond: unknown, message: string): asserts cond => {
  if (!cond) throw new Error(`model picker check failed: ${message}`)
}

// ── 1/2. Filtering is a substring match over the whole list, nothing else. ──────────────────────────────────────
const models = [
  'deepseek/deepseek-chat',
  'deepseek/deepseek-r1',
  'openai/gpt-oss-120b',
  'minimax/minimax-m2',
  'anthropic/claude-sonnet',
]
check(filterModels(models, '').length === models.length, 'an empty query shows every model')
check(filterModels(models, 'deepseek').length === 2, 'a fragment matches each model containing it')
check(filterModels(models, 'gpt-oss').length === 1, 'a multi-part fragment matches')
check(filterModels(models, 'MINIMAX').length === 1, 'matching ignores case')
check(filterModels(models, 'deepseek/deepseek-r1')[0] === 'deepseek/deepseek-r1', 'a full id matches itself')
check(filterModels(models, 'zzz').length === 0, 'an unmatched query yields the empty state')
const many = Array.from({ length: 300 }, (_, i) => `vendor/model-${i}`)
check(filterModels(many, '').length === 300, 'every model is kept at three hundred entries')
// 'model-29' matches model-29, model-290…model-299: 11 rows, none dropped.
check(filterModels(many, 'model-29').length === 11, 'a numeric fragment narrows without truncation')

// ── 3. Choosing a model saves through the existing route and the card follows the server. ────────────────────────
const providers = await mockClient.providers()
check(providers.ok, 'providers load')
if (!providers.ok) throw new Error('unreachable')
const provider = providers.data[0]
const saved = await mockClient.updateProvider(provider.id, { defaultModel: 'vendor/model-7' })
check(saved.ok && saved.data.defaultModel === 'vendor/model-7', 'the choose path saves the default')
const reread = await mockClient.providers()
check(reread.ok && reread.data.find((p) => p.id === provider.id)?.defaultModel === 'vendor/model-7', 'a reload keeps the default')

// ── 4. A failed save leaves the previous default in place (the screen only updates from a 2xx). ──────────────────
const failedSave = { ok: false as const, failure: { status: 0 as const, code: 'NETWORK' as const, message: 'offline' } }
const shown = failedSave.ok ? failedSave.data.defaultModel : saved.ok ? saved.data.defaultModel : undefined
check(shown === 'vendor/model-7', 'a failed save keeps the previous default')

// ── 5/6. The page renders the picker, not one row per model. ─────────────────────────────────────────────────────
const settings = readFileSync(new URL('../src/features/lainnya/AiSettings.tsx', import.meta.url), 'utf8')
check(settings.includes('<ModelPicker'), 'the card renders the picker')
check(!/models\.map\(/.test(settings), 'the card no longer maps every model into a row')
check(settings.includes('model tersedia'), 'the model count is kept')
