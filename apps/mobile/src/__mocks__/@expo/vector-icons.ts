import React from "react";
import { Text } from "react-native";

const createMockIcon = (name: string) => {
  const MockIcon = ({ testID, ...props }: any) =>
    React.createElement(Text, { testID: testID ?? name, ...props });
  MockIcon.displayName = name;
  return MockIcon;
};

export const Ionicons = createMockIcon("Ionicons");
export const MaterialIcons = createMockIcon("MaterialIcons");
export const FontAwesome = createMockIcon("FontAwesome");
export const FontAwesome5 = createMockIcon("FontAwesome5");
export const AntDesign = createMockIcon("AntDesign");
export const Entypo = createMockIcon("Entypo");
export const Feather = createMockIcon("Feather");
export const MaterialCommunityIcons = createMockIcon("MaterialCommunityIcons");
export const Octicons = createMockIcon("Octicons");
export const SimpleLineIcons = createMockIcon("SimpleLineIcons");
export const EvilIcons = createMockIcon("EvilIcons");
export const Foundation = createMockIcon("Foundation");
export const Zocial = createMockIcon("Zocial");

export default {
  Ionicons,
  MaterialIcons,
  FontAwesome,
  FontAwesome5,
  AntDesign,
  Entypo,
  Feather,
  MaterialCommunityIcons,
  Octicons,
  SimpleLineIcons,
  EvilIcons,
  Foundation,
  Zocial,
};
