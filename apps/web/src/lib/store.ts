// @MX:NOTE: Re-exports useStore from web-specific stores instantiation.
// Implementation has moved to @shadowoo/shared (createAppStore factory).
// Web instantiation is in src/lib/stores.ts.
export { useStore } from './stores';
// Re-export types from shared package for backward compatibility
export type { Video, Session, AppHighlight as Highlight, SavedSentence, AINote } from '@shadowoo/shared';
