const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);

// RIAMO_ALIAS
{
  const __p = require('path');
  const __orig = config.resolver.resolveRequest;
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (moduleName === 'expo-av') return { type: 'sourceFile', filePath: __p.resolve(__dirname, 'av-shim.js') };
    return __orig ? __orig(context, moduleName, platform) : context.resolveRequest(context, moduleName, platform);
  };
}

module.exports = config;
