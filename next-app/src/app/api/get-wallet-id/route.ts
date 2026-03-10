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
