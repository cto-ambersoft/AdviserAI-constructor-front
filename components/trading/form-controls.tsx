"use client";

import { useEffect, useMemo, useState } from "react";

export const INPUT_CLASS =
  "h-9 w-full rounded-sm border border-input/90 bg-background/75 px-2.5 font-mono text-sm text-foreground outline-none transition-colors duration-75 placeholder:text-muted-foreground/90 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/35 disabled:cursor-not-allowed disabled:opacity-60";

export function Label({ text }: { text: string }) {
  return <p className="text-[11px] font-medium tracking-[0.05em] uppercase text-muted-foreground">{text}</p>;
}

export function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label text={label} />
      <input className={INPUT_CLASS} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

export function NumericField({
  label,
  value,
  onChange,
  onInputValueChange,
  min,
  max,
  step,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  onInputValueChange?: (rawValue: string) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  const [inputValue, setInputValue] = useState(String(value));
  const normalizedPropValue = useMemo(() => String(value), [value]);

  useEffect(() => {
    setInputValue(normalizedPropValue);
  }, [normalizedPropValue]);

  const commitValue = (rawValue: string) => {
    const normalized = rawValue.trim().replace(",", ".");
    if (!normalized) {
      return;
    }
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed)) {
      return;
    }
    onChange(parsed);
  };

  return (
    <div className="space-y-1">
      <Label text={label} />
      <input
        className={INPUT_CLASS}
        type="number"
        value={inputValue}
        min={min}
        max={max}
        step={step}
        onChange={(event) => {
          const nextValue = event.target.value;
          setInputValue(nextValue);
          onInputValueChange?.(nextValue);
          commitValue(nextValue);
        }}
        onBlur={() => {
          commitValue(inputValue);
          if (!inputValue.trim() || !Number.isFinite(Number(inputValue.replace(",", ".")))) {
            setInputValue(normalizedPropValue);
          }
        }}
      />
    </div>
  );
}

export function Field({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label text={label} />
      <select className={INPUT_CLASS} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}
