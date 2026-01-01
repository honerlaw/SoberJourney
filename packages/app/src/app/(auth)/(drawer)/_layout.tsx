import { Drawer } from "expo-router/drawer"

export default function DrawerLayout() {
  return (
    <Drawer
      screenOptions={{
        headerShown: false,
        headerBackButtonDisplayMode: "minimal",
        swipeEnabled: false,
        drawerPosition: "right",
      }}
      // @todo custom content for drawer, should be the sponsor AI options for now
      drawerContent={() => null}
    >
      <Drawer.Screen name="(tabs)" />
    </Drawer>
  )
}
