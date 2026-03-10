// src/app/api/lend/route.ts
import { NextResponse } from "next/server";
import { encodeFunctionData, parseUnits, createPublicClient, getAddress, http, maxUint256 } from "viem";
import { baseSepolia } from "viem/chains";
import { privyRpc } from "@/lib/privy-signer";
import { CONTRACT_ADDRESSES } from "@/constants/contracts";

const publicClient = createPublicClient({ chain: baseSepolia, transport: http() });
const USDC = CONTRACT_ADDRESSES.usdc as `0x${string}`;
const MORPHO_USDC_VAULT = CONTRACT_ADDRESSES.morphoUSDCVault as `0x${string}`;

const erc20Abi = [{ name: "approve", type: "function", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "", type: "bool" }] }] as const;
const vaultAbi = [{ name: "deposit", type: "function", stateMutability: "nonpayable", inputs: [{ name: "assets", type: "uint256" }, { name: "receiver", type: "address" }], outputs: [] }] as const;

export async function POST(req: Request) {
  try {
    const { walletId, userAddress, amount } = await req.json();
    if (!walletId || !userAddress || !amount)
      return NextResponse.json({ error: "Faltan datos" }, { status: 400 });

    const addr = getAddress(userAddress.toLowerCase()) as `0x${string}`;
    const parsedAmount = parseUnits(amount, 6);
    console.log("--- LEND ---", { walletId, cleanAddress: addr, amount });

    const approveData = encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [MORPHO_USDC_VAULT as `0x${string}`, maxUint256] });
    const approveTx = await privyRpc(walletId, "eip155:84532", { to: USDC, data: approveData, chain_id: 84532 });
    await publicClient.waitForTransactionReceipt({ hash: approveTx.hash as `0x${string}` });
    console.log("Approve hash:", approveTx.hash);

    await new Promise(r => setTimeout(r, 3000));

    const depositData = encodeFunctionData({ abi: vaultAbi, functionName: "deposit", args: [parsedAmount, addr] });
    const depositTx = await privyRpc(walletId, "eip155:84532", { to: MORPHO_USDC_VAULT, data: depositData, chain_id: 84532 });
    await publicClient.waitForTransactionReceipt({ hash: depositTx.hash as `0x${string}` });
    console.log("Deposit hash:", depositTx.hash);

    return NextResponse.json({ success: true, approveHash: approveTx.hash, depositHash: depositTx.hash });
  } catch (e: any) {
    console.error("LEND ERROR:", e);
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}
