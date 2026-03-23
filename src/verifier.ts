import {
  Connection,
  PublicKey,
  LAMPORTS_PER_SOL,
  type ParsedTransactionWithMeta,
} from '@solana/web3.js'
import type { Network } from './types'

/** Known USDC mint addresses per network */
const USDC_MINTS: Record<Network, string> = {
  'devnet': '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
  'mainnet-beta': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
}

/** RPC URLs per network */
const RPC_URLS: Record<Network, string> = {
  'devnet': 'https://api.devnet.solana.com',
  'mainnet-beta': 'https://api.mainnet-beta.solana.com',
}

export interface VerificationResult {
  verified: boolean
  error?: string
  amount?: number
  sender?: string
  recipient?: string
  signature?: string
}

/**
 * Solana on-chain payment verifier.
 * 
 * Confirms a transaction signature on the Solana blockchain and verifies
 * that the transfer matches the expected payment (amount, recipient, currency).
 */
export class SolanaVerifier {
  private connection: Connection
  private network: Network

  constructor(network: Network, rpcUrl?: string) {
    this.network = network
    this.connection = new Connection(
      rpcUrl ?? RPC_URLS[network],
      'confirmed'
    )
  }

  /**
   * Verify a SOL transfer transaction.
   * 
   * Checks that:
   * 1. The transaction exists and is confirmed
   * 2. It contains a transfer to the expected recipient
   * 3. The amount matches the expected payment
   */
  async verifySOLTransfer(
    signature: string,
    expectedRecipient: string,
    expectedAmount: string,
  ): Promise<VerificationResult> {
    try {
      // Fetch the transaction from the chain
      const tx = await this.connection.getParsedTransaction(signature, {
        maxSupportedTransactionVersion: 0,
        commitment: 'confirmed',
      })

      if (!tx) {
        return { verified: false, error: 'Transaction not found on chain' }
      }

      if (tx.meta?.err) {
        return { verified: false, error: `Transaction failed: ${JSON.stringify(tx.meta.err)}` }
      }

      // Parse the transfer instruction
      const expectedLamports = Math.round(parseFloat(expectedAmount) * LAMPORTS_PER_SOL)
      const recipientPubkey = expectedRecipient

      // Check all instructions for a matching SOL transfer
      for (const ix of tx.transaction.message.instructions) {
        if ('parsed' in ix && ix.program === 'system' && ix.parsed?.type === 'transfer') {
          const info = ix.parsed.info
          if (
            info.destination === recipientPubkey &&
            info.lamports >= expectedLamports
          ) {
            return {
              verified: true,
              amount: info.lamports / LAMPORTS_PER_SOL,
              sender: info.source,
              recipient: info.destination,
              signature,
            }
          }
        }
      }

      // Also check inner instructions (for programs that wrap transfers)
      if (tx.meta?.innerInstructions) {
        for (const inner of tx.meta.innerInstructions) {
          for (const ix of inner.instructions) {
            if ('parsed' in ix && ix.program === 'system' && ix.parsed?.type === 'transfer') {
              const info = ix.parsed.info
              if (
                info.destination === recipientPubkey &&
                info.lamports >= expectedLamports
              ) {
                return {
                  verified: true,
                  amount: info.lamports / LAMPORTS_PER_SOL,
                  sender: info.source,
                  recipient: info.destination,
                  signature,
                }
              }
            }
          }
        }
      }

      return { verified: false, error: 'No matching SOL transfer found in transaction' }
    } catch (err) {
      return { verified: false, error: `RPC error: ${err instanceof Error ? err.message : String(err)}` }
    }
  }

