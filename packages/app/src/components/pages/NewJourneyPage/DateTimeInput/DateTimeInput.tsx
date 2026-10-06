import { XStack, YStack } from "tamagui"
import React, { useState } from "react"
import { Calendar, Clock } from "@tamagui/lucide-icons"
import { InputButton } from "../InputButton"
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker"
import { Platform } from "react-native"
import { format } from "date-fns"
import { WebDateTimeField } from "../../../NotificationSettings"

export interface DateTimeInputProps {
  onChange: (date: Date) => void
}

// A journey cannot start in the future: clamp to "now" at pick time
const clampToNow = (date: Date): Date => {
  const now = new Date()
  return date > now ? now : date
}

export const DateTimeInput: React.FC<DateTimeInputProps> = ({ onChange }) => {
  const [showPicker, setShowPicker] = useState<"date" | "time" | null>(null)
  const [internalDate, setInternalDate] = useState<Date>(new Date())

  // Web date inputs fire per typed segment, so clamping there would fight
  // entry (e.g. typing the month before the year). The web input carries
  // `max`, and NewJourneyPage clamps again at submit.
  const shouldClamp = Platform.OS !== "web"

  const commit = (date: Date) => {
    const next = shouldClamp ? clampToNow(date) : date
    setInternalDate(next)
    onChange(next)
  }

  const handleDateChange = (selectedDate: Date) => {
    // Keep the time from the current internal date, update only the date part
    const newDate = new Date(internalDate)
    newDate.setFullYear(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      selectedDate.getDate(),
    )
    commit(newDate)
  }

  const handleTimeChange = (selectedDate: Date) => {
    // Keep the date part from the current internal date, update only the time
    const newDate = new Date(internalDate)
    newDate.setHours(selectedDate.getHours(), selectedDate.getMinutes(), 0, 0)
    commit(newDate)
  }

  const handleChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === "android") {
      setShowPicker(null)
    }

    if (event.type === "set" && selectedDate) {
      if (showPicker === "time") {
        handleTimeChange(selectedDate)
      } else if (showPicker === "date") {
        handleDateChange(selectedDate)
      }
    } else if (event.type === "dismissed") {
      setShowPicker(null)
    }
  }

  // The native picker has no web implementation (renders null on web)
  if (Platform.OS === "web") {
    return (
      <YStack width="100%">
        <WebDateTimeField
          mode="date"
          value={internalDate}
          onChange={handleDateChange}
          maximumDate={new Date()}
        />
        <WebDateTimeField
          mode="time"
          value={internalDate}
          onChange={handleTimeChange}
        />
      </YStack>
    )
  }

  return (
    <>
      <XStack gap="$2" width="100%">
        <InputButton
          value={format(internalDate, "M/d/yyyy")}
          onPress={() => setShowPicker(showPicker === "date" ? null : "date")}
          icon={Calendar}
        />
        <InputButton
          value={format(internalDate, "h:mm a")}
          onPress={() => setShowPicker(showPicker === "time" ? null : "time")}
          icon={Clock}
        />
      </XStack>
      {showPicker && (
        <DateTimePicker
          value={internalDate}
          mode={showPicker === "time" ? "time" : "date"}
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={handleChange}
          maximumDate={showPicker === "date" ? new Date() : undefined}
        />
      )}
    </>
  )
}
