/**
 * @MX:ANCHOR: [AUTO] Whitelist entry-rule validation — single authoritative gate
 *   deciding whether a candidate channel may be added to the Channel whitelist.
 * @MX:REASON: [AUTO] REQ-WEB-003-U3 defines three exclusion grounds via
 *   `legal_status` (unofficial reupload / embed-disabled / major-IP-excluded).
 *   EC-003-A requires that major-IP exclusion applies EVEN to officially
 *   published sources — legal_status already encodes this as a value distinct
 *   from 'official', so a single equality check against 'official' is the
 *   correct and complete implementation: any of the other three enum values
 *   rejects, with no separate "is this official" branch needed.
 * @MX:SPEC: SPEC-WEB-001 Phase 4 REQ-WEB-003-U3, AC-003-2, EC-003-A
 */
import type { ChannelLegalStatus } from "@inputenglish/shared";

export interface ChannelEntryCandidate {
  name: string;
  legalStatus: ChannelLegalStatus;
}

export interface ChannelEntryValidationResult {
  accepted: boolean;
  /** Rejection ground — the legal_status value that caused rejection, or null when accepted. */
  reason: Exclude<ChannelLegalStatus, "official"> | null;
}

/**
 * Validates a candidate channel against the whitelist entry rules.
 *
 * Only `legal_status === 'official'` passes. All other values reject:
 * - 'unofficial_reupload' — fan/unofficial reuploads and edited compilations.
 * - 'embed_disabled' — channels that disable iframe embedding (ToS conflict).
 * - 'major_ip_excluded' — major entertainment IP (Disney/Pixar/Marvel/Warner/
 *   Universal, etc.), excluded regardless of official/unofficial status (EC-003-A).
 */
export function validateChannelEntry(
  candidate: ChannelEntryCandidate,
): ChannelEntryValidationResult {
  if (candidate.legalStatus === "official") {
    return { accepted: true, reason: null };
  }

  return { accepted: false, reason: candidate.legalStatus };
}
