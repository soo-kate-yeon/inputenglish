module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      [
        "module-resolver",
        {
          root: ["./src"],
          alias: {
            "@": "./src",
          },
        },
      ],
      // react-native-reanimated/plugin MUST be last in the plugins array.
      // Required for worklet compilation (UI-thread animations).
      "react-native-reanimated/plugin",
    ],
  };
};
