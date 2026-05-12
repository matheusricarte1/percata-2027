import {
  argbFromHex,
  hexFromArgb,
  themeFromSourceColor,
} from "@material/material-color-utilities";
import { createTheme, responsiveFontSizes } from "@mui/material/styles";

const MATERIAL_YOU_SEED = "#164073";
const materialTheme = themeFromSourceColor(argbFromHex(MATERIAL_YOU_SEED));

const schemeToPalette = (
  scheme: (typeof materialTheme)["schemes"]["light"] | (typeof materialTheme)["schemes"]["dark"],
) => ({
  primary: {
    main: hexFromArgb(scheme.primary),
    light: hexFromArgb(scheme.primaryContainer),
    dark: hexFromArgb(scheme.inversePrimary),
    contrastText: hexFromArgb(scheme.onPrimary),
  },
  secondary: {
    main: hexFromArgb(scheme.secondary),
    light: hexFromArgb(scheme.secondaryContainer),
    dark: hexFromArgb(scheme.secondary),
    contrastText: hexFromArgb(scheme.onSecondary),
  },
  error: {
    main: hexFromArgb(scheme.error),
    light: hexFromArgb(scheme.errorContainer),
    dark: hexFromArgb(scheme.error),
    contrastText: hexFromArgb(scheme.onError),
  },
  background: {
    default: hexFromArgb(scheme.background),
    paper: hexFromArgb(scheme.surface),
  },
  text: {
    primary: hexFromArgb(scheme.onSurface),
    secondary: hexFromArgb(scheme.onSurfaceVariant),
  },
  divider: hexFromArgb(scheme.outlineVariant),
});

const baseTheme = createTheme({
  cssVariables: {
    colorSchemeSelector: "class",
    cssVarPrefix: "percata",
  },
  colorSchemes: {
    light: {
      palette: schemeToPalette(materialTheme.schemes.light),
    },
    dark: {
      palette: schemeToPalette(materialTheme.schemes.dark),
    },
  },
  shape: {
    borderRadius: 16,
  },
  typography: {
    fontFamily: '"Inter", "Outfit", system-ui, -apple-system, sans-serif',
    h1: { fontWeight: 700 },
    h2: { fontWeight: 700 },
    h3: { fontWeight: 700 },
    h4: { fontWeight: 600 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
    button: { textTransform: "none", fontWeight: 600 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        ":root": {
          "--md-primary": hexFromArgb(materialTheme.schemes.light.primary),
          "--md-on-primary": hexFromArgb(materialTheme.schemes.light.onPrimary),
          "--md-primary-container": hexFromArgb(
            materialTheme.schemes.light.primaryContainer,
          ),
          "--md-secondary": hexFromArgb(materialTheme.schemes.light.secondary),
          "--md-surface": hexFromArgb(materialTheme.schemes.light.surface),
          "--md-on-surface": hexFromArgb(materialTheme.schemes.light.onSurface),
          "--md-surface-variant": hexFromArgb(
            materialTheme.schemes.light.surfaceVariant,
          ),
          "--md-outline": hexFromArgb(materialTheme.schemes.light.outline),
        },
      },
    },
  },
});

export const materialYouTheme = responsiveFontSizes(baseTheme);
export { MATERIAL_YOU_SEED };

