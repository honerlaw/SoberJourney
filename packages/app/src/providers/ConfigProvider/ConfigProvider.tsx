import React from "react"
import { LoadingView } from "@/src/components/LoadingView"
import { ErrorView } from "@/src/components/ErrorView"
import Constants from "expo-constants"
import { useReportError } from "@/src/hooks/useReportError"

type ConfigContextType = {
  clerkPublishableKey: string
  muxEnvKey: string
  trpcRelativeUrl: string
  baseUrl: string
}

const ConfigContext = React.createContext<ConfigContextType | null>(null)

function useBaseUrl() {
  const { report } = useReportError()
  const BASE_URL = Constants.expoConfig?.extra?.apiUrl
  if (!BASE_URL) {
    report(new Error("BASE_URL is not set"))
    return "https://www.soberjourney.app"
  }
  return BASE_URL
}

const fetchAppConfig = async (baseUrl: string): Promise<ConfigContextType> => {
  const response = await fetch(`${baseUrl}/api/app/config`)

  if (!response.ok) {
    throw new Error(`Failed to fetch config: ${response.statusText}`)
  }

  return await response.json()
}

const CONNECTION_MESSAGE =
  "We couldn't connect to SoberJourney. Check your internet connection and try again."

export const ConfigProvider: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const [data, setData] = React.useState<ConfigContextType | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<Error | null>(null)
  // Bumped by the retry button to re-run the fetch.
  const [attempt, setAttempt] = React.useState(0)
  const baseUrl = useBaseUrl()
  const { report } = useReportError()

  React.useEffect(() => {
    let cancelled = false
    const loadConfig = async () => {
      try {
        setIsLoading(true)
        setError(null)
        const config = await fetchAppConfig(baseUrl)
        if (!cancelled) {
          setData(config)
        }
      } catch (err) {
        const loadError =
          err instanceof Error ? err : new Error("Unknown error occurred")
        // Reported once per failed attempt (ErrorView does not report).
        report(loadError)
        if (!cancelled) {
          setError(loadError)
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    loadConfig()
    return () => {
      cancelled = true
    }
    // `report` is intentionally omitted: a new identity must not refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseUrl, attempt])

  const retry = React.useCallback(() => setAttempt((n) => n + 1), [])

  if (isLoading) {
    return <LoadingView />
  }

  if (error || !data) {
    return <ErrorView message={CONNECTION_MESSAGE} onRetry={retry} />
  }

  return (
    <ConfigContext.Provider
      value={{
        ...data,
        baseUrl,
      }}
    >
      {children}
    </ConfigContext.Provider>
  )
}

export function useConfig(): ConfigContextType {
  const context = React.useContext(ConfigContext)
  if (!context) {
    throw new Error("useConfig must be used within a ConfigProvider")
  }
  return context
}
