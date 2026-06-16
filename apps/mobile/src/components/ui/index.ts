/**
 * Editorial-tech UI surface for the mobile app.
 *
 * Single import point: `@/components/ui`. Re-exports FramingUI's RN primitives
 * (which consume the active theme) plus the local pill Button and the app theme
 * hooks. Screens build from these — never from raw colors/spacing literals.
 */

export {
  Screen,
  Section,
  ScreenHeader,
  Stack,
  Card,
  Text,
  Heading,
  Badge,
  SegmentedControl,
  ListItem,
  ListSection,
  TextField,
  TextArea,
  Switch,
  Checkbox,
  RadioGroup,
  Modal,
  IconButton,
  EmptyState,
  InlineMessage,
  ActionRow,
  Avatar,
  FormSection,
  PickerField,
  useTheme,
  createThemedStyles,
} from "@framingui/react-native";

export { Button, type ButtonProps } from "./Button";

export {
  AppThemeProvider,
  ImmersiveThemeProvider,
  useThemeMode,
  type ThemeMode,
} from "@/theme/ThemeProvider";
