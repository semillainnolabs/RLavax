#!/bin/bash
# Run from: /c/projects/RMLoans/
# Usage: bash setup-server-signing.sh

echo "Creating server-signing files..."
 
# ─── privy-signer.ts ───────────────────────────────────────────────────────
cat > next-app/src/lib/privy-signer.ts << 'EOF'
// src/lib/privy-signer.ts
import canonicalize from "canonicalize";
import crypto from "crypto";

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID!;
const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET!;
const PRIVY_BASE_URL = "https://api.privy.io";

function getAuthorizationSignature({ url, body }: { url: string; body: object }): string {
  const payload = {
    version: 1,
    method: "POST",
    url,
    body,
    headers: { "privy-app-id": PRIVY_APP_ID },
  };
  const serializedPayload = canonicalize(payload) as string;
  const serializedPayloadBuffer = Buffer.from(serializedPayload);
  console.log("Canonicalized payload:", serializedPayload);

  const rawKey = (process.env.PRIVY_SIGNING_KEY ?? "").replace("wallet-auth:", "").trim();
  const privateKeyAsPem = `-----BEGIN PRIVATE KEY-----\n${rawKey}\n-----END PRIVATE KEY-----`;
  const privateKey = crypto.createPrivateKey({ key: privateKeyAsPem, format: "pem" });

  const signatureBuffer = crypto.sign("sha256", serializedPayloadBuffer, privateKey);
  const signature = signatureBuffer.toString("base64");
  console.log("Signature:", signature.slice(0, 30) + "...");
  return signature;
}

export async function privyRpc(
  walletId: string,
  caip2: string,
  transaction: { to: string; data?: string; value?: string; chain_id?: number }
): Promise<{ hash: string }> {
  const url = `${PRIVY_BASE_URL}/v1/wallets/${walletId}/rpc`;
  const body = { caip2, method: "eth_sendTransaction", params: { transaction } };
  const signature = getAuthorizationSignature({ url, body });

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "privy-app-id": PRIVY_APP_ID,
      "privy-authorization-signature": signature,
      Authorization: "Basic " + Buffer.from(`${PRIVY_APP_ID}:${PRIVY_APP_SECRET}`).toString("base64"),
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  console.log(`Privy RPC response ${response.status}:`, text);
  if (!response.ok) throw new Error(`Privy RPC error ${response.status}: ${text}`);

  const data = JSON.parse(text);
  return { hash: data?.data?.hash ?? data?.hash };
}
EOF

# ─── get-wallet-id ──────────────────────────────────────────────────────────
cat > next-app/src/app/api/get-wallet-id/route.ts << 'EOF'
// src/app/api/get-wallet-id/route.ts
import { NextResponse } from "next/server";

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID!;
const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET!;

export async function POST(req: Request) {
  try {
    const { userAddress } = await req.json();
    if (!userAddress)
      return NextResponse.json({ error: "Falta userAddress" }, { status: 400 });

    const response = await fetch("https://auth.privy.io/api/v1/wallets", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "privy-app-id": PRIVY_APP_ID,
        Authorization: "Basic " + Buffer.from(`${PRIVY_APP_ID}:${PRIVY_APP_SECRET}`).toString("base64"),
      },
    });

    const text = await response.text();
    if (!response.ok) {
      console.error("Privy wallets error:", text);
      return NextResponse.json({ error: "Failed to fetch wallets" }, { status: 500 });
    }

    const data = JSON.parse(text);
    const wallets = data?.data ?? data?.wallets ?? [];
    const match = wallets.find((w: any) => w.address?.toLowerCase() === userAddress.toLowerCase());

    if (!match) return NextResponse.json({ error: "Wallet not found" }, { status: 404 });
    return NextResponse.json({ walletId: match.id });
  } catch (e: any) {
    console.error("GET WALLET ID ERROR:", e);
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}
EOF

# ─── lend ───────────────────────────────────────────────────────────────────
cat > next-app/src/app/api/lend/route.ts << 'EOF'
// src/app/api/lend/route.ts
import { NextResponse } from "next/server";
import { encodeFunctionData, parseUnits, createPublicClient, getAddress, http, maxUint256 } from "viem";
import { baseSepolia } from "viem/chains";
import { privyRpc } from "@/lib/privy-signer";

const publicClient = createPublicClient({ chain: baseSepolia, transport: http() });
const USDC = "0xba50cd2a20f6da35d788639e581bca8d0b5d4d5f";
const MORPHO_USDC_VAULT = "0xA694354Ab641DFB8C6fC47Ceb9223D12cCC373f9";

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
EOF

