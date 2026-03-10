// src/app/api/drain-wmusdc/route.ts
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
const MORPHO_USDC_VAULT = CONTRACT_ADDRESSES.morphoUSDCVault as `0x${string}`;

const wmUsdcAbi = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "userDepositedShares",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "userDepositedAssets",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "convertToAssets",
    type: "function",
    stateMutability: "pure",
    inputs: [{ name: "shares", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  // withdraw(assets, receiver, owner) — uses userDepositedAssets, safer than redeem
  {
    name: "withdraw",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "assets", type: "uint256" },
      { name: "receiver", type: "address" },
      { name: "owner", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const mUsdcAbi = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "redeem",
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

    const [wmusdcBalance, depositedShares, depositedAssets] = await Promise.all(
      [
        publicClient.readContract({
          address: WM_USDC as `0x${string}`,
          abi: wmUsdcAbi,
          functionName: "balanceOf",
          args: [addr],
        }),
        publicClient.readContract({
          address: WM_USDC as `0x${string}`,
          abi: wmUsdcAbi,
          functionName: "userDepositedShares",
          args: [addr],
        }),
        publicClient.readContract({
          address: WM_USDC as `0x${string}`,
          abi: wmUsdcAbi,
          functionName: "userDepositedAssets",
          args: [addr],
        }),
      ],
    );

    console.log("--- DRAIN ---", {
      wmusdcBalance: wmusdcBalance.toString(),
      depositedShares: depositedShares.toString(),
      depositedAssets: depositedAssets.toString(),
    });

    if (wmusdcBalance === 0n)
      return NextResponse.json({ success: true, message: "Nothing to drain" });

    // withdraw(assets) uses userDepositedAssets for the check — safer path
    // assets = shares for WmUSDC (convertToAssets is 1:1)
    const withdrawData = encodeFunctionData({
      abi: wmUsdcAbi,
      functionName: "withdraw",
      args: [wmusdcBalance, addr, addr], // assets = balance (1:1 with shares)
    });
    const withdrawTx = await privyRpc(walletId, "eip155:84532", {
      to: WM_USDC,
      data: withdrawData,
      chain_id: 84532,
    });
    await publicClient.waitForTransactionReceipt({
      hash: withdrawTx.hash as `0x${string}`,
    });
    console.log("Drain withdraw hash:", withdrawTx.hash);

    // Redeem resulting mUSDC → back to USDC
    await new Promise((r) => setTimeout(r, 3000));
    const musdcBalance = await publicClient.readContract({
      address: MORPHO_USDC_VAULT as `0x${string}`,
      abi: mUsdcAbi,
      functionName: "balanceOf",
      args: [addr],
    });
    console.log("mUSDC balance after drain:", musdcBalance.toString());

    if (musdcBalance > 0n) {
      const redeemMusdcData = encodeFunctionData({
        abi: mUsdcAbi,
        functionName: "redeem",
        args: [musdcBalance, addr, addr],
      });
      const redeemMusdcTx = await privyRpc(walletId, "eip155:84532", {
        to: MORPHO_USDC_VAULT,
        data: redeemMusdcData,
        chain_id: 84532,
      });
      await publicClient.waitForTransactionReceipt({
        hash: redeemMusdcTx.hash as `0x${string}`,
      });
      console.log("Drain mUSDC redeem hash:", redeemMusdcTx.hash);
      return NextResponse.json({
        success: true,
        drainHash: withdrawTx.hash,
        mUsdcHash: redeemMusdcTx.hash,
      });
    }

    return NextResponse.json({ success: true, drainHash: withdrawTx.hash });
  } catch (e: any) {
    console.error("DRAIN ERROR:", e);
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}
