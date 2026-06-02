export async function getSwapQuote({
    sellToken,
    buyToken,
    sellAmount,
}: {
    sellToken: string
    buyToken: string
    sellAmount: string
}) {
    const params = new URLSearchParams({
        sellToken,
        buyToken,
        sellAmount,
    })

    const res = await fetch(`/api/quote?${params}`)

    if (!res.ok) {
        const err = await res.json()
        console.error('Quote error:', err)
        throw new Error('Quote failed')
    }

    return res.json()
}