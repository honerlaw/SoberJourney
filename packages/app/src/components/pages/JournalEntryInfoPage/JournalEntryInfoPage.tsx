import React, { useRef } from "react"
import { Card, Text, YStack, ScrollView, Separator } from "tamagui"
import { useLocalSearchParams, router, Stack } from "expo-router"
import { format } from "date-fns"
import { useJournalEntryInfo } from "./hooks/useJournalEntryInfo"
import { useJournalRemove } from "@/src/components/pages/JournalDashboardPage/hooks/useJournalRemove"
import { LoadingView } from "@/src/components/LoadingView"
import { ErrorView } from "@/src/components/ErrorView"
import { AlertModal, AlertModalRef } from "@/src/components/AlertModal"
import { HeaderButton } from "@/src/components/HeaderButton"
import { Trash2 } from "@tamagui/lucide-icons"
import { useSafeAreaInsets } from "react-native-safe-area-context"

export const JournalEntryInfoPage: React.FC = () => {
  const { entryId } = useLocalSearchParams<{ entryId: string }>()
  const { entry, isLoading, error } = useJournalEntryInfo(entryId || "")
  const { removeEntry, isPending } = useJournalRemove()
  const alertModalRef = useRef<AlertModalRef>(null)
  const { bottom } = useSafeAreaInsets()

  if (isLoading) {
    return <LoadingView />
  }

  if (error) {
    return <ErrorView error={error} />
  }

  if (!entry) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" padding="$4">
        <Text color="$color11">Journal entry not found</Text>
      </YStack>
    )
  }

  const createdDate = new Date(entry.createdAt)
  const formattedDate = format(createdDate, "EEEE, MMMM d, yyyy")
  const formattedTime = format(createdDate, "h:mm a")

  const onDelete = async () => {
    await removeEntry(entryId || "")
    router.back()
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <HeaderButton
              icon={Trash2}
              onPress={() => alertModalRef.current?.show()}
              disabled={isPending}
            />
          ),
        }}
      />
      <AlertModal
        ref={alertModalRef}
        title="Delete Entry"
        message="Are you sure you want to delete this journal entry? This action cannot be undone."
        buttons={[
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: onDelete,
          },
        ]}
      />
      <ScrollView flex={1} contentContainerStyle={{ paddingBottom: bottom }}>
        <YStack padding="$4" gap="$4">
          {/* Date and Time Header */}
          <Card
            elevate
            bordered
            borderRadius="$4"
            backgroundColor="$background"
            padding="$4"
          >
            <YStack gap="$2">
              <Text fontSize="$6" fontWeight="600" color="$color12">
                {formattedDate}
              </Text>
              <Text fontSize="$4" color="$color11">
                {formattedTime}
              </Text>
            </YStack>
          </Card>

          {/* Journal Entry Content */}
          <Card
            elevate
            bordered
            borderRadius="$4"
            backgroundColor="$background"
            padding="$4"
          >
            <YStack gap="$3">
              <Text fontSize="$5" fontWeight="600" color="$color12">
                Entry
              </Text>
              <Separator />
              <Text fontSize="$4" color="$color12" lineHeight="$6">
                {entry.content}
              </Text>
            </YStack>
          </Card>
        </YStack>
      </ScrollView>
    </>
  )
}
