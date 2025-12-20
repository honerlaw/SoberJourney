import { XStack } from "tamagui"
import React, { useState } from "react"
import { Calendar, Clock } from "@tamagui/lucide-icons"
import { InputButton } from "../InputButton"
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker"
import { Platform } from "react-native"
import { format } from "date-fns"

export interface DateTimeInputProps {
  onChange: (date: Date) => void
}

export const DateTimeInput: React.FC<DateTimeInputProps> = ({ onChange }) => {
  const [showPicker, setShowPicker] = useState<"date" | "time" | null>(null)
  const [internalDate, setInternalDate] = useState<Date>(new Date())

  const handleDateChange = (selectedDate: Date) => {
    // Keep the time from the current internal date, update only the date part
    const newDate = new Date(internalDate)
    newDate.setFullYear(selectedDate.getFullYear())
    newDate.setMonth(selectedDate.getMonth())
    newDate.setDate(selectedDate.getDate())
    setInternalDate(newDate)
    onChange(newDate)
  }

  const handleTimeChange = (selectedDate: Date) => {
    // Keep the date part from the current internal date, update only the time
    const newDate = new Date(internalDate)
    newDate.setHours(selectedDate.getHours())
    newDate.setMinutes(selectedDate.getMinutes())
    newDate.setSeconds(0)
    newDate.setMilliseconds(0)
    setInternalDate(newDate)
    onChange(newDate)
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
        />
      )}
    </>
  )
}
