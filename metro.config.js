const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Disable package.json exports support temporarily for better compatibility
// Can be re-enabled once all dependencies support it properly
config.resolver.unstable_enablePackageExports = false;

// Add any additional resolver configurations if needed
config.resolver.alias = {
  // Add any aliases if needed for compatibility
};

module.exports = config; 