import React from "react"
import { Text, Button } from "tamagui"
import { useMutation } from "@tanstack/react-query"
import { useTRPC } from "@/src/providers/TRPCProvider"
import { useAuth } from "@/src/hooks/useAuth"
import { AlertModal } from "@/src/components/AlertModal"
import { useToastError } from "@/src/hooks/useToastError"
import { useToastController } from "@tamagui/toast"

export const DeleteAccountButton: React.FC = () => {
  const trpc = useTRPC()
  const { handleError } = useToastError()
  const { logout } = useAuth()
  const toast = useToastController()

  const { mutateAsync: removeUser, isPending } = useMutation(
    trpc.user.remove.mutationOptions(),
  )

  return (
    <AlertModal
      title="Delete Account"
      message="Are you sure you want to permanently delete your account and all data? This action cannot be undone."
      buttons={[
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete Account",
          style: "destructive",
          onPress: async () => {
            try {
              await removeUser()
            } catch (error) {
              handleError(error, "Failed to delete account. Please try again.")
              return
            }
            // Sign out after successful deletion; logout() also clears every
            // cached query so the next user never sees this account's data.
            // Failures are reported inside logout().
            const result = await logout()
            if (!result.success) {
              toast.show(
                "Your account was deleted, but signing out failed. Please restart the app.",
                { type: "error", native: false },
              )
            }
          },
        },
      ]}
    >
      <Button
        size="$3"
        backgroundColor="$red9"
        disabled={isPending}
        pressStyle={{
          backgroundColor: "$red10",
        }}
        hoverStyle={{
          backgroundColor: "$red10",
        }}
      >
        <Text color="white" fontWeight={"400"}>
          {isPending ? "Deleting..." : "Delete account"}
        </Text>
      </Button>
    </AlertModal>
  )
}
