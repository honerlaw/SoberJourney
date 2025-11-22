import { TamaguiProvider } from "tamagui";
import * as config from "../../../tamagui.config";
import { NavigationThemeProvider } from "./NavigationThemeProvider";
import { ThemeProvider, useThemeMode } from "./ThemeContext";

function TamaguiThemeWrapper({ children }: { children: React.ReactNode }) {
  const { currentTheme } = useThemeMode();

  // Ensure we have a valid theme that exists in the config
  // Tamagui expects specific theme names, so we need to ensure they exist
  const validTheme = currentTheme === "light" ? "light" : "dark";

  return (
    <TamaguiProvider
      config={config.config}
      defaultTheme={validTheme}
      disableInjectCSS={false}
    >
      <NavigationThemeProvider theme={validTheme}>
        {children}
      </NavigationThemeProvider>
    </TamaguiProvider>
  );
}

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <TamaguiThemeWrapper>{children}</TamaguiThemeWrapper>
    </ThemeProvider>
  );
}
