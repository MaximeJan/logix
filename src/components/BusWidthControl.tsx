import { useEffect, useState } from 'react';

// Contrôle d'édition d'une largeur de bus : champ numérique 1–32 + boutons +/−.
// Largeur libre, non restreinte aux puissances de 2.
export function BusWidthControl({
  value,
  min = 1,
  max = 32,
  onChange,
}: {
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => {
    setText(String(value));
  }, [value]);

  const clamp = (n: number) => Math.max(min, Math.min(max, Math.floor(n)));

  const commit = (raw: string) => {
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n) || isNaN(n)) {
      setText(String(value));
      return;
    }
    const c = clamp(n);
    setText(String(c));
    if (c !== value) onChange(c);
  };

  return (
    <div className="flex items-stretch gap-1">
      <button
        onClick={() => {
          const c = clamp(value - 1);
          if (c !== value) onChange(c);
        }}
        disabled={value <= min}
        className="px-2 py-1 border border-stone-300 rounded bg-white text-stone-700 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-mono"
        title="Diminuer"
      >
        −
      </button>
      <input
        type="number"
        min={min}
        max={max}
        step={1}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            commit(e.currentTarget.value);
            e.currentTarget.blur();
          }
        }}
        className="flex-1 min-w-0 px-2 py-1 border border-stone-300 rounded font-mono text-sm text-center"
      />
      <button
        onClick={() => {
          const c = clamp(value + 1);
          if (c !== value) onChange(c);
        }}
        disabled={value >= max}
        className="px-2 py-1 border border-stone-300 rounded bg-white text-stone-700 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-mono"
        title="Augmenter"
      >
        +
      </button>
    </div>
  );
}
