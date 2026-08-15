/** Shared portfolio types — used by the API route and the UI. */

export type PortfolioToken = {
    address: string
    symbol: string
    name: string
    decimals: number
    /** Human-readable, full precision. */
    balance: string
    /** Raw base units, for callers that need exactness. */
    balanceRaw: string
    image: string | null
    priceUsd: number | null
    valueUsd: number | null
    holders: number | null
}

export type Portfolio = {
    success: true
    address: string
    eth: number
    ethPriceUsd: number | null
    ethValueUsd: number | null
    rawWei: string
    tokens: PortfolioToken[]
    counts: {
        total: number
        priced: number
        unpriced: number
        returned: number
    }
    totalValueUsd: number
    /** Token discovery failed entirely; ETH may still be present. */
    tokensUnavailable: boolean
    /** Balances came from the endpoint without price data. */
    pricesUnavailable: boolean
}
