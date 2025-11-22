import { useTheme } from "tamagui";
import {
  ThemeProvider,
  DarkTheme,
  DefaultTheme,
} from "@react-navigation/native";
import { COLOR_PRIMARY } from "@/src/constant";

export type NavigationThemeProviderProps = React.PropsWithChildren<{
  theme: "light" | "dark";
}>;

export const NavigationThemeProvider: React.FC<
  NavigationThemeProviderProps
> = ({ children, theme }) => {
  const tamaguiTheme = useTheme();
  const isDark = theme === "dark";

  // Define fallback colors for light and dark themes
  const lightFallbacks = {
    primary: "#007AFF",
    background: "#FFFFFF",
    card: "#F2F2F7",
    text: "#000000",
    border: "#C6C6C8",
    notification: "#FF3B30",
  };

  const darkFallbacks = {
    primary: "#0A84FF",
    background: "#000000",
    card: "#1C1C1E",
    text: "#FFFFFF",
    border: "#38383A",
    notification: "#FF453A",
  };

  const fallbacks = isDark ? darkFallbacks : lightFallbacks;

  const navigationTheme: typeof DefaultTheme = {
    dark: isDark,
    colors: {
      primary: COLOR_PRIMARY || tamaguiTheme.color?.val || fallbacks.primary,
      background: tamaguiTheme.background?.val || fallbacks.background,
      card: tamaguiTheme.background?.val || fallbacks.card,
      text: tamaguiTheme.color?.val || fallbacks.text,
      border:
        tamaguiTheme.borderColor?.val ||
        tamaguiTheme.gray6?.val ||
        fallbacks.border,
      notification: tamaguiTheme.red10?.val || fallbacks.notification,
    },
    fonts: isDark ? DarkTheme.fonts : DefaultTheme.fonts,
  };

  return <ThemeProvider value={navigationTheme}>{children}</ThemeProvider>;
};
