import { useState, useCallback, useEffect } from "react"
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition"
import { useReportError } from "../useReportError/useReportError"

interface UseSpeechToTextReturn {
  isListening: boolean
  text: string
  start: () => Promise<void>
  stop: () => Promise<void>
  reset: () => void
  isAvailable: boolean
}

export function useSpeechToText(): UseSpeechToTextReturn {
  const [isListening, setIsListening] = useState(false)
  const [text, setText] = useState("")
  const [interimText, setInterimText] = useState("")
  const [isAvailable, setIsAvailable] = useState(false)
  const { report } = useReportError()

  // Check if speech recognition is available
  useEffect(() => {
    const checkAvailability = () => {
      try {
        const available = ExpoSpeechRecognitionModule.isRecognitionAvailable()
        setIsAvailable(available)
      } catch (error) {
        report(error)
        setIsAvailable(false)
      }
    }

    checkAvailability()
  }, [report])

  // Request permissions
  useEffect(() => {
    const requestPermissions = async () => {
      try {
        const { granted } =
          await ExpoSpeechRecognitionModule.requestPermissionsAsync()
        if (!granted) {
          console.warn("Speech recognition permissions not granted")
        }
      } catch (error) {
        report(error)
      }
    }

    if (isAvailable) {
      requestPermissions()
    }
  }, [isAvailable, report])

  const start = useCallback(async () => {
    try {
      if (!isAvailable) {
        throw new Error("Speech recognition is not available")
      }

      reset()

      ExpoSpeechRecognitionModule.start({
        lang: "en-US",
        interimResults: true,
        continuous: true,
      })

      setIsListening(true)
    } catch (error) {
      report(error)
      setIsListening(false)
    }
  }, [isAvailable, report])

  const stop = useCallback(async () => {
    try {
      if (!isAvailable) {
        throw new Error("Speech recognition is not available")
      }

      ExpoSpeechRecognitionModule.stop()
      setIsListening(false)
    } catch (error) {
      report(error)
      setIsListening(false)
    }
  }, [report])

  const reset = useCallback(() => {
    setText("")
    setInterimText("")
  }, [])

  useSpeechRecognitionEvent("result", (event) => {
    if (!event.results || event.results.length === 0) {
      return
    }

    // this is the final text, so it shows the entire transcript
    // in final processing form
    if (event.isFinal) {
      setText((prev) => prev + event.results[0]?.transcript)
      // reset the interim text at the end of the final result
      setInterimText("")
      return
    }

    // set whatever the interim text is that we should render
    setInterimText(event.results[0]?.transcript)
  })

  return {
    isListening,
    text: text + interimText,
    start,
    stop,
    reset,
    isAvailable,
  }
}
