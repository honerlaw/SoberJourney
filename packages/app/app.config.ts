import { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => {
  const isProduction =
    process.env.APP_VARIANT === "production" ||
    process.env.NODE_ENV === "production" ||
    (typeof process.env.APP_VARIANT === "undefined" &&
      typeof process.env.NODE_ENV === "undefined");
  return {
    ...config,
    name: "SoberJourney",
    slug: "SoberJourney",
    extra: {
      ...config.extra,
      apiUrl: isProduction ? "https://www.soberjourney.app" : "http://localhost:3000",
    },
  };
};
