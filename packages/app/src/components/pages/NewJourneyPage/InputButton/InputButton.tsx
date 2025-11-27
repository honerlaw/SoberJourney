import { Button, XStack, Text } from "tamagui";

type InputButtonProps = {
  onPress: () => void;
  value: string;
  icon: React.ComponentType<{ size?: string | number }>;
  iconRight?: React.ComponentType<{ size?: string | number }>;
};

export const InputButton: React.FC<InputButtonProps> = ({
  value,
  onPress,
  icon: Icon,
  iconRight: IconRight,
}) => {
  return (
    <Button
      onPress={onPress}
      flex={1}
      justifyContent="flex-start"
      paddingHorizontal="$3"
      backgroundColor="$color2"
      borderWidth={1}
      borderColor="$color5"
    >
      <XStack flex={1} alignItems="center" justifyContent="space-between">
        <XStack gap="$2" alignItems="center">
          <Icon size={20} />
          <Text fontSize="$4">
            {value}
          </Text>
        </XStack>
        {IconRight && <IconRight size={20} />}
      </XStack>
    </Button>
  );
};
