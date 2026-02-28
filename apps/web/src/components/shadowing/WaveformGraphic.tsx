"use client";

import { useState, useEffect } from "react";

interface WaveformGraphicProps {
    color?: string;
    isAnimating?: boolean;
    count?: number;
}

export function WaveformGraphic({ color = "#D9D9D9", isAnimating = false, count = 20 }: WaveformGraphicProps) {
    const [bars, setBars] = useState<number[]>([]);

    useEffect(() => {
        setBars([...Array(count)].map(() => Math.max(4, Math.random() * 24)));
    }, [count]);

    useEffect(() => {
        if (!isAnimating) return;
        const interval = setInterval(() => {
            setBars([...Array(count)].map(() => Math.max(4, Math.random() * 24)));
        }, 150);
        return () => clearInterval(interval);
    }, [isAnimating, count]);

    return (
        <div className="flex items-center gap-[2px] h-[24px]">
            {bars.map((height, i) => (
                <div
                    key={i}
                    className="w-[3px] rounded-full transition-all duration-150"
                    style={{
                        height: `${height}px`,
                        backgroundColor: color,
                    }}
                />
            ))}
        </div>
    );
}
