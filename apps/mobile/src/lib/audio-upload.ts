export type AudioUploadMeta = {
  extension: string;
  contentType: string;
};

function sanitizeExtension(extension: string): string {
  return extension.replace(/^\./, "").toLowerCase();
}

export function inferAudioUploadMeta(
  uri: string,
  blobType?: string | null,
): AudioUploadMeta {
  const normalizedUri = uri.split("?")[0].toLowerCase();
  const normalizedBlobType = (blobType ?? "").toLowerCase();

  if (
    normalizedUri.endsWith(".wav") ||
    normalizedBlobType.includes("audio/wav") ||
    normalizedBlobType.includes("audio/x-wav")
  ) {
    return { extension: "wav", contentType: "audio/wav" };
  }

  if (
    normalizedUri.endsWith(".caf") ||
    normalizedBlobType.includes("audio/x-caf") ||
    normalizedBlobType.includes("audio/caf")
  ) {
    return { extension: "caf", contentType: "audio/x-caf" };
  }

  if (
    normalizedUri.endsWith(".m4a") ||
    normalizedBlobType.includes("audio/mp4") ||
    normalizedBlobType.includes("audio/m4a") ||
    normalizedBlobType.includes("audio/aac")
  ) {
    return { extension: "m4a", contentType: "audio/mp4" };
  }

  const uriExtensionMatch = normalizedUri.match(/\.([a-z0-9]+)$/);
  if (uriExtensionMatch) {
    const extension = sanitizeExtension(uriExtensionMatch[1]);
    return {
      extension,
      contentType: normalizedBlobType || "application/octet-stream",
    };
  }

  return {
    extension: "m4a",
    contentType: normalizedBlobType || "audio/mp4",
  };
}

// @MX:ANCHOR: Forces blob.type to match the inferred upload contentType.
// @MX:REASON: On iOS release builds, fetch('file://*.wav') returns a Blob
//             whose `type` property is "audio/vnd.wave" (a valid but uncommon
//             variant). Supabase Storage rejects that MIME because the
//             `recordings` bucket whitelist only accepts "audio/wav" /
//             "audio/x-wav". Moreover, in React Native the supabase-js
//             upload() `contentType` option is often overridden by the
//             Blob's intrinsic type when the body is a Blob. Re-wrapping
//             the blob with an explicit, whitelisted type is the only
//             reliable way to control the uploaded Content-Type header.
export function normalizeAudioBlobForUpload(
  blob: Blob,
  meta: AudioUploadMeta,
): Blob {
  const targetType = meta.contentType;
  if ((blob.type ?? "").toLowerCase() === targetType.toLowerCase()) {
    return blob;
  }
  return new Blob([blob], { type: targetType });
}
