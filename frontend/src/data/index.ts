import type { ApiClient } from './client'
import { httpClient } from './httpClient'
import { mockClient } from '../mock/mockClient'

/**
 * The app's single data entry point. `VITE_API_MODE=http` talks to the backend over `/api/v1`; any other value
 * keeps the Gate 2 mock. No screen knows which one answered.
 */
export const api: ApiClient = import.meta.env.VITE_API_MODE === 'http' ? httpClient : mockClient

export { toOutcome } from './errors'
export type { Failure, Result } from './errors'
export type { ApiClient } from './client'
