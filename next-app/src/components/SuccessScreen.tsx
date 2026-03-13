import React, { ReactNode } from "react";
import { CheckCircleIcon } from "@heroicons/react/24/outline";
import Button from "./Button";

interface SuccessScreenProps {
    title: string;
    children?: ReactNode;
    buttonText: string;
    onButtonClick: () => void;
}

export default function SuccessScreen({
    title,
    children,
    buttonText,
    onButtonClick,
}: SuccessScreenProps) {
    return (
        <div className="py-8 text-center space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-500">
            <div className="w-20 h-20 bg-[#0a0a0a] rounded-full flex items-center justify-center mx-auto border border-[#4fe3c3]">
                <CheckCircleIcon className="w-10 h-10 text-[#4fe3c3]" />
            </div>
            <div>
                <h3 className="text-2xl font-bold text-white mb-2">{title}</h3>
                {children}
            </div>

            <Button
                onClick={onButtonClick}
                className="transform hover:-translate-y-1 w-full"
            >
                {buttonText}
            </Button>
        </div>
    );
}
