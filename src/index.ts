/**
 * @paytoll/sdk
 *
 * Developer toolkit for accepting machine payments on Solana
 * via the Machine Payments Protocol (MPP).
 *
 * @example
 * ```ts
 * import { defineConfig } from '@paytoll/sdk'
 *
 * export default defineConfig({
 *   recipient: 'YOUR_SOLANA_WALLET',
 *   endpoints: [
 *     { path: '/api/search', price: '0.01', currency: 'USDC', mode: 'charge' }
 *   ]
 * })
 * ```
 *
 * For Express middleware:
 * ```ts
 * import { paytoll } from '@paytoll/sdk/express'
 * ```
 *
 * For Hono middleware:
 * ```ts
 * import { paytoll } from '@paytoll/sdk/hono'
 * ```
 *
 * @packageDocumentation
 */

// Core config
export { defineConfig, loadConfig } from './config'

// Engine
export { PaymentEngine } from './engine'

// Verifier
export { SolanaVerifier } from './verifier'
export type { VerificationResult } from './verifier'

// Types
export type {
  PayTollConfig,
  EndpointConfig,
  PaymentMode,
  Currency,
  Network,
  PaymentChallenge,
  PaymentCredential,
  PaymentReceipt,
  TransactionRecord,
  PayTollRequest,
} from './types'
