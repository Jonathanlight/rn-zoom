module.exports = function babelConfig(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // The worklets plugin has to come last.
    plugins: ['react-native-worklets/plugin'],
  };
};
