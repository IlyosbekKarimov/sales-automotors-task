/**
 * Metro already applies `babel-preset-expo` by default; declaring it explicitly
 * lets Jest reuse the exact same transform for the unit tests.
 */
module.exports = function babelConfig(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
