import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label: string;
    symbol?: string;
    onMaxClick?: () => void;
    errorMessage?: string | boolean | null;
}

export default function Input({
    label,
    symbol = "CCOP",
    onMaxClick,
    errorMessage,
    className = "",
    ...props
}: InputProps) {
    return (
        <div className={`group ${className}`}>
            <label className="block text-xs font-medium text-white mb-2 uppercase tracking-wide">
                {label}
            </label>
            <div className="relative">
                <input
                    type="number"
                    placeholder="0.00"
                    className="w-full bg-[#0a0a0a] border border-[#264c73] rounded-xl px-4 py-3 text-white text-lg focus:outline-none focus:border-[#4fe3c3] transition-all placeholder:text-gray-200 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    {...props}
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    {symbol && <span className="text-sm font-semibold text-gray-200">{symbol}</span>}
                    {onMaxClick && (
                        <button
                            onClick={onMaxClick}
                            className="text-[10px] text-[#4fe3c3] uppercase font-bold hover:underline"
                            type="button"
                        >
                            Max
                        </button>
                    )}
                </div>
            </div>
            {errorMessage && (
                <div className="text-xs text-[#4fe3c3] mt-2 flex items-center gap-1">
                    ⚠️ {errorMessage}
                </div>
            )}
        </div>
    );
}