  /**
   * Verify a USDC (SPL token) transfer transaction.
   * 
   * Checks that:
   * 1. The transaction exists and is confirmed
   * 2. It contains an SPL token transfer of the correct mint
   * 3. The amount and destination match the expected payment
   */
  async verifyUSDCTransfer(
    signature: string,
    expectedRecipient: string,
    expectedAmount: string,
  ): Promise<VerificationResult> {
    try {
      const tx = await this.connection.getParsedTransaction(signature, {
        maxSupportedTransactionVersion: 0,
        commitment: 'confirmed',
      })

      if (!tx) {
        return { verified: false, error: 'Transaction not found on chain' }
      }

      if (tx.meta?.err) {
        return { verified: false, error: `Transaction failed: ${JSON.stringify(tx.meta.err)}` }
      }

      const usdcMint = USDC_MINTS[this.network]
      // USDC has 6 decimals
      const expectedRawAmount = Math.round(parseFloat(expectedAmount) * 1_000_000)

      // Check all instructions for SPL token transfers
      const allInstructions = [
        ...tx.transaction.message.instructions,
        ...(tx.meta?.innerInstructions?.flatMap(inner => inner.instructions) ?? []),
      ]

      for (const ix of allInstructions) {
        if (!('parsed' in ix)) continue
        if (ix.program !== 'spl-token' && ix.program !== 'spl-token-2022') continue

        const parsed = ix.parsed
        if (parsed?.type === 'transfer' || parsed?.type === 'transferChecked') {
          const info = parsed.info

          // For transferChecked, verify the mint
          if (parsed.type === 'transferChecked' && info.mint !== usdcMint) {
            continue
          }

          const amount = parsed.type === 'transferChecked'
            ? parseFloat(info.tokenAmount?.uiAmountString ?? '0')
            : parseFloat(info.amount) / 1_000_000

          // The destination is a token account, not a wallet address directly.
          // We need to check if it belongs to the expected recipient.
          // For now, we check the pre/post token balances for the recipient.
          if (amount >= parseFloat(expectedAmount)) {
            // Verify recipient by checking post-token balances
            const recipientMatch = this.checkRecipientInBalances(
              tx,
              expectedRecipient,
              usdcMint
            )

            if (recipientMatch) {
              return {
                verified: true,
                amount,
                sender: info.authority ?? info.source,
                recipient: expectedRecipient,
                signature,
              }
            }
          }
        }
      }

      return { verified: false, error: 'No matching USDC transfer found in transaction' }
    } catch (err) {
      return { verified: false, error: `RPC error: ${err instanceof Error ? err.message : String(err)}` }
    }
  }

  /**
   * Check if the expected recipient received tokens in this transaction
   * by examining pre/post token balances.
   */
  private checkRecipientInBalances(
    tx: ParsedTransactionWithMeta,
    expectedRecipient: string,
    mint: string,
  ): boolean {
    const preBalances = tx.meta?.preTokenBalances ?? []
    const postBalances = tx.meta?.postTokenBalances ?? []

    for (const post of postBalances) {
      if (post.owner === expectedRecipient && post.mint === mint) {
        const pre = preBalances.find(
          p => p.accountIndex === post.accountIndex
        )
        const preAmount = parseFloat(pre?.uiTokenAmount?.uiAmountString ?? '0')
        const postAmount = parseFloat(post.uiTokenAmount?.uiAmountString ?? '0')

        if (postAmount > preAmount) {
          return true
        }
      }
    }

    return false
  }

  /**
   * Verify any payment — routes to SOL or USDC verification based on currency.
   */
  async verifyTransfer(
    signature: string,
    expectedRecipient: string,
    expectedAmount: string,
    currency: string,
  ): Promise<VerificationResult> {
    if (currency === 'SOL') {
      return this.verifySOLTransfer(signature, expectedRecipient, expectedAmount)
    } else {
      // Default to USDC verification for any SPL token
      return this.verifyUSDCTransfer(signature, expectedRecipient, expectedAmount)
    }
  }

  /**
   * Wait for a transaction to confirm, with timeout.
   */
  async waitForConfirmation(signature: string, timeoutMs: number = 30000): Promise<boolean> {
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
      const status = await this.connection.getSignatureStatus(signature)
      if (status?.value?.confirmationStatus === 'confirmed' ||
          status?.value?.confirmationStatus === 'finalized') {
        return true
      }
      if (status?.value?.err) {
        return false
      }
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
    return false
  }
}
