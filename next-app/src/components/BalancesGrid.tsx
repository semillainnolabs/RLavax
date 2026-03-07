import React from "react";

export type BalanceItem = {
    label: string;
    value: React.ReactNode;
    icon: React.ElementType;
    highlightValue?: boolean;
};

interface BalancesGridProps {
    rows: BalanceItem[][];
    columns?: 1  | 2 | 3;
    className?: string;
}

export default function BalancesGrid({ rows, columns = 2, className = "" }: BalancesGridProps) {
    const gridColsClass = columns === 3 ? "grid-cols-3" : "grid-cols-2";
    const colSpanClass = columns === 3 ? "col-span-3" : "col-span-2";

    return (
        <div className={`grid ${gridColsClass} gap-2 p-2 bg-[#0a0a0a] rounded-xl ${className}`}>
            {rows.map((row, rowIndex) => (
                <React.Fragment key={rowIndex}>
                    {/* Row Items */}
                    {row.map((item, itemIndex) => {
                        const Icon = item.icon;
                        const hasLeftBorder = itemIndex > 0;
                        return (
                            <div
                                key={itemIndex}
                                className={`text-center p-2 ${hasLeftBorder ? "border-l border-[#264c73]" : ""}`}
                            >
                                <div className="text-[10px] uppercase text-white font-bold mb-1 flex items-center justify-center gap-1">
                                    <Icon className="w-3 h-3 text-[#4fe3c3]" /> {item.label}
                                </div>
                                <div className={`font-mono text-sm truncate ${item.highlightValue ? "text-white" : "text-gray-200"}`}>
                                    {item.value}
                                </div>
                            </div>
                        );
                    })}
                    {/* Separator if not last row */}
                    {rowIndex < rows.length - 1 && (
                        <div className={`${colSpanClass} h-px bg-[#264c73] my-1`} />
                    )}
                </React.Fragment>
            ))}
        </div>
    );
}