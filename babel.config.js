/**
    * @description      : Babel configuration for Expo project
    * @author           : 
    * @group            : 
    * @created          : 25/05/2025 - 12:45:41
    * 
    * MODIFICATION LOG
    * - Version         : 1.0.0
    * - Date            : 25/05/2025
    * - Author          : 
    * - Modification    : ALL REANIMATED WORKAROUNDS FAILED - Reanimated plugin disabled permanently
**/
module.exports = function (api) {  
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'react' }],
    ],
    plugins: [
      '@babel/plugin-transform-export-namespace-from',
      // ❌ REANIMATED PLUGIN DISABLED DUE TO INCOMPATIBILITY
      // The Reanimated Babel plugin cannot parse modern JavaScript syntax:
      // - OptionalCallExpression (?.())
      // - OptionalMemberExpression (?.)
      // - TSUnknownKeyword (unknown type)
      // - Array.at() method
      // All workarounds attempted and failed.
      // 'react-native-reanimated/plugin',
    ],
  };
}; 