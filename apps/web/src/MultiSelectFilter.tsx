import { useEffect, useMemo, useRef, useState } from "react";
import type { FilterSelection } from "./hooks";

export interface FilterOption {
  value: string;
  label: string;
}

export function MultiSelectFilter({
  label,
  noun,
  options,
  selected,
  onChange,
}: {
  label: string;
  noun: string;
  options: FilterOption[];
  selected: FilterSelection;
  onChange: (next: FilterSelection) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const lastToggleAt = useRef(0);

  const optionValues = useMemo(() => options.map((o) => o.value), [options]);
  const isAll = selected === null;
  const selectedSet = useMemo(
    () => new Set(isAll ? optionValues : selected),
    [isAll, optionValues, selected],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const summary = (() => {
    if (options.length === 0) return label;
    if (isAll || selectedSet.size === options.length) return `All ${noun}`;
    if (selectedSet.size === 0) return `No ${noun}`;
    if (selectedSet.size === 1) {
      return options.find((o) => selectedSet.has(o.value))?.label ?? `1 ${noun}`;
    }
    return `${selectedSet.size} ${noun}`;
  })();

  function commit(next: string[]) {
    const unique = [...new Set(next)];
    if (unique.length === options.length) onChange(null);
    else onChange(unique);
  }

  function toggle(value: string) {
    const now = performance.now();
    if (now - lastToggleAt.current < 80) return;
    lastToggleAt.current = now;
    const current = isAll ? optionValues : [...selectedSet];
    commit(
      current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value],
    );
  }

  return (
    <div className="filter" ref={rootRef}>
      <button
        type="button"
        className={`filter-toggle${open || !isAll ? " active" : ""}`}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={`Filter ${noun}`}
        disabled={options.length === 0}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="filter-toggle-label">{summary}</span>
        <span className="filter-caret" aria-hidden="true" />
      </button>
      {open ? (
        <div className="filter-menu" role="group" aria-label={`Select ${noun}`}>
          <input
            ref={searchRef}
            className="filter-search"
            type="search"
            placeholder={`Filter ${noun}…`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label={`Search ${noun}`}
          />
          <div className="filter-actions">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onChange(null)}
            >
              All
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onChange([])}
            >
              None
            </button>
          </div>
          <ul className="filter-options">
            {visible.length === 0 ? (
              <li className="filter-empty">No matches</li>
            ) : (
              visible.map((option) => {
                const checked = selectedSet.has(option.value);
                return (
                  <li key={option.value}>
                    <button
                      type="button"
                      aria-pressed={checked}
                      className={`filter-option${checked ? " selected" : ""}`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        toggle(option.value);
                      }}
                      onClick={(e) => {
                        e.preventDefault();
                        toggle(option.value);
                      }}
                    >
                      <span className="filter-check" aria-hidden="true" />
                      <span>{option.label}</span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function applySelection<T>(
  items: T[],
  selected: FilterSelection,
  valueOf: (item: T) => string,
): T[] {
  if (selected === null) return items;
  const allowed = new Set(selected);
  return items.filter((item) => allowed.has(valueOf(item)));
}
