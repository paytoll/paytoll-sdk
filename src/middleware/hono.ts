import type { Context, Next, MiddlewareHandler } from 'hono'
import { PaymentEngine } from '../engine'
import { defineConfig } from '../config'
import type { PayTollConfig, PayTollRequest } from '../types'

/**
 * Create PayToll middleware for Hono.
 *
 * @example
 * ```ts
 * import { Hono } from 'hono'
 * import { paytoll } from '@paytoll/sdk/hono'
 * import config from './paytoll.config'
 *
 * const app = new Hono()
 * app.use('*', paytoll(config))
 *
 * app.get('/api/search', (c) => {
 *   const { payer, amount } = c.get('paytoll')
 *   return c.json({ results: ['...'] })
 * })
 * ```
 */
export function paytoll(config: PayTollConfig): MiddlewareHandler {
  const resolvedConfig = defineConfig(config)
  const engine = new PaymentEngine(resolvedConfig)

  return async (c: Context, next: Next) => {
    // Check if this path is gated
    const endpoint = engine.findEndpoint(c.req.path)
    if (!endpoint) {
      await next()
      return
    }

    // Check for payment credential
    const credential = engine.extractCredential(c.req.header('Authorization'))

    if (!credential) {
      const challenge = engine.createChallenge(endpoint)
      const signature = engine.signChallenge(challenge)

      return c.json(
        {
          type: 'https://paymentauth.org/problems/payment-required',
          title: 'Payment Required',
          status: 402,
          detail: `This endpoint requires a payment of ${endpoint.price} ${endpoint.currency}.`,
          challenge,
          signature,
        },
        402
      )
    }

    // Verify payment
    try {
      const receipt = await engine.verifyPayment(credential)

      if (receipt.status === 'failed') {
        const challenge = engine.createChallenge(endpoint)
        const signature = engine.signChallenge(challenge)

        return c.json(
          {
            type: 'https://paymentauth.org/problems/verification-failed',
            title: 'Payment Verification Failed',
            status: 402,
            detail: 'The payment credential could not be verified.',
            challenge,
            signature,
          },
          402
        )
      }

      // Attach receipt to context
      const paytollData: PayTollRequest = {
        receipt,
        payer: credential.source,
        amount: credential.challenge.request.amount,
        currency: credential.challenge.request.currency,
      }

      c.set('paytoll', paytollData)
      c.header('Payment-Receipt', Buffer.from(JSON.stringify(receipt)).toString('base64'))

      await next()
    } catch {
      return c.json(
        {
          type: 'https://paymentauth.org/problems/internal-error',
          title: 'Payment Processing Error',
          status: 500,
          detail: 'An error occurred while processing the payment.',
        },
        500
      )
    }
  }
}

export { PaymentEngine } from '../engine'
