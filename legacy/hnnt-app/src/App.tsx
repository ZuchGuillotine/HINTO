/**
    * @description      : 
    * @author           : 
    * @group            : 
    * @created          : 26/05/2025 - 17:55:22
    * 
    * MODIFICATION LOG
    * - Version         : 1.0.0
    * - Date            : 26/05/2025
    * - Author          : 
    * - Modification    : 
**/
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
// import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
// import { useColorScheme } from 'nativewind'; // If using NativeWind for dark mode toggle

// Assuming your navigators are here
import AuthNavigator from './navigation/AuthNavigator';
import AppNavigator from './navigation/AppNavigator';

// Import the AuthProvider and useAuth hook
// Assuming useAuth.ts is in ./hooks/useAuth.ts
import { AuthProvider, useAuth } from './hooks/useAuth'; 

// Placeholder for a loading spinner
import { ActivityIndicator, View, StyleSheet } from 'react-native';

// Sentry & Amplitude (configure elsewhere, initialize here if needed)
// import * as Sentry from '@sentry/react-native';
// import *s Amplitude from '@amplitude/react-native';

// Sentry.init({
//   dsn: 'YOUR_SENTRY_DSN',
//   // ... other Sentry config
// });

// Amplitude.init('YOUR_AMPLITUDE_API_KEY');

// Root component that uses the auth state
const AppRoot: React.FC = () => {
  const { user, isLoading } = useAuth(); // Consuming the context

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return user ? <AppNavigator /> : <AuthNavigator />;
};

// Main App component wraps everything with AuthProvider
export default function App() {
  // const { colorScheme, toggleColorScheme } = useColorScheme(); // For NativeWind dark mode

  return (
    <SafeAreaProvider>
        <AuthProvider> {/* AuthProvider wraps NavigationContainer and AppRoot */}
          <NavigationContainer
          // theme={colorScheme === 'dark' ? DarkTheme : DefaultTheme} // Example for dark/light theme with React Navigation
          >
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

// It's good practice to wrap your app in an ErrorBoundary
// import ErrorBoundary from './components/ErrorBoundary'; // Create this component
// const AppWithBoundary = () => (
//   <ErrorBoundary>
//     <App />
//   </ErrorBoundary>
// );
// export default AppWithBoundary;
