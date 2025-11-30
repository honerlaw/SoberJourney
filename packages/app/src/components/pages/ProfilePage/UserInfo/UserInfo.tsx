import React from "react";
import { YStack, Text, H3 } from "tamagui";
import { useAuth } from "@/src/hooks/useAuth";
import { LoadingView } from "../../../LoadingView";
import { EmptyView } from "../../../EmptyView";
import { Avatar } from "./Avatar";

export const UserInfo: React.FC = () => {
  const { user, isLoaded } = useAuth();

  const email =
    user?.primaryEmailAddress?.emailAddress ||
    user?.emailAddresses?.[0]?.emailAddress;
  const displayName =
    user?.fullName ||
    `${user?.firstName || ""} ${user?.lastName || ""}`.trim() ||
    email?.split("@")[0];

  if (!isLoaded) {
    return <LoadingView />;
  }

  if (!user) {
    return <EmptyView />;
  }

  if (!email || !displayName) {
    return <EmptyView />;
  }

  return (
    <YStack flex={1}>
      <YStack padding="$4" paddingVertical={"$12"} gap="$4" justifyContent="center" alignItems="center">
        <Avatar name={displayName} size={150} />
        <YStack gap="$2">
          <H3 fontSize="$6" fontWeight="600" color="$color" textAlign="center">
            {displayName}
          </H3>
          <Text fontSize="$3" color="$gray10" textAlign="center">
            {email}
          </Text>
        </YStack>
      </YStack>
    </YStack>
  );
};
