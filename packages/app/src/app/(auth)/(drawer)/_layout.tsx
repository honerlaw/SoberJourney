import { ConversationProvider } from "@/src/providers/ConversationProvider"
import { ConversationDrawerContent } from "@/src/components/ConversationDrawerContent"
import { Drawer } from "expo-router/drawer"

export default function DrawerLayout() {
  return (
    <ConversationProvider>
      <Drawer
        screenOptions={{
          headerShown: false,
          headerBackButtonDisplayMode: "minimal",
          swipeEnabled: false,
          drawerPosition: "right",
        }}
        drawerContent={(props) => <ConversationDrawerContent {...props} />}
      >
        <Drawer.Screen name="(tabs)" />
      </Drawer>
    </ConversationProvider>
  )
}
