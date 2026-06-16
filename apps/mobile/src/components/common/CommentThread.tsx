import React, { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { CardComment } from "@inputenglish/shared";
import CommentInput from "./CommentInput";
import { useTheme, createThemedStyles } from "@/components/ui";

interface CommentThreadProps {
  comments: CardComment[];
  onAdd: (body: string) => void;
  onEdit: (commentId: string, body: string) => void;
  onDelete: (commentId: string) => void;
  saving?: boolean;
  onInputActivate?: () => void;
}

const getStyles = createThemedStyles((theme) => ({
  container: {
    gap: theme.spacing[2],
  },
  commentRow: {},
  commentBubble: {
    backgroundColor: theme.colors.surface.muted,
    borderRadius: theme.radius.md,
    padding: theme.spacing[2] + theme.spacing[1],
    gap: theme.spacing[1],
  },
  commentBody: {
    ...theme.typography.caption,
    color: theme.colors.text.primary,
  },
  commentMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  commentTimestamp: {
    ...theme.typography.caption,
    color: theme.colors.text.tertiary,
    letterSpacing: 0.2,
  },
  commentActions: {
    flexDirection: "row",
    gap: theme.spacing[2] + theme.spacing[1],
  },
  addTrigger: {
    backgroundColor: theme.colors.background.muted,
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing[2],
    paddingHorizontal: theme.spacing[2] + theme.spacing[1],
  },
  addTriggerText: {
    ...theme.typography.caption,
    color: theme.colors.text.secondary,
    letterSpacing: 0.2,
  },
}));

export default function CommentThread({
  comments,
  onAdd,
  onEdit,
  onDelete,
  saving = false,
  onInputActivate,
}: CommentThreadProps) {
  const theme = useTheme();
  const styles = getStyles(theme);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <View style={styles.container}>
      {comments.map((comment) => (
        <View key={comment.id} style={styles.commentRow}>
          {editingId === comment.id ? (
            <CommentInput
              initialValue={comment.body}
              onSave={(body) => {
                onEdit(comment.id, body);
                setEditingId(null);
              }}
              onCancel={() => setEditingId(null)}
              saving={saving}
            />
          ) : (
            <View style={styles.commentBubble}>
              <Text style={styles.commentBody}>{comment.body}</Text>
              <View style={styles.commentMeta}>
                <Text style={styles.commentTimestamp}>
                  {new Date(comment.createdAt).toLocaleString("ko-KR")}
                </Text>
                <View style={styles.commentActions}>
                  <TouchableOpacity
                    onPress={() => {
                      setEditingId(comment.id);
                      onInputActivate?.();
                    }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    testID={`comment-edit-${comment.id}`}
                  >
                    <Ionicons
                      name="pencil-outline"
                      size={14}
                      color={theme.colors.text.tertiary}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => onDelete(comment.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    testID={`comment-delete-${comment.id}`}
                  >
                    <Ionicons
                      name="trash-outline"
                      size={14}
                      color={theme.colors.text.tertiary}
                    />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </View>
      ))}

      {isAdding ? (
        <CommentInput
          onSave={(body) => {
            onAdd(body);
            setIsAdding(false);
          }}
          onCancel={() => setIsAdding(false)}
          saving={saving}
        />
      ) : (
        <TouchableOpacity
          style={styles.addTrigger}
          onPress={() => {
            setIsAdding(true);
            onInputActivate?.();
          }}
          activeOpacity={0.7}
          testID="comment-add-trigger"
        >
          <Text style={styles.addTriggerText}>메모 추가...</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
