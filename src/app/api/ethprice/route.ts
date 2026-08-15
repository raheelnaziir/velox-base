import { NextResponse } from 'next/server'

/** ETH spot price in USD, used to express the network fee in dollars.
 *  Non-critical: the UI falls back to showing the fee in ETH if this fails. */
export async function GET() {
    try {
        const res = await fetch(
            'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd',
            { next: { revalidate: 60 } }
        )

        if (!res.ok) {
            return NextResponse.json({ usd: null }, { status: 200 })
        }

        const data = await res.json()
        const usd = data?.ethereum?.usd

        return NextResponse.json({
            usd: typeof usd === 'number' && Number.isFinite(usd) ? usd : null,
        })
    } catch {
        // Swallow — a missing price must never break the quote panel.
        return NextResponse.json({ usd: null }, { status: 200 })
    }
}
