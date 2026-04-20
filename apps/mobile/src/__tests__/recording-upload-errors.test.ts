jest.mock("@/lib/supabase", () => ({
  supabase: {},
}));

import {
  AiApiError,
  getReadableAiApiErrorMessage,
  getReadableRecordingUploadError,
} from "@/lib/ai-api";
import { getReadableTransformationUploadError } from "@/lib/transformation-api";

describe("recording upload error messaging", () => {
  it("maps missing recordings bucket to a migration hint for pronunciation uploads", () => {
    const error = new AiApiError("Bucket not found", "UPLOAD");

    expect(getReadableAiApiErrorMessage(error)).toBe(
      "개발 환경의 recordings 버킷이 아직 생성되지 않았어요. 로컬 Supabase를 다시 시작하거나 마이그레이션을 적용해주세요.",
    );
    expect(getReadableRecordingUploadError(error)).toBe(
      "개발 환경의 recordings 버킷이 아직 생성되지 않았어요. 로컬 Supabase를 다시 시작하거나 마이그레이션을 적용해주세요.",
    );
  });

  it("maps storage permission failures to an auth-aware upload message", () => {
    expect(
      getReadableTransformationUploadError(
        new Error("new row violates row-level security policy"),
      ),
    ).toBe(
      "녹음 업로드 권한이 없어요. 로그인 상태를 확인한 뒤 다시 시도해주세요.",
    );
  });
});
