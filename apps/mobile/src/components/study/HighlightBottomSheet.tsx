// @MX:NOTE: [AUTO] Modal-based bottom sheet for creating highlights from long-pressed script lines.
// @MX:SPEC: SPEC-MOBILE-005 - REQ-E-007, REQ-E-008, REQ-C-001
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import type { Sentence } from "@inputenglish/shared";
import { colors, radius, font } from "../../theme";

interface HighlightBottomSheetProps {
  visible: boolean;
  sentence: Sentence | null;
  saving: boolean;
  onSave: (userNote: string) => void;
  onClose: () => void;
}

export default function HighlightBottomSheet({
  visible,
  sentence,
  saving,
  onSave,
  onClose,
}: HighlightBottomSheetProps): React.JSX.Element {
  const [note, setNote] = useState("");

  const handleSave = () => {
    onSave(note);
    setNote("");
  };

  const handleClose = () => {
    setNote("");
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={handleClose}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.sheetWrapper}
      >
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.label}>선택한 문장</Text>
          <Text style={styles.sentenceText} numberOfLines={3}>
            {sentence?.text ?? ""}
          </Text>
          <TextInput
            style={styles.input}
            placeholder="메모를 남겨보세요"
            value={note}
            onChangeText={setNote}
            multiline
            maxLength={200}
            placeholderTextColor="#aaa"
          />
          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={styles.saveButtonText}>
              {saving ? "저장 중..." : "저장"}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheetWrapper: {
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: 20,
    paddingBottom: 36,
    gap: 12,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: radius.sm,
    backgroundColor: colors.border,
    alignSelf: "center",
    marginBottom: 8,
  },
  label: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: font.weight.semibold,
  },
  sentenceText: {
    fontSize: 15,
    color: colors.text,
    lineHeight: 22,
    backgroundColor: colors.warningBg,
    padding: 10,
    borderRadius: radius.md,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 12,
    fontSize: 15,
    color: colors.text,
    minHeight: 80,
    textAlignVertical: "top",
  },
  saveButton: {
    backgroundColor: colors.text,
    paddingVertical: 14,
    borderRadius: radius.pill,
    alignItems: "center",
  },
  saveButtonDisabled: {
    backgroundColor: colors.disabled,
  },
  saveButtonText: {
    color: colors.textInverse,
    fontSize: 16,
    fontWeight: font.weight.semibold,
  },
});
