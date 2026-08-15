'use client'

import { useCallback, useEffect, useState } from 'react'

/* ------------------------------------------------------------------ *
 * EIP-6963 wallet discovery
 *
 * Calling window.ethereum.request('eth_requestAccounts') pops open
 * whichever extension happened to inject itself last. Instead we listen
 * for eip6963:announceProvider, which every modern wallet fires with its
 * own name/icon/provider, so the user can pick one.
 * ------------------------------------------------------------------ */

export type Eip1193Provider = {
  request: (args: { method: string; params?: any }) => Promise<any>
  on?: (event: string, handler: (...args: any[]) => void) => void
  removeListener?: (event: string, handler: (...args: any[]) => void) => void
}

export type WalletInfo = {
  uuid: string
  name: string
  icon: string
  rdns: string
}

export type DiscoveredWallet = {
  info: WalletInfo
  provider: Eip1193Provider
}

const STORAGE_KEY = 'velox.wallet.rdns'

const store: DiscoveredWallet[] = []
const listeners = new Set<() => void>()

function addWallet(wallet: DiscoveredWallet) {
  if (!wallet?.info?.rdns || !wallet.provider) return
  if (store.some(w => w.info.rdns === wallet.info.rdns)) return
  store.push(wallet)
  listeners.forEach(l => l())
}

// Start listening as early as the bundle loads — wallets announce once,
// immediately after we ask, and we don't want to miss the first round.
if (typeof window !== 'undefined') {
  window.addEventListener('eip6963:announceProvider', (event: any) => {
    addWallet(event?.detail)
  })
  window.dispatchEvent(new Event('eip6963:requestProvider'))
}

function requestAnnouncements() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event('eip6963:requestProvider'))
}

/* ------------------------------------------------------------------ *
 * Legacy fallback for wallets that never announce (and for the
 * Farcaster / in-app browser providers, which only set window.ethereum)
 * ------------------------------------------------------------------ */

// Order matters: plenty of wallets also set isMetaMask, so it goes last.
const LEGACY_FLAGS: [string, string][] = [
  ['isRabby', 'Rabby'],
  ['isCoinbaseWallet', 'Coinbase Wallet'],
  ['isBraveWallet', 'Brave Wallet'],
  ['isPhantom', 'Phantom'],
  ['isOkxWallet', 'OKX Wallet'],
  ['isTrust', 'Trust Wallet'],
  ['isTrustWallet', 'Trust Wallet'],
  ['isZerion', 'Zerion'],
  ['isMetaMask', 'MetaMask'],
]

function legacyName(provider: any): string {
  for (const [flag, name] of LEGACY_FLAGS) {
    if (provider?.[flag]) return name
  }
  return 'Browser Wallet'
}

function legacyWallets(): DiscoveredWallet[] {
  if (typeof window === 'undefined') return []
  const injected = (window as any).ethereum
  if (!injected) return []

  const raw: any[] =
    Array.isArray(injected.providers) && injected.providers.length
      ? injected.providers
      : [injected]

  const seen = new Set<string>()
  const out: DiscoveredWallet[] = []
  raw.forEach(provider => {
    const name = legacyName(provider)
    if (seen.has(name)) return
    seen.add(name)
    out.push({
      info: { uuid: `legacy:${name}`, name, icon: '', rdns: `legacy:${name}` },
      provider,
    })
  })
  return out
}

/** EIP-6963 wallets, plus any injected provider that didn't announce itself. */
function allWallets(announced: DiscoveredWallet[]): DiscoveredWallet[] {
  const names = new Set(announced.map(w => w.info.name.toLowerCase()))
  const extras = legacyWallets().filter(w => !names.has(w.info.name.toLowerCase()))
  return [...announced, ...extras]
}

/* ------------------------------------------------------------------ *
 * Active provider — the wallet the user actually picked
 * ------------------------------------------------------------------ */

let activeProvider: Eip1193Provider | null = null

/**
 * The provider every request should go through. Falls back to
 * window.ethereum so nothing breaks before a wallet has been chosen.
 */
export function getProvider(): Eip1193Provider | null {
  if (activeProvider) return activeProvider
  if (typeof window === 'undefined') return null
  return ((window as any).ethereum as Eip1193Provider) ?? null
}

