import { createContext, useContext, useState, useEffect } from "react";
import { useColorScheme } from "react-native";

export type ThemeMode = "light" | "dark" | "auto";

type ThemeContextValue = {
  themeMode: ThemeMode;
  currentTheme: "light" | "dark";
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeMode] = useState<ThemeMode>("dark"); // Start with dark as default
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize theme mode after component mounts to avoid hydration issues on web
  useEffect(() => {
    if (!isInitialized) {
      setThemeMode("auto");
      setIsInitialized(true);
    }
  }, [isInitialized]);

  // Determine the current theme based on mode and system preference
  // Handle null systemColorScheme (common on web during initial render)
  const currentTheme: "light" | "dark" =
    !isInitialized || themeMode === "dark"
      ? "dark"
      : themeMode === "light"
        ? "light"
        : themeMode === "auto"
          ? systemColorScheme === "light"
            ? "light"
            : "dark" // Default to dark when systemColorScheme is null or "dark"
          : "dark";

  // Ensure we always have a valid theme string
  const safeCurrentTheme: "light" | "dark" =
    currentTheme === "light" ? "light" : "dark";

  const toggleTheme = () => {
    setThemeMode((prev) => {
      if (prev === "auto" || prev === "dark") return "light";
      return "dark";
    });
  };

  const value: ThemeContextValue = {
    themeMode,
    currentTheme: safeCurrentTheme,
    setThemeMode,
    toggleTheme,
  };

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useThemeMode() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useThemeMode must be used within a ThemeProvider");
  }
  return context;
}
