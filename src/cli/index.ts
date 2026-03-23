#!/usr/bin/env node

import { Command } from 'commander'
import { writeFileSync, existsSync } from 'fs'
import { resolve } from 'path'

const program = new Command()

program
  .name('paytoll')
  .description('Developer toolkit for machine payments on Solana')
  .version('0.1.0')

/**
 * paytoll init — Create a paytoll.config.ts file
 */
program
  .command('init')
  .description('Create a paytoll.config.ts configuration file')
  .option('--force', 'Overwrite existing config file')
  .action((options) => {
    const configPath = resolve(process.cwd(), 'paytoll.config.ts')

    if (existsSync(configPath) && !options.force) {
      console.log('⚠ paytoll.config.ts already exists. Use --force to overwrite.')
      process.exit(1)
    }

    const template = `import { defineConfig } from '@paytoll/sdk'

export default defineConfig({
  // Your Solana wallet address for receiving payments
  recipient: 'YOUR_SOLANA_WALLET_ADDRESS',

  // Network — 'devnet' for testing, 'mainnet-beta' for production
  network: 'devnet',

  // Endpoints to gate with payments
  endpoints: [
    {
      path: '/api/search',
      price: '0.01',
      currency: 'USDC',
      mode: 'charge',
    },
    // Add more endpoints here:
    // {
    //   path: '/api/stream',
    //   price: '0.001',
    //   currency: 'USDC',
    //   mode: 'session',
    //   meter: 'tokens',
    // },
  ],

  // Optional: Base58 keypair for fee sponsorship
  // feePayer: 'YOUR_FEE_PAYER_KEYPAIR',

  // Optional: Custom RPC endpoint
  // rpcUrl: 'https://your-rpc.helius-rpc.com/?api-key=YOUR_KEY',
})
`
    writeFileSync(configPath, template, 'utf-8')
    console.log('✓ Created paytoll.config.ts')
    console.log('✓ Edit the file to set your wallet address and endpoints')
    console.log('')
    console.log('Next steps:')
    console.log('  1. Set your recipient wallet address')
    console.log('  2. Configure your endpoints and pricing')
    console.log('  3. Add middleware to your server:')
    console.log('')
    console.log("     import { paytoll } from '@paytoll/sdk/express'")
    console.log("     import config from './paytoll.config'")
    console.log('     app.use(paytoll(config))')
    console.log('')
    console.log('  4. Run: npx paytoll dev')
  })

/**
 * paytoll dev — Start development server
 */
program
  .command('dev')
  .description('Start development server with Surfpool integration')
  .option('-p, --port <port>', 'Server port', '3000')
  .option('-d, --dashboard-port <port>', 'Dashboard port', '3001')
  .action(async (options) => {
    console.log('')
    console.log('  PayToll Dev Server')
    console.log('  ──────────────────')
    console.log('')

    // Check for config file
    const configPath = resolve(process.cwd(), 'paytoll.config.ts')
    if (!existsSync(configPath)) {
      console.log('  ✗ No paytoll.config.ts found')
      console.log('  Run: npx paytoll init')
      process.exit(1)
    }

    console.log(`  ✓ Config loaded`)
    console.log(`  ✓ Server starting on :${options.port}`)
    console.log(`  ✓ Dashboard on :${options.dashboardPort}`)
    console.log('')
    console.log('  Tip: Make sure Surfpool is running for local testing')
    console.log('  Run: surfpool start')
    console.log('')

    // TODO: Actually start the dev server
    // This will require spawning the user's server with the middleware injected
    // For now, just print the status
    console.log('  ⚠ Dev server not yet implemented — coming in v0.2.0')
    console.log('  For now, add the middleware to your server manually:')
    console.log('')
    console.log("    import { paytoll } from '@paytoll/sdk/express'")
    console.log("    import config from './paytoll.config'")
    console.log('    app.use(paytoll(config))')
  })

/**
 * paytoll status — Show current stats
 */
program
  .command('status')
  .description('Show payment stats and endpoint health')
  .action(() => {
    console.log('')
    console.log('  PayToll Status')
    console.log('  ──────────────')
    console.log('')
    console.log('  Revenue today:     $0.00')
    console.log('  Total revenue:     $0.00')
    console.log('  Active sessions:   0')
    console.log('  Endpoints gated:   0')
    console.log('  Network:           devnet')
    console.log('')
    console.log('  ⚠ Status reporting requires a running PayToll server')
  })

/**
 * paytoll test — Simulate an agent payment
 */
program
  .command('test [path]')
  .description('Simulate an agent payment against an endpoint')
  .option('--amount <amount>', 'Payment amount')
  .option('--currency <currency>', 'Payment currency', 'USDC')
  .action((path, options) => {
    const endpoint = path ?? '/api/search'
    console.log('')
    console.log(`  Testing endpoint: ${endpoint}`)
    console.log('  ─────────────────────────')
    console.log('')
    console.log(`  → GET ${endpoint}`)
    console.log('  ← 402 Payment Required')
    console.log(`     Amount: ${options.amount ?? '0.01'} ${options.currency}`)
    console.log('')
    console.log('  → Signing transaction...')
    console.log('  → Submitting payment...')
    console.log('')
    console.log('  ⚠ Test client not yet implemented — coming in v0.2.0')
    console.log('  Use the MPP demo client for testing:')
    console.log('  https://github.com/solana-foundation/mpp-sdk/tree/main/demo')
  })

program.parse()
