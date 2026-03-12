import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { useWallets } from '@privy-io/react-auth';
import {
    BASE_SEPOLIA_CONFIG,
    CONTRACT_ADDRESSES,
    ERC20_ABI,
    VAULT_ABI,
    WMEMORY_ABI,
    MORPHO_ABI,
    IRM_ABI,
    AAVE_ABI,
    MXNB_MARKET_PARAMS,
    MARKET_IDS,
} from '../constants/contracts';
import { useWalletId } from './useWalletId';

const TARGET_LTV = 0.50; // Conservative LTV target for calculation
const USDC_DECIMALS = 6;
const MXNB_DECIMALS = 6;

export const useMorphoLoan = () => {
    const { wallets } = useWallets();
    const { walletId } = useWalletId();
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState(0); // 0: Idle, 1...
    const [error, setError] = useState<string | null>(null);
    const [txHash, setTxHash] = useState<string | null>(null);
    const [usdcBalance, setUsdcBalance] = useState<string>("0.00");
    const [mxnbBalance, setMxnbBalance] = useState<string>("0.00");
    const [rawMxnbBalance, setRawMxnbBalance] = useState<number>(0);
    const [collateralBalance, setCollateralBalance] = useState<string>("0.00");
    const [borrowBalance, setBorrowBalance] = useState<string>("0.00");
    const [rawBorrowBalance, setRawBorrowBalance] = useState<number>(0);
    const [marketLiquidity, setMarketLiquidity] = useState<string>("0");
    const [marketAPR, setMarketAPR] = useState<number>(0);
    const [totalRepaidAmount, setTotalRepaidAmount] = useState<string | null>(null);
    const [userPaidSubsidyInUSDC, setUserPaidSubsidyInUSDC] = useState<string>("0");
    const [userInterestInMxnb, setUserInterestInMxnb] = useState<string>("0");
    const [userInterestInUSDC, setUserInterestInUSDC] = useState<string>("0");
    const [oraclePrice, setOraclePrice] = useState<bigint>(0n);

    // Market data states for APR calculation
    const [totalSupplied, setTotalSupplied] = useState<number>(0);
    const [totalBorrowed, setTotalBorrowed] = useState<number>(0);

    // Helper: Format with max 3 decimals
    const formatBalance = (val: bigint, decimals: number) => {
        const formatted = ethers.formatUnits(val, decimals);
        const [integer, fraction] = formatted.split(".");
        if (!fraction) return integer;
        return `${integer}.${fraction.substring(0, 1)}`;
    };

    // Read-only provider — no wallet signing needed for reads
    const getProvider = useCallback(() => {
        return new ethers.JsonRpcProvider(BASE_SEPOLIA_CONFIG.rpcUrl);
    }, []);

    const fetchMarketAPR = useCallback(async () => {
        try {
            const provider = getProvider();
            const morpho = new ethers.Contract(CONTRACT_ADDRESSES.morphoBlue, MORPHO_ABI, provider);

            const marketDetails = await morpho.market(MARKET_IDS.mxnb);
            const totalSupplyAssets = Number(ethers.formatUnits(marketDetails.totalSupplyAssets, MXNB_DECIMALS));
            const totalBorrowAssets = Number(ethers.formatUnits(marketDetails.totalBorrowAssets, MXNB_DECIMALS));

            setTotalSupplied(totalSupplyAssets);
            setTotalBorrowed(totalBorrowAssets);

            const irmContract = new ethers.Contract(MXNB_MARKET_PARAMS.irm, IRM_ABI, provider);
            const marketTuple = [
                marketDetails[0], marketDetails[1], marketDetails[2],
                marketDetails[3], marketDetails[4], marketDetails[5],
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

            const borrowRateDecimal = Number(borrowRate) / 1e18;
            const secondsPerYear = 60 * 60 * 24 * 365;
            const borrowApr = Math.exp(borrowRateDecimal * secondsPerYear) - 1;

            setMarketAPR(borrowApr);
        } catch (err) {
            console.error("Error fetching market APR:", err);
        }
    }, [getProvider]);

    const refreshData = useCallback(async () => {
        try {
            if (!wallets.length) return;
            const userAddress = wallets[0]?.address;
            if (!userAddress) return;

            const provider = getProvider();

            const usdcContract = new ethers.Contract(CONTRACT_ADDRESSES.usdc, ERC20_ABI, provider);
            const bal = await usdcContract.balanceOf(userAddress);
            setUsdcBalance(formatBalance(bal, USDC_DECIMALS));

            const mxnbContract = new ethers.Contract(CONTRACT_ADDRESSES.mockMXNB, ERC20_ABI, provider);
            const targetBalance = await mxnbContract.balanceOf(userAddress);
            setMxnbBalance(formatBalance(targetBalance, MXNB_DECIMALS));
            setRawMxnbBalance(Number(targetBalance));

            const marketId = ethers.keccak256(
                ethers.AbiCoder.defaultAbiCoder().encode(
                    ["address", "address", "address", "address", "uint256"],
                    [
                        MXNB_MARKET_PARAMS.loanToken,
                        MXNB_MARKET_PARAMS.collateralToken,
                        MXNB_MARKET_PARAMS.oracle,
                        MXNB_MARKET_PARAMS.irm,
                        MXNB_MARKET_PARAMS.lltv
                    ]
                )
            );
            const morpho = new ethers.Contract(CONTRACT_ADDRESSES.morphoBlue, MORPHO_ABI, provider);
            const position = await morpho.position(marketId, userAddress);

            const marketData = await morpho.market(marketId);
            const totalSupplyAssets = BigInt(marketData[0]);
            const totalBorrowAssets = BigInt(marketData[2]);
            const liquidityAssets = totalSupplyAssets - totalBorrowAssets;

            // Borrow shares -> debt (Simplification for UI)
            setBorrowBalance(formatBalance(position[1], 12));
            setRawBorrowBalance(Number(formatBalance(position[1], 6)));
            //console.log("raw borrowBalance:",position[1], " raw mxnbbal:", targetBalance);
            //console.log("raw borrowBalance Numbered:",Number(formatBalance(position[1], 6)), " raw mxnbbal:", Number(targetBalance));
            setCollateralBalance(formatBalance(position[2], 6)); // waUSDC is 6 decimals

            const safeLiquidity = liquidityAssets > 0n ? liquidityAssets : 0n;
            setMarketLiquidity(formatBalance(safeLiquidity, MXNB_DECIMALS));

            const oracle = new ethers.Contract(MXNB_MARKET_PARAMS.oracle, ["function price() external view returns (uint256)"], provider);
            const price = await oracle.price();
            setOraclePrice(price);

            await fetchMarketAPR();
        } catch (err) {
            console.error("Error refreshing data:", err);
        }
    }, [wallets, getProvider, fetchMarketAPR]);

    useEffect(() => {
        refreshData();
        const interval = setInterval(refreshData, 10000);
        return () => clearInterval(interval);
    }, [refreshData]);

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

    const getSimulatedDeposit = (borrowAmount: string): string => {
        if (!borrowAmount || parseFloat(borrowAmount) <= 0) return "0";
        if (oraclePrice === 0n) {
            const amount = parseFloat(borrowAmount);
            const requiredUSDCApprox = amount / TARGET_LTV;
            return requiredUSDCApprox.toFixed(2);
        }

        try {
            const borrowAssets = ethers.parseUnits(borrowAmount, MXNB_DECIMALS);
            const TARGET_LTV_WAD = ethers.parseEther(TARGET_LTV.toString());

            const numerator = borrowAssets * (10n ** 54n); // 6 + 54 = 60
            const denominator = oraclePrice * TARGET_LTV_WAD;

            const depositAmountBN = numerator / denominator;
            return ethers.formatUnits(depositAmountBN, USDC_DECIMALS);
        } catch (e) {
            console.error("Error calculating deposit:", e);
            return "0";
        }
    };

    const waitForBalanceIncrease = async (tokenContract: ethers.Contract, userAddress: string, initialBalance: bigint) => {
        let retries = 0;
        while (retries < 15) {
            const currentBalance = await tokenContract.balanceOf(userAddress);
            if (currentBalance > initialBalance) return currentBalance;
            await new Promise(resolve => setTimeout(resolve, 5000));
            retries++;
        }
        return await tokenContract.balanceOf(userAddress);
    };

    const executeZale = async (borrowAmountMXNB: string) => {
        setLoading(true);
        setError(null);
        setStep(1);

        try {
            const userAddress = wallets[0]?.address;
            console.log("Intentando ejecutar con walletId:", walletId);
            if (!walletId || !userAddress) {
                setError("Wallet not ready. Please try again in a moment.");
                setLoading(false);
                return;
            }

            console.log(`Starting Zale: Borrow ${borrowAmountMXNB} MXNB via APIs`);
            const provider = getProvider();

            const oracle = new ethers.Contract(MXNB_MARKET_PARAMS.oracle, ["function price() external view returns (uint256)"], provider);
            const currentPrice = await oracle.price();

            const borrowAmountBN = ethers.parseUnits(borrowAmountMXNB, MXNB_DECIMALS);
            const TARGET_LTV_WAD = ethers.parseEther("0.50");

            const numerator = borrowAmountBN * (10n ** 54n);
            const denominator = currentPrice * TARGET_LTV_WAD;
            const depositAmountBN = numerator / denominator;
            const amountStr = ethers.formatUnits(depositAmountBN, USDC_DECIMALS);

            // 1. Lend USDC -> aUSDC (also handles approve)
            setStep(1);
            console.log("Step 1 & 2: Lending USDC to get aUSDC via API");

            const aUSDCContract = new ethers.Contract(CONTRACT_ADDRESSES.aUSDC, ERC20_ABI, provider);
            const initialAUsdcBalance = await aUSDCContract.balanceOf(userAddress);

            const lendRes = await fetch("/api/lend", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ walletId, userAddress, amount: amountStr }),
            });
            const lendData = await lendRes.json();
            if (!lendRes.ok || lendData.error) throw new Error(lendData.error || "Lend failed");
            setTxHash(lendData.depositHash);

            setStep(2);
            await waitForBalanceIncrease(aUSDCContract, userAddress, initialAUsdcBalance);

            // Retraso de 2s para dar margen a los indexadores antes de Wrap
            await new Promise(r => setTimeout(r, 2000));

            // 2. Wrap aUSDC -> waUSDC (also handles approve)
            setStep(3);
            console.log("Step 3 & 4: Wrapping aUSDC to waUSDC via API");

            const waUSDC = new ethers.Contract(CONTRACT_ADDRESSES.waUSDC, VAULT_ABI, provider);
            const initialWaUsdcBalance = await waUSDC.balanceOf(userAddress);

            const wrapRes = await fetch("/api/wrap", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ walletId, userAddress }),
            });
            const wrapData = await wrapRes.json();
            if (!wrapRes.ok || wrapData.error) throw new Error(wrapData.error || "Wrap failed");
            setTxHash(wrapData.wrapHash);

            setStep(4);
            const wmusdcBalance = await waitForBalanceIncrease(waUSDC, userAddress, initialWaUsdcBalance);

            // 3. Supply Collateral via API (also handles approve)
            setStep(5);
            console.log("Step 5 & 6: Supplying Collateral via API");

            const supplyRes = await fetch('/api/supply-collateral', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ walletId, userAddress, wmusdcAmount: wmusdcBalance.toString() })
            });
            const supplyData = await supplyRes.json();
            if (!supplyRes.ok || supplyData.error) throw new Error(supplyData.error || "Supply failed");

            setTxHash(supplyData.supplyHash);
            setStep(6);
            await new Promise(r => setTimeout(r, 2000));

            // 4. Borrow MXNB via API
            setStep(7);
            console.log("Step 7: Borrowing MXNB via API");

            const borrowRes = await fetch('/api/borrow', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ walletId, userAddress, borrowAmount: borrowAmountMXNB })
            });
            const borrowData = await borrowRes.json();
            if (!borrowRes.ok || borrowData.error) throw new Error(borrowData.error || "Borrow failed");

            setTxHash(borrowData.borrowHash);

            setStep(8); // Complete
            // Delay de sincronización para que el RPC indexe los nuevos balances antes de refrescar la UI
            await new Promise(r => setTimeout(r, 3000));
            await refreshData();
            setLoading(false);

        } catch (err: any) {
            console.error("Zale error:", err);
            let msg = err.reason || err.message || "Transaction failed";
            if (msg.includes("rejected")) msg = "You rejected the transaction";
            else msg = "Transaction failed. Please try again.";
            setError(msg);
        } finally {
            if (step !== 8 && step < 9) {
                setLoading(false);
            }
        }
    };

    // Pay all and withdraw
    const executeRepayAndWithdraw = async () => {
        setLoading(true);
        setError(null);
        setTotalRepaidAmount(null);
        setStep(11);

        try {
            const userAddress = wallets[0]?.address;
            if (!walletId || !userAddress) {
                setError("Wallet not ready. Please try again in a moment.");
                setLoading(false);
                return;
            }

            const provider = getProvider();
            const morpho = new ethers.Contract(CONTRACT_ADDRESSES.morphoBlue, MORPHO_ABI, provider);
            const mxnb = new ethers.Contract(CONTRACT_ADDRESSES.mockMXNB, ERC20_ABI, provider);
            const waUSDC = new ethers.Contract(CONTRACT_ADDRESSES.waUSDC, VAULT_ABI, provider);
            const mUSDCContract = new ethers.Contract(CONTRACT_ADDRESSES.morphoUSDCVault, ERC20_ABI, provider);

            const marketId = ethers.keccak256(
                ethers.AbiCoder.defaultAbiCoder().encode(
                    ["address", "address", "address", "address", "uint256"],
                    [
                        MXNB_MARKET_PARAMS.loanToken,
                        MXNB_MARKET_PARAMS.collateralToken,
                        MXNB_MARKET_PARAMS.oracle,
                        MXNB_MARKET_PARAMS.irm,
                        MXNB_MARKET_PARAMS.lltv
                    ]
                )
            );
            const position = await morpho.position(marketId, userAddress);
            const borrowShares = position[1];

            if (borrowShares <= 0n) throw new Error("No debt to repay.");

            // 0. Calculate Subsidy via API
            const subsidyRes = await fetch("/api/get-interest-subsidy", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ walletId, userAddress }),
            });
            const subsidyData = await subsidyRes.json();
            if (!subsidyRes.ok || subsidyData.error) throw new Error(subsidyData.error || "Failed to calc subsidy");

            const estimatedSubsidyUSDC = subsidyData.subsidyInUSDC;
            const estimatedSubsidyMXNB = subsidyData.subsidyInMXNE || "0";
            console.log(`User Subsidy: ${estimatedSubsidyUSDC} USDC (${estimatedSubsidyMXNB} MXNB)`);

            // 1. Repay Debt via API 
            setStep(12);
            console.log("Step 1 & 2: Repaying Debt via API");
            const initialMxnbBalance = await mxnb.balanceOf(userAddress);
            if (initialMxnbBalance === 0n) throw new Error("No MXNB balance to repay.");
            setTotalRepaidAmount(ethers.formatUnits(initialMxnbBalance, MXNB_DECIMALS));

            const repayRes = await fetch('/api/repay', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ walletId, userAddress, borrowShares: borrowShares.toString() })
            });
            const repayData = await repayRes.json();
            if (!repayRes.ok || repayData.error) throw new Error(repayData.error || "Repayment failed");
            setTxHash(repayData.repayHash);

            await new Promise(r => setTimeout(r, 2000));

            // 2. Withdraw Collateral via API
            setStep(13);
            console.log("Step 3: Withdrawing Collateral via API");
            const updatedPosition = await morpho.position(marketId, userAddress);
            const collateralShares = updatedPosition[2];

            if (collateralShares > 0n) {
                const withdrawRes = await fetch('/api/withdraw-collateral', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ walletId, userAddress, collateralAmount: collateralShares.toString() })
                });
                const withdrawData = await withdrawRes.json();
                if (!withdrawRes.ok || withdrawData.error) throw new Error(withdrawData.error || "Withdraw collateral failed");
                setTxHash(withdrawData.withdrawHash);
            }

            // 3. Unwrap waUSDC -> aUSDC via API
            setStep(14);
            console.log("Step 4: Unwrap waUSDC to aUSDC via API");

            const aUSDCContract = new ethers.Contract(CONTRACT_ADDRESSES.aUSDC, ERC20_ABI, provider);
            const initialAUsdcBalance = await aUSDCContract.balanceOf(userAddress);
            const unwrapRes = await fetch('/api/unwrap', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ walletId, userAddress }) // No wmusdc amount needed
            });
            const unwrapData = await unwrapRes.json();
            if (!unwrapRes.ok || unwrapData.error) throw new Error(unwrapData.error || "Unwrap waUSDC failed");
            setTxHash(unwrapData.unwrapHash);

            setStep(15);
            // 4. Wait for aUSDC balance + Withdraw from Aave (aUSDC -> USDC) via API
            console.log("Step 5: Withdraw USDC from Aave via API");
            const aUsdcBal = await waitForBalanceIncrease(aUSDCContract, userAddress, initialAUsdcBalance);

            if (aUsdcBal > 0n) {
                const redeemRes = await fetch("/api/withdraw-aave", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ walletId, userAddress, aUsdcAmount: aUsdcBal.toString() })
                });
                const redeemData = await redeemRes.json();
                if (!redeemRes.ok || redeemData.error) throw new Error(redeemData.error || "Withdraw Aave failed");
                setTxHash(redeemData.withdrawHash || redeemData.redeemHash);
            }

            setStep(16); // Complete Repay Flow and Display subsidy

            try {
                const waUSDCContract = new ethers.Contract(CONTRACT_ADDRESSES.waUSDC, VAULT_ABI, provider);
                const rawPaidSubsidyUSDC = await waUSDCContract.userPaidSubsidyInUSDC(userAddress);
                const paidSubsidyUSDC = ethers.formatUnits(rawPaidSubsidyUSDC, 6);

                if (parseFloat(paidSubsidyUSDC || "0") > 0) {
                    setUserPaidSubsidyInUSDC(paidSubsidyUSDC);
                    setUserInterestInMxnb(estimatedSubsidyMXNB);
                    setUserInterestInUSDC(estimatedSubsidyUSDC);
                } else {
                    const oracle = new ethers.Contract(MXNB_MARKET_PARAMS.oracle, ["function price() external view returns (uint256)"], provider);
                    const rawSubsidyMXNB = BigInt(subsidyData.rawSubsidyMXNE || "0");
                    const oraclePriceVal = await oracle.price();
                    let paidUSDC = (rawSubsidyMXNB * (10n ** 36n)) / oraclePriceVal;
                    setUserInterestInMxnb(estimatedSubsidyMXNB);
                    setUserInterestInUSDC(ethers.formatUnits(paidUSDC, 18));
                }
            } catch (err) {
                console.log("Could not fetch subsidy details at end, passing", err);
            }

            // Delay de sincronización para que el RPC indexe los nuevos balances antes de refrescar la UI
            await new Promise(r => setTimeout(r, 3000));
            await refreshData();
            setLoading(false);

        } catch (err: any) {
            console.error("Repay Error:", err);
            let msg = err.reason || err.message || "Transaction failed";
            if (msg.includes("rejected")) msg = "You rejected the transaction";
            else msg = "Transaction failed. Please try again.";
            setError(msg);
        } finally {
            if (step !== 16 && step >= 11) {
                setLoading(false);
            }
        }
    };

    const resetState = () => {
        setStep(0);
        setError(null);
        setTxHash(null);
        setLoading(false);
        setUserPaidSubsidyInUSDC("0");
        setUserInterestInMxnb("0");
    };

    return {
        loading,
        step,
        error,
        txHash,
        usdcBalance,
        mxnbBalance,
        rawMxnbBalance,
        collateralBalance,
        borrowBalance,
        rawBorrowBalance,
        marketLiquidity,
        marketAPR: (marketAPR * 100).toFixed(2),
        totalRepaidAmount,
        userPaidSubsidyInUSDC,
        userInterestInMxnb,
        userInterestInUSDC,
        getSimulatedDeposit,
        executeZale,
        executeRepayAndWithdraw,
        refreshData,
        resetState
    };
};