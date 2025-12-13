import { BookOpen, Home } from "@tamagui/lucide-icons";
import { Tabs } from "expo-router";
import { NativeTabs, Icon, Label } from 'expo-router/unstable-native-tabs';
import { Platform } from "react-native";

export default function TabsLayout() {
  if (Platform.OS !== "web") {
    return <NativeTabs>
      <NativeTabs.Trigger name="dashboard">
        <Label>Home</Label>
        <Icon sf="house.fill" drawable="custom_android_drawable" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="journal">
        <Label>Journal</Label>
        <Icon sf="book" drawable="custom_settings_drawable" />
      </NativeTabs.Trigger>
    </NativeTabs>
  }
  
  return (
    <Tabs
      screenOptions={{
        headerShadowVisible: false,
        tabBarShowLabel: true,
        headerBackButtonDisplayMode: "minimal"
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Home color={color} size={size} pointerEvents="none" />
          ),
        }}
      />
      <Tabs.Screen
        name="journal"
        options={{
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <BookOpen color={color} size={size} pointerEvents="none" />
          ),
        }}
      />
    </Tabs>
  );
}
