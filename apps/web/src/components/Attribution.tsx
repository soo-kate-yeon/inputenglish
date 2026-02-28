import type { CuratedVideo } from '@shadowoo/shared';

interface AttributionProps {
    video: CuratedVideo;
}

export function Attribution({ video }: AttributionProps) {
    return (
        <div className="mt-6 pt-4 border-t border-secondary-300">
            <div className="text-sm text-secondary-600 space-y-1">
                <p>
                    <strong>Original Content by:</strong>{' '}
                    <a
                        href={video.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary-500 hover:underline"
                    >
                        {video.channel_name || 'YouTube'}
                    </a>
                </p>
                <p>
                    <strong>Educational Excerpt:</strong> {Math.floor(video.snippet_duration / 60)}:
                    {String(Math.floor(video.snippet_duration % 60)).padStart(2, '0')} minutes
                </p>
                <p className="text-xs text-secondary-500 mt-2">
                    This is a curated educational excerpt for language learning purposes.
                    If you are the copyright holder and wish to have this content removed,
                    please contact us.
                </p>
            </div>
        </div>
    );
}
