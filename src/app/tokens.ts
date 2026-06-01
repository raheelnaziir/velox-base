export interface Token {
    name: string
    address: `0x${string}`
    symbol: string
    decimals: number
    image: string
    chainId: number
}

export async function getBaseTokens(): Promise<Token[]> {
    try {
        const res = await fetch(
            'https://tokens.coingecko.com/base/all.json'
        )
        const data = await res.json()
        return data.tokens.map((t: any) => ({
            name: t.name,
            address: t.address as `0x${string}`,
            symbol: t.symbol,
            decimals: t.decimals,
            image: t.logoURI || '',
            chainId: 8453,
        }))
    } catch {
        return []
    }
}