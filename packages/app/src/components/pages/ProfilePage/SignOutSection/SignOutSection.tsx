import React from "react";
import { YStack, Button, Separator, XStack, Text } from "tamagui";
import { LogOut } from "@tamagui/lucide-icons";
import { useAuth } from "@clerk/clerk-expo";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AlertModal, type AlertButton } from "../../../AlertModal";
import { useQueryClient } from "@tanstack/react-query";
import { DeleteAccountButton } from "./DeleteAccountButton";

export const SignOutSection: React.FC = () => {
  const { signOut } = useAuth();
  const { bottom } = useSafeAreaInsets();
  const client = useQueryClient();

  const alertButtons: AlertButton[] = [
    {
      text: "Cancel",
      style: "cancel",
    },
    {
      text: "Sign Out",
      style: "destructive",
      onPress: async () => {
        await signOut();
        client.invalidateQueries();
        client.resetQueries();
      },
    },
  ];

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
  );
};
