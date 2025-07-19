import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SituationshipListScreen } from '../screens/SituationshipListScreen';
import SituationshipDetailScreen from '../screens/SituationshipDetailScreen';
import ProfileScreen from '../screens/ProfileScreen';
import { SituationshipsProvider } from '../context/useSituationships';
// Import other main app screens here as they are developed
// import SettingsScreen from '../screens/SettingsScreen';
// import VoteResultScreen from '../screens/VoteResultScreen';

export type AppStackParamList = {
  Home: undefined; // Or SituationshipList
  SituationshipDetail: { situationshipId: string }; // Assuming it takes an ID
  Profile: undefined;
  // Settings: undefined;
  // VoteResult: undefined;
};

const Stack = createNativeStackNavigator<AppStackParamList>();

function AppNavigator() {
  return (
    <SituationshipsProvider>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Home" component={SituationshipListScreen} />
        <Stack.Screen name="SituationshipDetail" component={SituationshipDetailScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
        {/* Add other screens here */}
      </Stack.Navigator>
    </SituationshipsProvider>
  );
}

export default AppNavigator;
