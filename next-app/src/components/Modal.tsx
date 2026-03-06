"use client";

import React, { useEffect, useState } from "react";
import { XMarkIcon, DocumentDuplicateIcon, InformationCircleIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import Button from "./Button";
import Input from "./Input";
import { usePrivy } from "@privy-io/react-auth";
import { useTokenTransfer } from "../hooks/useTokenTransfer";
import Link from "next/link";

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    subtitle?: string;
    children: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, subtitle, children }: ModalProps) {
    // Escape key listener to close
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        if (isOpen) {
            window.addEventListener("keydown", handleKeyDown);
        }
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
            {/* Background overlay */}
            <div className="absolute inset-0" />

            <div className="relative w-full max-w-md bg-[#0a0a0a] border border-[#264c73] rounded-2xl shadow-2xl p-6 sm:p-8 animate-in fade-in zoom-in-95 duration-200">
                <button onClick={onClose} className="absolute top-6 right-6 z-10 text-gray-400 cursor-pointer hover:text-white transition-colors">
                    <XMarkIcon className="w-6 h-6" />
                </button>
                <div className="mb-6 mt-3">
                    <h3 className="text-xl w-fit mb-2 border-b-4 border-[#264c73] font-bold text-white uppercase">{title}</h3>
                    {subtitle && <p className="text-sm font-bold text-[#4fe3c3] mt-1">{subtitle}</p>}
                </div>
                {children}
            </div>
        </div>
    );
}

interface SendModalProps {
    isOpen: boolean;
    onClose: () => void;
    currency: "USDC" | "MXNB";
    balance: string;
    onSuccess?: () => void;
}

export function SendModal({ isOpen, onClose, currency, balance, onSuccess }: SendModalProps) {
    const [amount, setAmount] = useState("");
    const [address, setAddress] = useState("");
    const { execute, isLoading, error, txHash, resetState } = useTokenTransfer();

    const isExceedingBalance = amount ? parseFloat(amount) > parseFloat(balance || "0") : false;
    const isValid = amount && parseFloat(amount) > 0 && !isExceedingBalance && address.trim().length > 0;

    // Reset fields when closing the modal
    useEffect(() => {
        if (!isOpen) {
            setAmount("");
            setAddress("");
            resetState();
        }
    }, [isOpen]);

    const handleSend = async () => {
        if (!isValid) return;
        await execute(currency, amount, address);
        if (onSuccess) {
            onSuccess();
        }
    };

    const handleDone = () => {
        resetState();
        onClose();
    };

    if (txHash && !isLoading) {
        return (
            <Modal isOpen={isOpen} onClose={handleDone} title="Transfer Successful" subtitle="Your funds have been sent">
                <div className="space-y-6 mt-8">
                    <div className="flex justify-center mb-2">
                        <CheckCircleIcon className="w-20 h-20 text-[#4fe3c3]" />
                    </div>
                    <div className="text-center mb-8 space-y-2">
                        <div className="text-5xl border-b-4 w-fit mx-auto border-[#264c73] font-bold text-white">
                            {amount} <span className="text-[#4fe3c3]">{currency}</span>
                        </div>
                        <p className="text-sm text-gray-400">
                            Sent to: <span className="font-mono text-white">{address.substring(0, 6)}...{address.substring(address.length - 4)}</span>
                        </p>
                    </div>

                    <Link href={`https://sepolia.basescan.org/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className=" border hover:bg-gray-950 transition-colors cursor-pointer border-[#264c73] rounded-xl p-4 flex flex-col items-center gap-2">
                        <span className="text-xs text-gray-100 font-bold uppercase tracking-wider">Transaction Hash</span>
                        <p
                            className="text-sm font-mono text-[#4fe3c3] hover:underline break-all text-center"
                        >
                            {txHash}
                        </p>
                    </Link>

                    <Button onClick={handleDone} className="w-full">
                        Done
                    </Button>
                </div>
            </Modal>
        );
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Send ${currency}`} subtitle="Transfer funds securely">
            <div className="space-y-6 mt-2">
                <div className="text-sm">
                    <Input
                        label="Amount to send"
                        symbol={currency}
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        onMaxClick={() => setAmount(balance)}
                        placeholder="0.00"
                        errorMessage={isExceedingBalance ? "Amount exceeds available balance" : null}
                        disabled={isLoading}
                    />
                    <div className="text-right text-xs text-gray-400 mt-2">
                        Available Balance: <span className="text-white font-mono">{balance} {currency}</span>
                    </div>
                </div>
                <div>
                    <Input
                        type="text"
                        label="Recipient wallet address"
                        symbol=""
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="0x..."
                        disabled={isLoading}
                    />
                </div>
                {error && (
                    <div className="p-3 bg-red-900/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
                        {error}
                    </div>
                )}
                <Button disabled={!isValid || isLoading} onClick={handleSend} className="w-full">
                    {isLoading ? "Sending..." : "Confirm Send"}
                </Button>
            </div>
        </Modal>
    );
}

interface ReceiveModalProps {
    isOpen: boolean;
    onClose: () => void;
    currency: "USDC" | "MXNB";
}

export function ReceiveModal({ isOpen, onClose, currency }: ReceiveModalProps) {
    const { user } = usePrivy();
    const [copied, setCopied] = useState(false);

    const walletAddress = user?.wallet?.address || "";

    const handleCopy = () => {
        if (!walletAddress) return;
        navigator.clipboard.writeText(walletAddress);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Receive ${currency}`} subtitle="Deposit funds to your wallet">
            <div className="space-y-6">
                <div className="text-sm text-gray-200 border border-[#264c73] p-5 rounded-xl">
                    <p className="font-semibold text-white mb-3 flex items-center gap-2">
                        <InformationCircleIcon className="w-5 h-5 text-[#4fe3c3]" />
                        How to receive {currency}
                    </p>
                    <ol className="list-decimal space-y-3 pl-5 text-gray-300">
                        <li>Copy your wallet address below.</li>
                        <li>Open your preferred exchange app (e.g., Binance).</li>
                        <li>Go to your assets, select <strong>{currency}</strong>, and tap <strong>Withdraw</strong>.</li>
                        <li>Paste your address and confirm the transfer on the correct network.</li>
                    </ol>
                </div>

                <div className="w-full">
                    <label className="block text-xs font-medium text-white mb-2 uppercase tracking-wide">
                        Your Wallet Address
                    </label>
                    <button
                        onClick={handleCopy}
                        className="w-full cursor-pointer flex items-center justify-between border border-[#264c73] rounded-xl px-4 py-4 text-white hover:border-[#4fe3c3] hover:bg-[#264c73]/20 transition-all group shadow-sm"
                        title="Copy Address"
                    >
                        <span className="font-mono text-sm truncate mr-4 opacity-90 group-hover:opacity-100 transition-opacity">
                            {walletAddress || "Address not found"}
                        </span>
                        {copied ? (
                            <div className="flex items-center gap-1 bg-[#4fe3c3]/10 text-[#4fe3c3] px-2 py-1 rounded">
                                <span className="text-xs font-bold whitespace-nowrap">Copied!</span>
                            </div>
                        ) : (
                            <div className="p-2 rounded bg-[#264c73]/30 group-hover:bg-[#4fe3c3]/20 transition-colors">
                                <DocumentDuplicateIcon className="w-5 h-5 text-gray-400 group-hover:text-[#4fe3c3] shrink-0" />
                            </div>
                        )}
                    </button>
                </div>
            </div>
        </Modal>
    );
}