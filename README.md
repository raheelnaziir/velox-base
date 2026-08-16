
## Velox | Decentralized Swap on BASE L2

Velox is a decentralized token swap platform built on Base L2. Instantly swap any token with best prices aggregated across all Base liquidity. Non-custodial, transparent, and powered by 0x protocol.

## Velox Webb app

https://velox-base.vercel.app/

## Stack

- **Next.js 15** — frontend and API routes
- **0x API v2** — swap quotes and routing
- **OnchainKit** — wallet connection
- **Etherscan API v2** — portfolio balances
- **CoinGecko token list** — 500+ Base tokens
- **Farcaster Mini App SDK** — deployed as a Base Mini App

---

## How it works

The frontend never touches the 0x API directly. All quote requests go through a Next.js API route (`/api/quote`) so the API key stays server-side and CORS isn't an issue. Same for portfolio data — Basescan calls go through `/api/portfolio`.

When you hit Swap, the app fetches a full quote with transaction calldata, then sends it to your wallet via `eth_sendTransaction`. The 0x Exchange Proxy contract handles the rest.

---

## Running locally

```bash
git clone https://github.com/raheelnaziir/velox-base.git
cd velox
npm install
```

Create a `.env.local` file:

```env
NEXT_PUBLIC_ONCHAINKIT_API_KEY=your_key
NEXT_PUBLIC_WC_PROJECT_ID=your_key
ZERO_X_API_KEY=your_key
BASESCAN_API_KEY=your_key
```

Then:

```bash
npm run dev
```

Open [localhost:3000](http://localhost:3000).

