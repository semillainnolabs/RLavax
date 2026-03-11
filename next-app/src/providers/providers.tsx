"use client";

import { useMemo, useEffect } from "react";
import {
  PrivyProvider,
  usePrivy,
  useSigners,
  useWallets,
} from "@privy-io/react-auth";
import { base, arbitrum, baseSepolia, arbitrumSepolia } from "viem/chains";

// AutoSigner: runs after PrivyProvider is mounted.
// Automatically calls addSigners when user logs in so the backend
// can sign transactions on their behalf (server-side signing).
function AutoSigner({ children }: { children: React.ReactNode }) {
  const { ready, authenticated } = usePrivy();
  const { wallets } = useWallets();
  const { addSigners } = useSigners();

  const signerId = process.env.NEXT_PUBLIC_PRIVY_SIGNER_ID;

  useEffect(() => {
    if (!ready || !authenticated || !signerId) return;

    const wallet = wallets.find((w) => w.walletClientType === "privy");
    if (!wallet) return;

    const setupSigner = async () => {
      try {
        await addSigners({
          address: wallet.address,
          signers: [{ signerId, policyIds: [] }],
        });
        console.log("Signer added successfully for", wallet.address);
      } catch (err: any) {
        // Ignore "already exists" errors — signer was already added before
        if (
          err?.message?.includes("already") ||
          err?.message?.includes("exists")
        ) {
          console.log("Signer already added — skipping");
          return;
        }
        console.error("Failed to add signer:", err);
      }
    };

    setupSigner();
  }, [ready, authenticated, wallets, signerId, addSigners]);

  return <>{children}</>;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  const config = useMemo(
    () => ({
      embeddedWallets: {
        ethereum: {
          createOnLogin: "users-without-wallets",
        },
      },
      appearance: { walletChainType: "ethereum-only" },
      defaultChain: baseSepolia,
      supportedChains: [baseSepolia, arbitrumSepolia, base, arbitrum],
    }),
    [],
  );

  if (!appId) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-900 text-white">
        <div className="p-4 bg-red-900/50 border border-red-500 rounded-lg max-w-md text-center">
          <h2 className="text-xl font-bold mb-2">Configuration Error</h2>
          <p>
            Missing{" "}
            <code className="bg-black/30 px-1 rounded">
              NEXT_PUBLIC_PRIVY_APP_ID
            </code>{" "}
            in environment variables.
          </p>
        </div>
      </div>
    );
  }

  return (
    <PrivyProvider appId={appId} config={config as any}>
      <AutoSigner>{children}</AutoSigner>
    </PrivyProvider>
  );
}