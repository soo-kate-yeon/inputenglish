// @MX:NOTE: [AUTO] Multi-select chip component for difficulty tags used in AI tip requests.
// Renders a horizontal ScrollView with selectable tag chips.
// @MX:SPEC: SPEC-MOBILE-006

import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { appTokens } from "../../theme/app-tokens";

const ALL_TAGS = ["연음", "문법", "발음", "속도"] as const;
export type DifficultyTag = (typeof ALL_TAGS)[number];

interface DifficultyTagSelectorProps {
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
  disabled?: boolean;
}

export default function DifficultyTagSelector({
  selectedTags,
  onTagsChange,
  disabled = false,
}: DifficultyTagSelectorProps) {
  const handleTagPress = (tag: string) => {
    if (disabled) return;
    const isSelected = selectedTags.includes(tag);
    if (isSelected) {
      onTagsChange(selectedTags.filter((t) => t !== tag));
    } else {
      onTagsChange([...selectedTags, tag]);
    }
  };

  return (
    <View style={styles.wrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {ALL_TAGS.map((tag) => {
          const isSelected = selectedTags.includes(tag);
          return (
            <TouchableOpacity
              key={tag}
              style={[
                styles.chip,
                isSelected && styles.chipSelected,
                disabled && styles.chipDisabled,
              ]}
              onPress={() => handleTagPress(tag)}
              disabled={disabled}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isSelected, disabled }}
              accessibilityLabel={tag}
            >
              <Text
                style={[styles.chipText, isSelected && styles.chipTextSelected]}
              >
                {tag}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginVertical: appTokens.spacing.n6,
  },
  scrollContent: {
    paddingHorizontal: appTokens.spacing.n12,
    gap: appTokens.spacing.n8,
    flexDirection: "row",
    alignItems: "center",
  },
  chip: {
    paddingHorizontal: appTokens.spacing.n14,
    paddingVertical: appTokens.spacing.n6,
    borderRadius: appTokens.radius.n16,
    borderWidth: 1.5,
    borderColor: appTokens.color.vd4916bc1,
    backgroundColor: appTokens.color.v56e5145b,
  },
  chipSelected: {
    borderColor: appTokens.color.v3f34b586,
    backgroundColor: appTokens.color.vb15b6034,
  },
  chipDisabled: {
    opacity: 0.4,
  },
  chipText: {
    fontSize: appTokens.typography.n13,
    fontWeight: appTokens.typography.n500,
    color: appTokens.color.vddbce3da,
  },
  chipTextSelected: {
    color: appTokens.color.v3f34b586,
    fontWeight: appTokens.typography.n600,
  },
});
