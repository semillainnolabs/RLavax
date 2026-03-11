// src/app/api/wrap/route.ts
import { NextResponse } from "next/server";
import {
  encodeFunctionData,
  createPublicClient,
  getAddress,
  http,
  maxUint256,
  erc20Abi,
} from "viem";
import { baseSepolia } from "viem/chains";
import { privyRpc } from "@/lib/privy-signer";
import { CONTRACT_ADDRESSES } from "@/constants/contracts";

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(),
});

const A_USDC = CONTRACT_ADDRESSES.aUSDC as `0x${string}`;
const WM_USDC = CONTRACT_ADDRESSES.waUSDC as `0x${string}`;

const wmUsdcAbi = [
  {
    name: "deposit",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "assets", type: "uint256" },
      { name: "receiver", type: "address" },
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
    console.log("--- WRAP ---", { walletId, addr });

    // 1. Obtención de balance REAL desde el nodo 
    console.log("Obteniendo balance real del usuario de aUSDC...");
    let amount = await publicClient.readContract({
      address: A_USDC,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [addr],
    });

    if (amount === 0n) {
      console.log("Balance inicial es 0, realizando polling breve para dar tiempo al indexador...");
      for (let i = 0; i < 5; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        amount = await publicClient.readContract({
          address: A_USDC,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [addr],
        });
        if (amount > 0n) break;
        console.log(`Intento ${i + 1}: Balance sigue en 0...`);
      }
    }

    if (amount === 0n) {
      throw new Error("No aUSDC balance found to wrap after polling");
    }

    console.log(`Balance real detectado a wrap: ${amount.toString()}`);

    // 2. Check Allowance & Approve
    console.log("Checking allowance...");
    const currentAllowance = await publicClient.readContract({
      address: A_USDC,
      abi: erc20Abi,
      functionName: "allowance",
      args: [addr, WM_USDC],
    });

    let approveHash = undefined;

    if (currentAllowance >= amount) {
      console.log("Allowance already sufficient. Skipping approve step.");
    } else {
      console.log("Allowance insufficient. Approving con maxUint256...");
      const approveData = encodeFunctionData({
        abi: erc20Abi,
        functionName: "approve",
        args: [WM_USDC, maxUint256],
      });

      const approveTx = await privyRpc(walletId, "eip155:84532", {
        to: A_USDC,
        data: approveData,
        chain_id: 84532,
      });

      await publicClient.waitForTransactionReceipt({
        hash: approveTx.hash as `0x${string}`,
      });
      approveHash = approveTx.hash;
      console.log("Wrap approve hash:", approveHash);

      console.log("Esperando propagación del allowance en el indexador...");
      await new Promise((r) => setTimeout(r, 2000));
    }

    // Grace Period para los nodos de Privy 
    console.log("Iniciando Grace Period antes de WRAP para que los nodos de Privy sincronicen...");
    await new Promise((r) => setTimeout(r, 3000));

    // 3. Wrap aUSDC → waUSDC con Privy-Level Retry y Refresh de Balance
    console.log(`Executing Wrap for amount: ${amount}`);
    let wrapData = encodeFunctionData({
      abi: wmUsdcAbi,
      functionName: "deposit",
      args: [amount, addr],
    });

    let wrapTx;
    try {
      wrapTx = await privyRpc(walletId, "eip155:84532", {
        to: WM_USDC,
        data: wrapData,
        chain_id: 84532,
      });
    } catch (e: any) {
      console.warn("Privy simulation falló (underflow/simulation failure). Aplicando lógica de reintento.", e?.message);

      console.log("a) Esperando 4 segundos...");
      await new Promise((r) => setTimeout(r, 4000));

      console.log("b) Consultando de balance nuevamente...");
      const newBalance = await publicClient.readContract({
        address: A_USDC,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [addr],
      });
      console.log(`Nuevo balance detectado: ${newBalance.toString()}`);

      if (newBalance > 0n) {
        console.log("c) Retentando la transacción de Wrap con el balance fresco...");
        amount = newBalance;
        wrapData = encodeFunctionData({
          abi: wmUsdcAbi,
          functionName: "deposit",
          args: [amount, addr],
        });

        wrapTx = await privyRpc(walletId, "eip155:84532", {
          to: WM_USDC,
          data: wrapData,
          chain_id: 84532,
        });
      } else {
        throw new Error("El balance sigue siendo 0 después de la resincronización. Abortando WRAP.");
      }
    }

    await publicClient.waitForTransactionReceipt({
      hash: wrapTx.hash as `0x${string}`,
    });
    console.log("Wrap hash:", wrapTx.hash);

    return NextResponse.json({
      success: true,
      approveHash: approveHash,
      wrapHash: wrapTx.hash,
    });
  } catch (e: any) {
    console.error("WRAP ERROR:", e);
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}

