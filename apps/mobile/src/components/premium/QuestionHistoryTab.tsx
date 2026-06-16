// @MX:NOTE: [AUTO] Read-only history list of user's asked items (highlight questions + answers).
// @MX:SPEC: SPEC-INPUT-001 - REQ-INPUT-004-E2
import React, { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Text, View } from "react-native";
import type { AskedItem } from "@inputenglish/shared";
import { createThemedStyles, useTheme } from "@framingui/react-native";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

function AskedItemCard({ item }: { item: AskedItem }): React.JSX.Element {
  const styles = getStyles(useTheme());
  return (
    <View style={styles.card}>
      <Text style={styles.highlight}>{item.highlightText}</Text>
      {item.question ? (
        <Text style={styles.question}>{item.question}</Text>
      ) : null}
      {item.answer ? <Text style={styles.answer}>{item.answer}</Text> : null}
    </View>
  );
}

export default function QuestionHistoryTab(): React.JSX.Element {
  const styles = getStyles(useTheme());
  const { user } = useAuth();
  const [items, setItems] = useState<AskedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchItems() {
      const { data, error } = await supabase
        .from("asked_items")
        .select(
          "id, user_id, source_type, source_ref, highlight_text, question, answer, created_at",
        )
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });

      if (cancelled) return;

      if (error) {
        console.error("[QuestionHistoryTab] fetch error", error);
        setLoading(false);
        return;
      }

      // Map snake_case DB rows to camelCase AskedItem
      const mapped: AskedItem[] = (data ?? []).map(
        (row: {
          id: string;
          user_id: string;
          source_type: "reading" | "segment";
          source_ref: {
            type: "reading" | "segment";
            pieceId: string;
            position?: number;
          };
          highlight_text: string;
          question: string | null;
          answer: string | null;
          created_at: string;
        }) => ({
          id: row.id,
          userId: row.user_id,
          sourceType: row.source_type,
          sourceRef: row.source_ref,
          highlightText: row.highlight_text,
          question: row.question,
          answer: row.answer,
          createdAt: row.created_at,
        }),
      );

      setItems(mapped);
      setLoading(false);
    }

    fetchItems();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>아직 질문이 없어요</Text>
        <Text style={styles.emptySubtext}>
          글이나 영상에서 단어를 선택하고 질문해 보세요
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <AskedItemCard item={item} />}
      contentContainerStyle={styles.list}
    />
  );
}

const getStyles = createThemedStyles((theme) => ({
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing[6],
    gap: theme.spacing[2],
  },
  emptyText: {
    ...theme.typography.bodyStrong,
    color: theme.colors.text.primary,
  },
  emptySubtext: {
    ...theme.typography.caption,
    color: theme.colors.text.tertiary,
    textAlign: "center",
  },
  list: {
    padding: theme.spacing[4],
    gap: theme.spacing[3],
  },
  card: {
    backgroundColor: theme.colors.surface.muted,
    borderRadius: theme.radius.lg,
    padding: theme.spacing[4],
    gap: theme.spacing[2],
  },
  highlight: {
    ...theme.typography.bodyStrong,
    color: theme.colors.text.primary,
  },
  question: {
    ...theme.typography.caption,
    color: theme.colors.text.tertiary,
  },
  answer: {
    ...theme.typography.body,
    color: theme.colors.text.secondary,
  },
}));
