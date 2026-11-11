# VUE
Reads vibe/vibe launches and your VUE token on Robinhood Chain Testnet (chain 46630). Read-only. No private keys.

    npm install
    cp .env.example .env     # add your VUE token address after launching
    npm run dev

Deploy: push to GitHub and import in Vercel (build: `npm run build`, output: `dist`). Add the env vars there.

## Verify before you trust it
- The factory address and ABI in `src/chain.js` come from a community repo, not official docs. Check them on the explorer.
- Recent transfers use a short log window because public RPCs limit ranges. For full holder lists, use an indexer.
- Not an audit.
