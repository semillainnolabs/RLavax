"use client";

import { useState } from "react";
import { useMorphoLend } from "../hooks/useMorphoLend";
import { usePrivy } from "@privy-io/react-auth";
import {
    CheckCircleIcon,
    ArrowPathIcon,
    BanknotesIcon,
    ChartBarIcon,
    CircleStackIcon,
    WalletIcon,
    CurrencyDollarIcon
} from "@heroicons/react/24/outline";
import Button from "./Button";
import BalancesGrid from "./BalancesGrid";
import Input from "./Input";

export default function RendimientoRapido() {
    const { authenticated, login } = usePrivy();
    const {
        loading,
        step,
        error,
        mxnbBalance,
        vaultAssetsBalance,
        tvl,
        apy,
        withdrawnAmount,
        yieldEarned,
        executeDeposit,
        executeWithdraw,
        refreshData,
        resetState
    } = useMorphoLend();

    const [depositAmount, setDepositAmount] = useState("");

    const handleDeposit = async () => {
        if (!depositAmount || parseFloat(depositAmount) <= 0) return;
        await executeDeposit(depositAmount);
        setDepositAmount("");
    };

    const handleWithdrawAll = async () => {
        await executeWithdraw(0n, true);
    };

    const handleReset = () => {
        setDepositAmount("");
        resetState();
    };

    // Steps mapping
    const getStepLabel = (s: number) => {
        switch (s) {
            case 1: return "Approving MXNB...";
            case 2: return "Depositing in Vault...";
            case 3: return "Confirming...";
            case 11: return "Withdrawing Liquidity...";
            default: return "Processing...";
        }
    };

    // Derived states
    const hasLiquidity = parseFloat(vaultAssetsBalance) > 0;
    const isInsufficientBalance = depositAmount && parseFloat(depositAmount) > parseFloat(mxnbBalance);

    return (
        <div className="w-full max-w-md mx-auto p-1">
            <div className="relative overflow-hidden rounded-2xl bg-[#0a0a0a] border border-[#264c73] shadow-2xl backdrop-blur-xl">

                <div className="absolute top-0 left-0 w-full h-28 pointer-events-none" />

                <div className="relative p-6 sm:p-8">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h2 className="text-2xl w-fit mb-2 border-b-4 border-[#264c73] font-bold text-white">
                                MXNB Yield
                            </h2>
                            <p className="text-sm font-bold text-[#4fe3c3] mt-1">Provide liquidity and earn interest</p>
                        </div>
                        <div className="p-3 rounded-full bg-[#0a0a0a] border border-[#264c73]">
                            <ChartBarIcon className="w-6 h-6 text-[#4fe3c3]" />
                        </div>
                    </div>

                    {!authenticated ? (
                        <div className="text-center pt-12">
                            <p className="text-gray-200 mb-6">Connect your wallet to get started</p>
                            <Button
                                onClick={login}
                            >
                                Connect Wallet
                            </Button>
                        </div>
                    ) : (
                        <>
                            <BalancesGrid
                                columns={2}
                                className="mb-6 mt-14"
                                rows={[
                                    [
                                        { label: "Available MXNB", value: `${mxnbBalance} MXNB`, icon: WalletIcon, highlightValue: true },
                                        { label: "Your Liquidity", value: `${vaultAssetsBalance} MXNB`, icon: CircleStackIcon }
                                    ],
                                    [
                                        { label: "TVL", value: `${tvl} MXNB`, icon: BanknotesIcon },
                                        { label: "APY", value: `${apy}%`, icon: ChartBarIcon }
                                    ]
                                ]}
                            />

                            {/* Main Content Area */}
                            {step === 4 && !loading ? (
                                /* Success Screen (Deposit) */
                                <div className="py-8 text-center space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-500">
                                    <div className="w-20 h-20 bg-[#0a0a0a] rounded-full flex items-center justify-center mx-auto border border-[#4fe3c3]">
                                        <CheckCircleIcon className="w-10 h-10 text-[#4fe3c3]" />
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-bold text-white mb-2">Deposit Successful!</h3>
                                        <p className="text-gray-200">
                                            Your liquidity has been successfully added.
                                        </p>
                                    </div>

                                    <Button onClick={handleReset} className="transform hover:-translate-y-1">
                                        Make Another Deposit
                                    </Button>
                                </div>
                            ) : step === 12 && !loading ? (
                                /* Success Screen (Withdrawal) */
                                <div className="py-8 text-center space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-500">
                                    <div className="w-20 h-20 bg-[#0a0a0a] rounded-full flex items-center justify-center mx-auto border border-[#4fe3c3]">
                                        <CheckCircleIcon className="w-10 h-10 text-[#4fe3c3]" />
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-bold text-white mb-2">Withdrawal Successful!</h3>
                                        <div className="text-sm bg-[#0a0a0a] border border-[#264c73] p-4 rounded-lg space-y-2 text-left">
                                            <div className="flex justify-between">
                                                <span className="text-gray-200">Total Withdrawn:</span>
                                                <span className="text-white font-mono">{withdrawnAmount} MXNB</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-200">Yield Generated:</span>
                                                <span className="text-[#4fe3c3] font-mono">{yieldEarned || "0.00"} MXNB</span>
                                            </div>
                                        </div>
                                    </div>

                                    <Button onClick={handleReset} className="transform hover:-translate-y-1">
                                        Back to Home
                                    </Button>
                                </div>
                            ) : (
                                /* Input Section */
                                <div className="space-y-6 py-2">
                                    {!loading && (
                                        /* Input */
                                        <Input
                                            label="How much MXNB do you want to deposit?"
                                            value={depositAmount}
                                            onChange={(e) => setDepositAmount(e.target.value)}
                                            onMaxClick={() => setDepositAmount(mxnbBalance)}
                                            errorMessage={isInsufficientBalance && "Insufficient balance"}
                                            disabled={loading}
                                        />
                                    )}

                                    {/* Progress Stepper */}
                                    {loading && (
                                        <div className="space-y-3 py-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                            <div className="flex justify-between text-xs text-gray-200 uppercase tracking-widest mb-1">
                                                <span>
                                                    {step >= 11 ? "Processing Withdrawal..." : "Processing Deposit..."}
                                                </span>
                                                <span>
                                                    {step >= 11 ? "1 / 1" : `${Math.min(step, 3)} / 3`}
                                                </span>
                                            </div>
                                            <div className="h-2 w-full bg-[#264c73] rounded-full overflow-hidden">
                                                {step >= 11 ? (
                                                    <div
                                                        className="h-full bg-[#4fe3c3] transition-all duration-500 ease-out animate-pulse"
                                                        style={{ width: "100%" }}
                                                    />
                                                ) : (
                                                    <div
                                                        className="h-full bg-[#4fe3c3] transition-all duration-500 ease-out"
                                                        style={{ width: `${(step / 3) * 100}%` }}
                                                    />
                                                )}
                                            </div>
                                            <p className={`text-center text-sm font-medium animate-pulse text-[#4fe3c3]`}>
                                                {getStepLabel(step)}
                                            </p>
                                        </div>
                                    )}

                                    {/* Error Message */}
                                    {error && (
                                        <div className="p-4 text-center rounded-xl bg-[#0a0a0a] border border-[#264c73] text-[#4fe3c3] text-sm">
                                            <p className="font-semibold text-center mb-1"> An error occurred while depositing </p>
                                            {error}
                                        </div>
                                    )}

                                    {/* Deposit Button */}
                                    {!loading && (
                                        <Button
                                            onClick={handleDeposit}
                                            disabled={!!(!depositAmount || parseFloat(depositAmount) <= 0 || isInsufficientBalance)}
                                        >
                                            Deposit MXNB
                                        </Button>
                                    )}

                                    {/* Withdraw Button */}
                                    {hasLiquidity && !loading && (
                                        <Button
                                            onClick={handleWithdrawAll}
                                            isWithdraw
                                            className="mt-2"
                                        >
                                            Withdraw All
                                        </Button>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}