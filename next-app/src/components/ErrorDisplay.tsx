import React from "react";

interface ErrorDisplayProps {
    error: string | null;
}

export default function ErrorDisplay({ error }: ErrorDisplayProps) {
    if (!error) return null;

    return (
        <div className="p-4 text-center rounded-xl bg-[#0a0a0a] border border-red-500 text-red-500">
            <p className="font-bold text-center text-md mb-1"> An error occurred</p>
            {error}
        </div>
    );
}
