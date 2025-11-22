import React from "react";
import { LoadingView } from "@/src/components/LoadingView";
import { ErrorView } from "@/src/components/ErrorView";
import Constants from "expo-constants";
import { useReportError } from "@/src/hooks/useReportError";

type ConfigContextType = {
  clerkPublishableKey: string;
  muxEnvKey: string;
  trpcRelativeUrl: string;
  baseUrl: string;
};

export const ConfigContext = React.createContext<ConfigContextType | null>(
  null,
);

function useBaseUrl() {
  const { report } = useReportError();
  const BASE_URL = Constants.expoConfig?.extra?.apiUrl;
  if (!BASE_URL) {
    report(new Error("BASE_URL is not set"));
    return "https://www.soberjourney.app";
  }
  return BASE_URL;
}

const fetchAppConfig = async (baseUrl: string): Promise<ConfigContextType> => {
  const response = await fetch(`${baseUrl}/api/app/config`);

  if (!response.ok) {
    throw new Error(`Failed to fetch config: ${response.statusText}`);
  }

  return await response.json();
};

export const ConfigProvider: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const [data, setData] = React.useState<ConfigContextType | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);
  const baseUrl = useBaseUrl();

  React.useEffect(() => {
    const loadConfig = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const config = await fetchAppConfig(baseUrl);
        setData(config);
      } catch (err) {
        setError(
          err instanceof Error ? err : new Error("Unknown error occurred"),
        );
      } finally {
        setIsLoading(false);
      }
    };

    loadConfig();
  }, [baseUrl]);

  if (isLoading) {
    return <LoadingView />;
  }

  if (error) {
    return <ErrorView error={error} />;
  }

  if (!data) {
    return <ErrorView error={new Error("No configuration data available")} />;
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
  );
};

export function useConfig(): ConfigContextType {
  const context = React.useContext(ConfigContext);
  if (!context) {
    throw new Error("useConfig must be used within a ConfigProvider");
  }
  return context;
}
