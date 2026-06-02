import { NextResponse } from 'next/server'

export async function GET() {
    const res = await fetch('https://tokens.coingecko.com/base/all.json', {
        next: { revalidate: 3600 },
    })
    const data = await res.json()
    return NextResponse.json(data)
}