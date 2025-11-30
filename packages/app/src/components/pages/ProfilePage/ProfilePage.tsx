import React from "react";
import { YStack } from "tamagui";
import { UserInfo } from "@/src/components/pages/ProfilePage/UserInfo";
import { SignOutSection } from "@/src/components/pages/ProfilePage/SignOutSection";

export const ProfilePage: React.FC = () => {
  return (
    <YStack flex={1} backgroundColor="$background">
      <UserInfo />
      <SignOutSection />
    </YStack>
  );
};
