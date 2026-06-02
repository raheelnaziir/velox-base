import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url)

    const params = new URLSearchParams({
        chainId: '8453',
        sellToken: searchParams.get('sellToken') || '',
        buyToken: searchParams.get('buyToken') || '',
        sellAmount: searchParams.get('sellAmount') || '',
    })

    const res = await fetch(
        `https://api.0x.org/swap/permit2/price?${params}`,
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