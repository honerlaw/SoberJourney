import React from "react"
import { Modal } from "react-native"
import { Button, Text, XStack, YStack, View } from "tamagui"

export type AlertButton = {
  text: string
  style?: "default" | "cancel" | "destructive"
  onPress?: () => void
}

// AlertModal ref interface
export type AlertModalRef = {
  show: () => void
  hide: () => void
}

type AlertModalProps = React.PropsWithChildren<{
  title: string
  message?: string
  buttons: AlertButton[]
}>

export const AlertModal = React.forwardRef<AlertModalRef, AlertModalProps>(
  ({ title, message, buttons, children }, ref) => {
    const [isVisible, setIsVisible] = React.useState(false)

    const showModal = React.useCallback(() => {
      setIsVisible(true)
    }, [])

    const closeModal = React.useCallback(() => {
      setIsVisible(false)
    }, [])

    // Expose show and hide methods through the ref
    React.useImperativeHandle(
      ref,
      () => ({
        show: showModal,
        hide: closeModal,
      }),
      [showModal, closeModal],
    )

    const handleButtonPress = React.useCallback(
      (button: AlertButton) => {
        if (button.onPress) {
          button.onPress()
        }
        closeModal()
      },
      [closeModal],
    )

    const childrenWithProps = React.Children.map(children, (child) => {
      if (!React.isValidElement(child)) {
        return null
      }
      return React.cloneElement(child, {
        onPress: () => {
          const props = child.props as any
          if (props?.onPress) {
            props.onPress()
          }
          showModal()
        },
      } as any)
    })
    return (
      <>
        {childrenWithProps}
        <Modal
          visible={isVisible}
          transparent
          animationType="fade"
          onRequestClose={closeModal}
        >
          <View
            flex={1}
            justifyContent="center"
            alignItems="center"
            backgroundColor="rgba(0, 0, 0, 0.5)"
          >
            <View
              backgroundColor="$background"
              borderRadius="$4"
              borderWidth={1}
              borderColor="$borderColor"
              shadowColor="$shadowColor"
              shadowOffset={{ width: 0, height: 4 }}
              shadowOpacity={0.1}
              shadowRadius={8}
              maxWidth={400}
              minWidth={300}
              padding="$4"
              margin="$4"
            >
              <YStack space="$3">
                <Text fontSize="$6" fontWeight="600" color="$color12">
                  {title}
                </Text>

                {message && (
                  <Text fontSize="$4" color="$color11">
                    {message}
                  </Text>
                )}

                <XStack space="$3" justifyContent="flex-end" marginTop="$4">
                  {buttons.map((button, index) => {
                    const isCancel = button.style === "cancel"
                    const isDestructive = button.style === "destructive"

                    return (
                      <Button
                        key={`${button.text}-${index}`}
                        theme={isDestructive ? "red" : undefined}
                        variant={isCancel ? "outlined" : undefined}
                        borderWidth={isCancel ? 1 : undefined}
                        onPress={() => handleButtonPress(button)}
                        flex={1}
                      >
                        <Text
                          fontSize="$4"
                          fontWeight={isCancel ? "400" : "600"}
                          color={isDestructive ? "$red10" : undefined}
                        >
                          {button.text}
                        </Text>
                      </Button>
                    )
                  })}
                </XStack>
              </YStack>
            </View>
          </View>
        </Modal>
      </>
    )
  },
)

AlertModal.displayName = "AlertModal"
