/** Fields we rely on from the 0x permit2 price/quote response.
 *  Everything is optional — the `price` endpoint omits `transaction`, and
 *  individual fields vary by pair, so nothing here can be assumed present. */
export interface RouteFill {
    from: string
    to: string
    source: string
    proportionBps: string
}

export interface QuoteResponse {
    buyAmount?: string
    sellAmount?: string
    /** Echoed back by 0x — for native ETH this is the 0xeee… sentinel. */
    sellToken?: string
    buyToken?: string
    minBuyAmount?: string
    liquidityAvailable?: boolean
    totalNetworkFee?: string
    gas?: string
    gasPrice?: string
    slippageBps?: number
    blockNumber?: string
    route?: {
        fills?: RouteFill[]
        tokens?: { address: string; symbol: string }[]
    }
    fees?: {
        zeroExFee?: { amount: string; token: string; type: string } | null
        integratorFee?: { amount: string; token: string; type: string } | null
        gasFee?: { amount: string; token: string; type: string } | null
    }
    issues?: {
        allowance?: { actual: string; spender: string } | null
        balance?: { token: string; actual: string; expected: string } | null
        simulationIncomplete?: boolean
        invalidSourcesPassed?: string[]
    }
    transaction?: {
        to: string
        data: string
        value?: string
        gas?: string
        gasPrice?: string
    }
}

export async function getSwapQuote({
    sellToken,
    buyToken,
    sellAmount,
    taker,
}: {
    sellToken: string
    buyToken: string
    sellAmount: string
    taker?: string
}): Promise<QuoteResponse> {
    const params = new URLSearchParams({
        sellToken,
        buyToken,
        sellAmount,
        ...(taker ? { taker } : {}),
    })

    const res = await fetch(`/api/quote?${params}`)
    if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        console.error('Quote error:', err)
        throw new Error('Quote failed')
    }
    return res.json()
}