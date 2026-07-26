// @MX:NOTE: [AUTO] Modal-based bottom sheet for creating highlights from long-pressed script lines.
// @MX:SPEC: SPEC-MOBILE-005 - REQ-E-007, REQ-E-008, REQ-C-001
import React, { useCallback, useEffect, useRef, useState } from "react";
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
import { appTokens } from "../../theme/app-tokens";

interface HighlightBottomSheetProps {
  visible: boolean;
  sentence: Sentence | null;
  saving: boolean;
  onSave: (userNote: string, selectedText?: string) => void;
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
  const [selection, setSelection] = useState<{ start: number; end: number }>({
    start: 0,
    end: 0,
  });
  const selectableRef = useRef<TextInput>(null);

  const fullText = sentence?.text ?? "";
  const hasSelection = selection.start !== selection.end;
  const selectedText = hasSelection
    ? fullText.slice(selection.start, selection.end)
    : "";

  useEffect(() => {
    if (visible) {
      setNote("");
      setSelection({ start: 0, end: 0 });
    }
  }, [visible]);

  const handleSave = useCallback(() => {
    onSave(note, hasSelection ? selectedText : undefined);
    setNote("");
  }, [note, hasSelection, selectedText, onSave]);

  const handleClose = useCallback(() => {
    setNote("");
    onClose();
  }, [onClose]);

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

          <Text style={styles.label}>
            {hasSelection ? "선택한 부분" : "문장을 드래그해서 선택하세요"}
          </Text>

          {hasSelection ? (
            <View style={styles.selectedPreview}>
              <Text style={styles.selectedText}>{selectedText}</Text>
            </View>
          ) : null}

          <TextInput
            ref={selectableRef}
            style={styles.sentenceText}
            value={fullText}
            editable={false}
            multiline
            selectTextOnFocus={false}
            selection={undefined}
            onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
            contextMenuHidden={true}
          />

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
              {saving
                ? "저장 중..."
                : hasSelection
                  ? `"${selectedText.length > 20 ? selectedText.slice(0, 20) + "…" : selectedText}" 저장`
                  : "전체 문장 저장"}
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
    backgroundColor: appTokens.color.v0729ae0e,
  },
  sheetWrapper: {
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: appTokens.spacing.n20,
    paddingBottom: appTokens.spacing.n36,
    gap: appTokens.spacing.n12,
  },
  handle: {
    width: appTokens.size.n40,
    height: appTokens.size.n4,
    borderRadius: radius.sm,
    backgroundColor: colors.border,
    alignSelf: "center",
    marginBottom: appTokens.spacing.n8,
  },
  label: {
    fontSize: appTokens.typography.n12,
    color: colors.textMuted,
    fontWeight: font.weight.semibold,
  },
  selectedPreview: {
    backgroundColor: colors.warningBg,
    padding: appTokens.spacing.n10,
    borderRadius: radius.md,
  },
  selectedText: {
    fontSize: appTokens.typography.n15,
    color: colors.text,
    lineHeight: appTokens.typography.n22,
    fontWeight: font.weight.semibold,
  },
  sentenceText: {
    fontSize: appTokens.typography.n15,
    color: colors.textSecondary,
    lineHeight: appTokens.typography.n22,
    backgroundColor: colors.bgMuted,
    padding: appTokens.spacing.n10,
    borderRadius: radius.md,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: appTokens.spacing.n12,
    fontSize: appTokens.typography.n15,
    color: colors.text,
    minHeight: appTokens.size.n80,
    textAlignVertical: "top",
  },
  saveButton: {
    backgroundColor: colors.text,
    paddingVertical: appTokens.spacing.n14,
    borderRadius: radius.pill,
    alignItems: "center",
  },
  saveButtonDisabled: {
    backgroundColor: colors.disabled,
  },
  saveButtonText: {
    color: colors.textInverse,
    fontSize: appTokens.typography.n16,
    fontWeight: font.weight.semibold,
  },
});
