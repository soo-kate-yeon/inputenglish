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
import { createThemedStyles, useTheme } from "@/components/ui";
import { trackEvent } from "../../lib/analytics";

const ICONS: Record<
  string,
  {
    active: keyof typeof Ionicons.glyphMap;
    inactive: keyof typeof Ionicons.glyphMap;
  }
> = {
  index: { active: "play-circle", inactive: "play-circle-outline" },
  archive: { active: "albums", inactive: "albums-outline" },
  profile: { active: "person", inactive: "person-outline" },
};

const LABELS: Record<string, string> = {
  index: "오늘",
  archive: "보관함",
  profile: "프로필",
};

export default function FloatingTabBar({
  state,
  navigation,
}: BottomTabBarProps) {
  const theme = useTheme();
  const styles = getStyles(theme);
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        { paddingBottom: Math.max(insets.bottom, theme.spacing[2]) },
      ]}
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
            trackEvent("tab_changed", {
              from: state.routes[state.index]?.name,
              to: route.name,
            });
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
              color={
                isFocused
                  ? theme.colors.text.primary
                  : theme.colors.text.tertiary
              }
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

const getStyles = createThemedStyles((theme) => ({
  container: {
    flexDirection: "row",
    backgroundColor: theme.colors.background.canvas,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border.default,
    ...Platform.select({
      ios: {
        shadowColor: theme.colors.text.primary,
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
    paddingTop: theme.spacing[2],
    paddingBottom: theme.spacing[1],
    gap: theme.spacing[1],
  },
  label: {
    fontSize: 10,
    letterSpacing: 0.3,
    fontWeight: "500",
    color: theme.colors.text.tertiary,
  },
  labelActive: {
    color: theme.colors.text.primary,
    fontWeight: "600",
  },
}));
