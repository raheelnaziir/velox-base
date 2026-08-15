'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Providers from './providers'
import {
  ConnectWallet,
  Wallet,
  WalletDropdown,
  WalletDropdownDisconnect,
} from '@coinbase/onchainkit/wallet'
import { Avatar, Name, Identity, Address } from '@coinbase/onchainkit/identity'
import { base } from 'viem/chains'
import { parseUnits, formatUnits } from 'viem'
import { getBaseTokens, type Token } from './tokens'
import { getSwapQuote, type QuoteResponse } from './quote'
import RouteDetails from './RouteDetails'
import type { Portfolio, PortfolioToken } from './portfolio-types'
import {
  WalletModal,
  getProvider,
  restoreSavedProvider,
  clearActiveWallet,
} from './wallet'

const ETH = {
  name: 'Ethereum',
  address: '' as `0x${string}`,
  symbol: 'ETH',
  decimals: 18,
  image: 'https://wallet-api-production.s3.amazonaws.com/uploads/tokens/eth_288.png',
  chainId: base.id,
}

const USDC = {
  name: 'USD Coin',
  address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as `0x${string}`,
  symbol: 'USDC',
  decimals: 6,
  image: 'https://d3r81g40ycuhqg.cloudfront.net/tokens/images/nTEbVdiving35MoiMQ2T9kpe5wjkRUx38Gz4HoZQVS.png',
  chainId: base.id,
}

const USDT = {
  name: 'Tether',
  address: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2' as `0x${string}`,
  symbol: 'USDT',
  decimals: 6,
  image: 'https://assets.coingecko.com/coins/images/325/small/Tether.png',
  chainId: base.id,
}

const DAI = {
  name: 'Dai',
  address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb' as `0x${string}`,
  symbol: 'DAI',
  decimals: 18,
  image: 'https://assets.coingecko.com/coins/images/9956/small/Badge_Dai.png',
  chainId: base.id,
}

const WETH = {
  name: 'Wrapped Ether',
  address: '0x4200000000000000000000000000000000000006' as `0x${string}`,
  symbol: 'WETH',
  decimals: 18,
  image: 'https://assets.coingecko.com/coins/images/2518/small/weth.png',
  chainId: base.id,
}

const TOKENS = [ETH, USDC, USDT, DAI, WETH]

// The 0x API's stand-in address for native ETH (it isn't a real contract).
const NATIVE_SENTINEL = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'

function isNativeToken(token: Token | null): boolean {
  if (!token) return false
  return token.symbol === 'ETH' || token.address?.toLowerCase() === NATIVE_SENTINEL
}

// A "Max" of the full ETH balance can never actually be swapped — gas comes
// out of the same balance — so hold a little back on native 100%.
const GAS_RESERVE_WEI = parseUnits('0.00003', 18)

// tsconfig targets ES2017, so `0n` literals aren't allowed here.
const ZERO = BigInt(0)
const HUNDRED = BigInt(100)

type BalanceState = 'idle' | 'loading' | 'ready' | 'error'

/** Trim a full-precision amount down to something readable, without rounding up. */
function formatBalance(wei: bigint, decimals: number): string {
  const full = formatUnits(wei, decimals)
  if (!full.includes('.')) return full
  const [whole, frac] = full.split('.')
  const trimmed = frac.slice(0, 6).replace(/0+$/, '')
  return trimmed ? `${whole}.${trimmed}` : whole
}

/** Compact display for token quantities, which range from dust to absurd
 *  supplies on junk airdrops. */
