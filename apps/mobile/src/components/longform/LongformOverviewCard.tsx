import React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { LongformPackDetail } from "@/lib/api";
import { colors, font, radius, spacing } from "@/theme";

interface LongformOverviewCardProps {
  pack: LongformPackDetail;
}

function renderTags(tags: string[]) {
  return (
    <View style={styles.tagRow}>
      {tags.map((tag) => (
        <View key={tag} style={styles.tagChip}>
          <Text style={styles.tagChipText}>{tag}</Text>
        </View>
      ))}
    </View>
  );
}

export default function LongformOverviewCard({
  pack,
}: LongformOverviewCardProps) {
  const tags = Array.from(
    new Set([...(pack.topic_tags ?? []), ...(pack.content_tags ?? [])]),
  ).filter(Boolean);

  return (
    <View style={styles.card}>
      <View style={styles.copyBlock}>
        <Text style={styles.eyebrow}>전체 듣기</Text>
        <Text style={styles.title}>{pack.title}</Text>
        {pack.subtitle ? (
          <Text style={styles.subtitle}>{pack.subtitle}</Text>
        ) : null}
        {pack.description ? (
          <Text style={styles.description}>{pack.description}</Text>
        ) : null}
      </View>

      {tags.length > 0 ? renderTags(tags) : null}

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>
          이번 롱폼에서 먼저 잡아둘 포인트예요
        </Text>
        <Text style={styles.sectionBody}>
          {pack.context?.listening_takeaway ||
            pack.talk_summary ||
            "듣다 보면 핵심 흐름이 자연스럽게 잡히도록 정리해둘게요."}
        </Text>
      </View>

      {pack.context?.speaker_snapshot || pack.speaker_summary ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>출연자 맥락</Text>
          <Text style={styles.sectionBody}>
            {pack.context?.speaker_snapshot || pack.speaker_summary}
          </Text>
        </View>
      ) : null}

      {pack.context?.why_this_segment ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>왜 이 구간을 들으면 좋은가요</Text>
          <Text style={styles.sectionBody}>
            {pack.context.why_this_segment}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgDarkMuted,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderOnDark,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  copyBlock: {
    gap: spacing.sm,
  },
  eyebrow: {
    fontSize: font.size.xs,
    lineHeight: 16,
    color: colors.textOnDarkMuted,
    fontWeight: font.weight.semibold,
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  title: {
    fontSize: font.size.xl,
    lineHeight: 30,
    color: colors.textOnDark,
    fontWeight: font.weight.semibold,
  },
  subtitle: {
    fontSize: font.size.md,
    lineHeight: 22,
    color: colors.textOnDarkSecondary,
    fontWeight: font.weight.medium,
  },
  description: {
    fontSize: font.size.md,
    lineHeight: 24,
    color: colors.textOnDarkSecondary,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  tagChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: colors.borderOnDark,
  },
  tagChipText: {
    fontSize: font.size.sm,
    lineHeight: 18,
    color: colors.textOnDarkSecondary,
    fontWeight: font.weight.medium,
  },
  section: {
    gap: spacing.xs,
  },
  sectionLabel: {
    fontSize: font.size.sm,
    lineHeight: 18,
    color: colors.textOnDarkMuted,
    fontWeight: font.weight.semibold,
  },
  sectionBody: {
    fontSize: font.size.md,
    lineHeight: 24,
    color: colors.textOnDark,
  },
});
