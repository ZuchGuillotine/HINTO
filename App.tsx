/**
    * @description      : Main App Entry Point
    * @author           : 
    * @group            : 
    * @created          : 26/05/2025 - 17:49:24
    * 
    * MODIFICATION LOG
    * - Version         : 1.0.0
    * - Date            : 25/05/2025
    * - Author          : 
    * - Modification    : Removed GestureHandler and Reanimated dependencies completely
**/
// Import polyfills at the very top
import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ActivityIndicator, View, StyleSheet } from 'react-native';

// Import and configure Amplify
import { Amplify } from '@aws-amplify/core';
import amplifyconfig from './apps/hnnt-app/amplifyconfiguration.json';

// Import navigators
import AuthNavigator from './apps/hnnt-app/src/navigation/AuthNavigator';
import AppNavigator from './apps/hnnt-app/src/navigation/AppNavigator';

// Import auth context
import { AuthProvider, useAuth } from './apps/hnnt-app/src/hooks/useAuth';

// Configure Amplify
console.log('Configuring Amplify with config:', JSON.stringify(amplifyconfig, null, 2));
Amplify.configure(amplifyconfig); 

// Root component that uses the auth state
const AppRoot: React.FC = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return user ? <AppNavigator /> : <AuthNavigator />;
};

// Main App component
export default function App() {
  return (
    <SafeAreaProvider>
        <AuthProvider>
          <NavigationContainer>
            <AppRoot />
          </NavigationContainer>
        </AuthProvider>
      </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
