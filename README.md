
## Velox | Decentralized Swap on BASE L2

Velox is a decentralized token swap platform built on Base L2. Instantly swap any token with best prices aggregated across all Base liquidity. Non-custodial, transparent, and powered by 0x protocol.

## Velox Webb app

https://velox-base.vercel.app/

## How it works

The frontend never touches the 0x API directly. All quote requests go through  API route so the API key stays server-side and CORS isn't an issue. Same for portfolio data Basescan calls go through portfolio route.

When you hit Swap, the app fetches a full quote with transaction calldata, then sends it to your wallet. The 0x Exchange Proxy contract handles the rest.

---


