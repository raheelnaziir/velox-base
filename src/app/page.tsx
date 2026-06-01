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

const TOKENS = [ETH, USDC, USDT, DAI]

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
    <div style={{ minHeight: '100vh', background: '#f5f3ff', fontFamily: 'sans-serif' }}>

      {/* Navbar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 32px', background: 'white',
        borderBottom: '1px solid #ede9fe',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '34px', height: '34px', borderRadius: '10px',
            background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '18px',
          }}>⚡</div>
          <span style={{ fontWeight: '700', fontSize: '18px', color: '#1e1b4b' }}>Velox</span>
        </div>

        <div style={{
          display: 'flex', gap: '4px',
          background: '#f5f3ff', borderRadius: '12px', padding: '4px',
        }}>
          {(['swap', 'portfolio'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '8px 20px', borderRadius: '10px', border: 'none',
              background: tab === t ? 'white' : 'transparent',
              color: tab === t ? '#7c3aed' : '#6b7280',
              fontWeight: tab === t ? '600' : '400',
              fontSize: '14px', cursor: 'pointer',
              boxShadow: tab === t ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.15s', textTransform: 'capitalize',
            }}>
              {t === 'swap' ? 'Swap' : 'Portfolio'}
            </button>
          ))}
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

      {/* Content */}
      <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 24px' }}>

        {tab === 'swap' && (
          <div style={{ width: '100%', maxWidth: '460px' }}>
            <div style={{ textAlign: 'center', marginBottom: '28px' }}>
              <h1 style={{ fontSize: '28px', fontWeight: '800', color: '#1e1b4b', margin: '0 0 6px' }}>
                Swap Tokens
              </h1>
              <p style={{ color: '#6b7280', fontSize: '14px', margin: 0 }}>
                Best prices across all Base liquidity
              </p>
            </div>

            <div style={{
              background: 'white', borderRadius: '20px', padding: '24px',
              boxShadow: '0 4px 24px rgba(124,58,237,0.08)',
              border: '1px solid #ede9fe',
            }}>
              <Swap>
                <SwapAmountInput
                  label="Sell"
                  swappableTokens={TOKENS}
                  token={ETH}
                  type="from"
                />
                <SwapToggleButton />
                <SwapAmountInput
                  label="Buy"
                  swappableTokens={TOKENS}
                  token={USDC}
                  type="to"
                />
                <SwapButton />
                <SwapMessage />
              </Swap>
            </div>

            <div style={{
              display: 'flex', justifyContent: 'center', gap: '24px', marginTop: '20px',
            }}>
              {[
                { icon: '', label: 'Non-custodial' },
                { icon: '', label: 'Instant settlement' },
                { icon: '', label: 'Low fees on Base' },
              ].map((item, i) => (
                <div key={i} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '18px' }}>{item.icon}</div>
                  <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>{item.label}</div>
                </div>
              ))}
            </div>
          </div>
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
              background: 'white', borderRadius: '20px', padding: '24px',
              border: '1px solid #ede9fe',
              boxShadow: '0 4px 24px rgba(124,58,237,0.08)',
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
                  borderTop: '1px solid #f9f7ff',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <img src={token.image} alt={token.symbol}
                      style={{ width: '36px', height: '36px', borderRadius: '50%' }} />
                    <div>
                      <p style={{ fontSize: '14px', fontWeight: '600', color: '#1e1b4b', margin: '0 0 2px' }}>
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