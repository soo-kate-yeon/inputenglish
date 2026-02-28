import { TranscriptItem } from './transcript-parser';

const CACHE_KEY_PREFIX = 'transcript_cache_';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

interface CachedTranscript {
  videoId: string;
  transcript: TranscriptItem[];
  timestamp: number;
}

export class TranscriptCache {
  /**
   * Save raw transcript to sessionStorage with timestamp
   */
  static set(videoId: string, transcript: TranscriptItem[]): void {
    try {
      const cacheData: CachedTranscript = {
        videoId,
        transcript,
        timestamp: Date.now(),
      };
      sessionStorage.setItem(
        `${CACHE_KEY_PREFIX}${videoId}`,
        JSON.stringify(cacheData)
      );
    } catch (error) {
      console.warn('Failed to cache transcript:', error);
    }
  }

  /**
   * Get cached transcript if valid (not expired)
   */
  static get(videoId: string): TranscriptItem[] | null {
    try {
      const cached = sessionStorage.getItem(`${CACHE_KEY_PREFIX}${videoId}`);
      if (!cached) return null;

      const cacheData: CachedTranscript = JSON.parse(cached);

      // Check if cache is expired
      const isExpired = Date.now() - cacheData.timestamp > CACHE_DURATION;
      if (isExpired) {
        this.remove(videoId);
        return null;
      }

      return cacheData.transcript;
    } catch (error) {
      console.warn('Failed to retrieve cached transcript:', error);
      return null;
    }
  }

  /**
   * Remove cached transcript for specific video
   */
  static remove(videoId: string): void {
    try {
      sessionStorage.removeItem(`${CACHE_KEY_PREFIX}${videoId}`);
    } catch (error) {
      console.warn('Failed to remove cached transcript:', error);
    }
  }

  /**
   * Clear all cached transcripts
   */
  static clear(): void {
    try {
      const keys = Object.keys(sessionStorage);
      keys.forEach(key => {
        if (key.startsWith(CACHE_KEY_PREFIX)) {
          sessionStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.warn('Failed to clear transcript cache:', error);
    }
  }

  /**
   * Fetch transcript with caching - tries cache first, then API
   */
  static async fetchWithCache(videoId: string): Promise<TranscriptItem[]> {
    // Try cache first
    const cached = this.get(videoId);
    if (cached) {
      console.log(`Using cached transcript for video: ${videoId}`);
      return cached;
    }

    // Fetch from API
    console.log(`Fetching fresh transcript for video: ${videoId}`);
    const response = await fetch(`/api/transcript?videoId=${videoId}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch transcript: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.success || !data.transcript) {
      throw new Error('Invalid transcript response');
    }

    // Cache the raw transcript
    this.set(videoId, data.transcript);

    return data.transcript;
  }
}
