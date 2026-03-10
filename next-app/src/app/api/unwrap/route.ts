// src/app/api/unwrap/route.ts
import { NextResponse } from "next/server";
import { encodeFunctionData, createPublicClient, getAddress, http } from "viem";
import { baseSepolia } from "viem/chains";
import { privyRpc } from "@/lib/privy-signer";
import { CONTRACT_ADDRESSES } from "@/constants/contracts";

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(),
});
const WM_USDC = CONTRACT_ADDRESSES.waUSDC as `0x${string}`;

const wmUsdcAbi = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "redeemWithInterestSubsidy",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "shares", type: "uint256" },
      { name: "receiver", type: "address" },
      { name: "owner", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export async function POST(req: Request) {
  try {
    const { walletId, userAddress } = await req.json();
    if (!walletId || !userAddress)
      return NextResponse.json({ error: "Faltan datos" }, { status: 400 });

    const addr = getAddress(userAddress.toLowerCase()) as `0x${string}`;

    // Poll for WmUSDC balance — must be > 0 before unwrapping
    let wmusdcBalance = 0n;
    let retries = 0;
    while (retries < 15) {
      wmusdcBalance = await publicClient.readContract({
        address: WM_USDC as `0x${string}`,
        abi: wmUsdcAbi,
        functionName: "balanceOf",
        args: [addr],
      });
      console.log(
        `WmUSDC balance attempt ${retries + 1}:`,
        wmusdcBalance.toString(),
      );
      if (wmusdcBalance > 0n) break;
      await new Promise((r) => setTimeout(r, 3000));
      retries++;
    }

    if (wmusdcBalance === 0n)
      return NextResponse.json(
        { error: "WmUSDC balance is 0 after polling" },
        { status: 400 },
      );

    console.log("--- UNWRAP ---", {
      walletId,
      addr,
      wmusdcBalance: wmusdcBalance.toString(),
    });

    // getInterestSubsidy was already called in /api/repay before the repay tx
    // so userInterestSubsidyInWmUSDC and userDepositedShares are correctly set on chain
    const redeemData = encodeFunctionData({
      abi: wmUsdcAbi,
      functionName: "redeemWithInterestSubsidy",
      args: [wmusdcBalance, addr, addr],
    });
    const redeemTx = await privyRpc(walletId, "eip155:84532", {
      to: WM_USDC,
      data: redeemData,
      chain_id: 84532,
    });
    await publicClient.waitForTransactionReceipt({
      hash: redeemTx.hash as `0x${string}`,
    });
    console.log("Unwrap hash:", redeemTx.hash);

    return NextResponse.json({ success: true, unwrapHash: redeemTx.hash });
  } catch (e: any) {
    console.error("UNWRAP ERROR:", e);
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}
