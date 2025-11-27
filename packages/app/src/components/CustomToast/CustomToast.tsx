import { Toast, useToastState } from "@tamagui/toast";
import React from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useWindowDimensions, XStack } from "tamagui";
import { AlertTriangle, Check } from "@tamagui/lucide-icons";

type ToastIconProps = {
  type: "error" | "success";
};

const ToastIcon: React.FC<ToastIconProps> = ({ type }) => {
  switch (type) {
    case "error":
      return <AlertTriangle size={24} color="$red10" />;
    case "success":
      return <Check size={24} color="$green10" />;
  }
};

type CustomToastType = {
  type: "error" | "success";
} & ReturnType<typeof useToastState>;

export const CustomToast = () => {
  const toast = useToastState() as CustomToastType;
  const inset = useSafeAreaInsets();
  const dimensions = useWindowDimensions();
  const type = toast?.type;

  if (!toast || toast?.isHandledNatively) {
    return null;
  }

  return (
    <Toast
      animation={"bouncy"}
      key={toast.id}
      duration={toast.duration}
      position="absolute"
      top={inset.top + 16}
      width={dimensions.width}
      backgroundColor={"transparent"}
      justifyContent="center"
      alignItems="center"
      enterStyle={{ opacity: 0, transform: [{ translateY: 100 }] }}
      exitStyle={{ opacity: 0, transform: [{ translateY: 100 }] }}
      transform={[{ translateY: 0 }]}
      opacity={1}
      scale={1}
      viewportName={toast.viewportName}
    >
      <XStack
        display="flex"
        paddingVertical="$3"
        paddingHorizontal="$4"
        borderRadius="$4"
        alignItems="center"
        gap="$3"
        borderWidth={1}
        justifyContent="center"
        backgroundColor={"$background"}
      >
        <ToastIcon type={type} />
        <Toast.Title fontWeight={"600"}>{toast.title}</Toast.Title>
      </XStack>
    </Toast>
  );
};
