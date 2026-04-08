import React, { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { CardComment } from "@inputenglish/shared";
import CommentInput from "./CommentInput";
import { colors, font, radius, spacing } from "@/theme";

interface CommentThreadProps {
  comments: CardComment[];
  onAdd: (body: string) => void;
  onEdit: (commentId: string, body: string) => void;
  onDelete: (commentId: string) => void;
  saving?: boolean;
  onInputActivate?: () => void;
}

export default function CommentThread({
  comments,
  onAdd,
  onEdit,
  onDelete,
  saving = false,
  onInputActivate,
}: CommentThreadProps) {
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
                      color={colors.textMuted}
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
                      color={colors.textMuted}
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

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  commentRow: {},
  commentBubble: {
    backgroundColor: colors.bgSubtle,
    borderRadius: radius.md,
    padding: spacing.sm + spacing.xs,
    gap: spacing.xs,
  },
  commentBody: {
    fontSize: font.size.md - 1,
    lineHeight: (font.size.md - 1) * 1.45,
    color: colors.text,
  },
  commentMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  commentTimestamp: {
    fontSize: font.size.xs,
    color: colors.textMuted,
    letterSpacing: 0.2,
  },
  commentActions: {
    flexDirection: "row",
    gap: spacing.sm + spacing.xs,
  },
  addTrigger: {
    backgroundColor: colors.bgMuted,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm + spacing.xs,
  },
  addTriggerText: {
    fontSize: font.size.sm,
    color: colors.textSecondary,
    letterSpacing: 0.2,
  },
});
