import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();
        const searchParams = request.nextUrl.searchParams;

        const difficulty = searchParams.get('difficulty');
        const tag = searchParams.get('tag');

        let query = supabase
            .from('curated_videos')
            .select('id, video_id, title, thumbnail_url, difficulty, tags, snippet_duration, created_at')
            .order('created_at', { ascending: false });

        if (difficulty) {
            query = query.eq('difficulty', difficulty);
        }

        if (tag) {
            query = query.contains('tags', [tag]);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Curated videos fetch error:', error);
            return NextResponse.json(
                { error: 'Failed to fetch videos' },
                { status: 500 }
            );
        }

        return NextResponse.json({ videos: data || [] });

    } catch (error) {
        console.error('Curated videos fetch error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
