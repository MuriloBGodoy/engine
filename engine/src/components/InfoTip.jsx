import { useEffect, useRef, useState } from "react";
import { HelpCircle } from "lucide-react";

// Tooltip educativo: "?" que explica um termo em linguagem simples.
// Hover no desktop, toque no mobile (fecha ao tocar fora).
export function InfoTip({ text, align = "left" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event) => {
      if (!ref.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  return (
    <span ref={ref} className="relative inline-flex shrink-0">
      <button
        type="button"
        aria-label={text}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="flex items-center text-[var(--engine-text-subtle)] transition-colors hover:text-[var(--engine-accent)] focus-visible:text-[var(--engine-accent)]"
      >
        <HelpCircle size={13} />
      </button>
      {open && (
        <span
          role="tooltip"
          className={`engine-pop absolute bottom-full z-30 mb-2 w-60 rounded-xl border border-[var(--engine-border)] bg-[var(--engine-elevated)] px-3 py-2 text-left text-[11px] font-normal normal-case leading-relaxed tracking-normal text-[var(--engine-text-muted)] shadow-[var(--engine-shadow-md)] ${
            align === "right" ? "right-0" : "-left-2"
          }`}
        >
          {text}
        </span>
      )}
    </span>
  );
}
