import { AlertTriangle, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

export function DeleteModal({ isOpen, onClose, onConfirm, carName, message }) {
  const { t } = useTranslation();
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-red-600/30 bg-[#181818] p-8 text-center shadow-2xl">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-red-600/20 bg-red-600/10">
          <AlertTriangle className="text-red-600" size={32} />
        </div>

        <h2 className="mb-2 text-xl font-black uppercase italic tracking-tight text-white">
          {t("deleteModal.title")}
        </h2>

        <p className="mb-4 text-xs font-black uppercase tracking-widest text-red-600">
          {carName}
        </p>

        <p className="mb-8 text-sm font-medium leading-relaxed text-gray-400">
          {message}
        </p>

        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={onClose}
            className="rounded-xl bg-[#222] px-4 py-3 font-bold text-white transition-all hover:bg-[#333] active:scale-95"
          >
            {t("deleteModal.keep")}
          </button>
          <button
            onClick={onConfirm}
            className="flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 font-black uppercase italic text-white shadow-lg shadow-red-900/20 transition-all hover:bg-red-700 active:scale-95"
          >
            <Trash2 size={16} /> {t("common.delete")}
          </button>
        </div>
      </div>
    </div>
  );
}
