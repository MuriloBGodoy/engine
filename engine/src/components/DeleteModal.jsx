import { X, AlertTriangle, Trash2 } from "lucide-react";

export function DeleteModal({ isOpen, onClose, onConfirm, carName, message }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/95 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-[#181818] w-full max-w-sm rounded-2xl border border-red-600/30 p-8 shadow-2xl text-center">
        <div className="w-16 h-16 bg-red-600/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-600/20">
          <AlertTriangle className="text-red-600" size={32} />
        </div>

        <h2 className="text-xl font-black italic text-white tracking-tighter mb-2 uppercase">
          WAIT A SECOND!
        </h2>

        <p className="text-red-600 font-black text-xs mb-4 uppercase tracking-widest">
          {carName}
        </p>

        <p className="text-gray-400 font-medium text-sm leading-relaxed mb-8">
          {message}
        </p>

        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={onClose}
            className="py-3 px-4 bg-[#222] hover:bg-[#333] text-white font-bold rounded-xl transition-all active:scale-95"
          >
            NÃO, MANTER!
          </button>
          <button
            onClick={onConfirm}
            className="py-3 px-4 bg-red-600 hover:bg-red-700 text-white font-black italic rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-red-900/20"
          >
            <Trash2 size={16} /> EXCLUIR
          </button>
        </div>
      </div>
    </div>
  );
}
