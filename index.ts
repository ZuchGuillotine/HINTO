/**
    * @description      : 
    * @author           : 
    * @group            : 
    * @created          : 30/06/2025 - 23:55:17
    * 
    * MODIFICATION LOG
    * - Version         : 1.0.0
    * - Date            : 30/06/2025
    * - Author          : 
    * - Modification    : 
**/
import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
