"use client";

import { useState } from "react";
import type { Sentence } from "@shadowoo/shared";
import { Repeat, Mic } from "lucide-react";

interface ShadowingScriptListProps {
    sentences: Sentence[];
    mode: "sentence" | "paragraph" | "total";
    onPlaySentence: (startTime: number, endTime: number) => void;
    onLoopSentence: (sentenceId: string, isLooping: boolean) => void;
    onRecordSentence: (sentenceId: string) => void;
    loopingSentenceId: string | null;
}

export function ShadowingScriptList({
    sentences,
    mode,
    onPlaySentence,
    onLoopSentence,
    onRecordSentence,
    loopingSentenceId
}: ShadowingScriptListProps) {

    return (
        <div className="flex flex-col gap-6">
            {sentences.map((sentence, idx) => {
                const isLooping = loopingSentenceId === sentence.id;

                return (
                    <div key={sentence.id} className="relative group">
                        <div className="flex gap-4 items-start">
                            <span className={`
                                text-xs font-mono mt-2 shrink-0 w-6 transition-colors
                                ${isLooping ? 'text-primary-700 font-bold' : 'text-secondary-500'}
                            `}>
                                {idx + 1}
                            </span>
                            <p
                                onClick={() => onPlaySentence(sentence.startTime, sentence.endTime)}
                                className={`
                                    flex-1 text-lg leading-relaxed cursor-pointer transition-all duration-200
                                    ${isLooping
                                        ? "font-semibold text-neutral-900"
                                        : "font-medium text-secondary-500 hover:text-secondary-700"
                                    }
                                `}
                            >
                                {sentence.text}
                            </p>

                            {/* Hover Controls */}
                            <div className={`flex gap-2 mt-1 transition-opacity ${isLooping ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                                <button
                                    onClick={() => onLoopSentence(sentence.id, !isLooping)}
                                    className={`p-2 rounded-lg transition-colors ${isLooping
                                            ? 'bg-primary-500 text-white'
                                            : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                                        }`}
                                    aria-label={isLooping ? "Stop loop" : "Loop sentence"}
                                >
                                    <Repeat className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => onRecordSentence(sentence.id)}
                                    className="p-2 rounded-lg bg-neutral-100 text-neutral-600 hover:bg-neutral-200 transition-colors"
                                    aria-label="Record"
                                >
                                    <Mic className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })}
            <div className="h-20" />
        </div>
    );
}
