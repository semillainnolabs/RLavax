import React from "react";
import Button from "./Button";
import Image from "next/image";
import { ChartBarIcon } from "@heroicons/react/16/solid";

interface BalanceCardProps {
    currency: "USDC" | "MXNB";
    balance: string;
    onSend?: () => void;
    onReceive?: () => void;
}

export default function BalanceCard({
    currency,
    balance,
    onSend,
    onReceive
}: BalanceCardProps) {
    const isUSDC = currency === "USDC";

    return (
        <div className="w-full max-w-md mx-auto p-1">
            <div className="relative overflow-hidden rounded-2xl bg-[#0a0a0a] border border-[#264c73] shadow-2xl backdrop-blur-xl h-full">
                {/* Header Background Gradient */}
                <div className="absolute top-0 left-0 w-full h-32 pointer-events-none" />

                <div className="relative p-6 sm:p-8 flex flex-col h-full">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h2 className="text-2xl w-fit mb-2 border-b-4 border-[#264c73] font-bold text-white uppercase">
                                {currency}
                            </h2>
                            <p className="text-sm font-bold text-[#4fe3c3] mt-1">Wallet Balance</p>
                        </div>
                        {isUSDC ? <Image src="/eeuuFlag.jpg" className="rounded" alt="USDC" width={50} height={50} /> : <Image src="/mexicanFlag.webp" className="rounded" alt="MXNB" width={50} height={50} />}
                    </div>
                    <div className="flex-1 flex flex-col justify-center items-center py-6">
                        <div className="text-5xl font-mono text-white mb-2">{balance}</div>
                        <div className="text-sm text-gray-200 uppercase tracking-wider">{currency}</div>
                    </div>

                    <div className="flex gap-3 mt-8">
                        <Button onClick={onSend} className="flex-1">
                            Send
                        </Button>
                        <Button isWithdraw onClick={onReceive} className="flex-1">
                            Receive
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}