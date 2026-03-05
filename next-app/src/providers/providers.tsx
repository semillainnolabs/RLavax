"use client";

import { useMemo } from 'react';
import { PrivyProvider } from "@privy-io/react-auth";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";
import { createSolanaRpc, createSolanaRpcSubscriptions } from "@solana/kit";
// Replace this with any of the networks listed at https://github.com/wevm/viem/blob/main/src/chains/index.ts
import { baseSepolia, avalancheFuji } from 'viem/chains';

const solanaConnectors = toSolanaWalletConnectors();

export default function Providers({ children }: { children: React.ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  const config = useMemo(() => ({
    embeddedWallets: {
      ethereum: {
        createOnLogin: "users-without-wallets",
      },
    },
    appearance: { walletChainType: "ethereum-only" },
    // externalWallets: { solana: { connectors: solanaConnectors } },
    defaultChain: baseSepolia,
    supportedChains: [baseSepolia, avalancheFuji],
    /* solana: {
      rpcs: {
        "solana:mainnet": {
          rpc: createSolanaRpc(
            process.env.NEXT_PUBLIC_SOLANA_MAINNET_RPC_URL ||
            "https://api.mainnet-beta.solana.com",
          ),
          rpcSubscriptions: createSolanaRpcSubscriptions(
            process.env.NEXT_PUBLIC_SOLANA_MAINNET_RPC_URL?.replace(
              "http",
              "ws",
            ) || "wss://api.mainnet-beta.solana.com",
          ),
        },
        "solana:devnet": {
          rpc: createSolanaRpc("https://api.devnet.solana.com"),
          rpcSubscriptions: createSolanaRpcSubscriptions(
            "wss://api.devnet.solana.com",
          ),
        },
      },
    }, */
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