# ─── wrap ───────────────────────────────────────────────────────────────────
cat > next-app/src/app/api/wrap/route.ts << 'EOF'
// src/app/api/wrap/route.ts
import { NextResponse } from "next/server";
import { encodeFunctionData, createPublicClient, getAddress, http } from "viem";
import { baseSepolia } from "viem/chains";
import { privyRpc } from "@/lib/privy-signer";

const publicClient = createPublicClient({ chain: baseSepolia, transport: http() });
const MORPHO_USDC_VAULT = "0xA694354Ab641DFB8C6fC47Ceb9223D12cCC373f9";
const WM_USDC = "0xBDc7fCDAC92DEe5220215aB6a0f5E1B20A665CD4";

const vaultAbi = [{ name: "approve", type: "function", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "", type: "bool" }] }] as const;
const wmUsdcAbi = [{ name: "deposit", type: "function", stateMutability: "nonpayable", inputs: [{ name: "assets", type: "uint256" }, { name: "receiver", type: "address" }], outputs: [{ name: "", type: "uint256" }] }] as const;

export async function POST(req: Request) {
  try {
    const { walletId, userAddress, musdcAmount } = await req.json();
    if (!walletId || !userAddress || !musdcAmount)
      return NextResponse.json({ error: "Faltan datos" }, { status: 400 });

    const addr = getAddress(userAddress.toLowerCase()) as `0x${string}`;
    const amount = BigInt(musdcAmount);
    console.log("--- WRAP ---", { walletId, addr, amount: amount.toString() });

    const approveData = encodeFunctionData({ abi: vaultAbi, functionName: "approve", args: [WM_USDC as `0x${string}`, amount] });
    const approveTx = await privyRpc(walletId, "eip155:84532", { to: MORPHO_USDC_VAULT, data: approveData, chain_id: 84532 });
    await publicClient.waitForTransactionReceipt({ hash: approveTx.hash as `0x${string}` });

    const wrapData = encodeFunctionData({ abi: wmUsdcAbi, functionName: "deposit", args: [amount, addr] });
    const wrapTx = await privyRpc(walletId, "eip155:84532", { to: WM_USDC, data: wrapData, chain_id: 84532 });
    await publicClient.waitForTransactionReceipt({ hash: wrapTx.hash as `0x${string}` });

    return NextResponse.json({ success: true, approveHash: approveTx.hash, wrapHash: wrapTx.hash });
  } catch (e: any) {
    console.error("WRAP ERROR:", e);
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}
EOF

# ─── supply-collateral ───────────────────────────────────────────────────────
cat > next-app/src/app/api/supply-collateral/route.ts << 'EOF'
// src/app/api/supply-collateral/route.ts
import { NextResponse } from "next/server";
import { encodeFunctionData, parseEther, createPublicClient, getAddress, http } from "viem";
import { baseSepolia } from "viem/chains";
import { privyRpc } from "@/lib/privy-signer";

const publicClient = createPublicClient({ chain: baseSepolia, transport: http() });
const WM_USDC = "0xBDc7fCDAC92DEe5220215aB6a0f5E1B20A665CD4";
const MORPHO_BLUE = "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb";
const MXNB = "0xF19D2F986DC0fb7E2A82cb9b55f7676967F7bC3E";
const ORACLE = "0x9f4b138BF3513866153Af9f0A2794096DFebFaD4";
const IRM = "0x46415998764C29aB2a25CbeA6254146D50D22687";
const LLTV = parseEther("0.77");
const MARKET = { loanToken: MXNB as `0x${string}`, collateralToken: WM_USDC as `0x${string}`, oracle: ORACLE as `0x${string}`, irm: IRM as `0x${string}`, lltv: LLTV };

const erc20Abi = [{ name: "approve", type: "function", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "", type: "bool" }] }] as const;
const morphoAbi = [{ name: "supplyCollateral", type: "function", stateMutability: "nonpayable", inputs: [{ name: "marketParams", type: "tuple", components: [{ name: "loanToken", type: "address" }, { name: "collateralToken", type: "address" }, { name: "oracle", type: "address" }, { name: "irm", type: "address" }, { name: "lltv", type: "uint256" }] }, { name: "assets", type: "uint256" }, { name: "onBehalf", type: "address" }, { name: "data", type: "bytes" }], outputs: [] }] as const;

