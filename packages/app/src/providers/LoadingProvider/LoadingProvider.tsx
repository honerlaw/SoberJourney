import React from "react"
import { Modal } from "react-native"
import { View } from "tamagui"
import { LoadingView } from "@/src/components/LoadingView"

type LoadingContextType = {
  isLoading: boolean
  showLoading: () => void
  hideLoading: () => void
}

const LoadingContext = React.createContext<LoadingContextType | null>(null)

export const LoadingProvider: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const [isLoading, setIsLoading] = React.useState(false)

  const showLoading = React.useCallback(() => {
    setIsLoading(true)
  }, [])

  const hideLoading = React.useCallback(() => {
    setIsLoading(false)
  }, [])

  const contextValue = React.useMemo(
    () => ({
      isLoading,
      showLoading,
      hideLoading,
    }),
    [isLoading, showLoading, hideLoading],
  )

  return (
    <LoadingContext.Provider value={contextValue}>
      {children}

      <Modal
        visible={isLoading}
        transparent
        animationType="fade"
        onRequestClose={hideLoading}
      >
        <View
          flex={1}
          justifyContent="center"
          alignItems="center"
          backgroundColor="rgba(0, 0, 0, 0.3)"
        >
          <LoadingView />
        </View>
      </Modal>
    </LoadingContext.Provider>
  )
}

export function useLoading(): LoadingContextType {
  const context = React.useContext(LoadingContext)
  if (!context) {
    throw new Error("useLoading must be used within a LoadingProvider")
  }
  return context
}
