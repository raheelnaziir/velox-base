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
  const [portfolio, setPortfolio] = useState<any>(null)
  const [portfolioLoading, setPortfolioLoading] = useState(false)
  const [sellBalance, setSellBalance] = useState('0')
  const [showSuccess, setShowSuccess] = useState(false)

  useEffect(() => {
    const fetchBalance = async () => {
      if (!address || !sellToken) return
      try {
        const ethereum = (window as any).ethereum
        if (!ethereum) return

        if (sellToken.symbol === 'ETH') {
          const bal = await ethereum.request({
            method: 'eth_getBalance',
            params: [address, 'latest'],
          })
          const eth = parseInt(bal, 16) / 1e18
          setSellBalance(eth.toFixed(4))
        } else {
          const data = '0x70a08231' + address.slice(2).padStart(64, '0')
          const result = await ethereum.request({
            method: 'eth_call',
            params: [{ to: sellToken.address, data }, 'latest'],
          })
          const balance = parseInt(result, 16) / Math.pow(10, sellToken.decimals)
          setSellBalance(balance.toFixed(4))
        }
      } catch (e) {
        setSellBalance('0')
      }
    }
    fetchBalance()
  }, [address, sellToken])

  useEffect(() => {
    if (tab === 'portfolio' && address) {
      setPortfolioLoading(true)
      fetch(`/api/portfolio?address=${address}`)
        .then(r => r.json())
        .then(data => { setPortfolio(data); setPortfolioLoading(false) })
        .catch(() => setPortfolioLoading(false))
    }
  }, [tab, address])


  useEffect(() => {
    const getAddress = async () => {
      const ethereum = (window as any).ethereum
      if (ethereum) {
        const accounts = await ethereum.request({ method: 'eth_accounts' })
        if (accounts.length > 0) setAddress(accounts[0])
      }
    }
    getAddress()
    const ethereum = (window as any).ethereum
    if (ethereum) {
      ethereum.on('accountsChanged', (accounts: string[]) => {
        setAddress(accounts[0] || '')
      })
    }
  }, [])

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

  const handleSwap = async () => {
    if (!sellToken || !buyToken || !sellAmount) {
      alert('Please fill in all fields')
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

      const ethereum = (window as any).ethereum
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
            onClick={async () => {
              const ethereum = (window as any).ethereum
              if (ethereum) {
                const accounts = await ethereum.request({ method: 'eth_requestAccounts' })
                setAddress(accounts[0])
              } else {
                alert('No wallet found. Please install MetaMask or Coinbase Wallet.')
              }
            }}
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
              onClick={() => setAddress('')}
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

            {/* Swap card — dark UI */}
            <div style={{
              width: '100%', maxWidth: '440px',
              background: '#f0eeff', borderRadius: '24px', padding: '20px',
              boxShadow: '0 4px 32px rgba(0,0,0,0.3)',
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
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
                    {['25%', '50%', '75%', '100%'].map(p => (
                      <button key={p}
                        onClick={() => {
                          setSellAmount((parseFloat(p) / 100).toFixed(4))
                        }}
                        style={{
                          padding: '3px 8px', borderRadius: '6px', fontSize: '11px',
                          background: '#ede9fe', border: '1px solid #ede9fe',
                          color: '#1e1b4b', cursor: 'pointer', fontWeight: '600',
                        }}
                      >{p}</button>
                    ))}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '12px', color: '#8b8fa8' }}>
                      {sellAmount && rate ? `~$${(parseFloat(sellAmount) * (parseFloat(buyAmount) / parseFloat(sellAmount))).toFixed(2)}` : '$0.00'}
                    </span>
                    <span style={{ fontSize: '12px', color: '#6b7280' }}>Balance: {sellBalance} {sellToken?.symbol}</span>
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
                      onClick={async () => {
                        const ethereum = (window as any).ethereum
                        if (ethereum) {
                          const accounts = await ethereum.request({ method: 'eth_requestAccounts' })
                          setAddress(accounts[0])
                        } else {
                          alert('No wallet found. Please install MetaMask or Coinbase Wallet.')
                        }
                      }}
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
                    onClick={async () => {
                      const ethereum = (window as any).ethereum
                      if (ethereum) {
                        const accounts = await ethereum.request({ method: 'eth_requestAccounts' })
                        setAddress(accounts[0])
                      }
                    }}
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
                  Loading your portfolio...
                </div>
              ) : (
                <>
                  {/* Total value */}
                  <div style={{
                    background: '#e8e4ff', borderRadius: '16px', padding: '16px',
                    marginBottom: '20px', textAlign: 'center',
                  }}>
                    <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 4px' }}>Total ETH Balance</p>
                    <p style={{ fontSize: '28px', fontWeight: '800', color: '#1e1b4b', margin: 0 }}>
                      {portfolio?.eth?.toFixed(6) || '0'} ETH
                    </p>
                  </div>

                  {/* ETH row */}
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 0', borderBottom: '1px solid #f5f3ff',
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
                        {portfolio?.eth?.toFixed(6) || '0'}
                      </p>
                    </div>
                  </div>

                  {/* Token rows */}
                  {portfolio?.tokens?.length > 0 ? portfolio.tokens.map((token: any, i: number) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '14px 0', borderBottom: '1px solid #e8e4ff',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: '38px', height: '38px', borderRadius: '50%',
                          background: '#ede9fe', display: 'flex', alignItems: 'center',
                          justifyContent: 'center', fontWeight: '700', fontSize: '12px', color: '#6d28d9',
                        }}>
                          {token.symbol.slice(0, 3)}
                        </div>
                        <div>
                          <p style={{ fontSize: '14px', fontWeight: '700', color: '#1e1b4b', margin: '0 0 2px' }}>
                            {token.symbol}
                          </p>
                          <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0 }}>{token.name}</p>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: '14px', fontWeight: '600', color: '#1e1b4b', margin: 0 }}>
                          {token.balance.toFixed(4)}
                        </p>
                      </div>
                    </div>
                  )) : (
                    <div style={{ textAlign: 'center', padding: '20px 0', color: '#9ca3af', fontSize: '14px' }}>
                      No token balances found
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
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