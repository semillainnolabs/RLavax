// src/app/api/borrow/route.ts
import { NextResponse } from "next/server";
import { encodeFunctionData, parseUnits, createPublicClient, getAddress, http } from "viem";
import { baseSepolia } from "viem/chains";
import { privyRpc } from "@/lib/privy-signer";
import { CONTRACT_ADDRESSES, MXNB_MARKET_PARAMS } from "@/constants/contracts";

const publicClient = createPublicClient({ chain: baseSepolia, transport: http() });
const MORPHO_BLUE = CONTRACT_ADDRESSES.morphoBlue as `0x${string}`;
const MARKET = MXNB_MARKET_PARAMS as { loanToken: `0x${string}`; collateralToken: `0x${string}`; oracle: `0x${string}`; irm: `0x${string}`; lltv: bigint };

const morphoAbi = [{ name: "borrow", type: "function", stateMutability: "nonpayable", inputs: [{ name: "marketParams", type: "tuple", components: [{ name: "loanToken", type: "address" }, { name: "collateralToken", type: "address" }, { name: "oracle", type: "address" }, { name: "irm", type: "address" }, { name: "lltv", type: "uint256" }] }, { name: "assets", type: "uint256" }, { name: "shares", type: "uint256" }, { name: "onBehalf", type: "address" }, { name: "receiver", type: "address" }], outputs: [{ name: "", type: "uint256" }, { name: "", type: "uint256" }] }] as const;

export async function POST(req: Request) {
  try {
    const { walletId, userAddress, borrowAmount } = await req.json();
    if (!walletId || !userAddress || !borrowAmount)
      return NextResponse.json({ error: "Faltan datos" }, { status: 400 });

    const addr = getAddress(userAddress.toLowerCase()) as `0x${string}`;
    const amount = parseUnits(borrowAmount, 6);
    console.log("--- BORROW ---", { walletId, addr, borrowAmount });

    const borrowData = encodeFunctionData({ abi: morphoAbi, functionName: "borrow", args: [MARKET, amount, BigInt(0), addr, addr] });
    const borrowTx = await privyRpc(walletId, "eip155:84532", { to: MORPHO_BLUE, data: borrowData, chain_id: 84532 });
    await publicClient.waitForTransactionReceipt({ hash: borrowTx.hash as `0x${string}` });

    return NextResponse.json({ success: true, borrowHash: borrowTx.hash });
  } catch (e: any) {
    console.error("BORROW ERROR:", e);
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}
