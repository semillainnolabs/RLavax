// src/app/api/supply-collateral/route.ts
import { NextResponse } from "next/server";
import {
  encodeFunctionData,
  createPublicClient,
  getAddress,
  http,
  maxUint256,
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
] as const;

const morphoAbi = [
  {
    name: "supplyCollateral",
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
      { name: "onBehalf", type: "address" },
      { name: "data", type: "bytes" },
    ],
    outputs: [],
  },
] as const;

export async function POST(req: Request) {
  try {
    const { walletId, userAddress, wmusdcAmount } = await req.json();
    if (!walletId || !userAddress || !wmusdcAmount)
      return NextResponse.json({ error: "Faltan datos" }, { status: 400 });

    const addr = getAddress(userAddress.toLowerCase()) as `0x${string}`;
    const amount = BigInt(wmusdcAmount);
    console.log("--- SUPPLY COLLATERAL ---", {
      walletId,
      addr,
      amount: amount.toString(),
    });

    // 1. Approve WmUSDC → Morpho Blue (maxUint256 to avoid rounding issues)
    const approveData = encodeFunctionData({
      abi: erc20Abi,
      functionName: "approve",
      args: [MORPHO_BLUE as `0x${string}`, maxUint256],
    });
    const approveTx = await privyRpc(walletId, "eip155:84532", {
      to: WM_USDC,
      data: approveData,
      chain_id: 84532,
    });
    await publicClient.waitForTransactionReceipt({
      hash: approveTx.hash as `0x${string}`,
    });
    console.log("Supply approve hash:", approveTx.hash);

    // Wait for allowance to propagate on Base Sepolia
    await new Promise((r) => setTimeout(r, 3000));

    // 2. Supply collateral
    const supplyData = encodeFunctionData({
      abi: morphoAbi,
      functionName: "supplyCollateral",
      args: [MARKET, amount, addr, "0x"],
    });
    const supplyTx = await privyRpc(walletId, "eip155:84532", {
      to: MORPHO_BLUE,
      data: supplyData,
      chain_id: 84532,
    });
    await publicClient.waitForTransactionReceipt({
      hash: supplyTx.hash as `0x${string}`,
    });
    console.log("Supply hash:", supplyTx.hash);

    return NextResponse.json({
      success: true,
      approveHash: approveTx.hash,
      supplyHash: supplyTx.hash,
    });
  } catch (e: any) {
    console.error("SUPPLY COLLATERAL ERROR:", e);
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}
