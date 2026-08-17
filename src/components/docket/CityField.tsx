"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

import { searchCities, type CityMatch } from "@/lib/cities";

/**
 * Autocomplete over the local city base. Typing deduces the country; the
 * country is shown next to the label so the user sees the deduction happen.
 */
export function CityField({
  city,
  country,
  onChange,
  onSubmitShortcut,
}: {
  city: string;
  country: string;
  onChange: (value: { city: string; country: string }) => void;
  onSubmitShortcut?: () => void;
}) {
  const id = useId();
  const listId = `${id}-list`;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const block = useRef<HTMLDivElement>(null);

  const suggestions = useMemo(() => searchCities(city), [city]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (block.current && !block.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  function choose(match: CityMatch) {
    onChange({ city: match.city, country: match.country });
    setOpen(false);
    setActive(0);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) {
      if (event.key === "Enter") {
        event.preventDefault();
        onSubmitShortcut?.();
      }
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => (i + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => (i - 1 + suggestions.length) % suggestions.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const match = suggestions[active];
      if (match) choose(match);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={block} className="field relative">
      <label className="field-label" htmlFor={id}>
        City
        {country && <span className="font-mono font-bold normal-case text-stamp">→ {country}</span>}
      </label>
      <input
        id={id}
        data-form-type="other"
        className="field-input"
        role="combobox"
        aria-expanded={open && suggestions.length > 0}
        aria-autocomplete="list"
        aria-controls={listId}
        aria-activedescendant={open && suggestions[active] ? `${listId}-${active}` : undefined}
        autoComplete="off"
        value={city}
        onChange={(event) => {
          onChange({ city: event.target.value, country: "" });
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Start typing: Berlin, Lisbon…"
      />
      {open && suggestions.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute top-full right-0 left-0 z-30 mt-1 max-h-64 list-none overflow-y-auto rounded-[3px] border border-stamp bg-sheet p-1 shadow-popover"
        >
          {suggestions.map((match, index) => (
            <li
              key={`${match.city}-${match.country}`}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              className="flex cursor-pointer items-baseline justify-between gap-3 rounded-[2px] px-2.5 py-2 text-sm aria-selected:bg-stamp aria-selected:text-white"
              onMouseEnter={() => setActive(index)}
              onMouseDown={(event) => {
                event.preventDefault();
                choose(match);
              }}
            >
              <span>{match.city}</span>
              <span className="font-mono text-xs text-muted [li[aria-selected='true']_&]:text-white/80">
                {match.country}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
