import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url)
    const address = searchParams.get('address')

    if (!address) return NextResponse.json({ error: 'No address' }, { status: 400 })

    const apiKey = process.env.BASESCAN_API_KEY
    const baseUrl = `https://api.etherscan.io/v2/api?chainid=8453&apikey=${apiKey}`

    // Fetch ETH balance
    const ethRes = await fetch(
        `${baseUrl}&module=account&action=balance&address=${address}&tag=latest`
    )
    const ethData = await ethRes.json()
    const ethBalance = parseFloat(ethData.result) / 1e18

    // Fetch ERC20 token transactions
    const tokenRes = await fetch(
        `${baseUrl}&module=account&action=tokentx&address=${address}&startblock=0&endblock=99999999&sort=desc`
    )
    const tokenData = await tokenRes.json()

    // Get unique tokens
    const tokenMap: Record<string, any> = {}
    if (tokenData.result && Array.isArray(tokenData.result)) {
        for (const tx of tokenData.result) {
            if (!tokenMap[tx.contractAddress]) {
                tokenMap[tx.contractAddress] = {
                    symbol: tx.tokenSymbol,
                    name: tx.tokenName,
                    decimals: parseInt(tx.tokenDecimal),
                    address: tx.contractAddress,
                }
            }
        }
    }

    // Fetch balance for each token
    const tokenBalances = await Promise.all(
        Object.values(tokenMap).slice(0, 10).map(async (token: any) => {
            const balRes = await fetch(
                `${baseUrl}&module=account&action=tokenbalance&contractaddress=${token.address}&address=${address}&tag=latest`
            )
            const balData = await balRes.json()
            const balance = parseFloat(balData.result) / Math.pow(10, token.decimals)
            return { ...token, balance }
        })
    )

    return NextResponse.json({
        eth: ethBalance,
        tokens: tokenBalances.filter(t => t.balance > 0),
    })
}