export function setActiveWallet(wallet: DiscoveredWallet) {
  activeProvider = wallet.provider
  try {
    localStorage.setItem(STORAGE_KEY, wallet.info.rdns)
  } catch { }
}

export function clearActiveWallet() {
  activeProvider = null
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch { }
}

/**
 * Re-select the wallet used last session so balances, `eth_accounts` and
 * swaps all speak to the same provider after a reload. Waits briefly for
 * announcements, which land a tick or two after the page loads.
 */
export async function restoreSavedProvider(): Promise<Eip1193Provider | null> {
  let saved: string | null = null
  try {
    saved = localStorage.getItem(STORAGE_KEY)
  } catch { }

  if (saved) {
    requestAnnouncements()
    for (let i = 0; i < 20; i++) {
      const match = allWallets(store).find(w => w.info.rdns === saved)
      if (match) {
        activeProvider = match.provider
        return match.provider
      }
      await new Promise(r => setTimeout(r, 50))
    }
  }
  return getProvider()
}

/** Wallets available in this browser, kept live as announcements arrive. */
export function useWallets(): DiscoveredWallet[] {
  const [wallets, setWallets] = useState<DiscoveredWallet[]>([])

  useEffect(() => {
    const update = () => setWallets(allWallets(store))
    listeners.add(update)
    requestAnnouncements()
    update()
    // Some extensions inject late; re-ask once the tab has settled.
    const t = setTimeout(() => {
      requestAnnouncements()
      update()
    }, 400)
    return () => {
      listeners.delete(update)
      clearTimeout(t)
    }
  }, [])

  return wallets
}

/* ------------------------------------------------------------------ *
 * Wallet picker modal
 * ------------------------------------------------------------------ */

const INSTALL_OPTIONS = [
  { name: 'MetaMask', url: 'https://metamask.io/download/', color: '#f6851b' },
  { name: 'Coinbase Wallet', url: 'https://www.coinbase.com/wallet/downloads', color: '#0052ff' },
  { name: 'Rabby', url: 'https://rabby.io/', color: '#7084ff' },
  { name: 'Phantom', url: 'https://phantom.app/download', color: '#ab9ff2' },
]

function WalletIcon({ name, icon, color }: { name: string; icon?: string; color?: string }) {
  if (icon) {
    return (
      <img
        src={icon}
        alt=""
        style={{ width: '34px', height: '34px', borderRadius: '9px', flexShrink: 0 }}
      />
    )
  }
  return (
    <div style={{
      width: '34px', height: '34px', borderRadius: '9px', flexShrink: 0,
      background: color || '#ede9fe',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '14px', fontWeight: '800',
      color: color ? 'white' : '#6d28d9',
    }}>
      {name.slice(0, 1).toUpperCase()}
    </div>
  )
}

