import { YStack, XStack, Text, Switch, Label, Button, Spinner } from "tamagui"
import { Bell, Clock, ChevronDown } from "@tamagui/lucide-icons"
import { useState, useMemo, useEffect, useRef } from "react"
import { Platform } from "react-native"
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker"
import { useNotificationDefaults } from "./hooks/useNotificationDefaults"
import { useNotificationSettings } from "./hooks/useNotificationSettings"
import { useExpoNotifications } from "../../hooks/useExpoNotifications"
import { minuteOfDayToDate, dateToMinuteOfDay, formatTime } from "./utils"
import type { NotificationSettingsValue, NotificationFrequency } from "./types"

type NotificationSettingsProps = {
  // Optional journeyId - if provided, fetches settings and auto-saves changes
  journeyId?: string
  // Optional callback - emits whenever the internal value changes
  onChange?: (value: NotificationSettingsValue) => void
}

export const NotificationSettings: React.FC<NotificationSettingsProps> = ({
  journeyId,
  onChange,
}) => {
  // Fetch default settings and frequencies from the server
  const {
    defaults,
    frequencies,
    isLoading: isLoadingDefaults,
  } = useNotificationDefaults()

  // Use the hook to fetch/update settings when journeyId is provided
  const {
    notificationSettings: fetchedSettings,
    isLoading: isLoadingSettings,
    updateNotificationSettings,
    isUpdating,
  } = useNotificationSettings(journeyId)

  // Internal state - initialized once defaults load
  const [value, setValue] = useState<NotificationSettingsValue | null>(null)

  // Track if we've synced with fetched settings
  const hasSyncedRef = useRef(false)
  const hasSyncedDefaultsRef = useRef(false)

  // Sync internal state with server defaults when they load (for new journeys)
  useEffect(() => {
    if (defaults && !hasSyncedDefaultsRef.current && !journeyId) {
      setValue(defaults)
      hasSyncedDefaultsRef.current = true
    }
  }, [defaults, journeyId])

  // Sync internal state with fetched settings when journeyId is provided
  useEffect(() => {
    if (fetchedSettings && !hasSyncedRef.current) {
      setValue(fetchedSettings)
      hasSyncedRef.current = true
    }
  }, [fetchedSettings])

  // Reset sync flags when journeyId changes
  useEffect(() => {
    hasSyncedRef.current = false
    hasSyncedDefaultsRef.current = false
  }, [journeyId])

  // Request notification permissions when enabled
  useExpoNotifications(value?.enabled ?? false)

  const [showTimePicker, setShowTimePicker] = useState(false)

  const timeDate = useMemo(
    () => minuteOfDayToDate(value?.minuteOfDay ?? 480),
    [value?.minuteOfDay],
  )

  const handleChange = (newValue: NotificationSettingsValue) => {
    setValue(newValue)

    // Emit change to parent
    onChange?.(newValue)

    // Auto-save if journeyId is provided
    if (journeyId) {
      updateNotificationSettings(newValue)
    }
  }

  const handleToggle = (enabled: boolean) => {
    if (!value) return
    handleChange({ ...value, enabled })
  }

  const handleFrequencyChange = (frequency: NotificationFrequency) => {
    if (!value) return
    handleChange({ ...value, frequency })
  }

  const handleTimeChange = (
    event: DateTimePickerEvent,
    selectedDate?: Date,
  ) => {
    if (Platform.OS === "android") {
      setShowTimePicker(false)
    }

    if (event.type === "set" && selectedDate && value) {
      const minuteOfDay = dateToMinuteOfDay(selectedDate)
      handleChange({ ...value, minuteOfDay })
    } else if (event.type === "dismissed") {
      setShowTimePicker(false)
    }
  }

  // Show loading state when fetching settings or defaults
  if (isLoadingDefaults || (journeyId && isLoadingSettings)) {
    return (
      <YStack alignItems="center" padding="$4">
        <Spinner />
      </YStack>
    )
  }

  // Render nothing if defaults failed to load
  if (!defaults || !frequencies || !value) {
    return null
  }

  return (
    <YStack gap="$3">
      {/* Toggle for enabling notifications */}
      <XStack
        alignItems="center"
        justifyContent="space-between"
        backgroundColor="$color2"
        borderWidth={1}
        borderColor="$color5"
        borderRadius="$4"
        padding="$3"
        opacity={isUpdating ? 0.7 : 1}
      >
        <XStack gap="$2" alignItems="center">
          <Bell size={20} color="$color11" />
          <YStack>
            <Text fontSize="$4" fontWeight="500">
              Check-in Reminders
            </Text>
            <Text fontSize="$2" color="$color11">
              Get notified to track your progress
            </Text>
          </YStack>
        </XStack>
        <Switch
          size="$3"
          checked={value.enabled}
          onCheckedChange={handleToggle}
          backgroundColor="$color8"
          disabled={isUpdating}
        >
          <Switch.Thumb animation="quick" />
        </Switch>
      </XStack>

      {/* Frequency and Time settings (only shown when enabled) */}
      {value.enabled && (
        <YStack
          gap="$3"
          animation="quick"
          enterStyle={{ opacity: 0, y: -10 }}
          opacity={isUpdating ? 0.7 : 1}
        >
          {/* Frequency selector */}
          <YStack gap="$2">
            <Label fontWeight="400" fontSize="$3" color="$color11">
              How often?
            </Label>
            <XStack gap="$2" flexWrap="wrap">
              {frequencies.map(({ value: freq, label }) => {
                const isSelected = value.frequency === freq
                return (
                  <Button
                    key={freq}
                    size="$3"
                    flex={1}
                    minWidth={70}
                    themeInverse={isSelected}
                    onPress={() => handleFrequencyChange(freq)}
                    backgroundColor={isSelected ? undefined : "$color2"}
                    borderWidth={1}
                    borderColor={isSelected ? undefined : "$color5"}
                    disabled={isUpdating}
                  >
                    <Text fontSize="$3" fontWeight={isSelected ? "600" : "400"}>
                      {label}
                    </Text>
                  </Button>
                )
              })}
            </XStack>
          </YStack>

          {/* Time picker */}
          <YStack gap="$2">
            <Label fontWeight="400" fontSize="$3" color="$color11">
              What time? <Text color="$color10">(optional)</Text>
            </Label>
            <Button
              onPress={() => setShowTimePicker(!showTimePicker)}
              flex={1}
              justifyContent="flex-start"
              paddingHorizontal="$3"
              backgroundColor="$color2"
              borderWidth={1}
              borderColor="$color5"
              disabled={isUpdating}
            >
              <XStack
                flex={1}
                alignItems="center"
                justifyContent="space-between"
              >
                <XStack gap="$2" alignItems="center">
                  <Clock size={20} />
                  <Text fontSize="$4">{formatTime(value.minuteOfDay)}</Text>
                </XStack>
                <ChevronDown size={20} />
              </XStack>
            </Button>
            {showTimePicker && (
              <DateTimePicker
                value={timeDate}
                mode="time"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={handleTimeChange}
                minuteInterval={15}
              />
            )}
          </YStack>
        </YStack>
      )}
    </YStack>
  )
}
