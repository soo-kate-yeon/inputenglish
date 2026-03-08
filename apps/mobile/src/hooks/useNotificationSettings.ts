// @MX:NOTE: Local notification preference store backed by MMKV
// @MX:SPEC: SPEC-MOBILE-007 - AC-PUSH-006 notification settings UI
import { useState, useCallback } from "react";
import storage from "@/lib/mmkv";

const KEYS = {
  studyReminder: "notif_study_reminder",
  newContent: "notif_new_content",
  streak: "notif_streak",
} as const;

type NotificationKey = keyof typeof KEYS;

function getStoredBool(key: string, defaultValue = true): boolean {
  const value = storage.getString(key);
  if (value === undefined) return defaultValue;
  return value === "true";
}

export function useNotificationSettings() {
  const [studyReminder, setStudyReminderState] = useState(() =>
    getStoredBool(KEYS.studyReminder),
  );
  const [newContent, setNewContentState] = useState(() =>
    getStoredBool(KEYS.newContent),
  );
  const [streak, setStreakState] = useState(() => getStoredBool(KEYS.streak));

  const toggle = useCallback((key: NotificationKey) => {
    const mmkvKey = KEYS[key];
    const current = getStoredBool(mmkvKey);
    const next = !current;
    storage.set(mmkvKey, String(next));

    if (key === "studyReminder") setStudyReminderState(next);
    else if (key === "newContent") setNewContentState(next);
    else if (key === "streak") setStreakState(next);
  }, []);

  return { studyReminder, newContent, streak, toggle };
}
