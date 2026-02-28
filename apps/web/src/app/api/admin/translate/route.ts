import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(request: NextRequest) {
    try {
        const { sentences } = await request.json();

        if (!sentences || !Array.isArray(sentences) || sentences.length === 0) {
            return NextResponse.json(
                { error: 'Sentences array is required' },
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

        const prompt = `
        You are a professional English-Korean translator.
        Translate the following English sentences into natural, context-aware Korean.
        Return ONLY a JSON array of strings, where each string is the translation corresponding to the input sentence index.
        Do not include any other text or markdown formatting (like \`\`\`json). Just the raw array.

        Input Sentences:
        ${JSON.stringify(sentences)}
        `;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        let translations: string[] = [];
        try {
            // Clean up potentially wrapped markdown
            const cleanedText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
            translations = JSON.parse(cleanedText);
        } catch (e) {
            console.error('Failed to parse AI response:', responseText);
            throw new Error('AI response was not a valid JSON array');
        }

        if (!Array.isArray(translations) || translations.length !== sentences.length) {
            throw new Error('AI returned unmatched number of translations');
        }

        return NextResponse.json({
            translations
        });

    } catch (error: any) {
        console.error('Translation API error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to translate' },
            { status: 500 }
        );
    }
}
