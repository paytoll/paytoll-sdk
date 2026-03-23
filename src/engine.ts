import { createHmac, randomUUID } from 'crypto'
import { SolanaVerifier } from './verifier'
import type {
  PayTollConfig,
  EndpointConfig,
  PaymentChallenge,
  PaymentCredential,
  PaymentReceipt,
  TransactionRecord,
} from './types'

/**
 * PayToll payment engine.
 *
 * Handles the full 402 challenge/response flow with real
 * on-chain Solana payment verification.
 */
export class PaymentEngine {
  private config: Required<PayTollConfig>
  private verifier: SolanaVerifier
  private consumedSignatures = new Set<string>()
  private transactions: TransactionRecord[] = []

  constructor(config: Required<PayTollConfig>) {
    this.config = config
    this.verifier = new SolanaVerifier(config.network, config.rpcUrl)
  }

  findEndpoint(path: string): EndpointConfig | undefined {
    return this.config.endpoints.find((ep) => {
      if (ep.path === path) return true
      if (ep.path.endsWith('*')) {
        return path.startsWith(ep.path.slice(0, -1))
      }
      const pattern = ep.path.replace(/:[^/]+/g, '[^/]+')
      return new RegExp(`^${pattern}$`).test(path)
    })
  }

  createChallenge(endpoint: EndpointConfig): PaymentChallenge {
    const challenge: PaymentChallenge = {
      id: randomUUID(),
      realm: 'paytoll',
      method: 'solana',
      intent: endpoint.mode,
      request: {
        amount: endpoint.price,
        currency: endpoint.currency,
        recipient: this.config.recipient,
        network: this.config.network,
      },
    }
    if (this.config.feePayer) {
      challenge.request.feePayerKey = this.config.feePayer
    }
    return challenge
  }

  signChallenge(challenge: PaymentChallenge): string {
    const hmac = createHmac('sha256', this.config.secretKey)
    hmac.update(JSON.stringify(challenge))
    return hmac.digest('base64')
  }

  verifyChallengeSignature(challenge: PaymentChallenge, signature: string): boolean {
    return this.signChallenge(challenge) === signature
  }

  extractCredential(authHeader: string | undefined): PaymentCredential | null {
    if (!authHeader) return null
    if (!authHeader.startsWith('Payment ')) return null
    try {
      const encoded = authHeader.slice('Payment '.length)
      const decoded = Buffer.from(encoded, 'base64').toString('utf-8')
      return JSON.parse(decoded) as PaymentCredential
    } catch {
      return null
    }
  }

  /**
   * Verify a payment credential with REAL on-chain Solana verification.
   *
   * 1. Check for signature replay
   * 2. Look up the transaction on the Solana blockchain
   * 3. Confirm the transfer: right recipient, right amount, right token
   * 4. Issue a receipt
   */
  async verifyPayment(credential: PaymentCredential): Promise<PaymentReceipt> {
    const { challenge, payload } = credential
    const sig = payload.signature

    if (!sig) {
      return { status: 'failed', challengeId: challenge.id, timestamp: Date.now() }
    }

    if (this.consumedSignatures.has(sig)) {
      return { status: 'failed', challengeId: challenge.id, timestamp: Date.now() }
    }

    // Verify the payment on the Solana blockchain
    const verification = await this.verifier.verifyTransfer(
      sig,
      challenge.request.recipient,
      challenge.request.amount,
      challenge.request.currency,
    )

    if (!verification.verified) {
      console.error(`[PayToll] Payment verification failed: ${verification.error}`)
      return { status: 'failed', challengeId: challenge.id, timestamp: Date.now() }
    }

    // Payment verified on-chain
    this.consumedSignatures.add(sig)

    const receipt: PaymentReceipt = {
      status: 'success',
      challengeId: challenge.id,
      signature: sig,
      timestamp: Date.now(),
    }

    this.transactions.push({
      signature: sig,
      endpoint: challenge.request.recipient,
      amount: verification.amount?.toString() ?? challenge.request.amount,
      currency: challenge.request.currency,
      payer: verification.sender ?? credential.source,
      mode: challenge.intent,
      timestamp: Date.now(),
      verified: true,
    })

    console.log(`[PayToll] ✓ Payment verified: ${sig.slice(0, 16)}... (${verification.amount} ${challenge.request.currency})`)
    return receipt
  }

  getTransactions(): TransactionRecord[] {
    return [...this.transactions]
  }

  getStats() {
    const now = Date.now()
    const day = 24 * 60 * 60 * 1000
    const allTx = this.transactions
    const todayTx = allTx.filter((tx) => now - tx.timestamp < day)
    const totalRevenue = allTx.reduce((sum, tx) => sum + parseFloat(tx.amount), 0)
    const todayRevenue = todayTx.reduce((sum, tx) => sum + parseFloat(tx.amount), 0)
    return {
      totalTransactions: allTx.length,
      todayTransactions: todayTx.length,
      totalRevenue: totalRevenue.toFixed(6),
      todayRevenue: todayRevenue.toFixed(6),
      activeEndpoints: this.config.endpoints.length,
      network: this.config.network,
    }
  }
}
