// src/app/api/withdraw-collateral/route.ts
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

const morphoAbi = [
  {
    name: "withdrawCollateral",
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
      { name: "receiver", type: "address" },
    ],
    outputs: [],
  },
] as const;

export async function POST(req: Request) {
  try {
    const { walletId, userAddress, collateralAmount } = await req.json();
    if (!walletId || !userAddress || !collateralAmount)
      return NextResponse.json({ error: "Faltan datos" }, { status: 400 });

    const addr = getAddress(userAddress.toLowerCase()) as `0x${string}`;
    const amount = BigInt(collateralAmount);
    console.log("--- WITHDRAW COLLATERAL ---", {
      walletId,
      addr,
      amount: amount.toString(),
    });

    const withdrawData = encodeFunctionData({
      abi: morphoAbi,
      functionName: "withdrawCollateral",
      args: [MARKET, amount, addr, addr],
    });
    const withdrawTx = await privyRpc(walletId, "eip155:84532", {
      to: MORPHO_BLUE,
      data: withdrawData,
      chain_id: 84532,
    });

    // Wait for on-chain confirmation
    await publicClient.waitForTransactionReceipt({
      hash: withdrawTx.hash as `0x${string}`,
    });
    console.log("Withdraw collateral confirmed:", withdrawTx.hash);

    // Extra wait for Base Sepolia RPC indexing — critical to avoid arithmetic underflow in unwrap
    await new Promise((r) => setTimeout(r, 8000));
    console.log("Withdraw collateral indexing wait done");

    return NextResponse.json({ success: true, withdrawHash: withdrawTx.hash });
  } catch (e: any) {
    console.error("WITHDRAW COLLATERAL ERROR:", e);
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}
