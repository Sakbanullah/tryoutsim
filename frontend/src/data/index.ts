import type { ApiClient } from './client'
import { mockClient } from '../mock/mockClient'

/**
 * The app's single data entry point. Gate 2: mock only.
 * Gate 3 swaps this binding for an HTTP client against `/api/v1`; no screen changes.
 */
export const api: ApiClient = mockClient

export { toOutcome } from './errors'
export type { Failure, Result } from './errors'
export type { ApiClient } from './client'
