'use client';

import { useState } from 'react';
import { useStudyStore } from '@/store/useStudyStore';
import type { Sentence, Highlight } from '@shadowoo/shared';

interface SentenceItemProps {
    sentence: Sentence;
    sessionId: string;
    isActive: boolean;
    onClick: () => void;
}

export default function SentenceItem({
    sentence,
    sessionId,
    isActive,
    onClick,
}: SentenceItemProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [aiTip, setAiTip] = useState('');
    const [isLoadingTip, setIsLoadingTip] = useState(false);

    const { addNoteToSentence, addHighlightToSentence, updateHighlightCaption, removeHighlight } = useStudyStore();

    const difficultyTags = ['연음', '문법', '발음', '속도'];

    const handleDoubleClick = () => {
        setIsExpanded(!isExpanded);
    };

    const handleTagClick = (tag: string) => {
        setSelectedTags(prev =>
            prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
        );
    };

    const handleGenerateAITip = async () => {
        if (selectedTags.length === 0) return;

        setIsLoadingTip(true);
        try {
            const response = await fetch('/api/ai-tip', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sentence: sentence.text,
                    tags: selectedTags,
                }),
            });

            const data = await response.json();
            if (data.success) {
                setAiTip(data.tip);
                addNoteToSentence(sessionId, sentence.id, selectedTags, data.tip);
            }
        } catch (error) {
            console.error('Failed to generate AI tip:', error);
        } finally {
            setIsLoadingTip(false);
        }
    };

    const handleTextSelection = () => {
        const selection = window.getSelection();
        if (!selection || selection.toString().trim() === '') return;

        const selectedText = selection.toString().trim();
        const range = selection.getRangeAt(0);

        const highlight: Highlight = {
            id: crypto.randomUUID(),
            text: selectedText,
            startOffset: range.startOffset,
            endOffset: range.endOffset,
            caption: '',
            color: '#FFEB3B',
        };

        addHighlightToSentence(sessionId, sentence.id, highlight);
        selection.removeAllRanges();
    };

    const renderTextWithHighlights = () => {
        if (sentence.highlights.length === 0) {
            return <p className="text-gray-900">{sentence.text}</p>;
        }

        // Simple rendering - in production, you'd want more sophisticated text splitting
        let parts: Array<{ text: string; highlighted: boolean; highlightId?: string }> = [];
        let lastIndex = 0;

        sentence.highlights.forEach(highlight => {
            const index = sentence.text.indexOf(highlight.text, lastIndex);
            if (index !== -1) {
                if (index > lastIndex) {
                    parts.push({ text: sentence.text.substring(lastIndex, index), highlighted: false });
                }
                parts.push({ text: highlight.text, highlighted: true, highlightId: highlight.id });
                lastIndex = index + highlight.text.length;
            }
        });

        if (lastIndex < sentence.text.length) {
            parts.push({ text: sentence.text.substring(lastIndex), highlighted: false });
        }

        return (
            <p className="text-gray-900">
                {parts.map((part, index) => (
                    part.highlighted ? (
                        <mark
                            key={index}
                            className="bg-yellow-300 px-1 rounded cursor-pointer"
                            style={{ backgroundColor: sentence.highlights.find(h => h.id === part.highlightId)?.color }}
                        >
                            {part.text}
                        </mark>
                    ) : (
                        <span key={index}>{part.text}</span>
                    )
                ))}
            </p>
        );
    };

    return (
        <div
            className={`rounded-lg transition-all ${isActive
                    ? 'bg-primary-100 border-2 border-primary-500'
                    : 'bg-gray-50 border border-gray-200 hover:bg-gray-100'
                }`}
        >
            <div
                onClick={onClick}
                onDoubleClick={handleDoubleClick}
                onMouseUp={handleTextSelection}
                className="p-4 cursor-pointer select-text"
            >
                {renderTextWithHighlights()}
            </div>

            {/* Accordion Content */}
            {isExpanded && (
                <div className="px-4 pb-4 space-y-4 border-t border-gray-200 mt-2 pt-4">
                    {/* Difficulty Tags */}
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm font-medium text-gray-700">Why difficult?</span>
                        </div>
                        <div className="flex gap-2">
                            {difficultyTags.map(tag => (
                                <button
                                    key={tag}
                                    onClick={() => handleTagClick(tag)}
                                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${selectedTags.includes(tag)
                                            ? 'bg-primary-600 text-white'
                                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                        }`}
                                >
                                    {tag}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Generate AI Tip Button */}
                    {selectedTags.length > 0 && !aiTip && (
                        <button
                            onClick={handleGenerateAITip}
                            disabled={isLoadingTip}
                            className="w-full px-4 py-2 bg-gradient-to-r from-primary-600 to-accent-600 text-white rounded-lg font-medium hover:shadow-lg disabled:opacity-50 transition-all"
                        >
                            {isLoadingTip ? 'AI 팁 생성 중...' : 'AI 팁 생성하기'}
                        </button>
                    )}

                    {/* AI Tip Display */}
                    {aiTip && (
                        <div className="bg-gradient-to-r from-primary-50 to-accent-50 rounded-lg p-4 border border-primary-200">
                            <div className="flex items-start gap-2 mb-2">
                                <span className="text-lg">💡</span>
                                <h4 className="font-semibold text-gray-900">Ninja's Tip</h4>
                            </div>
                            <p className="text-sm text-gray-700 whitespace-pre-wrap">{aiTip}</p>
                        </div>
                    )}

                    {/* Highlights Section */}
                    {sentence.highlights.length > 0 && (
                        <div>
                            <h4 className="text-sm font-medium text-gray-700 mb-2">
                                Highlight words & phrase (Drag to add)
                            </h4>
                            <div className="space-y-2">
                                {sentence.highlights.map((highlight, index) => (
                                    <div
                                        key={highlight.id}
                                        className="flex items-start gap-3 p-3 bg-white rounded-lg border border-gray-200"
                                    >
                                        <span className="text-sm font-medium text-gray-500">
                                            Highlight {index + 1}
                                        </span>
                                        <div className="flex-1">
                                            <p className="text-sm font-medium text-gray-900 mb-1">
                                                {highlight.text}
                                            </p>
                                            <input
                                                type="text"
                                                placeholder="Add caption..."
                                                value={highlight.caption}
                                                onChange={(e) => updateHighlightCaption(sessionId, sentence.id, highlight.id, e.target.value)}
                                                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                                            />
                                        </div>
                                        <button
                                            onClick={() => removeHighlight(sessionId, sentence.id, highlight.id)}
                                            className="text-gray-400 hover:text-red-600 transition-colors"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
