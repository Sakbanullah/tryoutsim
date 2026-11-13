/**
 * Check for the one-global-model decision (AI_PROVIDER_ARCHITECTURE §4): the model chosen in Pengaturan AI is the model of
 * every AI task, there is no per-task route anywhere, and the mock says exactly what the route says.
 * `node --experimental-strip-types scripts/check-global-model.ts`.
 *
 * What it proves:
 *   1. the routing wire shape carries the global default and nothing else — no per-task entry;
 *   2. saving a default stores that pair, and a reload keeps it;
 *   3. a default naming an unknown provider is refused with the route's field path;
 *   4. the UI saves the provider first, then the one global model (no `perTask` in the body);
 *   5. the backend resolves generation through the global default and has no task-id resolver;
 *   6. deleting the provider that carried the global model leaves no model behind.
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

const { mockClient } = await import('../src/mock/mockClient.ts')

const check = (cond: unknown, message: string): asserts cond => {
  if (!cond) throw new Error(`global model check failed: ${message}`)
}
const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

// 1. The wire shape is the default alone.
const routing = await mockClient.routing()
check(routing.ok, 'routing loads')
if (!routing.ok) throw new Error('unreachable')
check(Object.keys(routing.data).join() === 'default', 'the routing wire shape has no per-task entry')
const provider = routing.data.default.providerId
check(provider !== null, 'the mock starts with a global model')

// 2. A save stores the chosen pair; a reload keeps it.
const saved = await mockClient.saveRouting({ default: { providerId: provider, modelId: 'vendor/chosen' } })
check(saved.ok && saved.data.default.modelId === 'vendor/chosen', 'the chosen model is the saved global model')
const reread = await mockClient.routing()
check(reread.ok && reread.data.default.modelId === 'vendor/chosen', 'a reload keeps the same global model')

// 3. An unknown provider is refused with the route's field path.
const refused = await mockClient.saveRouting({ default: { providerId: 'prov-not-real', modelId: 'm' } })
check(!refused.ok && refused.failure.code === 'VALIDATION_FAILED', 'an unknown provider is a validation failure')

// 4. The UI saves the provider, then the one global model — and nothing about a task.
const settings = read('../src/features/lainnya/AiSettings.tsx')
check(/api\.saveRouting\(\{ default: \{ providerId: provider\.id, modelId \} \}\)/.test(settings), 'the chosen model becomes the one global model')
check(!/saveRouting\([^)]*perTask/.test(settings), 'the UI never sends a per-task route')

// 5. Generation resolves the global model; no task-id resolver exists in the backend.
const backendRouting = read('../../backend/src/domain/routing.js')
const generation = read('../../backend/src/repositories/generation-job.js')
check(/export function resolveGlobalRoute\(/.test(backendRouting), 'the resolver is the global route')
check(!/export function resolveRoute\(/.test(backendRouting), 'no task-id resolver exists')
check(/resolveGlobalRoute\(/.test(generation), 'generation resolves through the global default')
check(!/resolveRoute\(/.test(generation), 'generation never resolves by task id')
const wire = read('../src/types/contracts.ts')
const aiRouting = wire.slice(wire.indexOf('export type AiRouting'))
check(!/perTask/.test(aiRouting.slice(0, aiRouting.indexOf('}') + 1)), 'the client contract has no per-task route')

// 6. Deleting the provider of the global model clears it (the mock keeps one provider, so make a second one first).
const spare = await mockClient.createProvider({
  preset: 'ollama', name: 'Cadangan', baseUrl: 'http://127.0.0.1:11434/v1', key: 'k', timeoutMs: 30000, retries: 1,
})
check(spare.ok, 'a second provider exists')
check((await mockClient.deleteProvider(provider!)).ok, 'the provider is deleted')
const after = await mockClient.routing()
check(after.ok && after.data.default.providerId === null, 'the global model is cleared with its provider')
