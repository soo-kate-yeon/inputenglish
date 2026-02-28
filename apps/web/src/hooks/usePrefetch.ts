'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

/**
 * Hook to provide prefetching capabilities for video and session data.
 */
export function usePrefetch() {
    const queryClient = useQueryClient();

    const prefetchVideo = useCallback((videoId: string) => {
        queryClient.prefetchQuery({
            queryKey: ['video', videoId],
            queryFn: async () => {
                const response = await fetch(`/api/curated-videos/${videoId}`);
                if (!response.ok) throw new Error('Failed to fetch video');
                return response.json();
            },
            staleTime: 5 * 60 * 1000,
        });
    }, [queryClient]);

    const prefetchSession = useCallback((sessionId: string) => {
        queryClient.prefetchQuery({
            queryKey: ['session', sessionId],
            queryFn: async () => {
                const response = await fetch(`/api/learning-sessions?sessionId=${sessionId}`);
                if (!response.ok) throw new Error('Failed to fetch session');
                const data = await response.json();
                return data.sessions?.[0];
            },
            staleTime: 5 * 60 * 1000,
        });
    }, [queryClient]);

    return { prefetchVideo, prefetchSession };
}
