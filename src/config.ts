import { randomBytes } from 'crypto'
import type { PayTollConfig, Network } from './types'

/** Default RPC URLs per network */
const RPC_URLS: Record<Network, string> = {
  'devnet': 'https://api.devnet.solana.com',
  'mainnet-beta': 'https://api.mainnet-beta.solana.com',
}

/**
 * Define a PayToll configuration with defaults applied.
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
 */
export function defineConfig(config: PayTollConfig): Required<PayTollConfig> {
  const network = config.network ?? 'devnet'

  return {
    recipient: config.recipient,
    network,
    endpoints: config.endpoints,
    feePayer: config.feePayer ?? '',
    rpcUrl: config.rpcUrl ?? RPC_URLS[network],
    secretKey: config.secretKey ?? randomBytes(32).toString('base64'),
    dashboardPort: config.dashboardPort ?? 3001,
  }
}

/**
 * Load config from a file path. Supports .ts and .json files.
 */
export async function loadConfig(path: string): Promise<Required<PayTollConfig>> {
  try {
    const mod = await import(path)
    const raw = mod.default ?? mod
    return defineConfig(raw)
  } catch (err) {
    throw new Error(`Failed to load PayToll config from ${path}: ${err}`)
  }
}
