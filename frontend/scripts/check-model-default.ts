/**
 * Regression check for BUG-008: a model listed by the provider can become the provider's default, and saving it is a
 * `PATCH /providers/:id { defaultModel }` — the same edit the route clears the test record for.
 * `node --experimental-strip-types scripts/check-model-default.ts`.
 */
import { readFileSync } from 'node:fs'

const check = (cond: unknown, message: string): asserts cond => {
  if (!cond) throw new Error(`model default check failed: ${message}`)
}

const settings = readFileSync(new URL('../src/features/lainnya/AiSettings.tsx', import.meta.url), 'utf8')
const client = readFileSync(new URL('../src/data/client.ts', import.meta.url), 'utf8')
const mock = readFileSync(new URL('../src/mock/mockClient.ts', import.meta.url), 'utf8')

check(/updateProvider\(provider\.id, \{ defaultModel: modelId \}\)/.test(settings), 'a listed model is saved as the default')
check(/api\.saveRouting\(\{ default: \{ providerId: provider\.id, modelId \} \}\)/.test(settings), 'the chosen model also becomes the one global model')
check(/updateProvider\(provider\.id, \{ defaultModel: modelId \}\)[\s\S]*saveRouting/.test(settings), 'the provider is saved before the global default, so no untested pair is routed')
// The long per-row list became a searchable picker; choosing a row is what sets the default now.
const picker = readFileSync(new URL('../src/features/lainnya/ModelPicker.tsx', import.meta.url), 'utf8')
check(picker.includes("role=\"option\""), 'the picker lists the models as options')
check(/aria-selected=\{m === selected\}/.test(picker), 'the current default is marked in the picker')
check(/placeholder=\{selected \?\? 'Pilih model'\}/.test(picker), 'with no default the picker says "Pilih model"')
check(settings.includes('<ModelPicker'), 'the card renders the picker')
check(/label="Model default"/.test(settings), 'the typed model field stays available')
check(/defaultModel\?: string/.test(client), 'the client patch can carry a model')
check(/body\.defaultModel !== undefined\) provider\.testedAt = null/.test(mock), 'the mock clears the test record when the model changes')
