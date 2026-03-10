// src/app/api/transfer/route.ts
import { NextResponse } from "next/server";
import { encodeFunctionData, createPublicClient, getAddress, http } from "viem";
import { baseSepolia } from "viem/chains";
import { privyRpc } from "@/lib/privy-signer";
import { CONTRACT_ADDRESSES } from "@/constants/contracts";

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(),
});

const USDC = CONTRACT_ADDRESSES.usdc as `0x${string}`;
const MXNE = CONTRACT_ADDRESSES.mockMXNB as `0x${string}`;

const erc20Abi = [
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export async function POST(req: Request) {
  try {
    const { walletId, userAddress, currency, amount, recipientAddress } =
      await req.json();

    if (!walletId || !userAddress || !currency || !amount || !recipientAddress)
      return NextResponse.json({ error: "Faltan datos" }, { status: 400 });

    const addr = getAddress(userAddress.toLowerCase()) as `0x${string}`;
    const recipient = getAddress(
      recipientAddress.toLowerCase(),
    ) as `0x${string}`;
    const tokenAddress = currency === "USDC" ? USDC : MXNE;

    // Both USDC and MXNE have 6 decimals
    const parsedAmount = BigInt(Math.round(parseFloat(amount) * 1_000_000));

    console.log("--- TRANSFER ---", {
      walletId,
      addr,
      currency,
      amount,
      parsedAmount: parsedAmount.toString(),
      recipient,
    });

    const transferData = encodeFunctionData({
      abi: erc20Abi,
      functionName: "transfer",
      args: [recipient, parsedAmount],
    });

    const transferTx = await privyRpc(walletId, "eip155:84532", {
      to: tokenAddress,
      data: transferData,
      chain_id: 84532,
    });
    await publicClient.waitForTransactionReceipt({
      hash: transferTx.hash as `0x${string}`,
    });
    console.log("Transfer hash:", transferTx.hash);

    return NextResponse.json({ success: true, txHash: transferTx.hash });
  } catch (e: any) {
    console.error("TRANSFER ERROR:", e);
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}
