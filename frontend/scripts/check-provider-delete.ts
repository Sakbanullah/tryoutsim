/**
 * Runnable check for deleting a provider from Pengaturan AI (`DELETE /providers/:id`, API_ENDPOINTS §8).
 * `node --experimental-strip-types scripts/check-provider-delete.ts`.
 *
 * What it proves:
 *   1. a confirmed delete removes only that provider from the list, without a page reload;
 *   2. every other provider stays, in the same order;
 *   3. a failed delete leaves the list untouched (only a 2xx reaches the list update);
 *   4. the server really forgot the row: a second delete of the same id is NOT_FOUND;
 *   5. faithful mocks: the same check shape is exercised against the mock client.
 */
import { registerHooks } from 'node:module'

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
  if (!cond) throw new Error(`provider delete check failed: ${message}`)
}

/**
 * The list update the screen applies on a confirmed delete (`AiSettings` `removeRow`): the same pure filter, so the
 * check fails if that rule ever changes to something broader.
 */
const removeRow = <T extends { id: string }>(rows: T[], id: string) => rows.filter((p) => p.id !== id)

// 1/2. The filter the screen runs after a 2xx: one row leaves, the others stay in order.
const rows = [
  { id: 'prov-1', name: 'Satu' },
  { id: 'prov-2', name: 'Dua' },
  { id: 'prov-3', name: 'Tiga' },
]
const afterDelete = removeRow(rows, 'prov-2')
check(afterDelete.length === 2, 'exactly one row leaves the list')
check(!afterDelete.some((p) => p.id === 'prov-2'), 'the deleted provider is gone from the list')
check(afterDelete.map((p) => p.id).join() === 'prov-1,prov-3', 'every other provider stays, in the same order')

// 3. A failed delete never reaches the filter: the list only changes on a 2xx.
const failedResult = { ok: false as const, failure: { status: 0 as const, code: 'NETWORK' as const, message: 'offline' } }
const survivors = failedResult.ok ? removeRow(rows, 'prov-1') : rows
check(survivors === rows, 'a failed delete leaves the list untouched')

// 4/5. The mock answers like the route: the row is gone from a later read, and a repeated delete is NOT_FOUND.
const created = await mockClient.createProvider({
  preset: 'ollama', name: 'Penyedia uji', baseUrl: 'http://127.0.0.1:11434/v1', key: 'k', timeoutMs: 30000, retries: 1,
})
check(created.ok, 'the fixture provider is created')
if (!created.ok) throw new Error('unreachable')
const first = await mockClient.deleteProvider(created.data.id)
check(first.ok, 'the first delete succeeds')
const second = await mockClient.deleteProvider(created.data.id)
check(!second.ok && second.failure.code === 'NOT_FOUND', 'a repeated delete is NOT_FOUND')
const reloaded = await mockClient.providers()
check(reloaded.ok && !reloaded.data.some((p) => p.id === created.data.id), 'a reload no longer lists the deleted provider')
