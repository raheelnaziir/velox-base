'use client'

import { useState, useEffect, useCallback } from 'react'
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
import { getSwapQuote } from './quote'

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

type Tab = 'swap' | 'portfolio'

function TokenSelector({
  selected, tokens, onSelect, label,
}: {
  selected: Token | null
  tokens: Token[]
  onSelect: (t: Token) => void
  label: string
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const filtered = tokens.filter(
    t =>
      t.symbol.toLowerCase().includes(search.toLowerCase()) ||
      t.name.toLowerCase().includes(search.toLowerCase())
  ).slice(0, 50)

  return (
    <div style={{ position: 'relative' }}>
      <div style={{
        background: '#f8f7ff', borderRadius: '16px',
        border: '1.5px solid #ede9fe', padding: '14px 16px',
      }}>
        <div style={{
          fontSize: '12px', fontWeight: '700', color: '#1e1b4b',
          marginBottom: '10px', textTransform: 'uppercase' as const,
          letterSpacing: '0.05em',
        }}>{label}</div>
        <button
          onClick={() => setOpen(!open)}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: 'white', border: '1.5px solid #ede9fe',
            borderRadius: '12px', padding: '8px 12px',
            cursor: 'pointer', fontWeight: '600',
            fontSize: '14px', color: '#1e1b4b', width: '100%',
          }}
        >
          {selected ? (
            <>
              {selected.image && (
                <img src={selected.image} alt={selected.symbol}
                  style={{ width: '20px', height: '20px', borderRadius: '50%' }}
                  onError={e => (e.currentTarget.style.display = 'none')}
                />
              )}
              {selected.symbol} — {selected.name.slice(0, 20)}
            </>
          ) : 'Select token'}
          <span style={{ marginLeft: 'auto' }}>▾</span>
        </button>
      </div>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
          background: 'white', borderRadius: '16px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
          border: '1px solid #ede9fe', marginTop: '8px',
          maxHeight: '320px', overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ padding: '12px' }}>
            <input
              autoFocus
              type="text"
              placeholder="Search token..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: '10px',
                border: '1.5px solid #ede9fe', fontSize: '14px',
                outline: 'none', boxSizing: 'border-box' as const,
              }}
            />
          </div>
          <div style={{ overflowY: 'auto' as const, flex: 1 }}>
            {filtered.map((t, i) => (
              <div
                key={i}
                onClick={() => { onSelect(t); setOpen(false); setSearch('') }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '10px 14px', cursor: 'pointer',
                }}
                onMouseOver={e => (e.currentTarget.style.background = '#f5f3ff')}
                onMouseOut={e => (e.currentTarget.style.background = 'white')}
              >
                {t.image ? (
                  <img src={t.image} alt={t.symbol}
                    style={{ width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0 }}
                    onError={e => (e.currentTarget.style.display = 'none')}
                  />
                ) : (
                  <div style={{
                    width: '28px', height: '28px', borderRadius: '50%',
                    background: '#ede9fe', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '10px', fontWeight: '700', color: '#6d28d9',
                  }}>{t.symbol.slice(0, 2)}</div>
                )}
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e1b4b' }}>{t.symbol}</div>
                  <div style={{ fontSize: '11px', color: '#9ca3af' }}>{t.name.slice(0, 24)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

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

  useEffect(() => {
    const stored = localStorage.getItem('connectedAddress')
    if (stored) setAddress(stored)
  }, [])

  const [swapping, setSwapping] = useState(false)
  const [txHash, setTxHash] = useState('')

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
    if (!sellToken || !buyToken || !sellAmount || parseFloat(sellAmount) === 0) {
      setBuyAmount('')
      setRate('')
      return
    }
    setLoading(true)
    try {
      const sellAmountWei = parseUnits(sellAmount, sellToken.decimals).toString()
      const sellAddr = sellToken.symbol === 'ETH'
        ? '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
        : sellToken.address
      const buyAddr = buyToken.symbol === 'ETH'
        ? '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
        : buyToken.address

      const quote = await getSwapQuote({
        sellToken: sellAddr,
        buyToken: buyAddr,
        sellAmount: sellAmountWei,
      })

      const buyAmt = formatUnits(BigInt(quote.buyAmount), buyToken.decimals)
      setBuyAmount(parseFloat(buyAmt).toFixed(6))
      const r = parseFloat(buyAmt) / parseFloat(sellAmount)
      setRate(`1 ${sellToken.symbol} = ${r.toFixed(4)} ${buyToken.symbol}`)
    } catch (e) {
      setBuyAmount('—')
      setRate('Unable to fetch quote')
    }
    setLoading(false)
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

  return (
    <div style={{ minHeight: '100vh', background: '#f0eeff', fontFamily: 'sans-serif' }}>

      {/* Navbar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 32px', background: '#f0eeff',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '10px',
              background: 'linear-gradient(135deg, #6d28d9, #4f46e5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '18px',
            }}>⚡</div>
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
        <Wallet>
          <ConnectWallet>
            <Avatar className="h-6 w-6" />
            <Name />
          </ConnectWallet>
          <WalletDropdown>
            <Identity className="px-4 pt-3 pb-2" hasCopyAddressOnClick>
              <Avatar /><Name /><Address />
            </Identity>
            <WalletDropdownDisconnect />
          </WalletDropdown>
        </Wallet>
      </div>

      {/* Main content */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '32px 24px', gap: '16px',
      }}>

        {tab === 'swap' && (
          <>
            {/* Side buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
              <button style={{
                width: '48px', height: '48px', borderRadius: '14px',
                background: 'white', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)', fontSize: '18px',
              }}>⇄</button>
              <button style={{
                width: '48px', height: '48px', borderRadius: '14px',
                background: 'white', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)', fontSize: '18px',
              }}>⛽</button>
            </div>

            {/* Swap card */}
            <div style={{
              width: '100%', maxWidth: '440px', background: 'white',
              borderRadius: '24px', padding: '24px',
              boxShadow: '0 4px 32px rgba(109,40,217,0.10)',
            }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', marginBottom: '20px',
              }}>
                <h2 style={{ fontSize: '22px', fontWeight: '800', color: '#1e1b4b', margin: 0 }}>
                  Swap & Bridge
                </h2>
                <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px' }}>⚙️</button>
              </div>

              <style>{`
                [data-testid="ockSwap_Title"] { display: none !important; }
                [data-testid="ockSwapAmountInput_Container"] { min-height: unset !important; height: auto !important; padding: 12px 14px !important; }
                [data-testid="ockSwapAmountInput_Container"] > div:last-child { display: none !important; }
                [data-testid="ockSwapAmountInput_Label"] { font-weight: 700 !important; font-size: 13px !important; color: #1e1b4b !important; }
                .ock-swap-container { display: flex; flex-direction: column; gap: 10px; }
                .ock-swap-amount-input { background: #f8f7ff !important; border-radius: 16px !important; border: 1.5px solid #ede9fe !important; padding: 14px !important; }
                .ock-swap-toggle-button { background: white !important; border: 1.5px solid #ede9fe !important; border-radius: 50% !important; width: 36px !important; height: 36px !important; margin: -6px auto !important; z-index: 2 !important; position: relative !important; }
                .ock-swap-button { background: #6d28d9 !important; border-radius: 14px !important; font-weight: 700 !important; font-size: 16px !important; padding: 14px !important; margin-top: 8px !important; width: 100% !important; }
                .ock-swap-message { font-size: 13px !important; color: #6b7280 !important; text-align: center !important; margin-top: 8px !important; }
                [data-testid="ockSwap_Header"], .ock-swap-header, div[class*="SwapHeader"], div[class*="swapHeader"] { display: none !important; }
              `}</style>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <TokenSelector
                  label="Sell"
                  selected={sellToken}
                  tokens={tokens}
                  onSelect={setSellToken}
                />

                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <button
                    onClick={() => {
                      const s = sellToken
                      setSellToken(buyToken)
                      setBuyToken(s)
                      setSellAmount('')
                      setBuyAmount('')
                    }}
                    style={{
                      width: '36px', height: '36px', borderRadius: '50%',
                      background: 'white', border: '1.5px solid #ede9fe',
                      cursor: 'pointer', fontSize: '16px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                    }}>↕</button>
                </div>

                <TokenSelector
                  label="Buy"
                  selected={buyToken}
                  tokens={tokens}
                  onSelect={setBuyToken}
                />

                <input
                  type="number"
                  placeholder="Enter amount to sell"
                  value={sellAmount}
                  onChange={e => setSellAmount(e.target.value)}
                  style={{
                    width: '100%', padding: '12px 14px', borderRadius: '12px',
                    border: '1.5px solid #ede9fe', fontSize: '16px',
                    outline: 'none', boxSizing: 'border-box' as const, color: '#1e1b4b',
                    marginTop: '4px',
                  }}
                />

                {(buyAmount || loading) && (
                  <div style={{
                    padding: '12px 14px', borderRadius: '12px',
                    background: '#f5f3ff', border: '1.5px solid #ede9fe',
                  }}>
                    {loading ? (
                      <p style={{ color: '#6b7280', fontSize: '14px', margin: 0 }}>
                        Fetching best price...
                      </p>
                    ) : (
                      <>
                        <p style={{ fontSize: '20px', fontWeight: '700', color: '#1e1b4b', margin: '0 0 4px' }}>
                          {buyAmount} {buyToken?.symbol}
                        </p>
                        <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>{rate}</p>
                      </>
                    )}
                  </div>
                )}

                {/* Swap button — fully wired */}
                <button
                  onClick={async () => {
                    if (!address || !sellToken || !buyToken || !sellAmount) {
                      alert('Please connect your wallet and enter an amount')
                      return
                    }
                    setSwapping(true)
                    try {
                      const sellAmountWei = parseUnits(sellAmount, sellToken.decimals).toString()
                      const sellAddr = sellToken.symbol === 'ETH'
                        ? '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
                        : sellToken.address
                      const buyAddr = buyToken.symbol === 'ETH'
                        ? '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
                        : buyToken.address

                      const quote = await getSwapQuote({
                        sellToken: sellAddr,
                        buyToken: buyAddr,
                        sellAmount: sellAmountWei,
                        taker: address,
                      })

                      if (!quote.transaction) {
                        alert('Could not get swap transaction. Try again.')
                        setSwapping(false)
                        return
                      }

                      // Use window.ethereum to send transaction
                      const ethereum = (window as any).ethereum
                      if (!ethereum) {
                        alert('No wallet found. Please install MetaMask or Coinbase Wallet.')
                        setSwapping(false)
                        return
                      }

                      const accounts = await ethereum.request({ method: 'eth_requestAccounts' })
                      const from = accounts[0]

                      const txHash = await ethereum.request({
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

                      setTxHash(txHash)
                    } catch (e: any) {
                      console.error(e)
                      alert(e.message || 'Swap failed')
                    }
                    setSwapping(false)
                  }}
                  disabled={!address || !sellAmount || !sellToken || !buyToken || swapping}
                  style={{
                    width: '100%', padding: '14px', borderRadius: '14px',
                    background: !address ? '#e5e7eb' : 'linear-gradient(135deg, #6d28d9, #4f46e5)',
                    color: !address ? '#9ca3af' : 'white',
                    border: 'none', fontSize: '16px',
                    fontWeight: '700', cursor: !address ? 'not-allowed' : 'pointer',
                    marginTop: '4px', transition: 'opacity 0.15s',
                  }}
                >
                  {!address
                    ? 'Connect wallet to swap'
                    : swapping
                      ? 'Swapping...'
                      : loading
                        ? 'Getting quote...'
                        : `Swap ${sellToken?.symbol || ''} → ${buyToken?.symbol || ''}`}
                </button>

                {txHash && (
                  <div style={{
                    padding: '12px 14px', borderRadius: '12px',
                    background: '#f0fdf4', border: '1px solid #86efac',
                    marginTop: '8px',
                  }}>
                    <p style={{ fontSize: '13px', color: '#15803d', margin: '0 0 4px', fontWeight: '600' }}>
                      ✅ Swap successful!
                    </p>

                    <a href={'https://basescan.org/tx/' + txHash} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px', color: '#16a34a' }}>
                      View on Basescan →
                    </a>
                  </div>
                )}

              </div>
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
              background: 'white', borderRadius: '24px', padding: '24px',
              boxShadow: '0 4px 32px rgba(109,40,217,0.10)',
            }}>
              <div style={{ textAlign: 'center', padding: '32px 0' }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>📊</div>
                <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '20px' }}>
                  Connect your wallet to view your portfolio
                </p>
                <Wallet>
                  <ConnectWallet>
                    <Avatar className="h-5 w-5" />
                    <Name />
                  </ConnectWallet>
                </Wallet>
              </div>

              {TOKENS.map((token, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '14px 0', borderTop: '1px solid #f5f3ff',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <img src={token.image} alt={token.symbol}
                      style={{ width: '38px', height: '38px', borderRadius: '50%' }} />
                    <div>
                      <p style={{ fontSize: '14px', fontWeight: '700', color: '#1e1b4b', margin: '0 0 2px' }}>
                        {token.symbol}
                      </p>
                      <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0 }}>{token.name}</p>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: '14px', fontWeight: '600', color: '#1e1b4b', margin: '0 0 2px' }}>—</p>
                    <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0 }}>Connect wallet</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div >
  )
}

export default function Home() {
  return (
    <Providers>
      <DEXApp />
    </Providers>
  )
}