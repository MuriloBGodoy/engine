import { useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  RotateCw,
  Send,
  X,
} from "lucide-react";
import { ImageEditor } from "./ImageEditor";

export function ImagePreviewModal({
  imageUrl,
  onSend,
  onCancel,
  isLoading = false,
}) {
  const [caption, setCaption] = useState("");
  const [editedImageUrl, setEditedImageUrl] = useState(imageUrl);
  const [isEditing, setIsEditing] = useState(false);

  const handleImageEditorSave = (dataUrl) => {
    setEditedImageUrl(dataUrl);
    setIsEditing(false);
  };

  const handleSend = async () => {
    if (!editedImageUrl) return;
    await onSend(editedImageUrl, caption, 0);
  };

  if (isEditing) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-black p-4 sm:p-6">
        <header className="mb-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            disabled={isLoading}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-white transition hover:bg-white/10 disabled:opacity-50"
            aria-label="Voltar"
          >
            <ChevronLeft size={24} />
          </button>
          <h2 className="text-sm font-semibold text-white">Editar foto</h2>
          <div className="w-10" />
        </header>
        <div className="flex-1 overflow-y-auto">
          <ImageEditor
            imageUrl={editedImageUrl}
            onClose={() => setIsEditing(false)}
            onSave={handleImageEditorSave}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <header className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3 sm:px-6">
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-white transition hover:bg-white/10 disabled:opacity-50"
          aria-label="Fechar"
        >
          <ChevronLeft size={24} />
        </button>

        <h2 className="text-sm font-semibold text-white">Foto</h2>

        <div className="w-10" />
      </header>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="flex items-center justify-center rounded-2xl bg-black/50">
          <img
            src={editedImageUrl}
            alt="Preview"
            style={{
              maxHeight: "60vh",
              maxWidth: "100%",
            }}
            className="rounded-2xl"
          />
        </div>
      </div>

      <div className="shrink-0 border-t border-white/10 bg-black/50 p-4 backdrop-blur-sm sm:p-6">
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          disabled={isLoading}
          className="mb-4 w-full rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20 disabled:opacity-50"
        >
          ✎ Editar foto
        </button>

        <textarea
          value={caption}
          onChange={(event) => setCaption(event.target.value)}
          placeholder="Adicione uma legenda (opcional)"
          maxLength={500}
          className="mb-4 w-full resize-none rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/50 outline-none transition focus:border-white/40 focus:bg-white/10"
          rows={3}
        />

        <div className="flex gap-3 sm:gap-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 rounded-xl bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/20 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={isLoading}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--engine-accent)] px-4 py-3 text-sm font-semibold text-white transition hover:brightness-95 disabled:opacity-50"
          >
            <Send size={16} />
            Enviar
          </button>
        </div>
      </div>
    </div>
  );
}
