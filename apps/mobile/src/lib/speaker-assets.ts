import type { ImageSourcePropType } from "react-native";

const speakerAssetMap: Record<string, ImageSourcePropType> = {
  "michelle-obama": require("../../assets/images/speakers/person_1.png"),
  oprah: require("../../assets/images/speakers/person_2.png"),
  "taylor-swift": require("../../assets/images/speakers/person_3.png"),
  zendaya: require("../../assets/images/speakers/person_4.png"),
  "emma-watson": require("../../assets/images/speakers/person_5.png"),
  "jensen-huang": require("../../assets/images/speakers/jensen-huang.webp"),
  jennie: require("../../assets/images/speakers/jennie.webp"),
  "jennie-kim": require("../../assets/images/speakers/jennie.webp"),
  "speaker-1": require("../../assets/images/speakers/person_6.png"),
  "ryan-reynolds": require("../../assets/images/speakers/person_7.png"),
  "matt-damon": require("../../assets/images/speakers/person_8.png"),
  "speaker-9": require("../../assets/images/speakers/person_9.png"),
  "simon-sinek": require("../../assets/images/speakers/person_10.png"),
  "conan-o'brien": require("../../assets/images/speakers/person_11.png"),
  "conan-obrien": require("../../assets/images/speakers/person_11.png"),
  "barack-obama": require("../../assets/images/speakers/person_12.png"),
  "karoline-leavitt": require("../../assets/images/speakers/karoline-leavitt.webp"),
};

const speakerNameAssetMap: Record<string, ImageSourcePropType> = {
  "michelle obama": require("../../assets/images/speakers/person_1.png"),
  oprah: require("../../assets/images/speakers/person_2.png"),
  "taylor swift": require("../../assets/images/speakers/person_3.png"),
  zendaya: require("../../assets/images/speakers/person_4.png"),
  "emma watson": require("../../assets/images/speakers/person_5.png"),
  "ryan reynolds": require("../../assets/images/speakers/person_7.png"),
  "matt damon": require("../../assets/images/speakers/person_8.png"),
  "simon sinek": require("../../assets/images/speakers/person_10.png"),
  "conan o'brien": require("../../assets/images/speakers/person_11.png"),
  "conan obrien": require("../../assets/images/speakers/person_11.png"),
  "barack obama": require("../../assets/images/speakers/person_12.png"),
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

function normalizeSpeakerSlug(value?: string | null): string {
  return value?.trim().toLowerCase().replace(/\s+/g, "-") ?? "";
}

function getSafeRemoteSpeakerUri(remoteUri?: string | null): string | null {
  if (!remoteUri) return null;

  const trimmed = remoteUri.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("https://")) {
    return encodeURI(trimmed);
  }

  if (trimmed.startsWith("http://")) {
    return encodeURI(`https://${trimmed.slice("http://".length)}`);
  }

  return null;
}

export function getSpeakerImageSource(
  slug?: string | null,
  remoteUri?: string | null,
  name?: string | null,
): ImageSourcePropType | null {
  const normalizedSlug = normalizeSpeakerSlug(slug);
  const normalizedName = normalizeSpeakerKey(name);

  if (normalizedSlug && speakerAssetMap[normalizedSlug]) {
    return speakerAssetMap[normalizedSlug];
  }

  if (normalizedName && speakerNameAssetMap[normalizedName]) {
    return speakerNameAssetMap[normalizedName];
  }

  const safeRemoteUri = getSafeRemoteSpeakerUri(remoteUri);
  if (safeRemoteUri) {
    return { uri: safeRemoteUri };
  }

  return null;
}
