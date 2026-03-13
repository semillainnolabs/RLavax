import React from "react";

interface AppCardProps {
    children: React.ReactNode;
    className?: string;
}

export default function AppCard({ children, className = "" }: AppCardProps) {
    return (
        <div className={`w-full max-w-md mx-auto p-1 ${className}`.trim()}>
            <div className="relative overflow-hidden rounded-2xl bg-[#0a0a0a] border border-[#264c73] shadow-2xl backdrop-blur-xl h-full">
                <div className="absolute top-0 left-0 w-full h-32 pointer-events-none" />
                <div className="relative p-6 sm:p-8 flex flex-col h-full">
                    {children}
                </div>
            </div>
        </div>
    );
}
