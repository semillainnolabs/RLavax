"use client";

import { useMorphoLoan } from "../../hooks/useMorphoLoan";
import BalanceCard from "../../components/BalanceCard";
import { usePrivy } from "@privy-io/react-auth";
import Button from "../../components/Button";
import { FullScreenLoader } from "@/components/ui/fullscreen-loader";
import { SendModal, ReceiveModal } from "../../components/Modal";
import { useState } from "react";

export default function Page() {
    const { ready, authenticated, login } = usePrivy();
    const { usdcBalance, mxnbBalance, refreshData } = useMorphoLoan();

    // Modals state
    const [isSendOpen, setIsSendOpen] = useState(false);
    const [isReceiveOpen, setIsReceiveOpen] = useState(false);
    const [selectedCurrency, setSelectedCurrency] = useState<"USDC" | "MXNB">("USDC");
    const [selectedBalance, setSelectedBalance] = useState("0");

    const openSend = (currency: "USDC" | "MXNB", balance: string) => {
        setSelectedCurrency(currency);
        setSelectedBalance(balance);
        setIsSendOpen(true);
    };

    const openReceive = (currency: "USDC" | "MXNB") => {
        setSelectedCurrency(currency);
        setIsReceiveOpen(true);
    };

    if (!ready) {
        return (
            <section className="flex items-center justify-center h-screen -mt-24">
                <FullScreenLoader />
            </section>
        );
    }

    return (
        <main>
            <div className="relative z-20 flex flex-col items-center gap-8 w-full py-18 mt-5 sm:mt-0 sm:py-5 px-4">
                <div className="text-center space-y-4">
                    <h1 className="text-5xl text-white font-bold tracking-tighter">
                        Manage your assets
                    </h1>
                    <p className="text-gray-200 max-w-lg mx-auto text-lg">
                        {authenticated ? "You remain in control of your funds" : "Connect your wallet to manage your loans and liquidity."}
                    </p>
                </div>

                {!authenticated ? (
                    <div className="w-full max-w-md mt-4">
                        <Button onClick={login}>
                            Connect Wallet
                        </Button>
                    </div>
                ) : (
                    <>
                        <div className="flex flex-col md:flex-row gap-6 w-full max-w-4xl justify-center items-stretch mt-8">
                            <BalanceCard
                                currency="USDC"
                                balance={usdcBalance}
                                onSend={() => openSend("USDC", usdcBalance)}
                                onReceive={() => openReceive("USDC")}
                            />
                            <BalanceCard
                                currency="MXNB"
                                balance={mxnbBalance}
                                onSend={() => openSend("MXNB", mxnbBalance)}
                                onReceive={() => openReceive("MXNB")}
                            />
                        </div>

                        {/* Modals */}
                        <SendModal
                            isOpen={isSendOpen}
                            onClose={() => setIsSendOpen(false)}
                            currency={selectedCurrency}
                            balance={selectedBalance}
                            onSuccess={refreshData}
                        />
                        <ReceiveModal
                            isOpen={isReceiveOpen}
                            onClose={() => setIsReceiveOpen(false)}
                            currency={selectedCurrency}
                        />
                    </>
                )}
            </div>
        </main>
    );
}