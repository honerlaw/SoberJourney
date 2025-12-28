import { useRef } from "react"
import { router } from "expo-router"
import { useJourneyRemove } from "@/src/components/pages/DashboardPage/TrackerCard/hooks/useJourneyRemove"
import type { AlertModalRef } from "@/src/components/AlertModal"

export function useDeleteConfirmation(journeyId: string) {
  const alertModalRef = useRef<AlertModalRef>(null)
  const { removeJourney } = useJourneyRemove()

  const showConfirmation = () => alertModalRef.current?.show()

  const handleDelete = async () => {
    const success = await removeJourney(journeyId)
    if (success) {
      router.back()
    }
  }

  const modalProps = {
    ref: alertModalRef,
    title: "Delete Journey",
    message:
      "Are you sure you want to delete this journey and all of the entries associated with it? This action cannot be undone.",
    buttons: [
      { text: "Cancel", style: "cancel" as const },
      { text: "Delete", style: "destructive" as const, onPress: handleDelete },
    ],
  }

  return { showConfirmation, modalProps }
}
