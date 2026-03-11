// src/app/api/repay/route.ts
import { NextResponse } from "next/server";
import {
  encodeFunctionData,
  createPublicClient,
  getAddress,
  http,
} from "viem";
import { baseSepolia } from "viem/chains";
import { privyRpc } from "@/lib/privy-signer";
import { CONTRACT_ADDRESSES, MXNB_MARKET_PARAMS } from "@/constants/contracts";

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(),
});

const WM_USDC = CONTRACT_ADDRESSES.waUSDC as `0x${string}`;
const MORPHO_BLUE = CONTRACT_ADDRESSES.morphoBlue as `0x${string}`;
const MXNE = CONTRACT_ADDRESSES.mockMXNB as `0x${string}`;
const MARKET = MXNB_MARKET_PARAMS as { loanToken: `0x${string}`; collateralToken: `0x${string}`; oracle: `0x${string}`; irm: `0x${string}`; lltv: bigint };

const erc20Abi = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const morphoAbi = [
  {
    name: "repay",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "marketParams",
        type: "tuple",
        components: [
          { name: "loanToken", type: "address" },
          { name: "collateralToken", type: "address" },
          { name: "oracle", type: "address" },
          { name: "irm", type: "address" },
          { name: "lltv", type: "uint256" },
        ],
      },
      { name: "assets", type: "uint256" },
      { name: "shares", type: "uint256" },
      { name: "onBehalf", type: "address" },
      { name: "data", type: "bytes" },
    ],
    outputs: [
      { name: "", type: "uint256" },
      { name: "", type: "uint256" },
    ],
  },
] as const;

const wmUsdcAbi = [
  {
    name: "getInterestSubsidy",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "userInterestSubsidyInWaUSDC",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export async function POST(req: Request) {
  try {
    const { walletId, userAddress, borrowShares } = await req.json();
    if (!walletId || !userAddress || !borrowShares)
      return NextResponse.json({ error: "Faltan datos" }, { status: 400 });

    const addr = getAddress(userAddress.toLowerCase()) as `0x${string}`;
    const shares = BigInt(borrowShares);
    console.log("--- REPAY ---", { walletId, addr, shares: shares.toString() });

    // Step 0: Call getInterestSubsidy BEFORE repay — this is required for redeemWithInterestSubsidy to work
    // It sets userInterestSubsidyInWaUSDC[user] and userDepositedShares on chain
    const initialSubsidy = await publicClient.readContract({
      address: WM_USDC as `0x${string}`,
      abi: wmUsdcAbi,
      functionName: "userInterestSubsidyInWaUSDC",
      args: [addr],
    });
    console.log("Initial subsidy:", initialSubsidy.toString());

    const subsidyData = encodeFunctionData({
      abi: wmUsdcAbi,
      functionName: "getInterestSubsidy",
      args: [addr],
    });
    const subsidyTx = await privyRpc(walletId, "eip155:84532", {
      to: WM_USDC,
      data: subsidyData,
      chain_id: 84532,
    });
    await publicClient.waitForTransactionReceipt({
      hash: subsidyTx.hash as `0x${string}`,
    });
    console.log("getInterestSubsidy hash:", subsidyTx.hash);

    // Wait for subsidy to transaction to finish, removing the loop since it locks if no diff.
    console.log("Esperando propagación del subsidy...");
    await new Promise((r) => setTimeout(r, 3000));

    // Step 1: Approve MXNE → Morpho Blue
    const currentAllowance = await publicClient.readContract({
      address: MXNE,
      abi: erc20Abi,
      functionName: "allowance",
      args: [addr, MORPHO_BLUE as `0x${string}`],
    });

    if (currentAllowance >= shares) {
      console.log("Allowance already sufficient. Skipping approve step.");
    } else {
      console.log("Allowance insufficient. Approving MXNB maxUint256...");
      const approveData = encodeFunctionData({
        abi: erc20Abi,
        functionName: "approve",
        args: [
          MORPHO_BLUE as `0x${string}`,
          BigInt(
            "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
          ),
        ],
      });
      const approveTx = await privyRpc(walletId, "eip155:84532", {
        to: MXNE,
        data: approveData,
        chain_id: 84532,
      });
      await publicClient.waitForTransactionReceipt({
        hash: approveTx.hash as `0x${string}`,
      });
      console.log("Repay approve hash:", approveTx.hash);

      console.log("Esperando propagación del allowance (Polling)...");
      let allowanceRetries = 0;
      while (allowanceRetries < 10) {
        const newAllowance = await publicClient.readContract({
          address: MXNE,
          abi: erc20Abi,
          functionName: "allowance",
          args: [addr, MORPHO_BLUE as `0x${string}`],
        });
        if (newAllowance > 0n) {
          console.log(`Allowance detectado: ${newAllowance.toString()}`);
          break;
        }
        await new Promise((r) => setTimeout(r, 2000));
        allowanceRetries++;
      }

      console.log("Iniciando Grace Period antes de REPAY...");
      await new Promise((r) => setTimeout(r, 4000));
    }

    // Step 2: Repay with exact borrowShares (assets=0 closes position without dust)
    const repayData = encodeFunctionData({
      abi: morphoAbi,
      functionName: "repay",
      args: [MARKET, 0n, shares, addr, "0x"],
    });
    const repayTx = await privyRpc(walletId, "eip155:84532", {
      to: MORPHO_BLUE,
      data: repayData,
      chain_id: 84532,
    });
    await publicClient.waitForTransactionReceipt({
      hash: repayTx.hash as `0x${string}`,
    });
    console.log("Repay hash:", repayTx.hash);

    return NextResponse.json({
      success: true,
      repayHash: repayTx.hash,
      subsidyHash: subsidyTx.hash,
    });
  } catch (e: any) {
    console.error("REPAY ERROR:", e);
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}
