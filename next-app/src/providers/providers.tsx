"use client";

import { useMemo } from 'react';
import { PrivyProvider } from "@privy-io/react-auth";
// Replace this with any of the networks listed at https://github.com/wevm/viem/blob/main/src/chains/index.ts
import { avalancheFuji } from 'viem/chains';

export default function Providers({ children }: { children: React.ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  const config = useMemo(() => ({
    embeddedWallets: {
      ethereum: {
        createOnLogin: "users-without-wallets",
      },
    },
    appearance: { walletChainType: "ethereum-only" },
    defaultChain: avalancheFuji,
    supportedChains: [avalancheFuji],
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);

  if (!appId) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-900 text-white">
        <div className="p-4 bg-red-900/50 border border-red-500 rounded-lg max-w-md text-center">
          <h2 className="text-xl font-bold mb-2">Configuration Error</h2>
          <p>Missing <code className="bg-black/30 px-1 rounded">NEXT_PUBLIC_PRIVY_APP_ID</code> in environment variables.</p>
        </div>
      </div>
    );
  }

  return (
    <PrivyProvider
      appId={appId}
      config={config as any}
    >
      {children}
    </PrivyProvider>
  );
}
