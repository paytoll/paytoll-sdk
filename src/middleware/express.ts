import type { Request, Response, NextFunction, RequestHandler } from 'express'
import { PaymentEngine } from '../engine'
import { defineConfig } from '../config'
import type { PayTollConfig, EndpointConfig, PayTollRequest } from '../types'

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      paytoll?: PayTollRequest
    }
  }
}

/**
 * Create PayToll middleware for Express.
 *
 * @example
 * ```ts
 * // Gate all configured endpoints
 * import { paytoll } from '@paytoll/sdk/express'
 * import config from './paytoll.config'
 *
 * app.use(paytoll(config))
 * ```
 *
 * @example
 * ```ts
 * // Gate a single route inline
 * import { paytollRoute } from '@paytoll/sdk/express'
 *
 * app.use('/api/search', paytollRoute({
 *   recipient: 'YOUR_WALLET',
 *   price: '0.01',
 *   currency: 'USDC',
 *   mode: 'charge'
 * }))
 * ```
 */
export function paytoll(config: PayTollConfig): RequestHandler {
  const resolvedConfig = defineConfig(config)
  const engine = new PaymentEngine(resolvedConfig)

  return async (req: Request, res: Response, next: NextFunction) => {
    // Check if this path is gated
    const endpoint = engine.findEndpoint(req.path)
    if (!endpoint) {
      return next()
    }

    // Check for payment credential in Authorization header
    const credential = engine.extractCredential(req.headers.authorization)

    if (!credential) {
      // No payment — return 402 with challenge
      const challenge = engine.createChallenge(endpoint)
      const signature = engine.signChallenge(challenge)

      res.status(402).json({
        type: 'https://paymentauth.org/problems/payment-required',
        title: 'Payment Required',
        status: 402,
        detail: `This endpoint requires a payment of ${endpoint.price} ${endpoint.currency}.`,
        challenge,
        signature,
      })
      return
    }

    // Verify the payment
    try {
      const receipt = await engine.verifyPayment(credential)

      if (receipt.status === 'failed') {
        const challenge = engine.createChallenge(endpoint)
        const signature = engine.signChallenge(challenge)

        res.status(402).json({
          type: 'https://paymentauth.org/problems/verification-failed',
          title: 'Payment Verification Failed',
          status: 402,
          detail: 'The payment credential could not be verified.',
          challenge,
          signature,
        })
        return
      }

      // Payment verified — attach receipt to request and proceed
      req.paytoll = {
        receipt,
        payer: credential.source,
        amount: credential.challenge.request.amount,
        currency: credential.challenge.request.currency,
      }

      // Add receipt header
      res.setHeader('Payment-Receipt', Buffer.from(JSON.stringify(receipt)).toString('base64'))

      next()
    } catch (err) {
      res.status(500).json({
        type: 'https://paymentauth.org/problems/internal-error',
        title: 'Payment Processing Error',
        status: 500,
        detail: 'An error occurred while processing the payment.',
      })
    }
  }
}

/**
 * Gate a single route with inline configuration.
 * Useful when you don't want a global config file.
 */
export function paytollRoute(options: {
  recipient: string
  price: string
  currency: string
  mode?: 'charge' | 'session'
  network?: 'devnet' | 'mainnet-beta'
}): RequestHandler {
  return paytoll({
    recipient: options.recipient,
    network: options.network,
    endpoints: [
      {
        path: '/*',
        price: options.price,
        currency: options.currency,
        mode: options.mode ?? 'charge',
      },
    ],
  })
}

/**
 * Get the PaymentEngine instance for accessing stats and transactions.
 * Useful for building dashboard endpoints.
 */
export function createEngine(config: PayTollConfig): PaymentEngine {
  return new PaymentEngine(defineConfig(config))
}

export { PaymentEngine } from '../engine'
