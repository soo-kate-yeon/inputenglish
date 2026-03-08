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
    marginVertical: 6,
  },
  scrollContent: {
    paddingHorizontal: 12,
    gap: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#C7C7CC",
    backgroundColor: "#F2F2F7",
  },
  chipSelected: {
    borderColor: "#007AFF",
    backgroundColor: "#E5F0FF",
  },
  chipDisabled: {
    opacity: 0.4,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#3C3C43",
  },
  chipTextSelected: {
    color: "#007AFF",
    fontWeight: "600",
  },
});
