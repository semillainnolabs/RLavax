import { useState } from 'react';
import { useWallets } from '@privy-io/react-auth';
import { useWalletId } from './useWalletId';
import { handleTransactionError } from '../utils/web3Utils';

export const useTokenTransfer = () => {
    const { wallets } = useWallets();
    const { walletId } = useWalletId();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [txHash, setTxHash] = useState<string | null>(null);

    const execute = async (currency: "USDC" | "MXNB", amount: string, recipientAddress: string) => {
        setIsLoading(true);
        setError(null);
        setTxHash(null);

        try {
            if (!walletId) {
                throw new Error("Wallet ID is not loaded yet. Please wait and try again.");
            }

            const userAddress = wallets[0]?.address;
            if (!userAddress) {
                throw new Error("Wallet not connected");
            }

            if (!/^0x[a-fA-F0-9]{40}$/.test(recipientAddress)) {
                throw new Error("Invalid recipient address. Please check the address and try again.");
            }

            const res = await fetch("/api/transfer", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    walletId,
                    userAddress,
                    currency,
                    amount,
                    recipientAddress
                }),
            });

            const data = await res.json();

            if (!res.ok || data.error) {
                throw new Error(data.error || "The transaction failed. Please try again.");
            }

            if (data.success && data.txHash) {
                setTxHash(data.txHash);
            } else if (data.txHash) {
                // Fallback in case success boolean is not passed but txHash is
                setTxHash(data.txHash);
            }

            setIsLoading(false);
        } catch (err: any) {
            console.error("Transfer Error:", err);
            setError(handleTransactionError(err));
            setIsLoading(false);
        }
    };

    const resetState = () => {
        setIsLoading(false);
        setError(null);
        setTxHash(null);
    };

    return { execute, isLoading, error, txHash, resetState };
};