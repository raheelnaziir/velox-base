import { NextRequest, NextResponse } from 'next/server'
import { formatUnits, isAddress } from 'viem'
import type { PortfolioToken } from '../../portfolio-types'

/* ------------------------------------------------------------------ *
 * Portfolio: every ERC-20 the address holds on Base, plus native ETH.
 *
 * Uses Blockscout's public Base instance for token discovery. The
 * BASESCAN_API_KEY in this project is on a free Etherscan plan that
 * explicitly excludes Base ("Free API access is not supported for this
 * chain"), so it can't enumerate balances. Blockscout needs no key and
 * returns balances with decimals, icons and USD rates in one call.
 * ------------------------------------------------------------------ */

const BLOCKSCOUT = 'https://base.blockscout.com/api/v2'
const BLOCKSCOUT_V1 = 'https://base.blockscout.com/api'
const BASE_RPC = 'https://mainnet.base.org'

// Native balance and price are quick; token discovery scales with how many
// tokens the wallet holds (a few seconds typically, ~40s for wallets holding
// thousands of airdropped tokens).
const FAST_TIMEOUT_MS = 10_000
const TOKENS_TIMEOUT_MS = 20_000
// The older endpoint carries no prices or icons but responds faster on huge
// wallets. Tried only after v2 fails — hitting both at once makes Blockscout
// slower at each, which defeats the point.
const TOKENS_FALLBACK_TIMEOUT_MS = 20_000

// Wallets holding thousands of airdropped tokens genuinely take this long
// upstream. Raise the platform ceiling to match (ignored when self-hosting).
export const maxDuration = 60

// An active wallet can hold thousands of airdropped tokens. Cap the payload
// and tell the client what was left out rather than truncating silently.
const MAX_TOKENS = 300

type BlockscoutToken = {
  address_hash?: string
  decimals?: string | null
  exchange_rate?: string | null
  holders_count?: string | null
  icon_url?: string | null
  name?: string | null
  symbol?: string | null
  type?: string | null
}

type BlockscoutBalance = {
  token?: BlockscoutToken
  value?: string | null
}

/** Normalised token row from either Blockscout endpoint. */
type RawToken = {
  address: string
  symbol: string
  name: string
  decimals: string | null | undefined
  type: string | null | undefined
  value: string | null | undefined
  image: string | null
  exchangeRate: string | null
  holders: string | null
}

function fromV2(entries: BlockscoutBalance[]): RawToken[] {
  return entries.map(e => ({
    address: e?.token?.address_hash ?? '',
    symbol: e?.token?.symbol ?? '',
    name: e?.token?.name ?? '',
    decimals: e?.token?.decimals,
    type: e?.token?.type,
    value: e?.value,
    image: e?.token?.icon_url ?? null,
    exchangeRate: e?.token?.exchange_rate ?? null,
    holders: e?.token?.holders_count ?? null,
  }))
}

/** Shape of a row from the legacy `tokenlist` endpoint. */
type V1Token = {
  contractAddress?: string
  symbol?: string
  name?: string
  decimals?: string | null
  type?: string | null
  balance?: string | null
}

function fromV1(entries: V1Token[]): RawToken[] {
  return entries.map(e => ({
    address: e?.contractAddress ?? '',
    symbol: e?.symbol ?? '',
    name: e?.name ?? '',
    decimals: e?.decimals,
    type: e?.type,
    value: e?.balance,
    image: null,
    exchangeRate: null,
    holders: null,
  }))
}

