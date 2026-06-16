import React, { useRef, useState } from "react";
import { TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, createThemedStyles } from "@/components/ui";

interface CommentInputProps {
  initialValue?: string;
  placeholder?: string;
  saving?: boolean;
  onSave: (body: string) => void;
  onCancel: () => void;
}

const getStyles = createThemedStyles((theme) => ({
  container: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.spacing[2],
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.border.default,
    borderRadius: theme.radius.lg,
    padding: theme.spacing[2] + theme.spacing[1],
    ...theme.typography.body,
    color: theme.colors.text.primary,
    minHeight: 40,
    textAlignVertical: "top",
  },
}));

export default function CommentInput({
  initialValue = "",
  placeholder = "메모 추가...",
  saving = false,
  onSave,
  onCancel,
}: CommentInputProps) {
  const theme = useTheme();
  const styles = getStyles(theme);
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
        placeholderTextColor={theme.colors.text.tertiary}
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
          color={
            canSave
              ? theme.colors.action.primary
              : theme.colors.action.primaryDisabled
          }
        />
      </TouchableOpacity>
    </View>
  );
}
