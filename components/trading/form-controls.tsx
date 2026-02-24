"use client";

export const INPUT_CLASS =
  "h-9 w-full rounded-md border border-input/80 bg-background/70 px-3 text-sm text-foreground shadow-xs outline-none transition-colors placeholder:text-muted-foreground/90 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/35 disabled:cursor-not-allowed disabled:opacity-60";

export function Label({ text }: { text: string }) {
  return <p className="text-sm font-medium">{text}</p>;
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
  min,
  max,
  step,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <div className="space-y-1">
      <Label text={label} />
      <input
        className={INPUT_CLASS}
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(Number(event.target.value))}
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
