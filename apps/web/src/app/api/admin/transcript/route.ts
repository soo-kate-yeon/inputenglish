import { NextRequest, NextResponse } from 'next/server';
import { YoutubeTranscript } from '@danielxceron/youtube-transcript';

// Decode HTML entities (e.g., &amp;#39; -> ', &quot; -> ", etc.)
function decodeHtmlEntities(text: string): string {
    const entities: Record<string, string> = {
        '&amp;': '&',
        '&lt;': '<',
        '&gt;': '>',
        '&quot;': '"',
        '&#39;': "'",
        '&apos;': "'",
        '&#x27;': "'",
        '&#x2F;': '/',
    };

    // Decode entities multiple times to handle double-encoding like &amp;#39;
    let decoded = text;
    let previous = '';

    // Keep decoding until no more changes occur (max 3 iterations to prevent infinite loops)
    for (let i = 0; i < 3 && decoded !== previous; i++) {
        previous = decoded;
        decoded = decoded.replace(/&[#\w]+;/g, (entity) => entities[entity] || entity);
    }

    return decoded;
}

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const videoId = searchParams.get('videoId');

    if (!videoId) {
        return NextResponse.json(
            { error: 'Missing videoId parameter' },
            { status: 400 }
        );
    }

    try {
        // Fetch transcript using youtube-transcript package
        const transcript = await YoutubeTranscript.fetchTranscript(videoId);

        if (!Array.isArray(transcript) || transcript.length === 0) {
            return NextResponse.json(
                { error: 'No transcript available for this video' },
                { status: 404 }
            );
        }

        // Decode HTML entities in transcript text
        const cleanTranscript = transcript.map(item => ({
            ...item,
            text: decodeHtmlEntities(item.text)
        }));

        return NextResponse.json({ transcript: cleanTranscript });

    } catch (error: any) {
        console.error('Transcript fetch error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to fetch transcript' },
            { status: 500 }
        );
    }
}
