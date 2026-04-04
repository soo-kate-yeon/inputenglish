import React, { useRef, useState } from "react";
import { StyleSheet, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, spacing } from "@/theme";

interface CommentInputProps {
  initialValue?: string;
  placeholder?: string;
  saving?: boolean;
  onSave: (body: string) => void;
  onCancel: () => void;
}

export default function CommentInput({
  initialValue = "",
  placeholder = "메모 추가...",
  saving = false,
  onSave,
  onCancel,
}: CommentInputProps) {
  const [text, setText] = useState(initialValue);
  const isSavingRef = useRef(false);
  const canSave = text.trim().length > 0 && !saving;

  const handleSave = () => {
    if (!canSave) return;
    isSavingRef.current = true;
    onSave(text.trim());
    setText("");
  };

  const handleBlur = () => {
    // Skip cancel if save was just triggered
    if (isSavingRef.current) {
      isSavingRef.current = false;
      return;
    }
    onCancel();
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        value={text}
        onChangeText={setText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        multiline
        maxLength={500}
        autoFocus
        editable={!saving}
        onBlur={handleBlur}
        testID="comment-input"
      />
      <TouchableOpacity
        onPress={handleSave}
        disabled={!canSave}
        testID="comment-save"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons
          name="checkmark-circle"
          size={28}
          color={canSave ? colors.primary : colors.disabled}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.sm + spacing.xs,
    fontSize: 15,
    color: colors.text,
    minHeight: 40,
    textAlignVertical: "top",
  },
});
