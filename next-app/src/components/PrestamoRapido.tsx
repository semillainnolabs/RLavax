"use client";

import { useState, useEffect } from "react";
import { useMorphoLoan } from "../hooks/useMorphoLoan";
import { usePrivy } from "@privy-io/react-auth";
import { CheckCircleIcon, ArrowPathIcon, BanknotesIcon, CircleStackIcon, LockClosedIcon, CreditCardIcon, ChartBarIcon } from "@heroicons/react/24/outline";
import Button from "./Button";
import BalancesGrid from "./BalancesGrid";
import Input from "./Input";

export default function PrestamoRapido() {
    const { authenticated, login } = usePrivy();
    const { loading, step, error, txHash, usdcBalance, mxnbBalance, collateralBalance, borrowBalance, marketLiquidity, marketAPR, totalRepaidAmount, userPaidSubsidyInUSDC, userInterestInMxnb, userInterestInUSDC, executeZale, executeRepayAndWithdraw, getSimulatedDeposit, resetState } = useMorphoLoan();

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
    const isExceedingLiquidity = Boolean(borrowAmount) && parseFloat(borrowAmount) > parseFloat(marketLiquidity);
    const isInsufficientBalance = parseFloat(usdcBalance) < parseFloat(requiredDeposit || "0");

    return (
        <div className="w-full max-w-md mx-auto p-1">
            <div className="relative overflow-hidden rounded-2xl bg-[#0a0a0a] border border-[#264c73] shadow-2xl backdrop-blur-xl">
                {/* Header Background Gradient */}
                <div className="absolute top-0 left-0 w-full h-32 pointer-events-none" />

                <div className="relative p-6 sm:p-8">
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
                                columns={3}
                                className="mb-2 mt-16"
                                rows={[
                                    [
                                        { label: "USDC", value: `${usdcBalance} USDC`, icon: CircleStackIcon, highlightValue: true },
                                        { label: "MXNB", value: `${mxnbBalance} MXNB`, icon: BanknotesIcon, highlightValue: true },
                                        { label: "Collateral", value: `${collateralBalance} waUSDC`, icon: LockClosedIcon }
                                    ],
                                    [
                                        { label: "Current Debt", value: `${borrowBalance} MXNB`, icon: CreditCardIcon },
                                        { label: "Rate (APR)", value: `${marketAPR}%`, icon: ChartBarIcon },
                                        { label: "Liquidity", value: `${marketLiquidity} MXNB`, icon: CircleStackIcon }
                                    ]
                                ]}
                            />

                            {step === 8 ? (
                                <div className="py-8 text-center space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-500">
                                    <div className="w-20 h-20 bg-[#0a0a0a] rounded-full flex items-center justify-center mx-auto border border-[#4fe3c3]">
                                        <CheckCircleIcon className="w-10 h-10 text-[#4fe3c3]" />
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-bold text-white mb-2">Operation Successful!</h3>
                                        <p className="text-gray-200">
                                            You received <span className="text-[#4fe3c3] font-bold text-lg">{borrowAmount} MXNB</span>
                                        </p>
                                    </div>

                                    <Button
                                        onClick={() => {
                                            setBorrowAmount("");
                                            resetState();
                                        }}
                                        className="transform hover:-translate-y-1"
                                    >
                                        Perform Another Operation
                                    </Button>
                                </div>
                            ) : step === 16 ? (
                                <div className="py-8 text-center space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-500">
                                    <div className="w-20 h-20 bg-[#0a0a0a] rounded-full flex items-center justify-center mx-auto border border-[#4fe3c3]">
                                        <CheckCircleIcon className="w-10 h-10 text-[#4fe3c3]" />
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-bold text-white mb-2">Payment Successful!</h3>
                                        <div className="text-sm bg-[#0a0a0a] border border-[#264c73] p-4 rounded-lg space-y-2 text-left">
                                            <div className="flex justify-between">
                                                <span className="text-gray-200">Total Paid:</span>
                                                <span className="text-white font-mono">{totalRepaidAmount || "Calculating..."} MXNB</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-200">Status:</span>
                                                <span className="text-[#4fe3c3]">Debt Settled</span>
                                            </div>
                                            {parseFloat(userPaidSubsidyInUSDC || "0") > 0 && (
                                                <>
                                                    <div className="h-px bg-[#264c73] my-2" />
                                                    <div className="text-center">
                                                        <div className="text-xs text-[#4fe3c3] font-semibold mb-2 flex items-center justify-center gap-1">
                                                            💰 We've subsidized your loan interest!!!
                                                        </div>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-200">We gave you:</span>
                                                        <span className="text-white font-mono">{userInterestInMxnb} MXNB (~= {userInterestInUSDC})</span>
                                                        <span className="text-xs text-gray-200 font-mono">(Approx. {userInterestInUSDC} USDC)</span>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    <Button
                                        onClick={() => {
                                            setBorrowAmount("");
                                            resetState();
                                        }}
                                        className="transform hover:-translate-y-1"
                                    >
                                        Back to Home
                                    </Button>
                                </div>
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
                                        {isInsufficientBalance && (
                                            <div className="text-xs text-[#4fe3c3] mt-2 flex items-center gap-1">
                                                ⚠️ Insufficient balance
                                            </div>
                                        )}
                                        {isExceedingLiquidity && (
                                            <div className="text-xs text-[#4fe3c3] mt-2 flex items-center gap-1">
                                                ⚠️ Insufficient liquidity in market
                                            </div>
                                        )}
                                    </div>

                                    {/* Progress Stepper (Visible when loading) */}
                                    {loading && (
                                        <div className="space-y-3 py-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                            {step < 11 ? (
                                                <>
                                                    <div className="flex justify-between text-xs text-gray-200 uppercase tracking-widest mb-1">
                                                        <span>Processing Loan...</span>
                                                        <span>{Math.min(step, 7)} / 7</span>
                                                    </div>
                                                    <div className="h-2 w-full bg-[#264c73] rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-[#4fe3c3] transition-all duration-500 ease-out"
                                                            style={{ width: `${(step / 7) * 100}%` }}
                                                        />
                                                    </div>
                                                    <p className="text-center text-sm text-[#4fe3c3] font-medium animate-pulse">
                                                        {step === 0 ? "Starting..." :
                                                            step > 7 ? "Ready!" :
                                                                steps[step - 1]}
                                                    </p>
                                                </>
                                            ) : (
                                                <>
                                                    <div className="flex justify-between text-xs text-gray-200 uppercase tracking-widest mb-1">
                                                        <span>Processing Payment...</span>
                                                        <span>{Math.min(step - 10, 5)} / 5</span>
                                                    </div>
                                                    <div className="h-2 w-full bg-[#264c73] rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-[#4fe3c3] transition-all duration-500 ease-out"
                                                            style={{ width: `${((step - 10) / 5) * 100}%` }}
                                                        />
                                                    </div>
                                                    <p className="text-center text-sm text-[#4fe3c3] font-medium animate-pulse">
                                                        {getRepayStepLabel(step)}
                                                    </p>
                                                </>
                                            )}
                                        </div>
                                    )}

                                    {/* Error Message */}
                                    {error && (
                                        <div className="p-4 text-center rounded-xl bg-[#0a0a0a] border border-[#264c73] text-[#4fe3c3] text-sm">
                                            <p className="font-semibold text-center mb-1">An error occurred while requesting the loan</p>
                                            {error}
                                        </div>
                                    )}

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
                                        disabled={loading || !borrowAmount || parseFloat(borrowAmount) <= 0 || isInsufficientBalance || isExceedingLiquidity}
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
                                    {(!loading && (parseFloat(borrowBalance) > 0)) && (
                                        <Button
                                            onClick={executeRepayAndWithdraw}
                                            isWithdraw
                                            className="mt-4"
                                        >
                                            Pay All and Withdraw
                                        </Button>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div >
        </div >
    );
}