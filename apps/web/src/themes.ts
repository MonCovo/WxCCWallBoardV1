export type WallboardThemeId =
  | "dark"
  | "light"
  | "dark-indigo"
  | "light-indigo"
  | "dark-jade"
  | "light-jade"
  | "dark-bronze"
  | "light-bronze"
  | "dark-rose"
  | "light-rose"
  | "dark-lavender"
  | "light-lavender"
  | "hc-dark"
  | "hc-light";

export interface WallboardTheme {
  id: WallboardThemeId;
  label: string;
  group: "Dark" | "Light" | "High contrast";
  /** Fully qualified Momentum ThemeProvider class */
  themeclass: string;
}

export const WALLBOARD_THEMES: WallboardTheme[] = [
  {
    id: "dark",
    label: "Default",
    group: "Dark",
    themeclass: "mds-theme-stable-darkWebex",
  },
  {
    id: "dark-indigo",
    label: "Indigo tint",
    group: "Dark",
    themeclass: "mds-theme-stable-darkIndigoWebex",
  },
  {
    id: "dark-jade",
    label: "Jade tint",
    group: "Dark",
    themeclass: "mds-theme-stable-darkJadeWebex",
  },
  {
    id: "dark-bronze",
    label: "Bronze tint",
    group: "Dark",
    themeclass: "mds-theme-stable-darkBronzeWebex",
  },
  {
    id: "dark-rose",
    label: "Rose tint",
    group: "Dark",
    themeclass: "mds-theme-stable-darkRoseWebex",
  },
  {
    id: "dark-lavender",
    label: "Lavender tint",
    group: "Dark",
    themeclass: "mds-theme-stable-darkLavenderWebex",
  },
  {
    id: "light",
    label: "Default",
    group: "Light",
    themeclass: "mds-theme-stable-lightWebex",
  },
  {
    id: "light-indigo",
    label: "Indigo tint",
    group: "Light",
    themeclass: "mds-theme-stable-lightIndigoWebex",
  },
  {
    id: "light-jade",
    label: "Jade tint",
    group: "Light",
    themeclass: "mds-theme-stable-lightJadeWebex",
  },
  {
    id: "light-bronze",
    label: "Bronze tint",
    group: "Light",
    themeclass: "mds-theme-stable-lightBronzeWebex",
  },
  {
    id: "light-rose",
    label: "Rose tint",
    group: "Light",
    themeclass: "mds-theme-stable-lightRoseWebex",
  },
  {
    id: "light-lavender",
    label: "Lavender tint",
    group: "Light",
    themeclass: "mds-theme-stable-lightLavenderWebex",
  },
  {
    id: "hc-dark",
    label: "Dark",
    group: "High contrast",
    themeclass: "mds-theme-stable-hcDarkWebex",
  },
  {
    id: "hc-light",
    label: "Light",
    group: "High contrast",
    themeclass: "mds-theme-stable-hcLightWebex",
  },
];

export const DEFAULT_THEME_ID: WallboardThemeId = "dark";

export const THEME_GROUPS = ["Dark", "Light", "High contrast"] as const;

export function resolveTheme(id: string | null | undefined): WallboardTheme {
  return (
    WALLBOARD_THEMES.find((t) => t.id === id) ??
    WALLBOARD_THEMES.find((t) => t.id === DEFAULT_THEME_ID)!
  );
}
