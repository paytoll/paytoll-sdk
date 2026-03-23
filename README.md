# @paytoll/sdk

Developer toolkit for accepting machine payments on Solana via the [Machine Payments Protocol (MPP)](https://mpp.dev).

## Install

```bash
npm install @paytoll/sdk
```

## Quick Start

### 1. Create config

```bash
npx paytoll init
```

This creates `paytoll.config.ts`:

```ts
import { defineConfig } from '@paytoll/sdk'

export default defineConfig({
  recipient: 'YOUR_SOLANA_WALLET_ADDRESS',
  network: 'devnet',
  endpoints: [
    {
      path: '/api/search',
      price: '0.01',
      currency: 'USDC',
      mode: 'charge',
    },
  ],
})
```

### 2. Add middleware

**Express:**

```ts
import express from 'express'
import { paytoll } from '@paytoll/sdk/express'
import config from './paytoll.config'

const app = express()
app.use(paytoll(config))

app.get('/api/search', (req, res) => {
  // This only runs after payment is verified
  // Access payment info via req.paytoll
  console.log(`Paid by: ${req.paytoll?.payer}`)
  res.json({ results: ['result1', 'result2'] })
})

app.listen(3000)
```

**Hono:**

```ts
import { Hono } from 'hono'
import { paytoll } from '@paytoll/sdk/hono'
import config from './paytoll.config'

const app = new Hono()
app.use('*', paytoll(config))

app.get('/api/search', (c) => {
  const { payer, amount } = c.get('paytoll')
  return c.json({ results: ['result1', 'result2'] })
})

export default app
```

### 3. Gate a single route (no config file)

```ts
import { paytollRoute } from '@paytoll/sdk/express'

app.use(
  '/api/premium',
  paytollRoute({
    recipient: 'YOUR_WALLET',
    price: '0.05',
    currency: 'USDC',
  })
)
```

## How It Works

1. Agent sends `GET /api/search`
2. PayToll middleware returns `402 Payment Required` with a challenge
3. Agent signs a Solana transaction and retries with `Authorization: Payment` header
4. PayToll verifies payment on-chain and passes the request to your handler
5. Your handler runs and the response includes a `Payment-Receipt` header

## Payment Modes

**Charge** — One-time payment per request. Best for discrete API calls.

**Session** — Streaming payment channel with micropayments. Best for metered/streaming access.

## CLI

```bash
npx paytoll init          # Create config file
npx paytoll dev           # Start dev server (coming soon)
npx paytoll test [path]   # Simulate payment (coming soon)
npx paytoll status        # Show stats (coming soon)
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `recipient` | `string` | — | Solana wallet address (required) |
| `network` | `string` | `'devnet'` | `'devnet'` or `'mainnet-beta'` |
| `endpoints` | `array` | `[]` | Endpoint configs |
| `feePayer` | `string?` | — | Base58 keypair for fee sponsorship |
| `rpcUrl` | `string?` | auto | Custom Solana RPC URL |
| `secretKey` | `string?` | auto | HMAC key for challenge signing |

## Endpoint Config

| Option | Type | Description |
|--------|------|-------------|
| `path` | `string` | URL path to gate |
| `price` | `string` | Amount (e.g. `'0.01'`) |
| `currency` | `string` | `'USDC'`, `'SOL'`, or mint address |
| `mode` | `string` | `'charge'` or `'session'` |
| `meter` | `string?` | Session meter name |

## Status

This is v0.1.0 — the middleware framework, types, config, and CLI scaffold are functional. On-chain payment verification is pending integration with `@solana/mpp` as the spec stabilizes.

## License

MIT
