import type { CSSProperties } from "react";
import { OptGroup, Option, Select } from "@momentum-design/components/react";
import { THEME_GROUPS, WALLBOARD_THEMES, type WallboardThemeId } from "./themes";

const THEME_SELECT_STYLE = {
  "--mdc-select-width": "14rem",
  "--mdc-select-listbox-width": "16rem",
  "--mdc-select-height": "2rem",
  width: "14rem",
} as CSSProperties;

export function ThemePicker({
  value,
  onChange,
}: {
  value: WallboardThemeId;
  onChange: (next: WallboardThemeId) => void;
}) {
  return (
    <div className="theme-picker">
      <Select
        value={value}
        data-aria-label="Wallboard theme"
        style={THEME_SELECT_STYLE}
        onChange={(event) => {
          const next = event.detail.value;
          if (typeof next === "string" && next) {
            onChange(next as WallboardThemeId);
          }
        }}
      >
        {THEME_GROUPS.map((group) => (
          <OptGroup key={group} label={group}>
            {WALLBOARD_THEMES.filter((t) => t.group === group).map((theme) => (
              <Option key={theme.id} value={theme.id} label={theme.label} />
            ))}
          </OptGroup>
        ))}
      </Select>
    </div>
  );
}
