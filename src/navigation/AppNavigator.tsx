import React from 'react';
import {StatusBar, Text} from 'react-native';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {DeviceScanScreen} from '../screens/DeviceScanScreen';
import {HomeScreen} from '../screens/HomeScreen';
import {SettingsScreen} from '../screens/SettingsScreen';
import {CANSnifferScreen} from '../screens/CANSnifferScreen';
import {useTheme} from '../theme';

export type RootStackParamList = {
  DeviceScan: undefined;
  Main: undefined;
  CANSniffer: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

function MainTabs() {
  const {colors, isDark} = useTheme();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        tabBarActiveTintColor: colors.speed,
        tabBarInactiveTintColor: colors.textSecondary,
      }}>
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: 'Dashboard',
          tabBarIcon: ({color}) => <Text style={{color, fontSize: 20}}>⚡</Text>,
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarLabel: 'Settings',
          tabBarIcon: ({color}) => <Text style={{color, fontSize: 20}}>⚙️</Text>,
        }}
      />
    </Tab.Navigator>
  );
}

export function AppNavigator() {
  const {colors, isDark} = useTheme();
  return (
    <NavigationContainer
      theme={{
        dark: isDark,
        colors: {
          primary: colors.speed,
          background: colors.background,
          card: colors.surface,
          text: colors.text,
          border: colors.border,
          notification: colors.rpm,
        },
        fonts: {
          regular: {fontFamily: 'System', fontWeight: '400'},
          medium: {fontFamily: 'System', fontWeight: '500'},
          bold: {fontFamily: 'System', fontWeight: '700'},
          heavy: {fontFamily: 'System', fontWeight: '900'},
        },
      }}>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle={isDark ? 'light-content' : 'dark-content'}
      />
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: {paddingTop: StatusBar.currentHeight ?? 0},
        }}>
        <Stack.Screen name="DeviceScan" component={DeviceScanScreen} />
        <Stack.Screen name="Main" component={MainTabs} />
        <Stack.Screen name="CANSniffer" component={CANSnifferScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
