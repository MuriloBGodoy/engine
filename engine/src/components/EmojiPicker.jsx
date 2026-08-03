import { useRef, useState, useEffect } from "react";
import { Smile } from "lucide-react";

const COMMON_EMOJIS = [
  "😀",
  "😂",
  "😍",
  "🥰",
  "😎",
  "🤔",
  "👍",
  "🔥",
  "💯",
  "✨",
  "🎉",
  "🚀",
  "💪",
  "😅",
  "😭",
  "😡",
  "🤷",
  "🙌",
  "💯",
  "👏",
  "🎊",
  "❤️",
  "💔",
  "💚",
  "💙",
  "👌",
  "🤝",
  "🙏",
  "💡",
  "⚡",
  "🌟",
  "✅",
  "❌",
  "🔔",
  "📱",
  "⏰",
  "🎯",
];

export function EmojiPicker({ onEmojiSelect }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event) => {
      if (ref.current && !ref.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const handleEmojiClick = (emoji) => {
    onEmojiSelect(emoji);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        title="Emojis"
        aria-label="Emojis"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[var(--engine-text-muted)] transition hover:bg-[var(--engine-surface-2)] hover:text-[var(--engine-accent)]"
      >
        <Smile size={18} />
      </button>

      {open && (
        <div className="absolute bottom-14 left-0 z-50 grid w-80 grid-cols-6 gap-1 rounded-2xl border border-[var(--engine-border)] bg-[var(--engine-surface)] p-3 shadow-lg">
          {COMMON_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => handleEmojiClick(emoji)}
              className="flex h-10 items-center justify-center rounded-lg text-lg transition hover:bg-[var(--engine-accent-soft)]"
              title={emoji}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
