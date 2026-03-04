import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { useWallets } from '@privy-io/react-auth';
import {
    AVAX_FUJI_CONFIG,
    CONTRACT_ADDRESSES,
    ERC20_ABI,
    VAULT_ABI,
    MORPHO_ABI,
    IRM_ABI,
    MXNB_MARKET_PARAMS,
    MARKET_IDS,
} from '../constants/contracts';

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

    // Helper: Format with max 3 decimals
    const formatBalance = (val: bigint, decimals: number) => {
        const formatted = ethers.formatUnits(val, decimals);
        const [integer, fraction] = formatted.split(".");
        if (!fraction) return integer;
        return `${integer}.${fraction.substring(0, 3)}`;
    };

    // Helper to get signer
    const getSigner = useCallback(async () => {
        const wallet = wallets[0];
        if (!wallet) throw new Error("Wallet not connected");

        const provider = await wallet.getEthereumProvider();
        const ethersProvider = new ethers.BrowserProvider(provider);
        return ethersProvider.getSigner();
    }, [wallets]);

    // Fetch market details and borrow rate for APY calculation
    const fetchMarketData = useCallback(async () => {
        try {
            if (!wallets.length) return;
            const signer = await getSigner();

            const morphoContract = new ethers.Contract(
                CONTRACT_ADDRESSES.morphoBlue,
                MORPHO_ABI,
                signer
            );

            // Read market details
            const marketDetails = await morphoContract.market(MARKET_IDS.mxnb);
            const totalSupplyAssets = Number(ethers.formatUnits(marketDetails.totalSupplyAssets, 6));
            const totalBorrowAssets = Number(ethers.formatUnits(marketDetails.totalBorrowAssets, 6));

            setTotalSupplied(totalSupplyAssets);
            setTotalBorrowed(totalBorrowAssets);

            // Read borrow rate from IRM
            const irmContract = new ethers.Contract(
                MXNB_MARKET_PARAMS.irm,
                IRM_ABI,
                signer
            );

            // Reconstruct market tuple as plain array to avoid read-only errors
            const marketTuple = [
                marketDetails[0],   // totalSupplyAssets
                marketDetails[1],   // totalSupplyShares
                marketDetails[2],   // totalBorrowAssets
                marketDetails[3],   // totalBorrowShares
                marketDetails[4],   // lastUpdate
                marketDetails[5],   // fee
            ];

            const borrowRate = await irmContract.borrowRateView(
                [
                    MXNB_MARKET_PARAMS.loanToken,
                    MXNB_MARKET_PARAMS.collateralToken,
                    MXNB_MARKET_PARAMS.oracle,
                    MXNB_MARKET_PARAMS.irm,
                    MXNB_MARKET_PARAMS.lltv,
                ],
                marketTuple
            );

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
    }, [wallets, getSigner]);

    const refreshData = useCallback(async () => {
        try {
            if (!wallets.length) return;
            const signer = await getSigner();
            const userAddress = await signer.getAddress();

            const mxnbContract = new ethers.Contract(CONTRACT_ADDRESSES.mockMXNB, ERC20_ABI, signer);
            const vaultContract = new ethers.Contract(CONTRACT_ADDRESSES.morphoMXNBVault, EXTENDED_VAULT_ABI, signer);

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
    }, [wallets, getSigner, fetchMarketData]);

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

    const waitForAllowance = async (
        tokenContract: ethers.Contract,
        owner: string,
        spender: string,
        requiredAmount: bigint
    ) => {
        let retries = 0;
        while (retries < 10) {
            const currentAllowance = await tokenContract.allowance(owner, spender);
            if (currentAllowance >= requiredAmount) return;

            console.log(`Waiting for allowance propagation... Attempt ${retries + 1}/10`);
            await new Promise(resolve => setTimeout(resolve, 3000));
            retries++;
        }
        throw new Error("Allowance failed to propagate. Please try again.");
    };

    const waitForBalanceIncrease = async (
        tokenContract: ethers.Contract,
        userAddress: string,
        initialBalance: bigint
    ) => {
        let retries = 0;
        while (retries < 15) {
            const currentBalance = await tokenContract.balanceOf(userAddress);
            if (currentBalance > initialBalance) return currentBalance;

            console.log(`Waiting for balance update... Attempt ${retries + 1}/15`);
            await new Promise(resolve => setTimeout(resolve, 5000));
            retries++;
        }
        throw new Error("RPC timeout: The network is slow indexing your new balance. Please wait a moment and try again.");
    };

    const executeDeposit = async (amountMXNB: string) => {
        setLoading(true);
        setError(null);
        setStep(1);

        try {
            const signer = await getSigner();
            const userAddress = await signer.getAddress();

            const mxnbContract = new ethers.Contract(CONTRACT_ADDRESSES.mockMXNB, ERC20_ABI, signer);
            const vaultContract = new ethers.Contract(CONTRACT_ADDRESSES.morphoMXNBVault, EXTENDED_VAULT_ABI, signer);

            const depositAmountBN = ethers.parseUnits(amountMXNB, MXNB_DECIMALS);

            // Step 1: Approve
            console.log("Step 1: Checking MXNB Allowance");
            const currentAllowance = await mxnbContract.allowance(userAddress, CONTRACT_ADDRESSES.morphoMXNBVault);

            if (currentAllowance < depositAmountBN) {
                const txApprove = await mxnbContract.approve(CONTRACT_ADDRESSES.morphoMXNBVault, ethers.MaxUint256, { gasLimit: MANUAL_GAS_LIMIT });
                setTxHash(txApprove.hash);
                await txApprove.wait();
                await waitForAllowance(mxnbContract, userAddress, CONTRACT_ADDRESSES.morphoMXNBVault, depositAmountBN);
            }

            // Capture initial shares balance
            const initialShares = await vaultContract.balanceOf(userAddress);

            // Step 2: Deposit
            setStep(2);
            console.log("Step 2: Depositing MXNB");
            const txDeposit = await vaultContract.deposit(depositAmountBN, userAddress, { gasLimit: MANUAL_GAS_LIMIT });
            setTxHash(txDeposit.hash);
            await txDeposit.wait();

            // Step 3: Wait for balance increase
            setStep(3);
            await waitForBalanceIncrease(vaultContract, userAddress, initialShares);

            // Success
            setStep(4); // Success state
            await refreshData();
            setLoading(false);

        } catch (err: any) {
            console.error("Deposit Error:", err);
            let msg = err.reason || err.message || "Deposit failed";

            {/* User friendly error messages */ }
            if (msg.includes("rejected")) msg = "You rejected the transaction";
            if (msg.includes("insufficient liquidity")) msg = "Insufficient liquidity";
            if (msg.includes("exceeds max deposit")) msg = "Exceeds maximum deposit";
            else msg = "The transaction failed. Please try again.";
            setError(msg);
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
            const signer = await getSigner();
            const userAddress = await signer.getAddress();
            const vaultContract = new ethers.Contract(CONTRACT_ADDRESSES.morphoMXNBVault, EXTENDED_VAULT_ABI, signer);

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

            // Calculate yield if possible (simple heuristic for now: any excess over 1:1 if we knew deposit basis, 
            // but here we just show what we got. Or we can just leave yield as null/calculated later if we track deposits).
            // For now, setting yield to "0.00" or calculated difference if we had cost basis. 
            // The prompt says: "Calculate yield if > 0, or leave as 'Calculando...'".
            // Since we don't track average cost basis here easily, we'll placeholder it or leave it null as requested 
            // but the prompt implies we might calculate it. 
            // Actually, we can just say "Rendimiento Generado: Calculando..." or just use a placeholder if we can't calc.
            // But let's set it to null so UI handles it or just "0.00" if we want to be safe.
            // Better: format the simple withdrawn amount as the success metric.

            // Step 1 (11): Redeem
            const txRedeem = await vaultContract.redeem(sharesToRedeem, userAddress, userAddress, { gasLimit: MANUAL_GAS_LIMIT });
            setTxHash(txRedeem.hash);
            await txRedeem.wait();

            // Success
            setStep(12); // Withdrawal Success
            await refreshData();
            setLoading(false);

        } catch (err: any) {
            console.error("Withdraw Error:", err);
            let msg = err.reason || err.message || "Withdraw failed";
            if (msg.includes("user rejected")) msg = "User rejected transaction";
            else msg = "The transaction failed. Please try again.";
            setError(msg);
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