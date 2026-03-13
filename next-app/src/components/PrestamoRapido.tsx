"use client";

import { useState, useEffect, useMemo } from "react";
import { useMorphoLoan } from "../hooks/useMorphoLoan";
import { usePrivy } from "@privy-io/react-auth";
import { CheckCircleIcon, ArrowPathIcon, BanknotesIcon, CircleStackIcon, LockClosedIcon, CreditCardIcon, ChartBarIcon } from "@heroicons/react/24/outline";
import Button from "./Button";
import BalancesGrid from "./BalancesGrid";
import Input from "./Input";
import AppCard from "./AppCard";
import ErrorDisplay from "./ErrorDisplay";
import SuccessScreen from "./SuccessScreen";
import ProgressStepper from "./ProgressStepper";

export default function PrestamoRapido() {
    const { authenticated, login } = usePrivy();
    const { loading, step, error, txHash, usdcBalance, mxnbBalance, rawMxnbBalance, collateralBalance, borrowBalance, rawBorrowBalance, marketLiquidity, marketAPR, totalRepaidAmount, userPaidSubsidyInUSDC, userInterestInMxnb, userInterestInUSDC, executeZale, executeRepayAndWithdraw, getSimulatedDeposit, resetState } = useMorphoLoan();

    const [borrowAmount, setBorrowAmount] = useState("");
    const [requiredDeposit, setRequiredDeposit] = useState("0.00");

    useEffect(() => {
        if (borrowAmount) {
            const deposit = getSimulatedDeposit(borrowAmount);
            setRequiredDeposit(deposit);
        } else {
            setRequiredDeposit("0.00");
        }
    }, [borrowAmount, getSimulatedDeposit]);

    const handleBorrow = async () => {
        if (!borrowAmount || parseFloat(borrowAmount) <= 0) return;
        await executeZale(borrowAmount);
    };
    // Steps for the stepper
    const steps = [
        "Approving USDC",
        "Depositing in Aave",
        "Approving aUSDC to Vault",
        "Depositing in waUSDC",
        "Approving Collateral",
        "Depositing Collateral",
        "Requesting MXNB"
    ];

    const getRepayStepLabel = (s: number) => {
        switch (s) {
            case 11: return "Verifying MXNB...";
            case 12: return "Paying Debt...";
            case 13: return "Withdrawing Collateral...";
            case 14: return "Unwrapping waUSDC...";
            case 15: return "Recovering USDC...";
            case 16: return "Completed!";
            default: return "Processing...";
        }
    };

    // Derived state for validation
    const isExceedingLiquidity = useMemo(() => {
        return Boolean(borrowAmount) && parseFloat(borrowAmount) > parseFloat(marketLiquidity);
    }, [borrowAmount, marketLiquidity]);

    const isInsufficientBalance = useMemo(() => {
        return parseFloat(usdcBalance) < parseFloat(requiredDeposit || "0");
    }, [usdcBalance, requiredDeposit]);

    const isInsufficientBalanceWithdraw = useMemo(() => {
        return rawMxnbBalance <= rawBorrowBalance;
    }, [rawMxnbBalance, rawBorrowBalance]);

    const isBorrowDisabled = useMemo(() => {
        return loading || !borrowAmount || parseFloat(borrowAmount) <= 0 || isInsufficientBalance || isExceedingLiquidity;
    }, [loading, borrowAmount, isInsufficientBalance, isExceedingLiquidity]);

    const hasDebt = useMemo(() => {
        return parseFloat(borrowBalance) > 0;
    }, [borrowBalance]);

    return (
        <AppCard>
            <div className="flex items-center justify-between mb-8">
                        <div>
                            <h2 className="text-2xl mb-2 border-b-4 border-[#264c73] font-bold text-white">
                                Quick Loan
                            </h2>
                            <p className="text-sm font-bold text-[#4fe3c3] mt-1">Get MXNB instantly</p>
                        </div>
                        <div className="p-3 rounded-full bg-[#0a0a0a] border border-[#264c73]">
                            <BanknotesIcon className="w-6 h-6 text-[#4fe3c3]" />
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
                                className="mb-2 mt-2"
                                rows={[
                                    [
                                        { label: "Your Dollars", value: `${usdcBalance} USDC`, icon: CircleStackIcon, highlightValue: true },
                                        { label: "Your Pesos", value: `${mxnbBalance} MXNB`, icon: BanknotesIcon, highlightValue: true }
                                    ]
                                ]}
                            />

                            <BalancesGrid
                                columns={2}
                                className="mb-2 mt-2"
                                rows={[
                                    [
                                        { label: "Current Debt", value: `${borrowBalance} MXNB`, icon: CreditCardIcon },
                                        { label: "Collateral Used", value: `${collateralBalance} USDC`, icon: LockClosedIcon }
                                    ]
                                ]}
                            />

                            <BalancesGrid
                                columns={2}
                                className="mb-2 mt-2"
                                rows={[
                                    [
                                        { label: "Rate (APR)", value: `${marketAPR}%`, icon: ChartBarIcon },
                                        { label: "Available", value: `${marketLiquidity} MXNB`, icon: CircleStackIcon }
                                    ]
                                ]}
                            />

                            {step === 8 ? (
                                <SuccessScreen
                                    title="Operation Successful!"
                                    buttonText="Perform Another Operation"
                                    onButtonClick={() => {
                                        setBorrowAmount("");
                                        resetState();
                                    }}
                                >
                                    <p className="text-gray-200">
                                        You received <span className="text-[#4fe3c3] font-bold text-lg">{borrowAmount} MXNB</span>
                                    </p>
                                </SuccessScreen>
                            ) : step === 16 ? (
                                <SuccessScreen
                                    title="Payment Successful!"
                                    buttonText="Back to Home"
                                    onButtonClick={() => {
                                        setBorrowAmount("");
                                        resetState();
                                    }}
                                >
                                    <div className="text-sm bg-[#0a0a0a] border border-[#264c73] p-4 rounded-lg space-y-2 text-left">
                                        <div className="flex justify-between">
                                            <span className="text-gray-200">Status:</span>
                                            <span className="text-[#4fe3c3]">Debt Repaid</span>
                                        </div>
                                        {parseFloat(userPaidSubsidyInUSDC || "0") > 0 && (
                                            <>
                                                <div className="h-px bg-[#264c73] my-6" />
                                                <div className="text-center">
                                                    <div className="text-xs text-[#4fe3c3] font-semibold mb-2 flex items-center justify-center gap-1">
                                                        💰 We've subsidized your loan interest!!!
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-center justify-center gap-2">
                                                    <span className="text-gray-200">We gave you (approx.):</span>
                                                    <span className="text-xl text-[#4fe3c3] font-bold font-mono">$USD {userPaidSubsidyInUSDC}</span>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </SuccessScreen>
                            ) : (
                                /* Input Section */
                                <div className="space-y-6 py-6">
                                    {/* Input */}
                                    <Input
                                        label="How much MXNB do you want to receive?"
                                        value={borrowAmount}
                                        onChange={(e) => setBorrowAmount(e.target.value)}
                                        disabled={loading}
                                    />

                                    {/* Simulation Output */}
                                    <div className="p-4 rounded-xl bg-[#0a0a0a] border border-[#264c73] space-y-3">
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-white">Required Deposit (Est.)</span>
                                            <span className="text-white font-mono font-medium">{requiredDeposit} USDC</span>
                                        </div>
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-gray-200">Available Balance</span>
                                            <span className="text-gray-200 font-mono">{usdcBalance} USDC</span>
                                        </div>
                                        {/* Validation Errors */}
                                        {isInsufficientBalance && !loading && (
                                            <div className="text-xs text-[#4fe3c3] mt-2 flex items-center gap-1">
                                                ⚠️ Insufficient balance
                                            </div>
                                        )}
                                        {isExceedingLiquidity && !loading && (
                                            <div className="text-xs text-[#4fe3c3] mt-2 flex items-center gap-1">
                                                ⚠️ Insufficient liquidity in market
                                            </div>
                                        )}
                                    </div>

                                    {/* Progress Stepper (Visible when loading) */}
                                    {loading && (
                                        <>
                                            {step < 11 ? (
                                                <ProgressStepper
                                                    title="Processing Loan..."
                                                    currentStep={step}
                                                    totalSteps={7}
                                                    stepLabel={step === 0 ? "Starting..." : step > 7 ? "Ready!" : steps[step - 1]}
                                                />
                                            ) : (
                                                <ProgressStepper
                                                    title="Processing Payment..."
                                                    currentStep={step - 10}
                                                    totalSteps={5}
                                                    stepLabel={getRepayStepLabel(step)}
                                                />
                                            )}
                                        </>
                                    )}

                                    {/* Error Message */}
                                    <ErrorDisplay error={error} />

                                    {/* Success Message */}
                                    {step === 8 && !loading && (
                                        <div className="p-4 rounded-xl bg-[#0a0a0a] border border-[#264c73] text-[#4fe3c3] text-sm text-center">
                                            <CheckCircleIcon className="w-8 h-8 mx-auto mb-2 text-[#4fe3c3]" />
                                            <p className="font-bold text-lg">Loan Successful!</p>
                                            <p className="text-gray-200">You received {borrowAmount} MXNB.</p>
                                        </div>
                                    )}

                                    <Button
                                        onClick={handleBorrow}
                                        disabled={isBorrowDisabled}
                                    >
                                        {loading ? (
                                            <span className="flex items-center justify-center gap-2 text-[#4fe3c3]">
                                                <ArrowPathIcon className="w-5 h-5 animate-spin" />
                                                Processing...
                                            </span>
                                        ) : step === 8 ? (
                                            "Request Another Loan"
                                        ) : (
                                            "Deposit and Borrow"
                                        )}
                                    </Button>

                                    {/* Repay Button - Only show if user has debt or collateral */}
                                    {(!loading && hasDebt) && (
                                        <Button
                                            onClick={executeRepayAndWithdraw}
                                            isWithdraw
                                            className="mt-4"
                                            disabled={isInsufficientBalanceWithdraw}
                                        >
                                            {isInsufficientBalanceWithdraw ? "Insufficient Balance to pay debt" : "Pay All and Withdraw"}
                                        </Button>
                                    )}
                                </div>
                            )}
                        </>
                    )}
        </AppCard>
    );
}