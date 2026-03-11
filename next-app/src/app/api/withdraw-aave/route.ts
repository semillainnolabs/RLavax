// src/app/api/withdraw-aave/route.ts
import { NextResponse } from "next/server";
import { encodeFunctionData, createPublicClient, getAddress, http } from "viem";
import { baseSepolia } from "viem/chains";
import { privyRpc } from "@/lib/privy-signer";
import { CONTRACT_ADDRESSES } from "@/constants/contracts";

const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(),
});

const AAVE_POOL = CONTRACT_ADDRESSES.aavePool as `0x${string}`;
const USDC = CONTRACT_ADDRESSES.usdc as `0x${string}`;

const aaveAbi = [
    {
        name: "withdraw",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [
            { name: "asset", type: "address" },
            { name: "amount", type: "uint256" },
            { name: "to", type: "address" },
        ],
        outputs: [{ name: "", type: "uint256" }],
    },
] as const;

export async function POST(req: Request) {
    try {
        const { walletId, userAddress, aUsdcAmount } = await req.json();
        if (!walletId || !userAddress || !aUsdcAmount)
            return NextResponse.json({ error: "Faltan datos" }, { status: 400 });

        const addr = getAddress(userAddress.toLowerCase()) as `0x${string}`;
        const amount = BigInt(aUsdcAmount);

        console.log("--- WITHDRAW AAVE ---", { walletId, addr, aUsdcAmount });

        const withdrawData = encodeFunctionData({
            abi: aaveAbi,
            functionName: "withdraw",
            args: [USDC, amount, addr],
        });

        const withdrawTx = await privyRpc(walletId, "eip155:84532", {
            to: AAVE_POOL,
            data: withdrawData,
            chain_id: 84532,
        });

        await publicClient.waitForTransactionReceipt({
            hash: withdrawTx.hash as `0x${string}`,
        });
        console.log("Withdraw Aave hash:", withdrawTx.hash);

        return NextResponse.json({ success: true, withdrawHash: withdrawTx.hash });
    } catch (e: any) {
        console.error("WITHDRAW AAVE ERROR:", e);
        return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
    }
}
