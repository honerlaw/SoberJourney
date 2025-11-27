const { getDefaultConfig } = require('expo/metro-config');
const { withTamagui } = require('@tamagui/metro-plugin');

const ALIASES = {
  'tslib': require.resolve('tslib/tslib.es6.js'),
};

module.exports = (() => {
  const config = getDefaultConfig(__dirname, {
    isCSSEnabled: true,
  });

  const { transformer, resolver } = config;

  config.transformer = {
    ...transformer,
    babelTransformerPath: require.resolve("react-native-svg-transformer/expo")
  };
  config.resolver = {
    ...resolver,
    assetExts: resolver.assetExts.filter((ext) => ext !== "svg"),
    sourceExts: [...resolver.sourceExts, "svg"],
    resolveRequest: (context, moduleName, platform) => {
      return context.resolveRequest(
        context,
        ALIASES[moduleName] ?? moduleName,
        platform
      );
    },
  };

  // Additional web-specific configuration for Apollo Client compatibility
  config.transformer = {
    ...config.transformer,
  };

  return withTamagui(config, {
    components: ['tamagui'],
    config: './tamagui.config.ts',
    outputCSS: './tamagui-web.css',
  });
})();
