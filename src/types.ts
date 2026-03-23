/**
 * PayToll SDK — Core Types
 *
 * These types define the configuration and interfaces for the PayToll
 * machine payments middleware.
 */

/** Supported payment modes */
export type PaymentMode = 'charge' | 'session'

/** Supported currencies */
export type Currency = 'USDC' | 'SOL' | (string & {})

/** Solana network */
export type Network = 'devnet' | 'mainnet-beta'

/** Single endpoint configuration */
export interface EndpointConfig {
  /** URL path to gate (e.g. '/api/search') */
  path: string
  /** Amount to charge per request (e.g. '0.01') */
  price: string
  /** Currency — 'USDC', 'SOL', or an SPL token mint address */
  currency: Currency
  /** Payment mode — 'charge' for one-time, 'session' for streaming */
  mode: PaymentMode
  /** For session mode: meter name (e.g. 'api_calls', 'tokens') */
  meter?: string
  /** For session mode: suggested deposit amount */
  suggestedDeposit?: string
  /** For session mode: session TTL in seconds */
  ttlSeconds?: number
}

/** Main PayToll configuration */
export interface PayTollConfig {
  /** Solana wallet address to receive payments */
  recipient: string
  /** Solana network — defaults to 'devnet' */
  network?: Network
  /** Array of endpoint configurations */
  endpoints: EndpointConfig[]
  /** Base58-encoded keypair for fee sponsorship (optional) */
  feePayer?: string
  /** Custom Solana RPC endpoint URL */
  rpcUrl?: string
  /** HMAC secret key for signing 402 challenges (auto-generated if not set) */
  secretKey?: string
  /** Dashboard port — defaults to 3001 */
  dashboardPort?: number
}

/** 402 Payment Required challenge sent to clients */
export interface PaymentChallenge {
  /** Unique challenge ID */
  id: string
  /** Realm identifier */
  realm: string
  /** Payment method */
  method: 'solana'
  /** Payment intent type */
  intent: PaymentMode
  /** Payment request details */
  request: {
    amount: string
    currency: string
    recipient: string
    network: string
    /** Recent blockhash for transaction building */
    recentBlockhash?: string
    /** Fee payer public key (if server sponsors fees) */
    feePayerKey?: string
  }
}

/** Payment credential submitted by client */
export interface PaymentCredential {
  /** The original challenge */
  challenge: PaymentChallenge
  /** Source wallet address */
  source: string
  /** Payment proof */
  payload: {
    /** Signed transaction bytes (base64) */
    transaction?: string
    /** Transaction signature (for pull mode) */
    signature?: string
  }
}

/** Payment receipt returned to client */
export interface PaymentReceipt {
  /** Receipt status */
  status: 'success' | 'failed'
  /** Challenge ID this receipt corresponds to */
  challengeId: string
  /** Solana transaction signature */
  signature?: string
  /** Timestamp */
  timestamp: number
}

/** Transaction record stored in the payment log */
export interface TransactionRecord {
  /** Transaction signature on Solana */
  signature: string
  /** Endpoint path that was paid for */
  endpoint: string
  /** Amount paid */
  amount: string
  /** Currency used */
  currency: string
  /** Payer wallet address */
  payer: string
  /** Payment mode */
  mode: PaymentMode
  /** Timestamp (ms since epoch) */
  timestamp: number
  /** Whether the payment was verified on-chain */
  verified: boolean
}

/** Middleware request extension — added to req after payment verification */
export interface PayTollRequest {
  /** The verified payment receipt */
  receipt: PaymentReceipt
  /** The payer's wallet address */
  payer: string
  /** The amount paid */
  amount: string
  /** The currency used */
  currency: string
}
