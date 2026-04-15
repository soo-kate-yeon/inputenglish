import type { ImageSourcePropType } from "react-native";

const speakerAssetMap: Record<string, ImageSourcePropType> = {
  "jensen-huang": require("../../assets/images/speakers/jensen-huang.webp"),
  jennie: require("../../assets/images/speakers/jennie.webp"),
  "jennie-kim": require("../../assets/images/speakers/jennie.webp"),
  "speaker-1": require("../../assets/images/speakers/jennie.webp"),
  "karoline-leavitt": require("../../assets/images/speakers/karoline-leavitt.webp"),
};

const speakerNameAssetMap: Record<string, ImageSourcePropType> = {
  "jensen huang": require("../../assets/images/speakers/jensen-huang.webp"),
  "젠슨 황": require("../../assets/images/speakers/jensen-huang.webp"),
  jennie: require("../../assets/images/speakers/jennie.webp"),
  "jennie kim": require("../../assets/images/speakers/jennie.webp"),
  제니: require("../../assets/images/speakers/jennie.webp"),
  "karoline leavitt": require("../../assets/images/speakers/karoline-leavitt.webp"),
  "캐럴라인 레빗": require("../../assets/images/speakers/karoline-leavitt.webp"),
  "캐럴라인 레빗 (karoline leavitt)": require("../../assets/images/speakers/karoline-leavitt.webp"),
};

function normalizeSpeakerKey(value?: string | null): string {
  return value?.trim().toLowerCase().replace(/\s+/g, " ") ?? "";
}

export function getSpeakerImageSource(
  slug?: string | null,
  remoteUri?: string | null,
  name?: string | null,
): ImageSourcePropType | null {
  const normalizedSlug = normalizeSpeakerKey(slug);
  const normalizedName = normalizeSpeakerKey(name);

  if (remoteUri) {
    return { uri: remoteUri };
  }

  if (normalizedSlug && speakerAssetMap[normalizedSlug]) {
    return speakerAssetMap[normalizedSlug];
  }

  if (normalizedName && speakerNameAssetMap[normalizedName]) {
    return speakerNameAssetMap[normalizedName];
  }

  return null;
}
