import React from "react"
import { Button, Text, XStack } from "tamagui"

type Tab<T extends string> = {
  value: T
  label: string
}

type TabSelectorProps<T extends string> = {
  tabs: Tab<T>[]
  activeTab: T
  onTabChange: (tab: T) => void
}

export function TabSelector<T extends string>({
  tabs,
  activeTab,
  onTabChange,
}: TabSelectorProps<T>) {
  return (
    <XStack
      backgroundColor="$color3"
      borderRadius="$4"
      borderWidth={1}
      borderColor="$color5"
    >
      {tabs.map((tab, index) => (
        <Button
          key={tab.value}
          flex={1}
          size="$3"
          backgroundColor={activeTab === tab.value ? "$color6" : "transparent"}
          borderTopRightRadius={index === tabs.length - 1 ? "$4" : "0"}
          borderTopLeftRadius={index === 0 ? "$4" : "0"}
          borderBottomRightRadius={index === tabs.length - 1 ? "$4" : "0"}
          borderBottomLeftRadius={index === 0 ? "$4" : "0"}
          pressStyle={{ opacity: 0.8 }}
          onPress={() => onTabChange(tab.value)}
        >
          <Text
            fontSize="$3"
            fontWeight={activeTab === tab.value ? "600" : "400"}
            color={activeTab === tab.value ? "$color12" : "$color11"}
          >
            {tab.label}
          </Text>
        </Button>
      ))}
    </XStack>
  )
}
