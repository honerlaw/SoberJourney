import React from "react"
import { YStack, Button, Separator, XStack, Text } from "tamagui"
import { LogOut } from "@tamagui/lucide-icons"
import { useAuth } from "@/src/hooks/useAuth"
import { useToastController } from "@tamagui/toast"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { AlertModal, type AlertButton } from "../../../AlertModal"
import { DeleteAccountButton } from "./DeleteAccountButton"

export const SignOutSection: React.FC = () => {
  const { logout } = useAuth()
  const toast = useToastController()
  const { bottom } = useSafeAreaInsets()

  const alertButtons: AlertButton[] = [
    {
      text: "Cancel",
      style: "cancel",
    },
    {
      text: "Sign Out",
      style: "destructive",
      onPress: async () => {
        // logout() signs out of Clerk, clears every cached query and
        // reports failures itself.
        const result = await logout()
        if (!result.success) {
          toast.show("Failed to sign out. Please try again.", {
            type: "error",
            native: false,
          })
        }
      },
    },
  ]

  return (
    <YStack paddingBottom={bottom * 1.3} paddingHorizontal={"$4"}>
      <Separator marginBottom="$4" />
      <XStack gap={"$4"}>
        <DeleteAccountButton />
        <AlertModal
          title="Sign Out"
          message="Are you sure you want to sign out?"
          buttons={alertButtons}
        >
          <Button flex={1} size="$3" iconAfter={LogOut}>
            <Text fontWeight={"500"} color="$color">
              Sign Out
            </Text>
          </Button>
        </AlertModal>
      </XStack>
    </YStack>
  )
}
