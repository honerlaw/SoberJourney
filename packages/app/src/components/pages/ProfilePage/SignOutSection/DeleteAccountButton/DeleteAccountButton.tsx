import React from "react";
import { Text, Button } from "tamagui";
import { useMutation } from "@tanstack/react-query";
import { useTRPC } from "@/src/providers/TRPCProvider";
import { useReportError } from "@/src/hooks/useReportError";
import { useAuth } from "@/src/hooks/useAuth";
import { AlertModal } from "@/src/components/AlertModal";

export const DeleteAccountButton: React.FC = () => {
  const trpc = useTRPC();
  const { report } = useReportError();
  const { logout } = useAuth();

  const { mutateAsync: removeUser, isPending } = useMutation(
    trpc.user.remove.mutationOptions(),
  );

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
              await removeUser();
              // Sign out the user after successful deletion
              await logout();
            } catch (error) {
              report(error, "Failed to delete account. Please try again.");
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
  );
};