export async function POST(req: Request) {
  try {
    const { walletId, userAddress, wmusdcAmount } = await req.json();
    if (!walletId || !userAddress || !wmusdcAmount)
      return NextResponse.json({ error: "Faltan datos" }, { status: 400 });

    const addr = getAddress(userAddress.toLowerCase()) as `0x${string}`;
    const amount = BigInt(wmusdcAmount);
    console.log("--- SUPPLY COLLATERAL ---", { walletId, addr, amount: amount.toString() });

    const approveData = encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [MORPHO_BLUE as `0x${string}`, amount] });
    const approveTx = await privyRpc(walletId, "eip155:84532", { to: WM_USDC, data: approveData, chain_id: 84532 });
    await publicClient.waitForTransactionReceipt({ hash: approveTx.hash as `0x${string}` });

    const supplyData = encodeFunctionData({ abi: morphoAbi, functionName: "supplyCollateral", args: [MARKET, amount, addr, "0x"] });
    const supplyTx = await privyRpc(walletId, "eip155:84532", { to: MORPHO_BLUE, data: supplyData, chain_id: 84532 });
    await publicClient.waitForTransactionReceipt({ hash: supplyTx.hash as `0x${string}` });

    return NextResponse.json({ success: true, approveHash: approveTx.hash, supplyHash: supplyTx.hash });
  } catch (e: any) {
    console.error("SUPPLY COLLATERAL ERROR:", e);
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}
EOF

# ─── borrow ──────────────────────────────────────────────────────────────────
cat > next-app/src/app/api/borrow/route.ts << 'EOF'
// src/app/api/borrow/route.ts
import { NextResponse } from "next/server";
import { encodeFunctionData, parseUnits, parseEther, createPublicClient, getAddress, http } from "viem";
import { baseSepolia } from "viem/chains";
import { privyRpc } from "@/lib/privy-signer";

const publicClient = createPublicClient({ chain: baseSepolia, transport: http() });
const WM_USDC = "0xBDc7fCDAC92DEe5220215aB6a0f5E1B20A665CD4";
const MORPHO_BLUE = "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb";
const MXNB = "0xF19D2F986DC0fb7E2A82cb9b55f7676967F7bC3E";
const ORACLE = "0x9f4b138BF3513866153Af9f0A2794096DFebFaD4";
const IRM = "0x46415998764C29aB2a25CbeA6254146D50D22687";
const LLTV = parseEther("0.77");
const MARKET = { loanToken: MXNB as `0x${string}`, collateralToken: WM_USDC as `0x${string}`, oracle: ORACLE as `0x${string}`, irm: IRM as `0x${string}`, lltv: LLTV };

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
EOF

# ─── repay ───────────────────────────────────────────────────────────────────
cat > next-app/src/app/api/repay/route.ts << 'EOF'
// src/app/api/repay/route.ts
import { NextResponse } from "next/server";
import { encodeFunctionData, parseEther, createPublicClient, getAddress, http, maxUint256 } from "viem";
import { baseSepolia } from "viem/chains";
import { privyRpc } from "@/lib/privy-signer";

const publicClient = createPublicClient({ chain: baseSepolia, transport: http() });
const WM_USDC = "0xBDc7fCDAC92DEe5220215aB6a0f5E1B20A665CD4";
const MORPHO_BLUE = "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb";
const MXNB = "0xF19D2F986DC0fb7E2A82cb9b55f7676967F7bC3E";
const ORACLE = "0x9f4b138BF3513866153Af9f0A2794096DFebFaD4";
const IRM = "0x46415998764C29aB2a25CbeA6254146D50D22687";
const LLTV = parseEther("0.77");
const MARKET = { loanToken: MXNB as `0x${string}`, collateralToken: WM_USDC as `0x${string}`, oracle: ORACLE as `0x${string}`, irm: IRM as `0x${string}`, lltv: LLTV };

const erc20Abi = [{ name: "approve", type: "function", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "", type: "bool" }] }] as const;
const morphoAbi = [{ name: "repay", type: "function", stateMutability: "nonpayable", inputs: [{ name: "marketParams", type: "tuple", components: [{ name: "loanToken", type: "address" }, { name: "collateralToken", type: "address" }, { name: "oracle", type: "address" }, { name: "irm", type: "address" }, { name: "lltv", type: "uint256" }] }, { name: "assets", type: "uint256" }, { name: "shares", type: "uint256" }, { name: "onBehalf", type: "address" }, { name: "data", type: "bytes" }], outputs: [{ name: "", type: "uint256" }, { name: "", type: "uint256" }] }] as const;

