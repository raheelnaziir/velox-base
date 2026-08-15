'use client'

import { formatUnits } from 'viem'
import type { Token } from './tokens'
import type { QuoteResponse, RouteFill } from './quote'
import { BASE_BLOCK_SECONDS, EST_BLOCKS_TO_CONFIRM, SLIPPAGE_BPS } from './config'

/* ------------------------------------------------------------------ *
 * Formatting helpers
 * ------------------------------------------------------------------ */

/** Significant-figure formatting so tiny fees don't render as "0.0000". */
function formatAmount(wei: bigint, decimals: number, maxFrac = 6): string {
  const full = formatUnits(wei, decimals)
  if (!full.includes('.')) return full
  const [whole, frac] = full.split('.')

  if (whole !== '0') {
    const trimmed = frac.slice(0, maxFrac).replace(/0+$/, '')
    return trimmed ? `${whole}.${trimmed}` : whole
  }

  // Below 1: keep digits from the first non-zero so small values stay legible.
  const firstSig = frac.search(/[1-9]/)
  if (firstSig === -1) return '0'
  const trimmed = frac.slice(0, firstSig + 4).replace(/0+$/, '')
  return trimmed ? `0.${trimmed}` : '0'
}

function formatUsd(value: number): string {
  if (!Number.isFinite(value)) return '—'
  if (value === 0) return '$0.00'
  if (value < 0.01) return '<$0.01'
  return `$${value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

/** "Uniswap_V4" -> "Uniswap V4" */
function prettySource(source: string): string {
  return source.replace(/_/g, ' ')
}

function safeBigInt(value: string | undefined | null): bigint | null {
  if (value === undefined || value === null || value === '') return null
  try {
    return BigInt(value)
  } catch {
    return null
  }
}

/* ------------------------------------------------------------------ *
 * Route aggregation
 *
 * 0x returns `fills` as a DAG, not a single path — for multi-hop splits the
 * proportions sum past 100%, since a hop's bps is relative to its own leg.
 * Aggregating per source is the honest summary; we surface hop count
 * separately rather than pretending it's one linear path.
 * ------------------------------------------------------------------ */

type SourceShare = { source: string; bps: number }

export function aggregateSources(
  fills: RouteFill[] | undefined,
  sellTokenAddress: string | undefined
): SourceShare[] {
  if (!fills?.length) return []

  // Only first-leg fills represent a share of the input amount. Identify the
  // leg whose `from` is the sold token (0x reports WETH for native ETH).
  const froms = new Set(fills.map(f => f.from.toLowerCase()))
  const tos = new Set(fills.map(f => f.to.toLowerCase()))
  const firstLegFroms = [...froms].filter(a => !tos.has(a))

  const target = sellTokenAddress?.toLowerCase()
  const originAddress =
    (target && froms.has(target) ? target : undefined) ??
    firstLegFroms[0] ??
    fills[0].from.toLowerCase()

  const firstLeg = fills.filter(f => f.from.toLowerCase() === originAddress)
  const relevant = firstLeg.length ? firstLeg : fills

  const totals = new Map<string, number>()
  relevant.forEach(f => {
    const bps = Number(f.proportionBps)
    if (!Number.isFinite(bps)) return
    totals.set(f.source, (totals.get(f.source) ?? 0) + bps)
  })

  const sum = [...totals.values()].reduce((a, b) => a + b, 0)
  if (sum <= 0) return []

  // Normalise to 100% so the displayed shares always add up.
  return [...totals.entries()]
    .map(([source, bps]) => ({ source, bps: (bps / sum) * 10000 }))
    .sort((a, b) => b.bps - a.bps)
}

/** Distinct hops in the longest path, for the "via" summary. */
function hopSymbols(quote: QuoteResponse): string[] {
  const tokens = quote.route?.tokens
  const fills = quote.route?.fills
  if (!tokens?.length || !fills?.length) return []

  const symbolFor = (address: string) =>
    tokens.find(t => t.address.toLowerCase() === address.toLowerCase())?.symbol

  const froms = new Set(fills.map(f => f.from.toLowerCase()))
  const tos = new Set(fills.map(f => f.to.toLowerCase()))
  // Intermediate tokens are both a source and a destination.
  const intermediates = [...froms].filter(a => tos.has(a))

  return intermediates
    .map(symbolFor)
    .filter((s): s is string => Boolean(s))
}

/* ------------------------------------------------------------------ *
 * Row primitives
 * ------------------------------------------------------------------ */

function Row({
  label,
  value,
  hint,
  valueColor = '#1e1b4b',
}: {
  label: string
  value: React.ReactNode
  hint?: string
  valueColor?: string
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start',
      justifyContent: 'space-between', gap: '12px', padding: '9px 0',
    }}>
      <span style={{ fontSize: '12px', color: '#6b7280', flexShrink: 0 }} title={hint}>
        {label}
      </span>
      <span style={{
        fontSize: '12px', fontWeight: '600', color: valueColor,
        textAlign: 'right', wordBreak: 'break-word',
      }}>
        {value}
      </span>
    </div>
  )
}

function Divider() {
  return <div style={{ height: '1px', background: '#ede9fe' }} />
}

function SkeletonRow() {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between',
      gap: '12px', padding: '9px 0',
    }}>
      <div style={{ height: '10px', width: '80px', borderRadius: '4px', background: '#ede9fe' }} />
      <div style={{ height: '10px', width: '58px', borderRadius: '4px', background: '#e8e4ff' }} />
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Panel
 * ------------------------------------------------------------------ */

export default function RouteDetails({
  quote,
  sellToken,
  buyToken,
  sellAmount,
  loading,
  error,
  ethUsd,
}: {
  quote: QuoteResponse | null
  sellToken: Token | null
  buyToken: Token | null
  sellAmount: string
  loading: boolean
  error: string
  ethUsd: number | null
}) {
  const shell = (children: React.ReactNode) => (
    <div style={{
      width: '340px', flexShrink: 0,
      background: '#f0eeff', borderRadius: '24px', padding: '20px',
      boxShadow: '0 4px 32px rgba(109,40,217,0.10)',
    }}>
      <h3 style={{
        fontSize: '15px', fontWeight: '800', color: '#1e1b4b',
        margin: '0 0 14px',
      }}>
        Route details
      </h3>
      {children}
    </div>
  )

  if (loading) {
    return shell(
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <SkeletonRow /><Divider />
        <SkeletonRow /><Divider />
        <SkeletonRow /><Divider />
        <SkeletonRow /><Divider />
        <SkeletonRow />
      </div>
    )
  }

  if (error) {
    return shell(
      <p style={{ fontSize: '12px', color: '#b91c1c', margin: 0, lineHeight: 1.6 }}>
        {error}
      </p>
    )
  }

  if (!quote || !sellToken || !buyToken) {
    return shell(
      <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0, lineHeight: 1.6 }}>
        Enter an amount to see the best route, rate, network cost and price impact.
      </p>
    )
  }

  const buyWei = safeBigInt(quote.buyAmount)
  const minBuyWei = safeBigInt(quote.minBuyAmount)
  const networkFeeWei = safeBigInt(quote.totalNetworkFee)
  const sellParsed = parseFloat(sellAmount)

  /* Exchange rate */
  let rateText = '—'
  if (buyWei !== null && Number.isFinite(sellParsed) && sellParsed > 0) {
    const buyFloat = parseFloat(formatUnits(buyWei, buyToken.decimals))
    if (buyFloat > 0) {
      const rate = buyFloat / sellParsed
      // Very small rates need more precision to stay meaningful.
      const digits = rate >= 1 ? 4 : rate >= 0.0001 ? 6 : 10
      rateText = `1 ${sellToken.symbol} = ${rate.toLocaleString('en-US', {
        maximumFractionDigits: digits,
      })} ${buyToken.symbol}`
    }
  }

  /* Network cost — totalNetworkFee is always denominated in native ETH */
  let networkCost = '—'
  if (networkFeeWei !== null) {
    const feeEth = formatAmount(networkFeeWei, 18)
    if (ethUsd !== null) {
      const usd = parseFloat(formatUnits(networkFeeWei, 18)) * ethUsd
      networkCost = `${formatUsd(usd)} (${feeEth} ETH)`
    } else {
      networkCost = `${feeEth} ETH`
    }
  }

  /* Slippage + minimum received */
  const slippageBps = quote.slippageBps ?? SLIPPAGE_BPS
  const slippagePct = slippageBps / 100
  const minReceived = minBuyWei !== null
    ? `${formatAmount(minBuyWei, buyToken.decimals)} ${buyToken.symbol}`
    : '—'

  /* Estimated time */
  const estSeconds = BASE_BLOCK_SECONDS * EST_BLOCKS_TO_CONFIRM
  const estTime = `~${estSeconds}s`

  /* Route sources */
  const sources = aggregateSources(quote.route?.fills, quote.sellToken)
  const hops = hopSymbols(quote)

  /* Fee taken by the aggregator, denominated in the buy token */
  const zeroExFee = quote.fees?.zeroExFee
  let feeText: string | null = null
  if (zeroExFee?.amount) {
    const amt = safeBigInt(zeroExFee.amount)
    const isBuyToken =
      zeroExFee.token?.toLowerCase() === buyToken.address?.toLowerCase()
    if (amt !== null && amt > BigInt(0)) {
      feeText = `${formatAmount(amt, isBuyToken ? buyToken.decimals : 18)} ${isBuyToken ? buyToken.symbol : ''}`.trim()
    }
  }

  const lowLiquidity = quote.liquidityAvailable === false

  return shell(
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {lowLiquidity && (
        <div style={{
          padding: '10px 12px', marginBottom: '10px',
          background: '#fffbeb', border: '1px solid #fde68a',
          borderRadius: '10px', fontSize: '11px', color: '#92400e',
        }}>
          No liquidity available for this pair right now.
        </div>
      )}

      <Row label="Exchange rate" value={rateText} />
      <Divider />

      <Row
        label="Est. time"
        value={estTime}
        hint="Base produces a block about every 2 seconds"
      />
      <Divider />

      <Row
        label="Network cost"
        value={networkCost}
        hint="Estimated gas paid to the Base network"
      />
      <Divider />

      <Row
        label="Max slippage"
        value={`${slippagePct}%`}
        hint="The swap reverts if the price moves beyond this"
      />
      <Divider />

      <Row
        label="Min. received"
        value={minReceived}
        hint="Guaranteed minimum after maximum slippage"
      />

      {feeText && (
        <>
          <Divider />
          <Row label="Aggregator fee" value={feeText} />
        </>
      )}

      {/* Route breakdown */}
      {sources.length > 0 && (
        <>
          <Divider />
          <div style={{ padding: '11px 0 2px' }}>
            <div style={{
              display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', marginBottom: '10px',
            }}>
              <span style={{ fontSize: '12px', color: '#6b7280' }}>
                Route
              </span>
              <span style={{ fontSize: '11px', color: '#9ca3af' }}>
                {sources.length === 1
                  ? '1 source'
                  : `split across ${sources.length}`}
              </span>
            </div>

            {/* Token path. Only the endpoints are guaranteed to carry the full
                amount — intermediates usually take a partial share, so they're
                noted separately rather than drawn as one linear path. */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              flexWrap: 'wrap', marginBottom: hops.length ? '6px' : '12px',
            }}>
              {[sellToken.symbol, buyToken.symbol].map((sym, i, arr) => (
                <span key={`${sym}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{
                    padding: '3px 8px', borderRadius: '7px',
                    background: '#e8e4ff', fontSize: '11px',
                    fontWeight: '700', color: '#1e1b4b',
                  }}>
                    {sym}
                  </span>
                  {i < arr.length - 1 && (
                    <span style={{ fontSize: '10px', color: '#c4b5fd' }}>→</span>
                  )}
                </span>
              ))}
            </div>

            {hops.length > 0 && (
              <p style={{
                fontSize: '10px', color: '#9ca3af',
                margin: '0 0 12px', lineHeight: 1.5,
              }}>
                Part of this trade routes via {hops.join(', ')}
              </p>
            )}

            {/* Per-source shares */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {sources.map(s => {
                const pct = s.bps / 100
                return (
                  <div key={s.source}>
                    <div style={{
                      display: 'flex', justifyContent: 'space-between',
                      marginBottom: '3px', gap: '8px',
                    }}>
                      <span style={{
                        fontSize: '11px', color: '#1e1b4b', fontWeight: '600',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {prettySource(s.source)}
                      </span>
                      <span style={{ fontSize: '11px', color: '#6b7280', flexShrink: 0 }}>
                        {pct < 1 ? '<1' : pct.toFixed(0)}%
                      </span>
                    </div>
                    <div style={{
                      height: '4px', borderRadius: '3px',
                      background: '#e8e4ff', overflow: 'hidden',
                    }}>
                      <div style={{
                        width: `${Math.max(pct, 1)}%`, height: '100%',
                        background: '#6d28d9', borderRadius: '3px',
                      }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}

      <p style={{
        fontSize: '10px', color: '#9ca3af',
        margin: '14px 0 0', lineHeight: 1.5,
      }}>
        Quotes update as prices move. Final amounts are set at execution.
      </p>
    </div>
  )
}
