interface VideoListModalProps {
    show: boolean;
    videos: Array<{ video_id: string; title: string; created_at: string }>;
    onClose: () => void;
    onSelect: (videoId: string) => void;
}

export function VideoListModal({ show, videos, onClose, onSelect }: VideoListModalProps) {
    if (!show) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-8" onClick={onClose}>
            <div className="bg-surface rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-secondary-200 flex justify-between items-center bg-secondary-50">
                    <h2 className="font-bold text-lg text-secondary-900">Existing Videos ({videos.length})</h2>
                    <button onClick={onClose} className="text-secondary-500 hover:text-secondary-900">✕</button>
                </div>
                <div className="flex-1 overflow-y-auto p-2">
                    {videos.length === 0 ? (
                        <div className="p-8 text-center text-secondary-500">No videos found.</div>
                    ) : (
                        <div className="space-y-1">
                            {videos.map((v) => (
                                <button
                                    key={v.video_id}
                                    onClick={() => {
                                        if (confirm('Load this video? Unsaved changes will be lost.')) {
                                            onSelect(v.video_id);
                                        }
                                    }}
                                    className="w-full text-left p-3 hover:bg-secondary-100 rounded-lg flex justify-between items-center group transition-colors"
                                >
                                    <div>
                                        <div className="font-medium text-secondary-900">{v.title || v.video_id}</div>
                                        <div className="text-xs text-secondary-500">{new Date(v.created_at).toLocaleDateString()}</div>
                                    </div>
                                    <span className="text-xs bg-primary-100 text-primary-700 px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                                        Edit
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
