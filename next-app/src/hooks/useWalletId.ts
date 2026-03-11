import { useState, useEffect } from "react";
import { useWallets } from "@privy-io/react-auth";

export const useWalletId = () => {
  const { wallets } = useWallets();
  const [walletId, setWalletId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchWalletId = async () => {
      const address = wallets[0]?.address;
      if (!address) return;

      setLoading(true);
      try {
        const res = await fetch("/api/get-wallet-id", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userAddress: address }),
        });
        const data = await res.json();
        if (res.ok && data.walletId) setWalletId(data.walletId);
      } catch (err) {
        console.error("Error fetching walletId:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchWalletId();
  }, [wallets]);

  return { walletId, loading };
};
