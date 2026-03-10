// src/app/api/get-interest-subsidy/route.ts
import { NextResponse } from "next/server";
import { createPublicClient, getAddress, http } from "viem";
import { baseSepolia } from "viem/chains";
import { ethers } from "ethers";
import { CONTRACT_ADDRESSES } from "@/constants/contracts";

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(),
});
const WM_USDC = CONTRACT_ADDRESSES.waUSDC as `0x${string}`;

const wmUsdcAbi = [
  {
    inputs: [
      {
        name: "user",
        type: "address"
      }
    ],
    name: "getInterestSubsidy",
    outputs: [
      {
        name: "subsidy",
        type: "uint256"
      }
    ],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      {
        name: "",
        type: "address"
      }
    ],
    name: "userInterestSubsidyInWmUSDC",
    outputs: [
      {
        name: "",
        type: "uint256"
      }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      {
        name: "",
        type: "address"
      }
    ],
    name: "userInterestInMxne",
    outputs: [
      {
        name: "",
        type: "uint256"
      }
    ],
    stateMutability: "view",
    type: "function"
  }
] as const;

export async function POST(req: Request) {
  try {
    const { walletId, userAddress } = await req.json();
    if (!walletId || !userAddress)
      return NextResponse.json({ error: "Faltan datos" }, { status: 400 });

    const addr = getAddress(userAddress.toLowerCase()) as `0x${string}`;

    // Get initial subsidy balance
    const initialRawSubsidyUSDC = await publicClient.readContract({
      address: WM_USDC as `0x${string}`,
      abi: wmUsdcAbi,
      functionName: "userInterestSubsidyInWmUSDC",
      args: [addr],
    });

    console.log(`Calculating subsidy with initial value: ${initialRawSubsidyUSDC.toString()} WmUSDC...`);

    // Call getInterestSubsidy to trigger subsidy calculation
    const userInterestSubsidyInWmUSDC = await publicClient.readContract({
      address: WM_USDC as `0x${string}`,
      abi: wmUsdcAbi as any,
      functionName: "getInterestSubsidy",
      args: [addr],
    });

    console.log('✓ Interest confirmed:', userInterestSubsidyInWmUSDC);

    // Poll for subsidy update
    let retries = 0;
    let finalSubsidyUSDC = initialRawSubsidyUSDC;

    while (retries < 15) {
      const currentBalance = await publicClient.readContract({
        address: WM_USDC as `0x${string}`,
        abi: wmUsdcAbi,
        functionName: "userInterestSubsidyInWmUSDC",
        args: [addr],
      });

      if (currentBalance > initialRawSubsidyUSDC) {
        finalSubsidyUSDC = currentBalance;
        break;
      }

      console.log(`Waiting for subsidy update... Attempt ${retries + 1}/15`);
      await new Promise((r) => setTimeout(r, 2500));
      retries++;
    }

    // Get subsidy in MXNE
    const rawSubsidyMXNE = await publicClient.readContract({
      address: WM_USDC as `0x${string}`,
      abi: wmUsdcAbi,
      functionName: "userInterestInMxne",
      args: [addr],
    });

    console.log("Raw Final subsidy:", { finalSubsidyUSDC, rawSubsidyMXNE });

    const subsidyInUSDC = ethers.formatUnits(finalSubsidyUSDC, 18);
    const subsidyInMXNE = ethers.formatUnits(rawSubsidyMXNE, 6);

    console.log("Final subsidy:", { subsidyInUSDC, subsidyInMXNE });

    return NextResponse.json({
      success: true,
      subsidyInUSDC,
      subsidyInMXNE,
      rawSubsidyUSDC: finalSubsidyUSDC.toString(),
      rawSubsidyMXNE: rawSubsidyMXNE.toString()
    });
  } catch (e: any) {
    console.error("GET INTEREST SUBSIDY ERROR:", e);
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}