export function WalletModal({
  open,
  onClose,
  onConnect,
}: {
  open: boolean
  onClose: () => void
  onConnect: (address: string) => void
}) {
  const wallets = useWallets()
  const [connecting, setConnecting] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) {
      setConnecting(null)
      setError('')
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const connect = useCallback(async (wallet: DiscoveredWallet) => {
    setError('')
    setConnecting(wallet.info.rdns)
    try {
      const accounts: string[] = await wallet.provider.request({
        method: 'eth_requestAccounts',
      })
      if (!accounts?.length) throw new Error('No accounts returned')
      setActiveWallet(wallet)
      onConnect(accounts[0])
      onClose()
    } catch (e: any) {
      setError(
        e?.code === 4001
          ? 'Connection request rejected.'
          : e?.message || 'Could not connect. Please try again.'
      )
    }
    setConnecting(null)
  }, [onConnect, onClose])

  if (!open) return null

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', top: 0, left: 0,
        width: '100vw', height: '100vh',
        background: 'rgba(15, 23, 42, 0.35)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 99999, padding: '16px',
      }}
    >
      <style>{`@keyframes veloxSpin { to { transform: rotate(360deg) } }`}</style>

      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: '400px',
          background: 'white', borderRadius: '22px',
          padding: '20px', border: '1px solid #ede9fe',
          boxShadow: '0 24px 60px rgba(109,40,217,0.25)',
          transform: 'translateY(-20px)',
          maxHeight: '80vh', display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', marginBottom: '4px',
        }}>
          <h2 style={{ fontSize: '19px', fontWeight: '800', color: '#1e1b4b', margin: 0 }}>
            Connect a wallet
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              width: '30px', height: '30px', borderRadius: '50%',
              background: '#f5f3ff', border: 'none', cursor: 'pointer',
              color: '#6b7280', fontSize: '15px', lineHeight: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            ✕
          </button>
        </div>

        <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 16px' }}>
          {wallets.length
            ? 'Choose how you want to connect to Velox'
            : 'Install a wallet to start swapping on Base'}
        </p>

        {/* Wallet list */}
        <div style={{
          display: 'flex', flexDirection: 'column', gap: '8px',
          overflowY: 'auto', flex: 1, margin: '0 -4px', padding: '0 4px',
        }}>
          {wallets.map(wallet => {
            const isConnecting = connecting === wallet.info.rdns
            const busy = connecting !== null
            return (
              <button
                key={wallet.info.rdns}
                onClick={() => connect(wallet)}
                disabled={busy}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  width: '100%', padding: '12px 14px',
                  background: isConnecting ? '#ede9fe' : '#f5f3ff',
                  border: '1px solid #ede9fe', borderRadius: '14px',
                  cursor: busy ? 'default' : 'pointer',
                  opacity: busy && !isConnecting ? 0.5 : 1,
                  textAlign: 'left', transition: 'background 0.15s',
                }}
                onMouseOver={e => {
                  if (!busy) e.currentTarget.style.background = '#ede9fe'
                }}
                onMouseOut={e => {
                  if (!isConnecting) e.currentTarget.style.background = '#f5f3ff'
                }}
              >
                <WalletIcon name={wallet.info.name} icon={wallet.info.icon} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: '15px', fontWeight: '700', color: '#1e1b4b',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {wallet.info.name}
                  </div>
                  <div style={{ fontSize: '11px', color: '#9ca3af' }}>
                    {isConnecting ? 'Approve in your wallet' : 'Installed'}
                  </div>
                </div>
                {isConnecting ? (
                  <div style={{
                    width: '16px', height: '16px', flexShrink: 0,
                    border: '2px solid #ddd6fe', borderTopColor: '#6d28d9',
                    borderRadius: '50%', animation: 'veloxSpin 0.7s linear infinite',
                  }} />
                ) : (
                  <span style={{ fontSize: '14px', color: '#c4b5fd', flexShrink: 0 }}>→</span>
                )}
              </button>
            )
          })}

          {/* Nothing detected — offer installs */}
          {!wallets.length && INSTALL_OPTIONS.map(option => (
            <a
              key={option.name}
              href={option.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '12px 14px', background: '#f5f3ff',
                border: '1px solid #ede9fe', borderRadius: '14px',
                textDecoration: 'none', transition: 'background 0.15s',
              }}
              onMouseOver={e => (e.currentTarget.style.background = '#ede9fe')}
              onMouseOut={e => (e.currentTarget.style.background = '#f5f3ff')}
            >
              <WalletIcon name={option.name} color={option.color} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '15px', fontWeight: '700', color: '#1e1b4b' }}>
                  {option.name}
                </div>
                <div style={{ fontSize: '11px', color: '#9ca3af' }}>Not installed</div>
              </div>
              <span style={{ fontSize: '11px', color: '#6d28d9', fontWeight: '600' }}>
                Install
              </span>
            </a>
          ))}
        </div>

        {error && (
          <div style={{
            marginTop: '12px', padding: '10px 12px',
            background: '#fef2f2', border: '1px solid #fee2e2',
            borderRadius: '12px', fontSize: '12px', color: '#b91c1c',
          }}>
            {error}
          </div>
        )}

        <p style={{
          fontSize: '11px', color: '#9ca3af',
          textAlign: 'center', margin: '16px 0 0',
        }}>
          Velox never has access to your funds or private keys.
        </p>
      </div>
    </div>
  )
}
