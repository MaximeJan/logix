import { useRef, useState, type ReactNode } from 'react';

// Tooltip qui apparaît après un délai au survol. Avec `onlyIfTruncated`, ne s'affiche
// que si l'élément `[data-truncate]` interne est réellement tronqué (texte coupé).
export function HoverTooltip({
  text,
  children,
  onlyIfTruncated = false,
}: {
  text: string;
  children: ReactNode;
  onlyIfTruncated?: boolean;
}) {
  const [show, setShow] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const onEnter = () => {
    timerRef.current = setTimeout(() => {
      if (onlyIfTruncated && wrapRef.current) {
        const el = wrapRef.current.querySelector('[data-truncate]');
        if (!el || el.scrollWidth <= el.clientWidth) return;
      }
      setShow(true);
    }, 500);
  };
  const onLeave = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setShow(false);
  };
  return (
    <div ref={wrapRef} className="relative" onMouseEnter={onEnter} onMouseLeave={onLeave}>
      {children}
      {show && (
        <div className="absolute z-50 left-1/2 -translate-x-1/2 top-full mt-1 px-2 py-1 rounded bg-stone-800 text-white text-xs whitespace-nowrap shadow-lg pointer-events-none">
          {text}
        </div>
      )}
    </div>
  );
}
