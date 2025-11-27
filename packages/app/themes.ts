import { createThemes, defaultComponentThemes } from '@tamagui/theme-builder'
import * as Colors from '@tamagui/colors'

const darkPalette = ['hsla(216, 40%, 8%, 1)','hsla(217, 39%, 12%, 1)','hsla(217, 38%, 17%, 1)','hsla(218, 36%, 21%, 1)','hsla(218, 35%, 25%, 1)','hsla(218, 34%, 30%, 1)','hsla(219, 33%, 35%, 1)','hsla(219, 32%, 40%, 1)','hsla(220, 31%, 45%, 1)','hsla(220, 30%, 50%, 1)','hsla(222, 25%, 85%, 1)','hsla(224, 20%, 95%, 1)']
const lightPalette = ['hsla(216, 40%, 94%, 1)','hsla(217, 39%, 89%, 1)','hsla(217, 38%, 85%, 1)','hsla(218, 36%, 80%, 1)','hsla(218, 35%, 75%, 1)','hsla(218, 34%, 70%, 1)','hsla(219, 33%, 65%, 1)','hsla(219, 32%, 60%, 1)','hsla(220, 31%, 55%, 1)','hsla(220, 30%, 50%, 1)','hsla(222, 25%, 20%, 1)','hsla(224, 20%, 5%, 1)']

const lightShadows = {
  shadow1: 'rgba(0,0,0,0.04)',
  shadow2: 'rgba(0,0,0,0.08)',
  shadow3: 'rgba(0,0,0,0.16)',
  shadow4: 'rgba(0,0,0,0.24)',
  shadow5: 'rgba(0,0,0,0.32)',
  shadow6: 'rgba(0,0,0,0.4)',
}

const darkShadows = {
  shadow1: 'rgba(0,0,0,0.2)',
  shadow2: 'rgba(0,0,0,0.3)',
  shadow3: 'rgba(0,0,0,0.4)',
  shadow4: 'rgba(0,0,0,0.5)',
  shadow5: 'rgba(0,0,0,0.6)',
  shadow6: 'rgba(0,0,0,0.7)',
}

// we're adding some example sub-themes for you to show how they are done, "success" "warning", "error":

const builtThemes = createThemes({
  componentThemes: defaultComponentThemes,

  base: {
    palette: {
      dark: darkPalette,
      light: lightPalette,
    },

    extra: {
      light: {
        ...Colors.green,
        ...Colors.red,
        ...Colors.yellow,
        ...lightShadows,
        shadowColor: lightShadows.shadow1,
      },
      dark: {
        ...Colors.greenDark,
        ...Colors.redDark,
        ...Colors.yellowDark,
        ...darkShadows,
        shadowColor: darkShadows.shadow1,
      },
    },
  },

  accent: {
    palette: {
      dark: ['hsla(220, 68%, 15%, 1)','hsla(220, 69%, 19%, 1)','hsla(220, 69%, 22%, 1)','hsla(220, 70%, 26%, 1)','hsla(220, 70%, 30%, 1)','hsla(220, 71%, 35%, 1)','hsla(220, 72%, 40%, 1)','hsla(220, 73%, 44%, 1)','hsla(220, 74%, 49%, 1)','hsla(220, 75%, 54%, 1)','hsla(220, 80%, 75%, 1)','hsla(220, 85%, 90%, 1)'],
      light: ['hsla(220, 68%, 95%, 1)','hsla(220, 69%, 89%, 1)','hsla(220, 69%, 83%, 1)','hsla(220, 70%, 76%, 1)','hsla(220, 70%, 70%, 1)','hsla(220, 71%, 67%, 1)','hsla(220, 72%, 64%, 1)','hsla(220, 73%, 60%, 1)','hsla(220, 74%, 57%, 1)','hsla(220, 75%, 54%, 1)','hsla(220, 80%, 30%, 1)','hsla(220, 85%, 15%, 1)'],
    },
  },

  childrenThemes: {
    warning: {
      palette: {
        dark: Object.values(Colors.yellowDark),
        light: Object.values(Colors.yellow),
      },
    },

    error: {
      palette: {
        dark: Object.values(Colors.redDark),
        light: Object.values(Colors.red),
      },
    },

    success: {
      palette: {
        dark: Object.values(Colors.greenDark),
        light: Object.values(Colors.green),
      },
    },
  },

  // optionally add more, can pass palette or template

  // grandChildrenThemes: {
  //   alt1: {
  //     template: 'alt1',
  //   },
  //   alt2: {
  //     template: 'alt2',
  //   },
  //   surface1: {
  //     template: 'surface1',
  //   },
  //   surface2: {
  //     template: 'surface2',
  //   },
  //   surface3: {
  //     template: 'surface3',
  //   },
  // },
})

export type Themes = typeof builtThemes

// the process.env conditional here is optional but saves web client-side bundle
// size by leaving out themes JS. tamagui automatically hydrates themes from CSS
// back into JS for you, and the bundler plugins set TAMAGUI_ENVIRONMENT. so
// long as you are using the Vite, Next, Webpack plugins this should just work,
// but if not you can just export builtThemes directly as themes:
export const themes: Themes =
  process.env.TAMAGUI_ENVIRONMENT === 'client' &&
  process.env.NODE_ENV === 'production'
    ? ({} as any)
    : (builtThemes as any)
