import { useState } from "react";
import { X, Upload, Image as ImageIcon } from "lucide-react";

export function CreatePostModal({ isOpen, onClose, onCreate, loading = false }) {
  const [content, setContent] = useState("");
  const [images, setImages] = useState([]);
  const [errors, setErrors] = useState({});

  if (!isOpen) return null;

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files || []);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (images.length < 4) {
          setImages((prev) => [...prev, event.target.result]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemoveImage = (index) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const validateForm = () => {
    const newErrors = {};
    if (!content.trim()) {
      newErrors.content = "O post não pode estar vazio";
    }
    if (content.length > 5000) {
      newErrors.content = "O post não pode ter mais de 5000 caracteres";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      await onCreate({
        content: content.trim(),
        imageUrls: images,
      });
      setContent("");
      setImages([]);
      onClose();
    } catch (error) {
      setErrors({ submit: error.message });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--engine-surface)] rounded-xl border border-[var(--engine-border)] max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-[var(--engine-surface)] border-b border-[var(--engine-border)] p-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-[var(--engine-text)]">
            Novo Post
          </h2>
          <button
            onClick={onClose}
            className="text-[var(--engine-text-muted)] hover:text-[var(--engine-text)] transition"
          >
            <X size={24} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Content */}
          <div>
            <label className="block text-sm font-semibold text-[var(--engine-text)] mb-2">
              O que você está pensando? *
            </label>
            <textarea
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                if (errors.content) {
                  setErrors((prev) => ({ ...prev, content: "" }));
                }
              }}
              placeholder="Compartilhe sua experiência, dica ou insight sobre carros..."
              maxLength={5000}
              rows={5}
              className="w-full px-4 py-3 rounded-lg border border-[var(--engine-border)] bg-[var(--engine-surface-2)] text-[var(--engine-text)] placeholder-[var(--engine-text-subtle)] focus:outline-none focus:border-[var(--engine-accent)] transition resize-none"
            />
            {errors.content && (
              <p className="text-xs text-red-500 mt-1">{errors.content}</p>
            )}
            <p className="text-xs text-[var(--engine-text-subtle)] mt-1">
              {content.length}/5000
            </p>
          </div>

          {/* Images */}
          <div>
            <label className="block text-sm font-semibold text-[var(--engine-text)] mb-2">
              Imagens (máx 4)
            </label>

            {/* Image Preview Grid */}
            {images.length > 0 && (
              <div className="grid grid-cols-2 gap-2 mb-3">
                {images.map((image, idx) => (
                  <div key={idx} className="relative group">
                    <img
                      src={image}
                      alt={`Preview ${idx + 1}`}
                      className="w-full h-24 object-cover rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(idx)}
                      className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Upload Area */}
            {images.length < 4 && (
              <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-[var(--engine-border)] rounded-lg cursor-pointer hover:border-[var(--engine-accent)] transition bg-[var(--engine-surface-2)]">
                <div className="flex flex-col items-center justify-center pt-4 pb-4">
                  <Upload size={20} className="text-[var(--engine-text-muted)] mb-1" />
                  <p className="text-xs text-[var(--engine-text-muted)]">
                    Clique para adicionar imagem
                  </p>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {/* Error Messages */}
          {errors.submit && (
            <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">
                {errors.submit}
              </p>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 px-4 rounded-lg border border-[var(--engine-border)] text-[var(--engine-text)] font-semibold hover:bg-[var(--engine-surface-2)] transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !content.trim()}
              className="flex-1 py-2 px-4 bg-[var(--engine-accent)] text-white rounded-lg font-semibold hover:opacity-90 transition disabled:opacity-50"
            >
              {loading ? "Postando..." : "Postar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
