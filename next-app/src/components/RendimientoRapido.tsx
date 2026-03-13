"use client";

import { useState, useMemo } from "react";
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
import AppCard from "./AppCard";
import ErrorDisplay from "./ErrorDisplay";
import SuccessScreen from "./SuccessScreen";
import ProgressStepper from "./ProgressStepper";

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
    const hasLiquidity = useMemo(() => {
        return parseFloat(vaultAssetsBalance) > 0;
    }, [vaultAssetsBalance]);

    const isInsufficientBalance = useMemo(() => {
        return Boolean(depositAmount) && parseFloat(depositAmount) > parseFloat(mxnbBalance);
    }, [depositAmount, mxnbBalance]);

    const isDepositDisabled = useMemo(() => {
        return loading || !depositAmount || parseFloat(depositAmount) <= 0 || isInsufficientBalance;
    }, [loading, depositAmount, isInsufficientBalance]);

    return (
        <AppCard>
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
                            <p className="text-gray-200 mb-6">Sign In/Up to get started</p>
                            <Button
                                onClick={login}
                            >
                                Sign In/Up
                            </Button>
                        </div>
                    ) : (
                        <>
                            <BalancesGrid
                                columns={2}
                                className="mb-3 mt-3"
                                rows={[
                                    [
                                        { label: "Your Pesos", value: `${mxnbBalance} MXNB`, icon: WalletIcon, highlightValue: true },
                                        { label: "Your Deposits", value: `${vaultAssetsBalance} MXNB`, icon: CircleStackIcon }
                                    ],

                                    [
                                        { label: "APY", value: `${apy}%`, icon: ChartBarIcon },
                                        { label: "TVL", value: `${tvl} MXNB`, icon: BanknotesIcon }
                                    ]
                                ]}
                            />
                            {/* Main Content Area */}
                            {step === 4 && !loading ? (
                                /* Success Screen (Deposit) */
                                <SuccessScreen
                                    title="Deposit Successful!"
                                    buttonText="Make Another Deposit"
                                    onButtonClick={handleReset}
                                >
                                    <p className="text-gray-200">
                                        Your liquidity has been successfully added.
                                    </p>
                                </SuccessScreen>
                            ) : step === 12 && !loading ? (
                                /* Success Screen (Withdrawal) */
                                <SuccessScreen
                                    title="Withdrawal Successful!"
                                    buttonText="Back to Home"
                                    onButtonClick={handleReset}
                                >
                                    <div className="text-sm bg-[#0a0a0a] border border-[#264c73] p-4 rounded-lg space-y-2 text-left">
                                        <div className="flex justify-between">
                                            <span className="text-gray-200">Total Withdrawn:</span>
                                            <span className="text-[#4fe3c3] font-mono">{withdrawnAmount} MXNB</span>
                                        </div>
                                    </div>
                                </SuccessScreen>
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
                                        <ProgressStepper
                                            title={step >= 11 ? "Processing Withdrawal..." : "Processing Deposit..."}
                                            currentStep={step >= 11 ? 1 : step}
                                            totalSteps={step >= 11 ? 1 : 3}
                                            stepLabel={getStepLabel(step)}
                                        />
                                    )}

                                    {/* Error Message */}
                                    <ErrorDisplay error={error} />

                                    {/* Deposit Button */}
                                    {!loading && (
                                        <Button
                                            onClick={handleDeposit}
                                            disabled={isDepositDisabled}
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
        </AppCard>
    );
}