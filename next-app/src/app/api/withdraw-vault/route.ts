// src/app/api/withdraw-vault/route.ts
import { NextResponse } from "next/server";
import { encodeFunctionData, createPublicClient, getAddress, http } from "viem";
import { baseSepolia } from "viem/chains";
import { privyRpc } from "@/lib/privy-signer";
import { CONTRACT_ADDRESSES } from "@/constants/contracts";

const publicClient = createPublicClient({ chain: baseSepolia, transport: http() });
const MORPHO_USDC_VAULT = CONTRACT_ADDRESSES.morphoUSDCVault as `0x${string}`;

const vaultAbi = [{ name: "redeem", type: "function", stateMutability: "nonpayable", inputs: [{ name: "shares", type: "uint256" }, { name: "receiver", type: "address" }, { name: "owner", type: "address" }], outputs: [{ name: "", type: "uint256" }] }] as const;

export async function POST(req: Request) {
  try {
    const { walletId, userAddress, musdcShares } = await req.json();
    if (!walletId || !userAddress || !musdcShares)
      return NextResponse.json({ error: "Faltan datos" }, { status: 400 });

    const addr = getAddress(userAddress.toLowerCase()) as `0x${string}`;
    const shares = BigInt(musdcShares);
    console.log("--- WITHDRAW VAULT ---", { walletId, addr, shares: shares.toString() });

    const redeemData = encodeFunctionData({ abi: vaultAbi, functionName: "redeem", args: [shares, addr, addr] });
    const redeemTx = await privyRpc(walletId, "eip155:84532", { to: MORPHO_USDC_VAULT, data: redeemData, chain_id: 84532 });
    await publicClient.waitForTransactionReceipt({ hash: redeemTx.hash as `0x${string}` });

    return NextResponse.json({ success: true, redeemHash: redeemTx.hash });
  } catch (e: any) {
    console.error("WITHDRAW VAULT ERROR:", e);
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}
