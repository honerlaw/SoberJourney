import React from "react"
import { Stack, Text } from "tamagui"

type AvatarProps = {
  name: string
  size?: number
}

export const Avatar: React.FC<AvatarProps> = ({ name, size = 60 }) => {
  const getInitials = (fullName: string): string => {
    const names = fullName.trim().split(" ")
    if (names.length === 0) return "U"
    if (names.length === 1) return names[0].charAt(0).toUpperCase()
    return `${names[0].charAt(0)}${names[names.length - 1].charAt(0)}`.toUpperCase()
  }

  const initials = getInitials(name)

  return (
    <Stack
      width={size}
      height={size}
      borderRadius={size / 2}
      backgroundColor={"$color5"}
      justifyContent="center"
      alignItems="center"
    >
      <Text
        color="white"
        fontSize={size * 0.4}
        fontWeight="600"
        textAlign="center"
      >
        {initials}
      </Text>
    </Stack>
  )
}
