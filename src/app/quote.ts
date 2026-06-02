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
}) {
    const params = new URLSearchParams({
        sellToken,
        buyToken,
        sellAmount,
        ...(taker ? { taker } : {}),
    })

    const res = await fetch(`/api/quote?${params}`)
    if (!res.ok) {
        const err = await res.json()
        console.error('Quote error:', err)
        throw new Error('Quote failed')
    }
    return res.json()
}