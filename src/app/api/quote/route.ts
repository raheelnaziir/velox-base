import { NextRequest, NextResponse } from 'next/server'
import { CHAIN_ID, SLIPPAGE_BPS } from '../../config'

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url)

    const sellToken = searchParams.get('sellToken') || ''
    const buyToken = searchParams.get('buyToken') || ''
    const sellAmount = searchParams.get('sellAmount') || ''
    const taker = searchParams.get('taker') || ''

    const params = new URLSearchParams({
        chainId: String(CHAIN_ID),
        sellToken,
        buyToken,
        sellAmount,
        slippageBps: String(SLIPPAGE_BPS),
        ...(taker ? { taker } : {}),
        affiliateAddress: '0x2d64d7924eeadaa270b893b28c3a1c9ccfd9eabc',
        affiliateFee: '0.01',
    })

    // Use quote endpoint (returns tx data) if taker provided, else price
    const endpoint = taker ? 'quote' : 'price'

    try {
        const res = await fetch(
            `https://api.0x.org/swap/permit2/${endpoint}?${params}`,
            {
                headers: {
                    '0x-api-key': process.env.ZERO_X_API_KEY!,
                    '0x-version': 'v2',
                    '0x-builder-code': 'bc_syb3heao',
                },
                cache: 'no-store',
            }
        )

        const data = await res.json()

        // Surface upstream failures as real HTTP errors instead of handing
        // the client a 200 with an error body it would treat as a quote.
        if (!res.ok) {
            return NextResponse.json(
                { error: 'Quote request failed', status: res.status, details: data },
                { status: res.status }
            )
        }

        // Echo the slippage actually sent so the UI never has to assume it.
        return NextResponse.json({ ...data, slippageBps: SLIPPAGE_BPS })
    } catch (error: unknown) {
        return NextResponse.json(
            {
                error: 'Quote request failed',
                message: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 502 }
        )
    }
}