function formatTokenQty(value: string): string {
  const n = parseFloat(value)
  if (!Number.isFinite(n)) return '0'
  if (n === 0) return '0'
  // Past quadrillions a suffix stops helping ("1.15e+29T"), so go exponential.
  if (n >= 1e15) return n.toExponential(2)
  if (n >= 1e12) return `${(n / 1e12).toFixed(2)}T`
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`
  if (n >= 1) return n.toLocaleString('en-US', { maximumFractionDigits: 4 })
  if (n < 0.0001) return n.toExponential(2)
  return n.toLocaleString('en-US', { maximumFractionDigits: 8 })
}

function formatUsdValue(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  if (value === 0) return '$0.00'
  if (value < 0.01) return '<$0.01'
  return `$${value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

type Tab = 'swap' | 'portfolio'

function DEXApp() {
  const [tab, setTab] = useState<Tab>('swap')
  const [tokens, setTokens] = useState<Token[]>([])
  const [sellToken, setSellToken] = useState<Token | null>(null)
  const [buyToken, setBuyToken] = useState<Token | null>(null)
  const [sellAmount, setSellAmount] = useState('')
  const [buyAmount, setBuyAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [rate, setRate] = useState('')
  const [address, setAddress] = useState<string>('')
  const [swapping, setSwapping] = useState(false)
  const [txHash, setTxHash] = useState('')
  const [open1, setOpen1] = useState(false)
  const [open2, setOpen2] = useState(false)
  const [search1, setSearch1] = useState('')
  const [search2, setSearch2] = useState('')
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null)
  const [portfolioLoading, setPortfolioLoading] = useState(false)
  const [portfolioError, setPortfolioError] = useState('')
  const [showUnpriced, setShowUnpriced] = useState(false)
  const [sellBalanceWei, setSellBalanceWei] = useState<bigint | null>(null)
  const [balanceState, setBalanceState] = useState<BalanceState>('idle')
  const [showSuccess, setShowSuccess] = useState(false)
  const [showWallets, setShowWallets] = useState(false)
  // Bumped whenever the active wallet changes, so the account listener
  // re-attaches to the newly selected provider.
  const [walletVersion, setWalletVersion] = useState(0)
  const [quote, setQuote] = useState<QuoteResponse | null>(null)
  const [quoteError, setQuoteError] = useState('')
  const [ethUsd, setEthUsd] = useState<number | null>(null)
  // Monotonic counter so late-arriving quotes can be discarded.
  const quoteRequestId = useRef(0)

  useEffect(() => {
    if (!address || !sellToken) {
      setSellBalanceWei(null)
      setBalanceState('idle')
      return
    }

    // Guards against a slow response for a previously selected token
    // landing after the user has already switched to another one.
    let cancelled = false
    setBalanceState('loading')

    const fetchBalance = async () => {
      try {
        const ethereum = getProvider()
        if (!ethereum) throw new Error('No wallet provider available')

        let wei: bigint
        if (isNativeToken(sellToken)) {
          const bal = await ethereum.request({
            method: 'eth_getBalance',
            params: [address, 'latest'],
          })
          // BigInt, not parseInt — float math loses precision past ~9007 ETH
          // and would silently corrupt the amount we send.
          wei = BigInt(bal)
        } else {
          const data = '0x70a08231' + address.slice(2).toLowerCase().padStart(64, '0')
          const result = await ethereum.request({
            method: 'eth_call',
            params: [{ to: sellToken.address, data }, 'latest'],
          })
          // A non-token address returns '0x' rather than erroring.
          if (!result || result === '0x') throw new Error('No balanceOf response')
          wei = BigInt(result)
        }

        if (cancelled) return
        setSellBalanceWei(wei)
        setBalanceState('ready')
      } catch (err) {
        if (cancelled) return
        console.error('Failed to fetch balance:', err)
        // Distinct from a real zero balance, so the UI can say so.
        setSellBalanceWei(null)
        setBalanceState('error')
      }
    }

    fetchBalance()
    return () => { cancelled = true }
  }, [address, sellToken])

  const loadPortfolio = useCallback(async (signal?: AbortSignal) => {
    if (!address) return
    setPortfolioLoading(true)
    setPortfolioError('')
    try {
      const res = await fetch(`/api/portfolio?address=${address}`, { signal })
      const data = await res.json()
      if (signal?.aborted) return
      if (!res.ok || data?.success === false) {
        setPortfolio(null)
        setPortfolioError(data?.error || 'Could not load your portfolio.')
      } else {
        setPortfolio(data)
      }
    } catch (e) {
      if (signal?.aborted || (e as Error)?.name === 'AbortError') return
      setPortfolio(null)
      setPortfolioError('Could not load your portfolio. Check your connection.')
    }
    if (!signal?.aborted) setPortfolioLoading(false)
  }, [address])

  useEffect(() => {
    if (tab !== 'portfolio' || !address) return
    const controller = new AbortController()
    loadPortfolio(controller.signal)
    return () => controller.abort()
  }, [tab, address, loadPortfolio])


  useEffect(() => {
    let ethereum: ReturnType<typeof getProvider> = null
    let cancelled = false
    const onAccountsChanged = (accounts: string[]) => {
      setAddress(accounts[0] || '')
    }

    const init = async () => {
      // Reconnect through the wallet chosen last time, not whichever
      // extension happens to own window.ethereum.
      ethereum = walletVersion === 0 ? await restoreSavedProvider() : getProvider()
      if (!ethereum || cancelled) return
      try {
        const accounts = await ethereum.request({ method: 'eth_accounts' })
        if (accounts.length > 0 && !cancelled) setAddress(accounts[0])
      } catch { }
      if (cancelled) return
      ethereum.on?.('accountsChanged', onAccountsChanged)
    }
    init()

    return () => {
      cancelled = true
      ethereum?.removeListener?.('accountsChanged', onAccountsChanged)
    }
  }, [walletVersion])

  useEffect(() => {
    getBaseTokens().then(list => {
      setTokens(list)
      const eth = list.find(t => t.symbol === 'ETH') || {
        name: 'Ethereum',
        address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' as `0x${string}`,
        symbol: 'ETH', decimals: 18,
        image: 'https://wallet-api-production.s3.amazonaws.com/uploads/tokens/eth_288.png',
        chainId: 8453,
      }
      const usdc = list.find(t => t.symbol === 'USDC') || null
      setSellToken(eth)
      setBuyToken(usdc)
    })
  }, [])

  const fetchQuote = useCallback(async () => {
    const parsed = parseFloat(sellAmount)
    if (!sellToken || !buyToken || !sellAmount || !Number.isFinite(parsed) || parsed <= 0) {
      setBuyAmount('')
      setRate('')
      setQuote(null)
      setQuoteError('')
      return
    }

    // Mid-typing values like "0." or "1.2.3" throw here; treated as
    // "no quote yet" rather than an error state.
    let sellAmountWei: bigint
    try {
      sellAmountWei = parseUnits(sellAmount, sellToken.decimals)
    } catch {
      setBuyAmount('')
      setRate('')
      setQuote(null)
      setQuoteError('')
      return
    }

    // A stale in-flight quote must never overwrite a newer one.
    const requestId = ++quoteRequestId.current
    setLoading(true)
    setQuoteError('')

    try {
      const sellAddr = isNativeToken(sellToken) ? NATIVE_SENTINEL : sellToken.address
      const buyAddr = isNativeToken(buyToken) ? NATIVE_SENTINEL : buyToken.address

      const result = await getSwapQuote({
        sellToken: sellAddr,
        buyToken: buyAddr,
        sellAmount: sellAmountWei.toString(),
      })

      if (requestId !== quoteRequestId.current) return

      if (result.liquidityAvailable === false || !result.buyAmount) {
        setQuote(result)
        setBuyAmount('—')
        setRate('')
        setQuoteError('No liquidity available for this pair.')
        return
      }

      setQuote(result)
      const buyAmt = formatUnits(BigInt(result.buyAmount), buyToken.decimals)
      setBuyAmount(parseFloat(buyAmt).toFixed(6))
      const r = parseFloat(buyAmt) / parsed
      setRate(`1 ${sellToken.symbol} = ${r.toFixed(4)} ${buyToken.symbol}`)
    } catch (e) {
      if (requestId !== quoteRequestId.current) return
      setBuyAmount('—')
      setRate('Unable to fetch quote')
      setQuote(null)
      setQuoteError('Could not fetch a quote. Check your connection and try again.')
    } finally {
      if (requestId === quoteRequestId.current) setLoading(false)
    }
  }, [sellToken, buyToken, sellAmount])

  useEffect(() => {
    const t = setTimeout(fetchQuote, 600)
    return () => clearTimeout(t)
  }, [fetchQuote])

  useEffect(() => {
    const initSDK = async () => {
      try {
        const sdk = (await import('@farcaster/miniapp-sdk')).default
        await sdk.actions.ready()
      } catch (e) { }
    }
    initSDK()
  }, [])

  // ETH/USD for the network-cost figure. Non-critical: a failure just means
  // the fee shows in ETH only.
  useEffect(() => {
    let cancelled = false
    fetch('/api/ethprice')
      .then(r => r.json())
      .then(d => {
        if (!cancelled && typeof d?.usd === 'number') setEthUsd(d.usd)
      })
      .catch(() => { })
    return () => { cancelled = true }
  }, [])

  const applyPercent = useCallback((percent: number) => {
    if (!sellToken || sellBalanceWei === null || sellBalanceWei === ZERO) return

    // Integer math in wei — no float rounding that could exceed the balance.
    let amount = (sellBalanceWei * BigInt(percent)) / HUNDRED

    if (percent === 100 && isNativeToken(sellToken)) {
      amount = amount > GAS_RESERVE_WEI ? amount - GAS_RESERVE_WEI : ZERO
    }

    if (amount <= ZERO) {
      setSellAmount('')
      return
    }
    setSellAmount(formatUnits(amount, sellToken.decimals))
  }, [sellToken, sellBalanceWei])

  const handleSwap = async () => {

    if (!sellToken || !buyToken || !sellAmount) {
      alert('Please fill in all fields')
      return
    }

    let sellAmountWei: bigint
    try {
      sellAmountWei = parseUnits(sellAmount, sellToken.decimals)
    } catch {
      alert(`Enter a valid ${sellToken.symbol} amount.`)
      return
    }

    if (sellAmountWei <= ZERO) {
      alert('Enter an amount greater than zero.')
      return
    }

    // Catch this here rather than letting the wallet reject it with an
    // opaque RPC error after the user has already approved.
    if (sellBalanceWei !== null && sellAmountWei > sellBalanceWei) {
      alert(
        `Amount exceeds your balance of ` +
        `${formatBalance(sellBalanceWei, sellToken.decimals)} ${sellToken.symbol}.`
      )
      return
    }

    setSwapping(true)
    try {
      const sellAddr = isNativeToken(sellToken) ? NATIVE_SENTINEL : sellToken.address
      const buyAddr = isNativeToken(buyToken) ? NATIVE_SENTINEL : buyToken.address

      const quote = await getSwapQuote({
        sellToken: sellAddr,
        buyToken: buyAddr,
        sellAmount: sellAmountWei.toString(),
        taker: address,
      })

      if (!quote.transaction) {
        alert('Could not get swap transaction. Try again.')
        setSwapping(false)
        return
      }

      const ethereum = getProvider()
      if (!ethereum) {
        alert('No wallet found. Please install MetaMask or Coinbase Wallet.')
        setSwapping(false)
        return
      }

      const accounts = await ethereum.request({ method: 'eth_requestAccounts' })
      const from = accounts[0]

      const hash = await ethereum.request({
        method: 'eth_sendTransaction',
        params: [{
          from,
          to: quote.transaction.to,
          data: quote.transaction.data,
          value: quote.transaction.value
            ? '0x' + BigInt(quote.transaction.value).toString(16)
            : '0x0',
          gas: quote.transaction.gas
            ? '0x' + BigInt(quote.transaction.gas).toString(16)
            : undefined,
        }],
      })

      setTxHash(hash)
      setShowSuccess(true)
    } catch (e: any) {
      console.error(e)
      alert(e.message || 'Swap failed')
    }
    setSwapping(false)
  }

  // Drives whether the route panel exists at all. Mid-typing values like
  // "0", "0." or "abc" count as no amount.
  const parsedSellAmount = parseFloat(sellAmount)
  const hasSellAmount = Number.isFinite(parsedSellAmount) && parsedSellAmount > 0

  return (
    <div style={{ minHeight: '100vh', background: '#f0eeff', fontFamily: 'sans-serif' }}>

      {/* Navbar — unchanged */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 32px', background: '#f0eeff',
        position: 'sticky', top: 0, zIndex: 10,
      }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <img
              src="/favicon.png"
              alt="Velox"
              style={{ width: '36px', height: '36px', borderRadius: '10px' }}
            />
            <span style={{ fontWeight: '800', fontSize: '20px', color: '#1e1b4b' }}>Velox</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {(['swap', 'portfolio'] as Tab[]).map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                padding: '8px 18px', borderRadius: '20px', border: 'none',
                background: tab === t ? 'white' : 'transparent',
                color: tab === t ? '#1e1b4b' : '#6b7280',
                fontWeight: tab === t ? '600' : '400',
                fontSize: '15px', cursor: 'pointer',
                boxShadow: tab === t ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s',
              }}>
                {t === 'swap' ? 'Trade' : 'Portfolio'}
              </button>
            ))}
          </div>
        </div>

        {!address ? (
          <button
            onClick={() => setShowWallets(true)}
            style={{
              background: '#3b0764', color: 'white', border: 'none',
              borderRadius: '20px', padding: '10px 20px',
              fontWeight: '600', fontSize: '16px', cursor: 'pointer',
            }}
          >
            Connect
          </button>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: '600', fontSize: '16px', color: '#1e1b4b' }}>
              {address.slice(0, 6)}...{address.slice(-4)}
            </span>
            <button
              onClick={() => { clearActiveWallet(); setAddress('') }}
              style={{
                background: '#ede9fe', border: 'none', borderRadius: '10px',
                padding: '6px 12px', fontSize: '12px', color: '#6d28d9',
                cursor: 'pointer', fontWeight: '600',
              }}
            >
              Disconnect
            </button>
          </div>
        )}
      </div>

      {/* Main content */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '32px 24px', gap: '16px',
      }}>

        {tab === 'swap' && (
          <>
            {/* Side buttons — unchanged */}

            {/* Centering wrapper: the card kept its centered position, the
                route panel sits beside it and wraps on narrow screens. */}
            <div style={{
              position: 'absolute',
              top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              display: 'flex', alignItems: 'flex-start',
              justifyContent: 'center', gap: '16px',
              flexWrap: 'wrap', width: 'min(1180px, calc(100% - 48px))',
            }}>

            {/* Swap card — dark UI */}
            <div style={{
              width: '100%', maxWidth: '440px',
              background: '#f0eeff', borderRadius: '24px', padding: '20px',
              boxShadow: '0 4px 32px rgba(0,0,0,0.3)',
              flexShrink: 0,
            }}>

              {/* Card header */}
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', marginBottom: '16px',
              }}>

                <b><h2 style={{ fontSize: '20px', fontWeight: '800', color: '#1e1b4b', margin: 0 }}>
                  Swap & Bridge
                </h2></b>

                <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px' }}></button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>

                {/* Sell box */}
                <div style={{ background: '#e8e4ff', borderRadius: '16px', padding: '16px', position: 'relative' }} onClick={e => e.stopPropagation()}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontSize: '13px', color: '#12131f', fontWeight: '600' }}><b>Sell</b></span>
                    <button
                      onClick={() => { setOpen1(!open1); setOpen2(false) }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        background: 'white', border: '1px solid #ede9fe',
                        borderRadius: '20px', padding: '6px 12px',
                        cursor: 'pointer', color: '#1e1b4b', fontWeight: '600', fontSize: '14px',
                      }}

                    >
                      {sellToken?.image && (
                        <img src={sellToken.image} alt="" style={{ width: '20px', height: '20px', borderRadius: '50%' }}
                          onError={e => (e.currentTarget.style.display = 'none')} />
                      )}
                      {sellToken?.symbol || 'Select'}
                      <span style={{ fontSize: '10px', color: '#6b7280' }}>▼</span>
                    </button>
                  </div>

                  <input
                    type="number"
                    placeholder="0"
                    value={sellAmount}
                    onChange={e => setSellAmount(e.target.value)}
                    onWheel={e => e.currentTarget.blur()}
                    style={{
                      background: 'transparent', border: 'none', outline: 'none',
                      fontSize: '36px', fontWeight: '700', color: '#1e1b4b',
                      width: '100%', marginBottom: '10px',
                    }}
                  />

                  {/* % shortcuts */}
                  <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                    {['25%', '50%', '75%', '100%'].map(p => {
                      const usable = sellBalanceWei !== null && sellBalanceWei > ZERO
                      return (
                        <button key={p}
                          onClick={() => applyPercent(parseFloat(p))}
                          disabled={!usable}
                          title={usable ? `${p} of your ${sellToken?.symbol ?? ''} balance` : 'No balance available'}
                          style={{
                            padding: '3px 8px', borderRadius: '6px', fontSize: '11px',
                            background: '#ede9fe', border: '1px solid #ede9fe',
                            color: '#1e1b4b', cursor: usable ? 'pointer' : 'not-allowed',
                            fontWeight: '600', opacity: usable ? 1 : 0.45,
                          }}
                        >{p}</button>
                      )
                    })}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '12px', color: '#8b8fa8' }}>
                      {sellAmount && rate ? `~$${(parseFloat(sellAmount) * (parseFloat(buyAmount) / parseFloat(sellAmount))).toFixed(2)}` : '$0.00'}
                    </span>
                    <span style={{ fontSize: '12px', color: '#6b7280' }}>
                      {!address
                        ? 'Balance: —'
                        : balanceState === 'loading'
                          ? 'Balance: ...'
                          : balanceState === 'error'
                            ? 'Balance: unavailable'
                            : `Balance: ${sellBalanceWei !== null && sellToken
                              ? formatBalance(sellBalanceWei, sellToken.decimals)
                              : '0'} ${sellToken?.symbol ?? ''}`}
                    </span>
                  </div>

                  {/* Sell dropdown */}
                  {open1 && (
                    <div style={{
                      position: 'absolute', top: '40px', right: 0, left: 'auto', zIndex: 200, width: '300px',
                      background: '#ede9fe', borderRadius: '16px',
                      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                      border: '1px solid #ede9fe',
                      maxHeight: '320px', overflow: 'hidden',
                      display: 'flex', flexDirection: 'column', marginTop: '8px',
                    }}>
                      <div style={{ padding: '12px' }}>
                        <input autoFocus type="text" placeholder="Search token..."
                          value={search1} onChange={e => setSearch1(e.target.value)}
                          style={{
                            width: '100%', padding: '10px 12px', borderRadius: '10px',
                            background: '#f5f3ff', border: '1px solid #ede9fe',
                            color: '#1e1b4b', fontSize: '14px', outline: 'none',
                            boxSizing: 'border-box' as const,
                          }} />
                      </div>
                      <div style={{ overflowY: 'auto' as const, flex: 1 }}>
                        {tokens.filter(t =>
                          t.symbol.toLowerCase().includes(search1.toLowerCase()) ||
                          t.name.toLowerCase().includes(search1.toLowerCase())
                        ).slice(0, 50).map((t, i) => (
                          <div key={i}
                            onClick={() => { setSellToken(t); setOpen1(false); setSearch1('') }}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '10px',
                              padding: '10px 14px', cursor: 'pointer', color: '#1e1b4b',
                            }}
                            onMouseOver={e => (e.currentTarget.style.background = '#ede9fe')}
                            onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
                          >
                            {t.image ? (
                              <img src={t.image} alt="" style={{ width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0 }}
                                onError={e => (e.currentTarget.style.display = 'none')} />
                            ) : (
                              <div style={{
                                width: '28px', height: '28px', borderRadius: '50%', background: '#2d2f4a',
                                flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '10px', fontWeight: '700', color: '#8b8fa8',
                              }}>{t.symbol.slice(0, 2)}</div>
                            )}
                            <div>
                              <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e1b4b' }}>{t.symbol}</div>
                              <div style={{ fontSize: '11px', color: '#6b7280' }}>{t.name.slice(0, 24)}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Toggle button */}
                <div style={{ display: 'flex', justifyContent: 'center', margin: '-2px 0', zIndex: 1 }}>
                  <button
                    onClick={() => {
                      const s = sellToken; setSellToken(buyToken); setBuyToken(s)
                      setSellAmount(''); setBuyAmount('')
                    }}
                    style={{
                      width: '36px', height: '36px', borderRadius: '50%',
                      background: '#1a1b2e', border: '2px solid #2d2f4a',
                      cursor: 'pointer', color: 'white', fontSize: '16px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>↓</button>
                </div>

                {/* Buy box */}
                <div style={{ background: '#e8e4ff', borderRadius: '16px', padding: '16px', position: 'relative' }} onClick={e => e.stopPropagation()}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontSize: '13px', color: '#12131f', fontWeight: '600' }}><b>Buy</b></span>
                    <button
                      onClick={() => { setOpen2(!open2); setOpen1(false) }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        background: 'white', border: '1px solid #ede9fe',
                        borderRadius: '20px', padding: '6px 12px',
                        cursor: 'pointer', color: '#1e1b4b', fontWeight: '600', fontSize: '14px',
                      }}
                    >
                      {buyToken?.image && (
                        <img src={buyToken.image} alt="" style={{ width: '20px', height: '20px', borderRadius: '50%' }}
                          onError={e => (e.currentTarget.style.display = 'none')} />
                      )}
                      {buyToken?.symbol || 'Select'}
                      <span style={{ fontSize: '10px', color: '#8b8fa8' }}>▼</span>
                    </button>
                  </div>

                  <div style={{ fontSize: '36px', fontWeight: '700', color: loading ? '#6b7280' : '#1e1b4b', marginBottom: '8px' }}>
                    {loading ? 'Loading...' : (buyAmount || '0')}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '12px', color: '#8b8fa8' }}>
                      {buyAmount && buyAmount !== '—' ? `~$${(parseFloat(buyAmount)).toFixed(2)}` : '$0.00'}
                    </span>
                    <span style={{ fontSize: '12px', color: rate.includes('Unable') ? '#1e1b4b' : '#1e1b4b' }}>{rate}</span>
                  </div>

                  {/* Buy dropdown */}
                  {open2 && (
                    <div style={{
                      position: 'absolute', top: '40px', left: 'auto', right: 0, zIndex: 200, width: '300px',
                      background: '#ede9fe', borderRadius: '16px',
                      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                      border: '1px solid #ede9fe',
                      maxHeight: '320px', overflow: 'hidden',
                      display: 'flex', flexDirection: 'column', marginTop: '8px',
                    }}>
                      <div style={{ padding: '12px' }}>
                        <input autoFocus type="text" placeholder="Search token..."
                          value={search2} onChange={e => setSearch2(e.target.value)}
                          style={{
                            width: '100%', padding: '10px 12px', borderRadius: '10px',
                            background: '#f5f3ff', border: '1px solid #ede9fe',
                            color: '#1e1b4b', fontSize: '14px', outline: 'none',
                            boxSizing: 'border-box' as const,
                          }} />
                      </div>
                      <div style={{ overflowY: 'auto' as const, flex: 1 }}>
                        {tokens.filter(t =>
                          t.symbol.toLowerCase().includes(search2.toLowerCase()) ||
                          t.name.toLowerCase().includes(search2.toLowerCase())
                        ).slice(0, 50).map((t, i) => (
                          <div key={i}
                            onClick={() => { setBuyToken(t); setOpen2(false); setSearch2('') }}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '10px',
                              padding: '10px 14px', cursor: 'pointer', color: '#1e1b4b',
                            }}
                            onMouseOver={e => (e.currentTarget.style.background = '#ede9fe')}
                            onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
                          >
                            {t.image ? (
                              <img src={t.image} alt="" style={{ width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0 }}
                                onError={e => (e.currentTarget.style.display = 'none')} />
                            ) : (
                              <div style={{
                                width: '28px', height: '28px', borderRadius: '50%', background: '#2d2f4a',
                                flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '10px', fontWeight: '700', color: '#8b8fa8',
                              }}>{t.symbol.slice(0, 2)}</div>
                            )}
                            <div>
                              <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e1b4b' }}>{t.symbol}</div>
                              <div style={{ fontSize: '11px', color: '#6b7280' }}>{t.name.slice(0, 24)}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Swap button */}
                {!address ? (
                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                    <button
                      onClick={() => setShowWallets(true)}
                      style={{
                        flex: 1, padding: '16px', borderRadius: '14px',
                        background: '#3b0764', color: 'white',
                        border: 'none', fontSize: '16px', fontWeight: '600',
                        cursor: 'pointer',
                      }}
                    >
                      Connect wallet
                    </button>
                    <button style={{
                      width: '52px', height: '52px', borderRadius: '14px',
                      background: '#ede9fe', border: 'none', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '20px',
                    }}>💳</button>
                  </div>
                ) : (
                  <button
                    onClick={handleSwap}
                    disabled={!sellAmount || !sellToken || !buyToken || swapping}
                    style={{
                      width: '100%', padding: '16px', borderRadius: '14px', marginTop: '8px',
                      background: !sellAmount ? '#ede9fe' : '#3b0764',
                      color: !sellAmount ? '#8b8fa8' : 'white',
                      border: 'none', fontSize: '16px', fontWeight: '700',
                      cursor: !sellAmount ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {swapping ? 'Swapping...' : loading ? 'Getting quote...' : `Swap ${sellToken?.symbol || ''} → ${buyToken?.symbol || ''}`}
                  </button>
                )}



              </div>

            </div>

            {/* Only mounted once there's a real amount to quote — no
                placeholder panel sitting next to the card beforehand. */}
            {hasSellAmount && (
              <RouteDetails
                quote={quote}
                sellToken={sellToken}
                buyToken={buyToken}
                sellAmount={sellAmount}
                loading={loading}
                error={quoteError}
                ethUsd={ethUsd}
              />
            )}

            </div>
          </>
        )}

        {tab === 'portfolio' && (
          <div style={{ width: '100%', maxWidth: '560px' }}>
            <div style={{ textAlign: 'center', marginBottom: '28px' }}>
              <h1 style={{ fontSize: '28px', fontWeight: '800', color: '#1e1b4b', margin: '0 0 6px' }}>
                Portfolio
              </h1>
              <p style={{ color: '#6b7280', fontSize: '14px', margin: 0 }}>
                Your token balances on Base
              </p>
            </div>

            <div style={{
              background: '#f0eeff', borderRadius: '24px', padding: '24px',
              boxShadow: '0 4px 32px rgba(109,40,217,0.10)',
            }}>
              {!address ? (
                <div style={{ textAlign: 'center', padding: '32px 0' }}>
                  <div style={{ fontSize: '40px', marginBottom: '12px' }}>📊</div>
                  <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '20px' }}>
                    Connect your wallet to view your portfolio
                  </p>
                  <button
                    onClick={() => setShowWallets(true)}
                    style={{
                      background: '#3b0764', color: 'white', border: 'none',
                      borderRadius: '20px', padding: '10px 24px',
                      fontWeight: '600', fontSize: '15px', cursor: 'pointer',
                    }}
                  >
                    Connect
                  </button>
                </div>
              ) : portfolioLoading ? (
                <div style={{ textAlign: 'center', padding: '32px 0', color: '#6b7280' }}>
                  <p style={{ fontSize: '14px', margin: '0 0 6px' }}>Loading your portfolio...</p>
                  <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0 }}>
                    Scanning Base for your token balances
                  </p>
                </div>
              ) : portfolioError ? (
                <div style={{ textAlign: 'center', padding: '28px 0' }}>
                  <div style={{ fontSize: '32px', marginBottom: '10px' }}>⚠️</div>
                  <p style={{ color: '#b91c1c', fontSize: '13px', margin: '0 0 16px' }}>
                    {portfolioError}
                  </p>
                  <button
                    onClick={() => loadPortfolio()}
                    style={{
                      background: '#3b0764', color: 'white', border: 'none',
                      borderRadius: '20px', padding: '9px 22px',
                      fontWeight: '600', fontSize: '14px', cursor: 'pointer',
                    }}
                  >
                    Try again
                  </button>
                </div>
              ) : (
                <>
                  {/* Total value */}
                  <div style={{
                    background: '#e8e4ff', borderRadius: '16px', padding: '16px',
                    marginBottom: '20px', textAlign: 'center',
                  }}>
                    <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 4px' }}>
                      Total Portfolio Value
                    </p>
                    <p style={{ fontSize: '28px', fontWeight: '800', color: '#1e1b4b', margin: 0 }}>
                      {portfolio?.ethPriceUsd != null
                        ? formatUsdValue(portfolio?.totalValueUsd)
                        : `${(portfolio?.eth ?? 0).toFixed(6)} ETH`}
                    </p>
                    {portfolio?.ethPriceUsd != null && (
                      <p style={{ fontSize: '12px', color: '#6b7280', margin: '4px 0 0' }}>
                        {(portfolio?.eth ?? 0).toFixed(6)} ETH
                        {portfolio?.counts?.total > 0 && ` · ${portfolio.counts.total} token${portfolio.counts.total === 1 ? '' : 's'}`}
                      </p>
                    )}
                  </div>

                  {/* Token discovery failed but ETH loaded */}
                  {portfolio?.tokensUnavailable && (
                    <div style={{
                      padding: '10px 12px', marginBottom: '14px',
                      background: '#fffbeb', border: '1px solid #fde68a',
                      borderRadius: '10px', fontSize: '12px', color: '#92400e',
                    }}>
                      Token balances couldn&apos;t be loaded right now — this wallet holds
                      a lot of tokens and the scan timed out.{' '}
                      <button
                        onClick={() => loadPortfolio()}
                        style={{
                          background: 'none', border: 'none', padding: 0,
                          color: '#92400e', fontWeight: '700', cursor: 'pointer',
                          textDecoration: 'underline', fontSize: '12px',
                        }}
                      >
                        Retry
                      </button>
                    </div>
                  )}

                  {/* Fell back to the endpoint without prices */}
                  {portfolio?.pricesUnavailable && (
                    <div style={{
                      padding: '10px 12px', marginBottom: '14px',
                      background: '#fffbeb', border: '1px solid #fde68a',
                      borderRadius: '10px', fontSize: '12px', color: '#92400e',
                    }}>
                      Showing balances without prices — the price source timed out
                      for this wallet.{' '}
                      <button
                        onClick={() => loadPortfolio()}
                        style={{
                          background: 'none', border: 'none', padding: 0,
                          color: '#92400e', fontWeight: '700', cursor: 'pointer',
                          textDecoration: 'underline', fontSize: '12px',
                        }}
                      >
                        Retry
                      </button>
                    </div>
                  )}

                  {/* ETH row */}
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 0', borderBottom: '1px solid #e8e4ff',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <img src="https://wallet-api-production.s3.amazonaws.com/uploads/tokens/eth_288.png"
                        alt="ETH" style={{ width: '38px', height: '38px', borderRadius: '50%' }} />
                      <div>
                        <p style={{ fontSize: '14px', fontWeight: '700', color: '#1e1b4b', margin: '0 0 2px' }}>ETH</p>
                        <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0 }}>Ethereum</p>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: '14px', fontWeight: '600', color: '#1e1b4b', margin: 0 }}>
                        {(portfolio?.eth ?? 0).toFixed(6)}
                      </p>
                      {portfolio?.ethValueUsd != null && (
                        <p style={{ fontSize: '12px', color: '#9ca3af', margin: '2px 0 0' }}>
                          {formatUsdValue(portfolio.ethValueUsd)}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Token rows */}
                  {(() => {
                    const all: PortfolioToken[] = portfolio?.tokens ?? []
                    // With no price source, every token reads as "unpriced" —
                    // show them directly instead of hiding them all.
                    const pricesDown = Boolean(portfolio?.pricesUnavailable)
                    const priced = pricesDown ? all : all.filter(t => t.valueUsd != null)
                    const unpriced = pricesDown ? [] : all.filter(t => t.valueUsd == null)
                    const visible = showUnpriced ? [...priced, ...unpriced] : priced

                    if (!all.length) {
                      return (
                        <div style={{ textAlign: 'center', padding: '20px 0', color: '#9ca3af', fontSize: '14px' }}>
                          {portfolio?.tokensUnavailable
                            ? 'Token list unavailable'
                            : 'No token balances found'}
                        </div>
                      )
                    }

                    return (
                      <>
                        {visible.map((token, i) => (
                          <div key={token.address || i} style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '14px 0', borderBottom: '1px solid #e8e4ff', gap: '12px',
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                              {token.image ? (
                                <img
                                  src={token.image}
                                  alt=""
                                  style={{
                                    width: '38px', height: '38px', borderRadius: '50%',
                                    flexShrink: 0, objectFit: 'cover', background: '#ede9fe',
                                  }}
                                  onError={e => { e.currentTarget.style.visibility = 'hidden' }}
                                />
                              ) : (
                                <div style={{
                                  width: '38px', height: '38px', borderRadius: '50%',
                                  background: '#ede9fe', display: 'flex', alignItems: 'center',
                                  justifyContent: 'center', fontWeight: '700', fontSize: '12px',
                                  color: '#6d28d9', flexShrink: 0,
                                }}>
                                  {String(token.symbol ?? '?').slice(0, 3)}
                                </div>
                              )}
                              <div style={{ minWidth: 0 }}>
                                <p style={{
                                  fontSize: '14px', fontWeight: '700', color: '#1e1b4b',
                                  margin: '0 0 2px', overflow: 'hidden',
                                  textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                }}>
                                  {token.symbol}
                                </p>
                                <p style={{
                                  fontSize: '12px', color: '#9ca3af', margin: 0,
                                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                }}>
                                  {token.name}
                                </p>
                              </div>
                            </div>
                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                              <p
                                style={{ fontSize: '14px', fontWeight: '600', color: '#1e1b4b', margin: 0 }}
                                title={token.balance}
                              >
                                {formatTokenQty(token.balance)}
                              </p>
                              <p style={{ fontSize: '12px', color: '#9ca3af', margin: '2px 0 0' }}>
                                {token.valueUsd != null ? formatUsdValue(token.valueUsd) : 'No price'}
                              </p>
                            </div>
                          </div>
                        ))}

                        {/* Unpriced tokens are mostly airdrop spam, so they're
                            collapsed rather than padding out the list. */}
                        {unpriced.length > 0 && (
                          <button
                            onClick={() => setShowUnpriced(v => !v)}
                            style={{
                              width: '100%', marginTop: '14px', padding: '11px',
                              background: '#ede9fe', border: 'none', borderRadius: '12px',
                              color: '#6d28d9', fontWeight: '600', fontSize: '13px',
                              cursor: 'pointer',
                            }}
                          >
                            {showUnpriced
                              ? `Hide ${unpriced.length} unpriced token${unpriced.length === 1 ? '' : 's'}`
                              : `Show ${unpriced.length} unpriced token${unpriced.length === 1 ? '' : 's'}`}
                          </button>
                        )}

                        {!priced.length && !showUnpriced && (
                          <p style={{
                            textAlign: 'center', padding: '18px 0 0',
                            color: '#9ca3af', fontSize: '13px', margin: 0,
                          }}>
                            No tokens with a known price.
                          </p>
                        )}

                        {/* Never let a cap look like the full picture. */}
                        {portfolio && portfolio.counts.total > portfolio.counts.returned && (
                          <p style={{
                            fontSize: '11px', color: '#9ca3af',
                            textAlign: 'center', margin: '14px 0 0',
                          }}>
                            Showing the top {portfolio.counts.returned} of {portfolio.counts.total} tokens by value.
                          </p>
                        )}
                      </>
                    )
                  })()}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <WalletModal
        open={showWallets}
        onClose={() => setShowWallets(false)}
        onConnect={addr => {
          setAddress(addr)
          setWalletVersion(v => v + 1)
        }}
      />

      {showSuccess && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(15, 23, 42, 0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '380px',
              background: 'white',
              borderRadius: '22px',
              padding: '24px',
              boxShadow: '0 24px 60px rgba(109,40,217,0.25)',
              textAlign: 'center',
              border: '1px solid #ede9fe',
              transform: 'translateY(-40px)',
            }}
          >
            <div style={{ fontSize: '48px', marginBottom: '14px' }}></div>

            <h2 style={{ fontSize: '22px', fontWeight: '800', color: '#1e1b4b', margin: '0 0 8px' }}>
              Swap Successful!
            </h2>

            <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 18px' }}>
              Your swap has been confirmed on Base
            </p>

            <a
              href={`https://basescan.org/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'block',
                padding: '12px',
                background: '#ede9fe',
                borderRadius: '12px',
                color: '#6d28d9',
                fontWeight: '600',
                fontSize: '14px',
                textDecoration: 'none',
                marginBottom: '12px',
              }}
            >
              View on Basescan →
            </a>

            <button
              onClick={() => {
                setShowSuccess(false)
                setTxHash('')
              }}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '12px',
                background: '#3b0764',
                color: 'white',
                border: 'none',
                fontWeight: '600',
                fontSize: '15px',
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Home() {
  return (
    <Providers>
      <DEXApp />
    </Providers>
  )
}