import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url)
        const address = searchParams.get('address')

        if (!address) {
            return NextResponse.json({ error: 'Wallet address is required' }, { status: 400 })
        }

        const rpcRes = await fetch('https://mainnet.base.org', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'eth_getBalance',
                params: [address, 'latest'],
            }),
            cache: 'no-store',
        })

        const rpcData = await rpcRes.json()

        const weiHex = rpcData.result || '0x0'
        const wei = BigInt(weiHex)
        const eth = Number(wei) / 1e18

        return NextResponse.json({
            success: true,
            address,
            eth,
            tokens: [],
            rawWei: wei.toString(),
        })
    } catch (error: any) {
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to fetch Base ETH balance',
                message: error.message,
            },
            { status: 500 }
        )
    }
}