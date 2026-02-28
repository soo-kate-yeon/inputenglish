import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(request: NextRequest) {
    try {
        const { sentence, tags } = await request.json();

        if (!sentence || !tags || tags.length === 0) {
            return NextResponse.json(
                { error: 'Sentence and tags are required' },
                { status: 400 }
            );
        }

        if (!process.env.GEMINI_API_KEY) {
            return NextResponse.json(
                { error: 'Gemini API key not configured' },
                { status: 500 }
            );
        }

        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

        // Build prompt based on difficulty tags
        const tagDescriptions: Record<string, string> = {
            '연음': 'liaison (linking sounds between words)',
            '문법': 'grammar structure',
            '발음': 'pronunciation',
            '속도': 'speaking speed',
        };

        const tagList = tags.map((tag: string) => tagDescriptions[tag] || tag).join(', ');

        const prompt = `You are an English learning assistant. A Korean student is having difficulty understanding this English sentence:

"${sentence}"

The student marked this as difficult because of: ${tagList}

Provide a concise, helpful tip in Korean (2-3 sentences max) explaining why this sentence is challenging and how to understand it better. Focus specifically on the difficulty areas mentioned.

If the difficulty is about liaison/연음, explain the phonetic changes with IPA notation.
If it's about grammar/문법, explain the structure briefly.
If it's about pronunciation/발음, provide phonetic guidance.
If it's about speed/속도, suggest how to break it down.

Keep your response practical and encouraging.`;

        const result = await model.generateContent(prompt);
        const tip = result.response.text();

        return NextResponse.json({
            success: true,
            tip,
        });
    } catch (error) {
        console.error('AI tip generation error:', error);

        return NextResponse.json(
            {
                error: 'Failed to generate AI tip',
                message: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}
