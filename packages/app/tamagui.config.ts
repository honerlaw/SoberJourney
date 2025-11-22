import { createTamagui, createTokens } from "tamagui"
import { tokens, themes } from "@tamagui/themes"
import { shorthands } from "@tamagui/shorthands"
import { createInterFont } from "@tamagui/font-inter"
import { createAnimations } from "@tamagui/animations-react-native"
import { COLOR_PRIMARY, COLOR_SECONDARY } from "./src/constant"

const headingFont = createInterFont()
const bodyFont = createInterFont()

const monoFont = createInterFont({
  family: 'SF Mono, Monaco, Inconsolata, "Roboto Mono", Consolas, "Liberation Mono", Menlo, Courier, monospace',
})

const customTokens = createTokens({
  ...tokens,
  color: {
    ...tokens.color,
    primary: COLOR_PRIMARY,
    primary2: COLOR_SECONDARY,
  }
})

const animations = createAnimations({
  bouncy: {
    damping: 10,
    mass: 0.9,
    stiffness: 100,
  },
  lazy: {
    damping: 20,
    stiffness: 60,
  },
  quick: {
    damping: 20,
    mass: 1.2,
    stiffness: 250,
  },
  tooltip: {
    damping: 10,
    mass: 0.9,
    stiffness: 100,
  },
})

export const config = createTamagui({
  defaultTheme: "dark",
  defaultFont: "body",
  fonts: {
    heading: headingFont,
    body: bodyFont,
    mono: monoFont,
  },
  themes,
  tokens: customTokens,
  shorthands,
  animations,
  shouldAddPrefersColorThemes: true,
  themeClassNameOnRoot: false,
})

export type AppTamaguiConfig = typeof config
declare module "tamagui" {
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface TamaguiCustomConfig extends AppTamaguiConfig {}
}

export default config