export async function POST(req: Request) {
  try {
    const { walletId, userAddress, borrowShares } = await req.json();
    if (!walletId || !userAddress || !borrowShares)
      return NextResponse.json({ error: "Faltan datos" }, { status: 400 });

    const addr = getAddress(userAddress.toLowerCase()) as `0x${string}`;
    const shares = BigInt(borrowShares);
    console.log("--- REPAY ---", { walletId, addr, shares: shares.toString() });

    // 1. Approve MXNB → Morpho Blue (max)
    const approveData = encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [MORPHO_BLUE as `0x${string}`, maxUint256] });
    const approveTx = await privyRpc(walletId, "eip155:84532", { to: MXNB, data: approveData, chain_id: 84532 });
    await publicClient.waitForTransactionReceipt({ hash: approveTx.hash as `0x${string}` });
    await new Promise(r => setTimeout(r, 3000));

    // 2. Repay with exact shares — closes position completely without dust
    const repayData = encodeFunctionData({ abi: morphoAbi, functionName: "repay", args: [MARKET, BigInt(0), shares, addr, "0x"] });
    const repayTx = await privyRpc(walletId, "eip155:84532", { to: MORPHO_BLUE, data: repayData, chain_id: 84532 });
    await publicClient.waitForTransactionReceipt({ hash: repayTx.hash as `0x${string}` });

    return NextResponse.json({ success: true, approveHash: approveTx.hash, repayHash: repayTx.hash });
  } catch (e: any) {
    console.error("REPAY ERROR:", e);
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}
EOF

# ─── withdraw-collateral ─────────────────────────────────────────────────────
cat > next-app/src/app/api/withdraw-collateral/route.ts << 'EOF'
// src/app/api/withdraw-collateral/route.ts
import { NextResponse } from "next/server";
import { encodeFunctionData, parseEther, createPublicClient, getAddress, http } from "viem";
import { baseSepolia } from "viem/chains";
import { privyRpc } from "@/lib/privy-signer";

const publicClient = createPublicClient({ chain: baseSepolia, transport: http() });
const WM_USDC = "0xBDc7fCDAC92DEe5220215aB6a0f5E1B20A665CD4";
const MORPHO_BLUE = "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb";
const MXNB = "0xF19D2F986DC0fb7E2A82cb9b55f7676967F7bC3E";
const ORACLE = "0x9f4b138BF3513866153Af9f0A2794096DFebFaD4";
const IRM = "0x46415998764C29aB2a25CbeA6254146D50D22687";
const LLTV = parseEther("0.77");
const MARKET = { loanToken: MXNB as `0x${string}`, collateralToken: WM_USDC as `0x${string}`, oracle: ORACLE as `0x${string}`, irm: IRM as `0x${string}`, lltv: LLTV };

const morphoAbi = [{ name: "withdrawCollateral", type: "function", stateMutability: "nonpayable", inputs: [{ name: "marketParams", type: "tuple", components: [{ name: "loanToken", type: "address" }, { name: "collateralToken", type: "address" }, { name: "oracle", type: "address" }, { name: "irm", type: "address" }, { name: "lltv", type: "uint256" }] }, { name: "assets", type: "uint256" }, { name: "onBehalf", type: "address" }, { name: "receiver", type: "address" }], outputs: [] }] as const;

