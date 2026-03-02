import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    isWithdraw?: boolean;
}

export default function Button({
    isWithdraw = false,
    disabled = false,
    className = "",
    children,
    ...props
}: ButtonProps) {
    const baseClasses = "w-full rounded-xl font-bold transition-all border border-[#264c73]";

    let variantClasses = "";
    if (isWithdraw) {
        variantClasses = disabled
            ? "py-3 px-6 text-sm bg-[#0a0a0a] text-gray-600 cursor-not-allowed"
            : "py-3 px-6 text-sm bg-[#0a0a0a] text-[#4fe3c3] hover:bg-[#264c73] hover:text-white cursor-pointer";
    } else {
        variantClasses = disabled
            ? "py-4 px-6 text-lg bg-[#0a0a0a] text-gray-200 cursor-not-allowed"
            : "py-4 px-6 text-lg bg-[#264c73] hover:bg-[#4fe3c3] text-white hover:text-[#0a0a0a] cursor-pointer";
    }

    // Merge custom className over the defaults if needed
    const finalClasses = `${baseClasses} ${variantClasses} ${className}`.trim();

    return (
        <button disabled={disabled} className={finalClasses} {...props}>
            {children}
        </button>
    );
}