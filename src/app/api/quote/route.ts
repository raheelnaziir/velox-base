import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url)

    const sellToken = searchParams.get('sellToken') || ''
    const buyToken = searchParams.get('buyToken') || ''
    const sellAmount = searchParams.get('sellAmount') || ''
    const taker = searchParams.get('taker') || ''

    const params = new URLSearchParams({
        chainId: '8453',
        sellToken,
        buyToken,
        sellAmount,
        ...(taker ? { taker } : {}),
    })

    // Use quote endpoint (returns tx data) if taker provided, else price
    const endpoint = taker ? 'quote' : 'price'

    const res = await fetch(
        `https://api.0x.org/swap/permit2/${endpoint}?${params}`,
        {
            headers: {
                '0x-api-key': process.env.ZERO_X_API_KEY!,
                '0x-version': 'v2',
            },
        }
    )

    const data = await res.json()
    return NextResponse.json(data)
}