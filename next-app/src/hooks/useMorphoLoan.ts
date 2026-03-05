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
    AAVE_ABI,
    MXNB_MARKET_PARAMS,
    MARKET_IDS,
} from '../constants/contracts';

const TARGET_LTV = 0.50; // Conservative LTV target for calculation
const USDC_DECIMALS = 6;
const MXNB_DECIMALS = 6;
const MANUAL_GAS_LIMIT = 5000000n; // Fixed gas limit for testnet stability

export const useMorphoLoan = () => {
    const { wallets } = useWallets();
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState(0); // 0: Idle, 1...
    const [error, setError] = useState<string | null>(null);
    const [txHash, setTxHash] = useState<string | null>(null);
    const [usdcBalance, setUsdcBalance] = useState<string>("0.00");
    const [mxnbBalance, setMxnbBalance] = useState<string>("0.00");
    const [collateralBalance, setCollateralBalance] = useState<string>("0.00");
    const [borrowBalance, setBorrowBalance] = useState<string>("0.00");
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
        return `${integer}.${fraction.substring(0, 3)}`;
    };

    const getSigner = useCallback(async () => {
        const wallet = wallets[0];
        if (!wallet) throw new Error("Wallet not connected");
        const provider = await wallet.getEthereumProvider();
        const ethersProvider = new ethers.BrowserProvider(provider);
        return ethersProvider.getSigner();
    }, [wallets]);

    const fetchMarketAPR = useCallback(async () => {
        try {
            if (!wallets.length) return;
            const signer = await getSigner();
            const morpho = new ethers.Contract(CONTRACT_ADDRESSES.morphoBlue, MORPHO_ABI, signer);

            const marketDetails = await morpho.market(MARKET_IDS.mxnb);
            const totalSupplyAssets = Number(ethers.formatUnits(marketDetails.totalSupplyAssets, MXNB_DECIMALS));
            const totalBorrowAssets = Number(ethers.formatUnits(marketDetails.totalBorrowAssets, MXNB_DECIMALS));

            setTotalSupplied(totalSupplyAssets);
            setTotalBorrowed(totalBorrowAssets);

            const irmContract = new ethers.Contract(MXNB_MARKET_PARAMS.irm, IRM_ABI, signer);
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
    }, [wallets, getSigner]);

    const refreshData = useCallback(async () => {
        try {
            if (!wallets.length) return;
            const signer = await getSigner();
            const userAddress = await signer.getAddress();

            const usdcContract = new ethers.Contract(CONTRACT_ADDRESSES.usdc, ERC20_ABI, signer);
            const bal = await usdcContract.balanceOf(userAddress);
            setUsdcBalance(formatBalance(bal, USDC_DECIMALS));

            const mxnbContract = new ethers.Contract(CONTRACT_ADDRESSES.mockMXNB, ERC20_ABI, signer);
            const targetBalance = await mxnbContract.balanceOf(userAddress);
            setMxnbBalance(formatBalance(targetBalance, MXNB_DECIMALS));

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
            const morpho = new ethers.Contract(CONTRACT_ADDRESSES.morphoBlue, MORPHO_ABI, signer);
            const position = await morpho.position(marketId, userAddress);

            const marketData = await morpho.market(marketId);
            const totalSupplyAssets = BigInt(marketData[0]);
            const totalBorrowAssets = BigInt(marketData[2]);
            const liquidityAssets = totalSupplyAssets - totalBorrowAssets;

            // Borrow shares -> debt (Simplification for UI)
            setBorrowBalance(formatBalance(position[1], 12));
            setCollateralBalance(formatBalance(position[2], 6)); // waUSDC is 6 decimals

            const safeLiquidity = liquidityAssets > 0n ? liquidityAssets : 0n;
            setMarketLiquidity(formatBalance(safeLiquidity, MXNB_DECIMALS));

            const oracle = new ethers.Contract(MXNB_MARKET_PARAMS.oracle, ["function price() external view returns (uint256)"], signer);
            const price = await oracle.price();
            setOraclePrice(price);

            await fetchMarketAPR();
        } catch (err) {
            console.error("Error refreshing data:", err);
        }
    }, [wallets, getSigner, fetchMarketAPR]);

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
            // 1 waUSDC is roughly 1 USDC. 
            // We use simple LTV math. Let's assume price 1.
            const requiredUSDCApprox = amount / TARGET_LTV;
            return requiredUSDCApprox.toFixed(2);
        }

        try {
            const borrowAssets = ethers.parseUnits(borrowAmount, MXNB_DECIMALS);
            const TARGET_LTV_WAD = ethers.parseEther(TARGET_LTV.toString());

            const numerator = borrowAssets * (10n ** 54n); // 6 + 54 = 60
            const denominator = oraclePrice * TARGET_LTV_WAD;

            const requiredCollateralWaUSDC = numerator / denominator;
            const depositAmountBN = requiredCollateralWaUSDC;
            return ethers.formatUnits(depositAmountBN, USDC_DECIMALS);
        } catch (e) {
            console.error("Error calculating deposit:", e);
            return "0";
        }
    };

    const waitForAllowance = async (tokenContract: ethers.Contract, owner: string, spender: string, requiredAmount: bigint) => {
        let retries = 0;
        while (retries < 10) {
            const currentAllowance = await tokenContract.allowance(owner, spender);
            if (currentAllowance >= requiredAmount) return;
            await new Promise(resolve => setTimeout(resolve, 3000));
            retries++;
        }
        throw new Error("Allowance failed to propagate. Please try again.");
    }

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

    const waitForSubsidyIncrease = async (
        tokenContract: ethers.Contract,
        userAddress: string,
        initialBalance: bigint
    ) => {
        let retries = 0;
        while (retries < 15) {
            const currentBalance = await tokenContract.userInterestSubsidyInWaUSDC(userAddress);
            if (currentBalance > initialBalance) return currentBalance;

            console.log(`Waiting for USDC subsidy update... Attempt ${retries + 1}/15, balance:${currentBalance}`);
            await new Promise(resolve => setTimeout(resolve, 2500)); // Wait 2.5s
            retries++;
        }
        throw new Error("RPC timeout: The network is slow indexing your new subsidy. Please wait a moment and try again.");
    };

    const executeZale = async (borrowAmountMXNB: string) => {
        setLoading(true);
        setError(null);
        setStep(1);

        try {
            const signer = await getSigner();
            const userAddress = await signer.getAddress();

            const provider = signer.provider;
            const network = await provider?.getNetwork();
            if (network?.chainId !== BigInt(BASE_SEPOLIA_CONFIG.chainId)) {
                throw new Error("Wrong network detected during execution.");
            }

            console.log(`Starting Zale: Borrow ${borrowAmountMXNB} MXNB`);

            const usdc = new ethers.Contract(CONTRACT_ADDRESSES.usdc, ERC20_ABI, signer);
            const aavePool = new ethers.Contract(CONTRACT_ADDRESSES.aavePool, AAVE_ABI, signer);
            const aUSDC = new ethers.Contract(CONTRACT_ADDRESSES.aUSDC, ERC20_ABI, signer);
            const waUSDC = new ethers.Contract(CONTRACT_ADDRESSES.waUSDC, VAULT_ABI, signer);
            const morpho = new ethers.Contract(CONTRACT_ADDRESSES.morphoBlue, MORPHO_ABI, signer);

            const oracle = new ethers.Contract(MXNB_MARKET_PARAMS.oracle, ["function price() external view returns (uint256)"], signer);
            const currentPrice = await oracle.price();

            const borrowAmountBN = ethers.parseUnits(borrowAmountMXNB, MXNB_DECIMALS);
            const TARGET_LTV_WAD = ethers.parseEther("0.50");

            const numerator = borrowAmountBN * (10n ** 54n);
            const denominator = currentPrice * TARGET_LTV_WAD;
            const depositAmountBN = numerator / denominator;

            // 1. Approve USDC for Aave
            console.log("Step 1: Checking USDC Allowance for Aave");
            const usdcAllowance = await usdc.allowance(userAddress, CONTRACT_ADDRESSES.aavePool);
            if (usdcAllowance < depositAmountBN) {
                const tx = await usdc.approve(CONTRACT_ADDRESSES.aavePool, ethers.MaxUint256, { gasLimit: MANUAL_GAS_LIMIT });
                setTxHash(tx.hash);
                await tx.wait();
                await waitForAllowance(usdc, userAddress, CONTRACT_ADDRESSES.aavePool, depositAmountBN);
            }

            const initialAUsdcBalance = await aUSDC.balanceOf(userAddress);

            // 2. Supply USDC to Aave (get aUSDC)
            setStep(2);
            console.log("Step 2: Supplying USDC to Aave");
            const tx2 = await aavePool.supply(CONTRACT_ADDRESSES.usdc, depositAmountBN, userAddress, 0, { gasLimit: MANUAL_GAS_LIMIT });
            setTxHash(tx2.hash);
            await tx2.wait();
            await waitForBalanceIncrease(aUSDC, userAddress, initialAUsdcBalance);
            const aUsdcBalance = await aUSDC.balanceOf(userAddress);

            // 3. Approve aUSDC for waUSDC
            setStep(3);
            console.log("Step 3: Approving aUSDC to waUSDC Vault");
            const waUSDCAllowance = await aUSDC.allowance(userAddress, CONTRACT_ADDRESSES.waUSDC);
            if (waUSDCAllowance < aUsdcBalance) {
                const tx3 = await aUSDC.approve(CONTRACT_ADDRESSES.waUSDC, ethers.MaxUint256, { gasLimit: MANUAL_GAS_LIMIT });
                setTxHash(tx3.hash);
                await tx3.wait();
                await waitForAllowance(aUSDC, userAddress, CONTRACT_ADDRESSES.waUSDC, aUsdcBalance);
            }

            const initialWaUsdcBalance = await waUSDC.balanceOf(userAddress);

            // 4. Deposit in waUSDC
            setStep(4);
            console.log("Step 4: Deposit in waUSDC");
            const tx4 = await waUSDC.deposit(aUsdcBalance, userAddress, { gasLimit: MANUAL_GAS_LIMIT });
            setTxHash(tx4.hash);
            await tx4.wait();
            await waitForBalanceIncrease(waUSDC, userAddress, initialWaUsdcBalance);

            // 5. Approve waUSDC for Morpho Blue
            setStep(5);
            console.log("Step 5: Approving waUSDC for Morpho Blue");
            const wmusdcBalance = await waUSDC.balanceOf(userAddress);
            const wmusdcAllowance = await waUSDC.allowance(userAddress, CONTRACT_ADDRESSES.morphoBlue);
            if (wmusdcAllowance < wmusdcBalance) {
                const tx7 = await waUSDC.approve(CONTRACT_ADDRESSES.morphoBlue, ethers.MaxUint256, { gasLimit: MANUAL_GAS_LIMIT });
                setTxHash(tx7.hash);
                await tx7.wait();
                await waitForAllowance(waUSDC, userAddress, CONTRACT_ADDRESSES.morphoBlue, wmusdcBalance);
            }

            // 6. Supply Collateral to Morpho
            setStep(6);
            console.log("Step 6: Supplying Collateral");
            const MXNB_MARKET_PARAMS_ARRAY = [
                MXNB_MARKET_PARAMS.loanToken,
                MXNB_MARKET_PARAMS.collateralToken,
                MXNB_MARKET_PARAMS.oracle,
                MXNB_MARKET_PARAMS.irm,
                MXNB_MARKET_PARAMS.lltv
            ];
            const currentWaUSDCBalance = await waUSDC.balanceOf(userAddress);
            if (currentWaUSDCBalance <= 0n) throw new Error("Cannot supply 0 collateral.");

            const tx8 = await morpho.supplyCollateral(
                MXNB_MARKET_PARAMS_ARRAY,
                currentWaUSDCBalance,
                userAddress,
                "0x",
                { gasLimit: MANUAL_GAS_LIMIT }
            );

            setTxHash(tx8.hash);
            await tx8.wait();

            // 7. Borrow MXNB
            setStep(7);
            console.log("Step 7: Borrowing MXNB");
            const tx9 = await morpho.borrow(MXNB_MARKET_PARAMS_ARRAY, borrowAmountBN, 0, userAddress, userAddress, { gasLimit: MANUAL_GAS_LIMIT });
            setTxHash(tx9.hash);
            await tx9.wait();

            setStep(8); // Complete
            await refreshData();
            setLoading(false);

        } catch (err: any) {
            console.error("Zale Error:", err);
            let msg = err.reason || err.message || "Transaction failed";
            if (msg.includes("rejected")) msg = "You rejected the transaction";
            if (msg.includes("estimateGas")) msg = "Gas error.";
            if (msg.includes("allowance")) msg = "Approval failed.";
            if (msg.includes("collateral")) msg = "Insufficient collateral.";
            setError(msg);
        } finally {
            if (step !== 8 && step < 9) {
                setLoading(false);
            }
        }
    };

    const executeRepayAndWithdraw = async () => {
        setLoading(true);
        setError(null);
        setTotalRepaidAmount(null);
        setStep(11);

        try {
            const signer = await getSigner();
            const userAddress = await signer.getAddress();

            const mxnb = new ethers.Contract(CONTRACT_ADDRESSES.mockMXNB, ERC20_ABI, signer);
            const morpho = new ethers.Contract(CONTRACT_ADDRESSES.morphoBlue, MORPHO_ABI, signer);
            const waUSDC = new ethers.Contract(CONTRACT_ADDRESSES.waUSDC, VAULT_ABI, signer);
            const aavePool = new ethers.Contract(CONTRACT_ADDRESSES.aavePool, AAVE_ABI, signer);
            const aUSDC = new ethers.Contract(CONTRACT_ADDRESSES.aUSDC, ERC20_ABI, signer);

            const MXNB_MARKET_PARAMS_ARRAY = [
                MXNB_MARKET_PARAMS.loanToken,
                MXNB_MARKET_PARAMS.collateralToken,
                MXNB_MARKET_PARAMS.oracle,
                MXNB_MARKET_PARAMS.irm,
                MXNB_MARKET_PARAMS.lltv
            ];

            const marketId = ethers.keccak256(
                ethers.AbiCoder.defaultAbiCoder().encode(
                    ["address", "address", "address", "address", "uint256"],
                    MXNB_MARKET_PARAMS_ARRAY
                )
            );
            const position = await morpho.position(marketId, userAddress);
            const borrowShares = position[1];

            if (borrowShares <= 0n) throw new Error("No debt to repay.");

            // 1: Approve MXNB
            console.log("Step 1: Checking MXNB Allowance");
            const initialMxnbBalance = await mxnb.balanceOf(userAddress);
            if (initialMxnbBalance === 0n) throw new Error("No MXNB balance to repay.");
            setTotalRepaidAmount(ethers.formatUnits(initialMxnbBalance, MXNB_DECIMALS));

            const mxnbAllowance = await mxnb.allowance(userAddress, CONTRACT_ADDRESSES.morphoBlue);
            if (mxnbAllowance < initialMxnbBalance) {
                const tx1 = await mxnb.approve(CONTRACT_ADDRESSES.morphoBlue, ethers.MaxUint256, { gasLimit: MANUAL_GAS_LIMIT });
                setTxHash(tx1.hash);
                await tx1.wait();
                await waitForAllowance(mxnb, userAddress, CONTRACT_ADDRESSES.morphoBlue, initialMxnbBalance);
            }

            // 2a: Calculate MXNB APR
            const initialRawSubsidyUSDC = await waUSDC.userInterestSubsidyInWaUSDC(userAddress);
            console.log(`Calculating subsidy in MXNB (${borrowShares.toString()} shares) with INitial Subsidy: ${initialRawSubsidyUSDC} WmUSDC...`);
            const userInterestSubsidyInWaUSDC = await waUSDC.getInterestSubsidy(userAddress);
            //await interestTx.wait();
            console.log('✓ Interest confirmed:', userInterestSubsidyInWaUSDC);
            await waitForSubsidyIncrease(waUSDC, userAddress, initialRawSubsidyUSDC);
            const rawEstimatedSubsidyUSDC = await waUSDC.userInterestSubsidyInWaUSDC(userAddress);
            const estimatedSubsidyUSDC = ethers.formatUnits(rawEstimatedSubsidyUSDC, 18);
            const rawEstimatedSubsidyMXNB = await waUSDC.userInterestInMxnb(userAddress);
            const estimatedSubsidyMXNB = ethers.formatUnits(rawEstimatedSubsidyMXNB, 6);
            console.log(`User raw Subsidy: ${rawEstimatedSubsidyUSDC} USDC (${rawEstimatedSubsidyMXNB} MXNB)`);
            console.log(`User Subsidy: ${estimatedSubsidyUSDC} USDC (${estimatedSubsidyMXNB} MXNB)`);

            // 2b: Repay Debt
            setStep(12);
            console.log("Step 2: Repaying Debt");
            const tx2 = await morpho.repay(MXNB_MARKET_PARAMS_ARRAY, 0, borrowShares, userAddress, "0x", { gasLimit: MANUAL_GAS_LIMIT });
            setTxHash(tx2.hash);
            await tx2.wait();

            // 3: Withdraw Collateral
            setStep(13);
            console.log("Step 3: Withdrawing Collateral");
            const updatedPosition = await morpho.position(marketId, userAddress);
            const collateralShares = updatedPosition[2];

            const initialWaUsdcBalance = await waUSDC.balanceOf(userAddress);

            if (collateralShares > 0n) {
                const tx3 = await morpho.withdrawCollateral(MXNB_MARKET_PARAMS_ARRAY, collateralShares, userAddress, userAddress, { gasLimit: MANUAL_GAS_LIMIT });
                setTxHash(tx3.hash);
                await tx3.wait();
                await waitForBalanceIncrease(waUSDC, userAddress, initialWaUsdcBalance);
            }

            // 4: Unwrap waUSDC -> aUSDC
            setStep(14);
            console.log("Step 4: Unwrap waUSDC to aUSDC");

            const wMusdcBalance = await waUSDC.balanceOf(userAddress);
            const initialAUsdcBalance = await aUSDC.balanceOf(userAddress);

            if (wMusdcBalance > 0n) {
                const tx4 = await waUSDC.redeem(wMusdcBalance, userAddress, userAddress, { gasLimit: MANUAL_GAS_LIMIT });
                setTxHash(tx4.hash);
                await tx4.wait();
                await waitForBalanceIncrease(aUSDC, userAddress, initialAUsdcBalance);
            }

            // 5: Withdraw aUSDC from Aave
            setStep(15);
            console.log("Step 5: Withdraw aUSDC from Aave");
            const aUsdcBalance = await aUSDC.balanceOf(userAddress);
            if (aUsdcBalance > 0n) {
                const tx5 = await aavePool.withdraw(CONTRACT_ADDRESSES.usdc, aUsdcBalance, userAddress, { gasLimit: MANUAL_GAS_LIMIT });
                setTxHash(tx5.hash);
                await tx5.wait();
            }

            setStep(16); // Complete Repay Flow and Display subsidy
            const rawPaidSubsidyUSDC = await waUSDC.userPaidSubsidyInUSDC(userAddress);
            const paidSubsidyUSDC = ethers.formatUnits(rawPaidSubsidyUSDC, 6);
            console.log(`Paid Subsidy: ${paidSubsidyUSDC} USDC (${estimatedSubsidyMXNB} MXNB, ${estimatedSubsidyUSDC} USDC)`);
            if (parseFloat(paidSubsidyUSDC || "0") > 0) {
                setUserPaidSubsidyInUSDC(paidSubsidyUSDC);
                setUserInterestInMxnb(estimatedSubsidyMXNB);
                setUserInterestInUSDC(estimatedSubsidyUSDC);
            } else {
                const subsidyMXNE = parseFloat(estimatedSubsidyMXNB || "0");
                let paidUSDC = subsidyMXNE / 17.6;
                setUserPaidSubsidyInUSDC(ethers.formatUnits(paidUSDC, 6));
                setUserInterestInMxnb(estimatedSubsidyMXNB);
                setUserInterestInUSDC(ethers.formatUnits(paidUSDC, 6));
            }

            await refreshData();
            setLoading(false);

        } catch (err: any) {
            console.error("Repay Error:", err);
            let msg = err.reason || err.message || "Repay transaction failed";
            if (msg.includes("rejected")) msg = "You rejected the transaction";
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
    };

    return {
        loading,
        step,
        error,
        txHash,
        usdcBalance,
        mxnbBalance,
        collateralBalance,
        borrowBalance,
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