async function fetchJson(url: string, timeoutMs = FAST_TIMEOUT_MS): Promise<unknown> {
  const res = await fetch(url, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(timeoutMs),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Upstream ${res.status} for ${url}`)
  return res.json()
}

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/** Native ETH balance straight from the chain — fast and always available. */
async function getNativeBalance(address: string): Promise<bigint> {
  const res = await fetch(BASE_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0', id: 1, method: 'eth_getBalance',
      params: [address, 'latest'],
    }),
    signal: AbortSignal.timeout(FAST_TIMEOUT_MS),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`RPC ${res.status}`)
  const json = await res.json()
  if (json?.error) throw new Error(json.error?.message ?? 'RPC error')
  return BigInt(json?.result ?? '0')
}

/** ETH spot price. Non-critical — null just means values are hidden. */
async function getEthPrice(): Promise<number | null> {
  try {
    const data = await fetchJson(
      'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd'
    ) as { ethereum?: { usd?: unknown } }
    return toNumberOrNull(data?.ethereum?.usd)
  } catch {
    return null
  }
}

/** Token discovery: rich v2 endpoint, falling back to the leaner v1 one. */
async function discoverTokens(address: string): Promise<{
  raw: RawToken[]
  unavailable: boolean
  pricesUnavailable: boolean
}> {
  try {
    const v2 = await fetchJson(
      `${BLOCKSCOUT}/addresses/${address}/token-balances`,
      TOKENS_TIMEOUT_MS
    )
    if (Array.isArray(v2)) {
      return { raw: fromV2(v2), unavailable: false, pricesUnavailable: false }
    }
  } catch {
    // Fall through to the faster, price-less endpoint.
  }

  try {
    const v1 = await fetchJson(
      `${BLOCKSCOUT_V1}?module=account&action=tokenlist&address=${address}`,
      TOKENS_FALLBACK_TIMEOUT_MS
    ) as { result?: unknown }
    if (Array.isArray(v1?.result)) {
      return {
        raw: fromV1(v1.result as V1Token[]),
        unavailable: false,
        pricesUnavailable: true,
      }
    }
  } catch {
    // Both endpoints unreachable.
  }

  return { raw: [], unavailable: true, pricesUnavailable: false }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const address = searchParams.get('address')

  if (!address) {
    return NextResponse.json(
      { success: false, error: 'Wallet address is required' },
      { status: 400 }
    )
  }
  // strict: false — viem otherwise rejects mixed-case addresses that aren't
  // EIP-55 checksummed, which are perfectly valid addresses.
  if (!isAddress(address, { strict: false })) {
    return NextResponse.json(
      { success: false, error: 'Invalid wallet address' },
      { status: 400 }
    )
  }

  try {
    // All independent — one failure must not hide the others. Token discovery
    // handles its own v2 → v1 fallback internally.
    const [nativeResult, priceResult, tokensResult] = await Promise.allSettled([
      getNativeBalance(address),
      getEthPrice(),
      discoverTokens(address),
    ])

    const discovery = tokensResult.status === 'fulfilled'
      ? tokensResult.value
      : { raw: [] as RawToken[], unavailable: true, pricesUnavailable: false }

    const raw = discovery.raw
    const tokensUnavailable = discovery.unavailable
    const pricesUnavailable = discovery.pricesUnavailable

    if (nativeResult.status === 'rejected' && tokensUnavailable) {
      return NextResponse.json(
        { success: false, error: 'Could not reach Base. Please try again.' },
        { status: 502 }
      )
    }

    const nativeWei = nativeResult.status === 'fulfilled' ? nativeResult.value : BigInt(0)
    const ethPriceUsd = priceResult.status === 'fulfilled' ? priceResult.value : null

    const ethBalance = parseFloat(formatUnits(nativeWei, 18))
    const ethValueUsd = ethPriceUsd !== null ? ethBalance * ethPriceUsd : null

    const tokens: PortfolioToken[] = []
    for (const token of raw) {
      // NFTs (ERC-721/1155) come back from the same endpoint; this is a
      // fungible-token portfolio.
      if (!token || token.type !== 'ERC-20') continue

      let rawBalance: bigint
      try {
        rawBalance = BigInt(token.value ?? '0')
      } catch {
        continue
      }
      if (rawBalance <= BigInt(0)) continue

      const decimals = Number(token.decimals ?? 18)
      const safeDecimals = Number.isInteger(decimals) && decimals >= 0 && decimals <= 36
        ? decimals
        : 18

      const balance = formatUnits(rawBalance, safeDecimals)
      const priceUsd = toNumberOrNull(token.exchangeRate)
      const balanceNum = parseFloat(balance)
      const valueUsd = priceUsd !== null && Number.isFinite(balanceNum)
        ? balanceNum * priceUsd
        : null

      tokens.push({
        address: token.address ?? '',
        symbol: token.symbol || '???',
        name: token.name || 'Unknown token',
        decimals: safeDecimals,
        balance,
        balanceRaw: rawBalance.toString(),
        image: token.image || null,
        priceUsd,
        valueUsd,
        holders: toNumberOrNull(token.holders),
      })
    }

    // Priced tokens first by value; unpriced (mostly airdrop spam) after,
    // ordered by holder count as a rough legitimacy signal.
    tokens.sort((a, b) => {
      if (a.valueUsd !== null && b.valueUsd !== null) return b.valueUsd - a.valueUsd
      if (a.valueUsd !== null) return -1
      if (b.valueUsd !== null) return 1
      return (b.holders ?? 0) - (a.holders ?? 0)
    })

    const pricedCount = tokens.filter(t => t.valueUsd !== null).length
    const tokensValueUsd = tokens.reduce((sum, t) => sum + (t.valueUsd ?? 0), 0)

    return NextResponse.json({
      success: true,
      address,
      eth: ethBalance,
      ethPriceUsd,
      ethValueUsd,
      rawWei: nativeWei.toString(),
      tokens: tokens.slice(0, MAX_TOKENS),
      counts: {
        total: tokens.length,
        priced: pricedCount,
        unpriced: tokens.length - pricedCount,
        returned: Math.min(tokens.length, MAX_TOKENS),
      },
      totalValueUsd: (ethValueUsd ?? 0) + tokensValueUsd,
      // True when token discovery failed but ETH succeeded, so the UI can
      // avoid claiming the wallet holds no tokens.
      tokensUnavailable,
      // True when we fell back to the endpoint without price data, so "no
      // price" isn't mistaken for "worthless".
      pricesUnavailable,
    })
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to load portfolio',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
