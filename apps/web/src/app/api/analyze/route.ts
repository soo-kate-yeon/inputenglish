import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(request: Request) {
    try {
        const { sentence, feedbackTypes } = await request.json();

        if (!sentence || !feedbackTypes || feedbackTypes.length === 0) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        if (!process.env.GEMINI_API_KEY) {
            return NextResponse.json(
                { error: 'API key not configured' },
                { status: 500 }
            );
        }

        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

        const prompt = `
        You are a Professional English Tutor specializing in shadowing and pronunciation.
        
        Analyze the following English sentence based on the user's difficulties:
        Sentence: "${sentence}"
        User's Difficulties: ${feedbackTypes.join(', ')}

        Please provide a structured response in JSON format with the following fields:
        1. "analysis": Explain why this sentence might be difficult based on the user's feedback (e.g., specific linking sounds, difficult vocabulary nuances, speed factors).
        2. "tips": Provide actionable advice to overcome these difficulties (e.g., how to link specific words, breathing techniques, mental imagery).
        3. "focusPoint": A short, catchy phrase summarizing the key thing to focus on when practicing this sentence.

        Keep the tone encouraging, professional, and insightful. The response must be in Korean.
        
        Example JSON structure:
        {
            "analysis": "...",
            "tips": "...",
            "focusPoint": "..."
        }
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Extract JSON from the response (in case of markdown formatting)
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('Failed to parse AI response');
        }

        const jsonResponse = JSON.parse(jsonMatch[0]);

        return NextResponse.json(jsonResponse);

    } catch (error) {
        console.error('AI Analysis Error:', error);
        console.error('Error details:', JSON.stringify(error, null, 2));
        if (error instanceof Error) {
            console.error('Error message:', error.message);
            console.error('Error stack:', error.stack);
        }
        return NextResponse.json(
            { error: 'Failed to generate analysis', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
