import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(
    request: NextRequest,
    props: { params: Promise<{ videoId: string }> }
) {
    try {
        const supabase = await createClient();
        const params = await props.params;
        const { videoId } = params;

        const { data, error } = await supabase
            .from('curated_videos')
            .select('*')
            .eq('video_id', videoId)
            .single();

        if (error || !data) {
            return NextResponse.json(
                { error: 'Video not found' },
                { status: 404 }
            );
        }

        return NextResponse.json(data);

    } catch (error) {
        console.error('Curated video fetch error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
