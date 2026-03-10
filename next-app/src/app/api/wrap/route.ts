// src/app/api/wrap/route.ts
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
import { CONTRACT_ADDRESSES } from "@/constants/contracts";

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(),
});

const MORPHO_USDC_VAULT = CONTRACT_ADDRESSES.morphoUSDCVault as `0x${string}`;
const WM_USDC = CONTRACT_ADDRESSES.waUSDC as `0x${string}`;

const vaultAbi = [
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

const wmUsdcAbi = [
  {
    name: "deposit",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "assets", type: "uint256" },
      { name: "receiver", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export async function POST(req: Request) {
  try {
    const { walletId, userAddress, musdcAmount } = await req.json();
    if (!walletId || !userAddress || !musdcAmount)
      return NextResponse.json({ error: "Faltan datos" }, { status: 400 });

    const addr = getAddress(userAddress.toLowerCase()) as `0x${string}`;
    const amount = BigInt(musdcAmount);
    console.log("--- WRAP ---", { walletId, addr, amount: amount.toString() });

    // 1. Approve mUSDC → WmUSDC (maxUint256 to avoid wei rounding issues)
    const approveData = encodeFunctionData({
      abi: vaultAbi,
      functionName: "approve",
      args: [WM_USDC as `0x${string}`, maxUint256],
    });
    const approveTx = await privyRpc(walletId, "eip155:84532", {
      to: MORPHO_USDC_VAULT,
      data: approveData,
      chain_id: 84532,
    });
    await publicClient.waitForTransactionReceipt({
      hash: approveTx.hash as `0x${string}`,
    });
    console.log("Wrap approve hash:", approveTx.hash);

    // Wait for allowance to propagate on Base Sepolia
    await new Promise((r) => setTimeout(r, 3000));

    // 2. Wrap mUSDC → WmUSDC
    const wrapData = encodeFunctionData({
      abi: wmUsdcAbi,
      functionName: "deposit",
      args: [amount, addr],
    });
    const wrapTx = await privyRpc(walletId, "eip155:84532", {
      to: WM_USDC,
      data: wrapData,
      chain_id: 84532,
    });
    await publicClient.waitForTransactionReceipt({
      hash: wrapTx.hash as `0x${string}`,
    });
    console.log("Wrap hash:", wrapTx.hash);

    return NextResponse.json({
      success: true,
      approveHash: approveTx.hash,
      wrapHash: wrapTx.hash,
    });
  } catch (e: any) {
    console.error("WRAP ERROR:", e);
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}
