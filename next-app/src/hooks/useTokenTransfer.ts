import { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { useWallets } from '@privy-io/react-auth';
import { CONTRACT_ADDRESSES, ERC20_ABI } from '../constants/contracts';

export const useTokenTransfer = () => {
    const { wallets } = useWallets();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [txHash, setTxHash] = useState<string | null>(null);

    const getSigner = useCallback(async () => {
        const wallet = wallets[0];
        if (!wallet) throw new Error("Wallet not connected");

        const provider = await wallet.getEthereumProvider();
        const ethersProvider = new ethers.BrowserProvider(provider);
        return ethersProvider.getSigner();
    }, [wallets]);

    const execute = async (currency: "USDC" | "MXNB", amount: string, recipientAddress: string) => {
        setIsLoading(true);
        setError(null);
        setTxHash(null);

        try {
            if (!ethers.isAddress(recipientAddress)) {
                throw new Error("Invalid recipient address. Please check the address and try again.");
            }

            const signer = await getSigner();
            const tokenAddress = currency === "USDC" ? CONTRACT_ADDRESSES.usdc : CONTRACT_ADDRESSES.mockMXNB;
            const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);

            const parsedAmount = ethers.parseUnits(amount, 6); // Both USDC and MXNB have 6 decimals

            const tx = await tokenContract.transfer(recipientAddress, parsedAmount);
            setTxHash(tx.hash);
            await tx.wait();

            setIsLoading(false);
        } catch (err: any) {
            console.error("Transfer Error:", err);
            let msg = err.reason || err.message || "Transaction failed";
            if (msg.includes("rejected")) msg = "You rejected the transaction in your wallet.";
            else if (msg.includes("estimateGas")) msg = "Gas estimation error. Insufficient funds or network issue.";
            else if (msg.includes("insufficient balance") || msg.toLowerCase().includes("exceeds balance")) msg = "Insufficient balance for transfer.";
            else msg = "The transaction failed. Please try again.";
            setError(msg);
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