export async function POST(req: Request) {
  try {
    const { walletId, userAddress, collateralAmount } = await req.json();
    if (!walletId || !userAddress || !collateralAmount)
      return NextResponse.json({ error: "Faltan datos" }, { status: 400 });

    const addr = getAddress(userAddress.toLowerCase()) as `0x${string}`;
    const amount = BigInt(collateralAmount);
    console.log("--- WITHDRAW COLLATERAL ---", { walletId, addr, amount: amount.toString() });

    const withdrawData = encodeFunctionData({ abi: morphoAbi, functionName: "withdrawCollateral", args: [MARKET, amount, addr, addr] });
    const withdrawTx = await privyRpc(walletId, "eip155:84532", { to: MORPHO_BLUE, data: withdrawData, chain_id: 84532 });
    await publicClient.waitForTransactionReceipt({ hash: withdrawTx.hash as `0x${string}` });

    return NextResponse.json({ success: true, withdrawHash: withdrawTx.hash });
  } catch (e: any) {
    console.error("WITHDRAW COLLATERAL ERROR:", e);
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}
EOF

# ─── unwrap ──────────────────────────────────────────────────────────────────
cat > next-app/src/app/api/unwrap/route.ts << 'EOF'
// src/app/api/unwrap/route.ts
import { NextResponse } from "next/server";
import { encodeFunctionData, createPublicClient, getAddress, http } from "viem";
import { baseSepolia } from "viem/chains";
import { privyRpc } from "@/lib/privy-signer";

const publicClient = createPublicClient({ chain: baseSepolia, transport: http() });
const WM_USDC = "0xBDc7fCDAC92DEe5220215aB6a0f5E1B20A665CD4";

const wmUsdcAbi = [{ name: "redeemWithInterestSubsidy", type: "function", stateMutability: "nonpayable", inputs: [{ name: "shares", type: "uint256" }, { name: "receiver", type: "address" }, { name: "owner", type: "address" }], outputs: [{ name: "", type: "uint256" }] }] as const;

export async function POST(req: Request) {
  try {
    const { walletId, userAddress, wmusdcAmount } = await req.json();
    if (!walletId || !userAddress || !wmusdcAmount)
      return NextResponse.json({ error: "Faltan datos" }, { status: 400 });

    const addr = getAddress(userAddress.toLowerCase()) as `0x${string}`;
    const amount = BigInt(wmusdcAmount);
    console.log("--- UNWRAP ---", { walletId, addr, amount: amount.toString() });

    const unwrapData = encodeFunctionData({ abi: wmUsdcAbi, functionName: "redeemWithInterestSubsidy", args: [amount, addr, addr] });
    const unwrapTx = await privyRpc(walletId, "eip155:84532", { to: WM_USDC, data: unwrapData, chain_id: 84532 });
    await publicClient.waitForTransactionReceipt({ hash: unwrapTx.hash as `0x${string}` });

    return NextResponse.json({ success: true, unwrapHash: unwrapTx.hash });
  } catch (e: any) {
    console.error("UNWRAP ERROR:", e);
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}
EOF

# ─── withdraw-vault ───────────────────────────────────────────────────────────
cat > next-app/src/app/api/withdraw-vault/route.ts << 'EOF'
// src/app/api/withdraw-vault/route.ts
import { NextResponse } from "next/server";
import { encodeFunctionData, createPublicClient, getAddress, http } from "viem";
import { baseSepolia } from "viem/chains";
import { privyRpc } from "@/lib/privy-signer";

const publicClient = createPublicClient({ chain: baseSepolia, transport: http() });
const MORPHO_USDC_VAULT = "0xA694354Ab641DFB8C6fC47Ceb9223D12cCC373f9";

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
EOF

# ─── lend-mxnb ───────────────────────────────────────────────────────────────
cat > next-app/src/app/api/lend-mxnb/route.ts << 'EOF'
// src/app/api/lend-mxnb/route.ts
import { NextResponse } from "next/server";
import { encodeFunctionData, parseUnits, createPublicClient, getAddress, http, maxUint256 } from "viem";
import { baseSepolia } from "viem/chains";
import { privyRpc } from "@/lib/privy-signer";

const publicClient = createPublicClient({ chain: baseSepolia, transport: http() });
const MXNB = "0xF19D2F986DC0fb7E2A82cb9b55f7676967F7bC3E";
const MXNB_VAULT = "0x3F8FAB03021738f227e3Ad76da51f57522540d30";

const erc20Abi = [{ name: "approve", type: "function", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "", type: "bool" }] }] as const;
const vaultAbi = [{ name: "deposit", type: "function", stateMutability: "nonpayable", inputs: [{ name: "assets", type: "uint256" }, { name: "receiver", type: "address" }], outputs: [{ name: "", type: "uint256" }] }] as const;

export async function POST(req: Request) {
  try {
    const { walletId, userAddress, amount } = await req.json();
    if (!walletId || !userAddress || !amount)
      return NextResponse.json({ error: "Faltan datos" }, { status: 400 });

    const addr = getAddress(userAddress.toLowerCase()) as `0x${string}`;
    const depositAmount = parseUnits(amount, 6);
    console.log("--- LEND MXNB ---", { walletId, addr, amount });

    const approveData = encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [MXNB_VAULT as `0x${string}`, maxUint256] });
    const approveTx = await privyRpc(walletId, "eip155:84532", { to: MXNB, data: approveData, chain_id: 84532 });
    await publicClient.waitForTransactionReceipt({ hash: approveTx.hash as `0x${string}` });
    await new Promise(r => setTimeout(r, 3000));

    const depositData = encodeFunctionData({ abi: vaultAbi, functionName: "deposit", args: [depositAmount, addr] });
    const depositTx = await privyRpc(walletId, "eip155:84532", { to: MXNB_VAULT, data: depositData, chain_id: 84532 });
    await publicClient.waitForTransactionReceipt({ hash: depositTx.hash as `0x${string}` });

    return NextResponse.json({ success: true, approveHash: approveTx.hash, depositHash: depositTx.hash });
  } catch (e: any) {
    console.error("LEND MXNB ERROR:", e);
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}
EOF

