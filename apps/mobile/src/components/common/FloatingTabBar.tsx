import React from "react";
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, font } from "../../theme";

const ICONS: Record<
  string,
  {
    active: keyof typeof Ionicons.glyphMap;
    inactive: keyof typeof Ionicons.glyphMap;
  }
> = {
  index: { active: "home", inactive: "home-outline" },
  archive: { active: "folder", inactive: "folder-outline" },
  profile: { active: "person", inactive: "person-outline" },
};

const LABELS: Record<string, string> = {
  index: "홈",
  archive: "보관함",
  profile: "프로필",
};

export default function FloatingTabBar({
  state,
  navigation,
}: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[styles.container, { paddingBottom: Math.max(insets.bottom, 8) }]}
    >
      {state.routes.map((route, index) => {
        const isFocused = state.index === index;
        const iconSet = ICONS[route.name] ?? {
          active: "ellipse" as const,
          inactive: "ellipse-outline" as const,
        };

        const onPress = () => {
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <TouchableOpacity
            key={route.key}
            style={styles.tab}
            onPress={onPress}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityState={{ selected: isFocused }}
            accessibilityLabel={LABELS[route.name]}
          >
            <Ionicons
              name={isFocused ? iconSet.active : iconSet.inactive}
              size={24}
              color={isFocused ? colors.text : colors.textMuted}
            />
            <Text style={[styles.label, isFocused && styles.labelActive]}>
              {LABELS[route.name]}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    backgroundColor: colors.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    ...Platform.select({
      ios: {
        shadowColor: colors.text,
        shadowOffset: { width: 0, height: -1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 10,
    paddingBottom: 4,
    gap: 3,
  },
  label: {
    fontSize: 10,
    letterSpacing: 0.3,
    fontWeight: font.weight.medium,
    color: colors.textMuted,
  },
  labelActive: {
    color: colors.text,
    fontWeight: font.weight.semibold,
  },
});
