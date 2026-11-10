/**
 * Run one unit of work in a single database transaction and map a refusal to its
 * registry error.
 *
 * A constraint or trigger raising *is* a rule firing (DB-4's provider guard, a
 * CHECK, a unique key); `translateDbError` turns it into the contract's code.
 * Anything unrecognised is rethrown and becomes an ordinary 500.
 */

import { translateDbError } from './errors.js';

/**
 * @template T
 * @param {import('../generated/prisma/client.ts').PrismaClient} prisma
 * @param {{resource: string, id?: string}} context
 * @param {(tx: Parameters<Parameters<import('../generated/prisma/client.ts').PrismaClient['$transaction']>[0]>[0]) => Promise<T>} work
 * @returns {Promise<T>}
 */
export async function inTransaction(prisma, context, work) {
  try {
    return await prisma.$transaction((tx) => work(tx));
  } catch (error) {
    translateDbError(error, context);
  }
}

/**
 * Map a refusal raised outside a transaction.
 * @param {unknown} error
 * @param {{resource: string, id?: string}} context
 * @returns {never}
 */
export function rethrowTranslated(error, context) {
  return translateDbError(error, context);
}
