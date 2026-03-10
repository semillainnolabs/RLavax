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
