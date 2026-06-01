'use client'

import { useState, useEffect } from 'react'
import Providers from './providers'
import {
  ConnectWallet,
  Wallet,
  WalletDropdown,
  WalletDropdownDisconnect,
} from '@coinbase/onchainkit/wallet'
import { Avatar, Name, Identity, Address } from '@coinbase/onchainkit/identity'
import {
  Swap,
  SwapAmountInput,
  SwapToggleButton,
  SwapButton,
  SwapMessage,
} from '@coinbase/onchainkit/swap'
import { base } from 'viem/chains'

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
    <div style={{
      minHeight: '100vh',
      background: '#f0eeff',
      fontFamily: 'sans-serif',
    }}>

      {/* Navbar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 32px',
        background: '#f0eeff',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '10px',
            background: 'linear-gradient(135deg, #6d28d9, #4f46e5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '18px',
          }}>⚡</div>
          <span style={{ fontWeight: '800', fontSize: '20px', color: '#1e1b4b' }}>Velox</span>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex', gap: '4px',
          background: 'white',
          borderRadius: '14px', padding: '4px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        }}>
          {(['swap', 'portfolio'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '9px 24px', borderRadius: '10px', border: 'none',
              background: tab === t ? '#6d28d9' : 'transparent',
              color: tab === t ? 'white' : '#6b7280',
              fontWeight: '600',
              fontSize: '14px', cursor: 'pointer',
              transition: 'all 0.15s',
            }}>
              {t === 'swap' ? 'Trade' : 'Portfolio'}
            </button>
          ))}
        </div>

        {/* Wallet */}
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
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '32px 24px',
        gap: '16px',
      }}>

        {tab === 'swap' && (
          <>
            {/* Side buttons — like Jumper */}
            <div style={{
              display: 'flex', flexDirection: 'column', gap: '8px',
              marginTop: '8px',
            }}>
              <button style={{
                width: '48px', height: '48px', borderRadius: '14px',
                background: 'white', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                fontSize: '18px',
              }}>⇄</button>
              <button style={{
                width: '48px', height: '48px', borderRadius: '14px',
                background: 'white', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                fontSize: '18px',
              }}>⛽</button>
            </div>

            {/* Swap card */}
            <div style={{
              width: '100%',
              maxWidth: '440px',
              background: 'white',
              borderRadius: '24px',
              padding: '24px',
              boxShadow: '0 4px 32px rgba(109,40,217,0.10)',
            }}>

              {/* Card header */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '20px',
              }}>
                <h2 style={{
                  fontSize: '22px', fontWeight: '800',
                  color: '#1e1b4b', margin: 0,
                }}>Swap & Bridge</h2>
                <button style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: '20px', color: '#6b7280',
                }}>⚙️</button>
              </div>

              {/* OnchainKit Swap — styled via CSS overrides */}
              <style>{`
              [data-testid="ockSwap_Title"] {
                display: none !important;
              }
                .ock-swap-container { display: flex; flex-direction: column; gap: 10px; }
                .ock-textinput { font-size: 22px !important; font-weight: 700 !important; }
                .ock-swap-amount-input {
                  background: #f8f7ff !important;
                  border-radius: 16px !important;
                  border: 1.5px solid #ede9fe !important;
                  padding: 14px !important;
                }
                .ock-swap-toggle-button {
                  background: white !important;
                  border: 1.5px solid #ede9fe !important;
                  border-radius: 50% !important;
                  width: 36px !important;
                  height: 36px !important;
                  margin: -6px auto !important;
                  z-index: 2 !important;
                  position: relative !important;
                }
                .ock-swap-button {
                  background: #6d28d9 !important;
                  border-radius: 14px !important;
                  font-weight: 700 !important;
                  font-size: 16px !important;
                  padding: 14px !important;
                  margin-top: 8px !important;
                  width: 100% !important;
                }
                .ock-swap-message {
                  font-size: 13px !important;
                  color: #6b7280 !important;
                  text-align: center !important;
                  margin-top: 8px !important;
                }
                
                /* Hide internal Swap header */
                [data-testid="ockSwap_Header"],
                .ock-swap-header,
                div[class*="SwapHeader"],
                div[class*="swapHeader"] {
                  display: none !important;
                }
`}</style>




              <Swap className="ock-swap-container">
                <SwapAmountInput
                  label="Sell"
                  swappableTokens={TOKENS}
                  token={ETH}
                  type="from"
                  className="ock-swap-amount-input"
                />
                <SwapToggleButton className="ock-swap-toggle-button" />
                <SwapAmountInput
                  label="Buy"
                  swappableTokens={TOKENS}
                  token={USDC}
                  type="to"
                  className="ock-swap-amount-input"
                />
                <SwapButton className="ock-swap-button" />
                <SwapMessage className="ock-swap-message" />
              </Swap>
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
                  padding: '14px 0',
                  borderTop: '1px solid #f5f3ff',
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