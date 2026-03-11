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
        name: "",
        type: "address"
      }
    ],
    name: "userInterestSubsidyInWaUSDC",
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
    name: "userInterestInMXNB",
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

    // Get current subsidy balance in WaUSDC
    const finalSubsidyUSDC = await publicClient.readContract({
      address: WM_USDC as `0x${string}`,
      abi: wmUsdcAbi,
      functionName: "userInterestSubsidyInWaUSDC",
      args: [addr],
    });

    // Get current subsidy in MXNB
    const rawSubsidyMXNB = await publicClient.readContract({
      address: WM_USDC as `0x${string}`,
      abi: wmUsdcAbi,
      functionName: "userInterestInMXNB",
      args: [addr],
    });

    console.log("Raw Final subsidy:", { finalSubsidyUSDC, rawSubsidyMXNB });

    const subsidyInUSDC = ethers.formatUnits(finalSubsidyUSDC, 6); // WaUSDC has 6 decimals
    const subsidyInMXNE = ethers.formatUnits(rawSubsidyMXNB, 6);

    console.log("Final formated subsidy:", { subsidyInUSDC, subsidyInMXNE });

    return NextResponse.json({
      success: true,
      subsidyInUSDC,
      subsidyInMXNE,
      rawSubsidyUSDC: finalSubsidyUSDC.toString(),
      rawSubsidyMXNE: rawSubsidyMXNB.toString()
    });
  } catch (e: any) {
    console.error("GET INTEREST SUBSIDY ERROR:", e);
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}