# ─── withdraw-mxnb ────────────────────────────────────────────────────────────
cat > next-app/src/app/api/withdraw-mxnb/route.ts << 'EOF'
// src/app/api/withdraw-mxnb/route.ts
import { NextResponse } from "next/server";
import { encodeFunctionData, createPublicClient, getAddress, http } from "viem";
import { baseSepolia } from "viem/chains";
import { privyRpc } from "@/lib/privy-signer";

const publicClient = createPublicClient({ chain: baseSepolia, transport: http() });
const MXNB_VAULT = "0x3F8FAB03021738f227e3Ad76da51f57522540d30";

const vaultAbi = [{ name: "redeem", type: "function", stateMutability: "nonpayable", inputs: [{ name: "shares", type: "uint256" }, { name: "receiver", type: "address" }, { name: "owner", type: "address" }], outputs: [{ name: "", type: "uint256" }] }] as const;

export async function POST(req: Request) {
  try {
    const { walletId, userAddress, musdcShares } = await req.json();
    if (!walletId || !userAddress || !musdcShares)
      return NextResponse.json({ error: "Faltan datos" }, { status: 400 });

    const addr = getAddress(userAddress.toLowerCase()) as `0x${string}`;
    const shares = BigInt(musdcShares);
    console.log("--- WITHDRAW MXNB ---", { walletId, addr, shares: shares.toString() });

    const redeemData = encodeFunctionData({ abi: vaultAbi, functionName: "redeem", args: [shares, addr, addr] });
    const redeemTx = await privyRpc(walletId, "eip155:84532", { to: MXNB_VAULT, data: redeemData, chain_id: 84532 });
    await publicClient.waitForTransactionReceipt({ hash: redeemTx.hash as `0x${string}` });

    return NextResponse.json({ success: true, redeemHash: redeemTx.hash });
  } catch (e: any) {
    console.error("WITHDRAW MXNB ERROR:", e);
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}
EOF

# ─── useWalletId.ts ───────────────────────────────────────────────────────────
cat > next-app/src/hooks/useWalletId.ts << 'EOF'
// src/hooks/useWalletId.ts
import { useState, useEffect } from "react";
import { useWallets } from "@privy-io/react-auth";

export const useWalletId = () => {
  const { wallets } = useWallets();
  const [walletId, setWalletId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchWalletId = async () => {
      const address = wallets[0]?.address;
      if (!address) return;

      setLoading(true);
      try {
        const res = await fetch("/api/get-wallet-id", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userAddress: address }),
        });
        const data = await res.json();
        if (res.ok && data.walletId) setWalletId(data.walletId);
      } catch (err) {
        console.error("Error fetching walletId:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchWalletId();
  }, [wallets]);

  return { walletId, loading };
};
EOF

echo ""
echo "✅ All files created successfully!"
echo ""
echo "Files created:"
echo "  next-app/src/lib/privy-signer.ts"
echo "  next-app/src/app/api/get-wallet-id/route.ts"
echo "  next-app/src/app/api/lend/route.ts"
echo "  next-app/src/app/api/wrap/route.ts"
echo "  next-app/src/app/api/supply-collateral/route.ts"
echo "  next-app/src/app/api/borrow/route.ts"
echo "  next-app/src/app/api/repay/route.ts"
echo "  next-app/src/app/api/withdraw-collateral/route.ts"
echo "  next-app/src/app/api/unwrap/route.ts"
echo "  next-app/src/app/api/withdraw-vault/route.ts"
echo "  next-app/src/app/api/lend-mxnb/route.ts"
echo "  next-app/src/app/api/withdraw-mxnb/route.ts"
echo "  next-app/src/hooks/useWalletId.ts"
echo ""
echo "Next steps:"
echo "  1. Run: cd next-app && npm install canonicalize"
echo "  2. Modify useMorphoLoan.ts and useMorphoLend.ts (coming next)"
echo "  3. Update providers.tsx with AutoSigner"
