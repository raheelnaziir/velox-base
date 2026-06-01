'use client'

import { OnchainKitProvider } from '@coinbase/onchainkit'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { base } from 'viem/chains'
import { WagmiProvider, createConfig, http } from 'wagmi'
import { coinbaseWallet, metaMask, walletConnect } from 'wagmi/connectors'

const queryClient = new QueryClient()

const config = createConfig({
    chains: [base],
    connectors: [
        coinbaseWallet({ appName: 'BaseDEX' }),
        metaMask(),
        walletConnect({ projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID! }),
    ],
    transports: { [base.id]: http() },
})

export default function Providers({ children }: { children: React.ReactNode }) {
    return (
        <WagmiProvider config={config}>
            <QueryClientProvider client={queryClient}>
                <OnchainKitProvider
                    apiKey={process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY}
                    chain={base}
                    config={{
                        appearance: { mode: 'light' },
                        wallet: { display: 'modal' },
                    }}
                >
                    {children}
                </OnchainKitProvider>
            </QueryClientProvider>
        </WagmiProvider>
    )
}