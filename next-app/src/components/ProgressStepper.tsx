import React from "react";

interface ProgressStepperProps {
    title: string;
    currentStep: number;
    totalSteps: number;
    stepLabel: string;
}

export default function ProgressStepper({
    title,
    currentStep,
    totalSteps,
    stepLabel,
}: ProgressStepperProps) {
    const safeCurrentStep = Math.min(currentStep, totalSteps);
    const progressPercentage = (safeCurrentStep / totalSteps) * 100;

    return (
        <div className="space-y-3 py-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between text-xs text-gray-200 uppercase tracking-widest mb-1">
                <span>{title}</span>
                <span>
                    {safeCurrentStep} / {totalSteps}
                </span>
            </div>
            <div className="h-2 w-full bg-[#264c73] rounded-full overflow-hidden">
                <div
                    className={`h-full bg-[#4fe3c3] transition-all duration-500 ease-out ${
                        progressPercentage >= 100 ? "animate-pulse" : ""
                    }`}
                    style={{ width: `${progressPercentage}%` }}
                />
            </div>
            <p className="text-center text-sm text-[#4fe3c3] font-medium animate-pulse">
                {stepLabel}
            </p>
        </div>
    );
}
