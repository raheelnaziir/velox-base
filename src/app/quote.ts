export async function getSwapQuote({
    sellToken,
    buyToken,
    sellAmount,
    takerAddress,
}: {
    sellToken: string
    buyToken: string
    sellAmount: string
    takerAddress?: string
}) {
    const params = new URLSearchParams({
        chainId: '8453',
        sellToken,
        buyToken,
        sellAmount,
        ...(takerAddress ? { takerAddress } : {}),
    })

    const res = await fetch(
        `https://api.0x.org/swap/permit2/price?${params}`,
        {
            headers: {
                '0x-api-key': process.env.NEXT_PUBLIC_ZERO_X_API_KEY!,
                '0x-version': 'v2',
            },
        }
    )

    if (!res.ok) throw new Error('Quote failed')
    return res.json()
}