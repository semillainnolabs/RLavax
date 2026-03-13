import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { useWallets } from '@privy-io/react-auth';
import {
    BASE_SEPOLIA_CONFIG,
    CONTRACT_ADDRESSES,
    ERC20_ABI,
    VAULT_ABI,
    MORPHO_ABI,
    IRM_ABI,
    MXNB_MARKET_PARAMS,
    MARKET_IDS,
} from '../constants/contracts';
import { useWalletId } from './useWalletId';
import { formatBalance, getProvider, handleTransactionError, waitForBalanceIncrease, fetchMarketBorrowRate } from '../utils/web3Utils';

const MXNB_DECIMALS = 6;
const MANUAL_GAS_LIMIT = 500000n;

// Extend VAULT_ABI to include totalAssets which was missing in the constants
const EXTENDED_VAULT_ABI = [
    ...VAULT_ABI,
    "function totalAssets() external view returns (uint256)",
    "function previewRedeem(uint256 shares) external view returns (uint256 assets)"
];

export const useMorphoLend = () => {
    const { wallets } = useWallets();
    const { walletId } = useWalletId();
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState(0); // 0: Idle, 1...
    const [error, setError] = useState<string | null>(null);
    const [txHash, setTxHash] = useState<string | null>(null);

    // New states for success screen
    const [withdrawnAmount, setWithdrawnAmount] = useState<string | null>(null);
    const [yieldEarned, setYieldEarned] = useState<string | null>(null);

    // Data States
    const [mxnbBalance, setCcopBalance] = useState<string>("0.000");
    const [vaultSharesBalance, setVaultSharesBalance] = useState<string>("0.000");
    const [vaultAssetsBalance, setVaultAssetsBalance] = useState<string>("0.000");
    const [tvl, setTvl] = useState<string>("0.000");
    const [apy, setApy] = useState<number>(0);

    // Market data states for APY calculation
    const [totalSupplied, setTotalSupplied] = useState<number>(0);
    const [totalBorrowed, setTotalBorrowed] = useState<number>(0);

    // Fetch market details and borrow rate for APY calculation
    const fetchMarketData = useCallback(async () => {
        try {
            const provider = getProvider();

            const { totalSupplyAssets, totalBorrowAssets, borrowRate } = await fetchMarketBorrowRate(provider);

            setTotalSupplied(totalSupplyAssets);
            setTotalBorrowed(totalBorrowAssets);

            console.log("Market Details:", { totalSupplyAssets, totalBorrowAssets });
            console.log("Borrow Rate (per second):", borrowRate.toString());

            // Calculate APY
            const feeRate = 0; // Fee rate in decimals
            const borrowRateDecimal = Number(borrowRate) / 1e18;
            const secondsPerYear = 60 * 60 * 24 * 365;
            const utilization = totalBorrowAssets / totalSupplyAssets;
            const borrowApy = Math.exp(borrowRateDecimal * secondsPerYear) - 1;
            const supplyApy = borrowApy * utilization * (1 - feeRate);

            setApy(supplyApy);
            console.log("APY Calculation:", {
                borrowRate: borrowRateDecimal,
                utilization,
                borrowApy,
                supplyApy,
                supplyApyPercent: supplyApy * 100,
            });
        } catch (err) {
            console.error("Error fetching market data:", err);
        }
    }, []);

    const refreshData = useCallback(async () => {
        try {
            if (!wallets.length) return;
            const userAddress = wallets[0]?.address;
            if (!userAddress) return;

            const provider = getProvider();

            const mxnbContract = new ethers.Contract(CONTRACT_ADDRESSES.mockMXNB, ERC20_ABI, provider);
            const vaultContract = new ethers.Contract(CONTRACT_ADDRESSES.morphoMXNBVault, EXTENDED_VAULT_ABI, provider);

            // Parallel reads
            const [
                mxnbBal,
                sharesBal,
                totalAssetsVal
            ] = await Promise.all([
                mxnbContract.balanceOf(userAddress),
                vaultContract.balanceOf(userAddress),
                vaultContract.totalAssets()
            ]);

            // Derived reads
            let assetsBal = 0n;
            if (sharesBal > 0n) {
                assetsBal = await vaultContract.convertToAssets(sharesBal);
            }

            setCcopBalance(formatBalance(mxnbBal, MXNB_DECIMALS));
            setVaultSharesBalance(formatBalance(sharesBal, MXNB_DECIMALS));
            setVaultAssetsBalance(formatBalance(assetsBal, MXNB_DECIMALS));
            setTvl(formatBalance(totalAssetsVal, MXNB_DECIMALS));

            // Fetch market data for APY
            await fetchMarketData();
        } catch (err) {
            console.error("Error refreshing data:", err);
        }
    }, [wallets, fetchMarketData]);

    useEffect(() => {
        refreshData();
        const interval = setInterval(refreshData, 10000);
        return () => clearInterval(interval);
    }, [refreshData]);

    // Error Auto-Reset
    useEffect(() => {
        if (error) {
            const timer = setTimeout(() => {
                setError(null);
                setStep(0);
                setLoading(false);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [error]);

    const executeDeposit = async (amountMXNB: string) => {
        setLoading(true);
        setError(null);
        setStep(1);

        try {
            const userAddress = wallets[0]?.address;
            if (!walletId || !userAddress) {
                setError("Wallet not ready. Please try again in a moment.");
                setLoading(false);
                return;
            }

            const provider = getProvider();
            const vaultContract = new ethers.Contract(CONTRACT_ADDRESSES.morphoMXNBVault, EXTENDED_VAULT_ABI, provider);

            // Capture initial shares balance
            const initialShares = await vaultContract.balanceOf(userAddress);

            // Step 2: Deposit via API
            setStep(2);
            console.log("Step 2: Depositing MXNB via API");

            const depositRes = await fetch("/api/lend-mxne", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ walletId, userAddress, amount: amountMXNB }),
            });
            const depositData = await depositRes.json();
            if (!depositRes.ok || depositData.error) throw new Error(depositData.error || "Deposit failed");

            setTxHash(depositData.depositHash);

            // Step 3: Wait for balance increase
            setStep(3);
            await waitForBalanceIncrease(vaultContract, userAddress, initialShares);

            // Success
            setStep(4); // Success state
            await new Promise(r => setTimeout(r, 2000));
            await refreshData();
            setLoading(false);

        } catch (err: any) {
            console.error("Deposit Error:", err);
            setError(handleTransactionError(err));
            setLoading(false);
        }
    };

    const executeWithdraw = async (sharesAmount: string | bigint, withdrawAll: boolean = false) => {
        setLoading(true);
        setError(null);
        setStep(11); // Start withdrawal flow
        setWithdrawnAmount(null);
        setYieldEarned(null);

        try {
            const userAddress = wallets[0]?.address;
            if (!walletId || !userAddress) {
                setError("Wallet not ready. Please try again in a moment.");
                setLoading(false);
                return;
            }

            const provider = getProvider();
            const vaultContract = new ethers.Contract(CONTRACT_ADDRESSES.morphoMXNBVault, EXTENDED_VAULT_ABI, provider);

            let sharesToRedeem: bigint;

            if (withdrawAll) {
                sharesToRedeem = await vaultContract.balanceOf(userAddress);
            } else {
                if (typeof sharesAmount === 'string') {
                    sharesToRedeem = ethers.parseUnits(sharesAmount, 6);
                } else {
                    sharesToRedeem = sharesAmount;
                }
            }

            if (sharesToRedeem === 0n) throw new Error("No shares to withdraw.");

            console.log("Withdrawing shares:", sharesToRedeem.toString());

            // Preview redeem to get exact output amount
            const expectedAssets = await vaultContract.previewRedeem(sharesToRedeem);
            setWithdrawnAmount(ethers.formatUnits(expectedAssets, MXNB_DECIMALS));

            // Step 1 (11): Redeem via API
            const redeemRes = await fetch("/api/withdraw-mxne", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ walletId, userAddress, musdcShares: sharesToRedeem.toString() })
            });
            const redeemData = await redeemRes.json();
            if (!redeemRes.ok || redeemData.error) throw new Error(redeemData.error || "Withdraw failed");

            setTxHash(redeemData.redeemHash);

            // Success
            setStep(12); // Withdrawal Success
            await new Promise(r => setTimeout(r, 2000));
            await refreshData();
            setLoading(false);

        } catch (err: any) {
            console.error("Withdraw Error:", err);
            setError(handleTransactionError(err));
            setLoading(false);
        }
    };

    const resetState = () => {
        setStep(0);
        setError(null);
        setTxHash(null);
        setLoading(false);
        setWithdrawnAmount(null);
        setYieldEarned(null);
    };

    return {
        loading,
        step,
        error,
        txHash,
        mxnbBalance,
        vaultSharesBalance,
        vaultAssetsBalance,
        tvl,
        apy: (apy * 100).toFixed(2), // Return as percentage string for display
        withdrawnAmount,
        yieldEarned,
        executeDeposit,
        executeWithdraw,
        refreshData,
        resetState
    };
};