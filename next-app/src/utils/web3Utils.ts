import { ethers } from 'ethers';
import {
    BASE_SEPOLIA_CONFIG,
    CONTRACT_ADDRESSES,
    MORPHO_ABI,
    IRM_ABI,
    MXNB_MARKET_PARAMS,
    MARKET_IDS,
} from '../constants/contracts';

// Helper: Format with max 3 decimals
export const formatBalance = (val: bigint, decimals: number) => {
    const formatted = ethers.formatUnits(val, decimals);
    const [integer, fraction] = formatted.split(".");
    if (!fraction) return integer;
    return `${integer}.${fraction.substring(0, 1)}`;
};

// Read-only provider — no wallet signing needed for reads
export const getProvider = () => {
    return new ethers.JsonRpcProvider(BASE_SEPOLIA_CONFIG.rpcUrl);
};

export const handleTransactionError = (err: any): string => {
    let msg = err.reason || err.message || "Transaction failed";

    if (msg.includes("insufficient funds for gas")) {
        msg = "Insufficient funds for gas. Please add ETH to your wallet on Base Sepolia.";
    }
    else if (msg.includes("transfer amount exceeds balance")) {
        msg = "Transfer amount exceeds balance. Please try again.";
    }
    else if (msg.includes("reverted")) {
        msg = "Transaction reverted. Check your inputs and try again.";
    }
    else {
        msg = "Transaction failed. Please try again.";
    }
    return msg;
};

export const waitForBalanceIncrease = async (
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
    return await tokenContract.balanceOf(userAddress);
};

export const fetchMarketBorrowRate = async (provider: ethers.Provider | ethers.JsonRpcProvider) => {
    const morpho = new ethers.Contract(CONTRACT_ADDRESSES.morphoBlue, MORPHO_ABI, provider);

    const marketDetails = await morpho.market(MARKET_IDS.mxnb);
    const totalSupplyAssets = Number(ethers.formatUnits(marketDetails.totalSupplyAssets, 6)); // MXNB decimals
    const totalBorrowAssets = Number(ethers.formatUnits(marketDetails.totalBorrowAssets, 6));

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

    return {
        totalSupplyAssets,
        totalBorrowAssets,
        borrowRate,
    };
};