import { useState } from "react";
import { X, Upload } from "lucide-react";

const CATEGORIES = [
  "Classic Cars",
  "Hybrids",
  "SUVs",
  "Racing",
];

export function ClubCreateModal({ isOpen, onClose, onCreate, loading = false }) {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: "Classic Cars",
    isPublic: true,
    tags: [],
    imageUrl: "",
  });

  const [tagInput, setTagInput] = useState("");
  const [errors, setErrors] = useState({});

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleTogglePublic = () => {
    setFormData((prev) => ({ ...prev, isPublic: !prev.isPublic }));
  };

  const handleAddTag = () => {
    if (tagInput.trim() && formData.tags.length < 5) {
      setFormData((prev) => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim()],
      }));
      setTagInput("");
    }
  };

  const handleRemoveTag = (index) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags.filter((_, i) => i !== index),
    }));
  };

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      // For now, just store the file reference
      // In a real app, you'd upload to Firebase Storage
      const reader = new FileReader();
      reader.onload = (event) => {
        setFormData((prev) => ({
          ...prev,
          imageUrl: event.target.result,
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.name.trim()) {
      newErrors.name = "Nome é obrigatório";
    }
    if (formData.name.length > 120) {
      newErrors.name = "Nome não pode ter mais de 120 caracteres";
    }
    if (formData.description.length > 500) {
      newErrors.description = "Descrição não pode ter mais de 500 caracteres";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      await onCreate(formData);
      setFormData({
        name: "",
        description: "",
        category: "Classic Cars",
        isPublic: true,
        tags: [],
        imageUrl: "",
      });
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
            Criar Novo Clube
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
          {/* Name */}
          <div>
            <label className="block text-sm font-semibold text-[var(--engine-text)] mb-2">
              Nome do Clube *
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Ex: Clássicos de São Paulo"
              maxLength={120}
              className="w-full px-4 py-2 rounded-lg border border-[var(--engine-border)] bg-[var(--engine-surface-2)] text-[var(--engine-text)] placeholder-[var(--engine-text-subtle)] focus:outline-none focus:border-[var(--engine-accent)] transition"
            />
            {errors.name && (
              <p className="text-xs text-red-500 mt-1">{errors.name}</p>
            )}
            <p className="text-xs text-[var(--engine-text-subtle)] mt-1">
              {formData.name.length}/120
            </p>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-[var(--engine-text)] mb-2">
              Descrição
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Descreva o propósito do seu clube..."
              maxLength={500}
              rows={3}
              className="w-full px-4 py-2 rounded-lg border border-[var(--engine-border)] bg-[var(--engine-surface-2)] text-[var(--engine-text)] placeholder-[var(--engine-text-subtle)] focus:outline-none focus:border-[var(--engine-accent)] transition resize-none"
            />
            {errors.description && (
              <p className="text-xs text-red-500 mt-1">{errors.description}</p>
            )}
            <p className="text-xs text-[var(--engine-text-subtle)] mt-1">
              {formData.description.length}/500
            </p>
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-semibold text-[var(--engine-text)] mb-2">
              Categoria
            </label>
            <select
              name="category"
              value={formData.category}
              onChange={handleChange}
              className="w-full px-4 py-2 rounded-lg border border-[var(--engine-border)] bg-[var(--engine-surface-2)] text-[var(--engine-text)] focus:outline-none focus:border-[var(--engine-accent)] transition"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-semibold text-[var(--engine-text)] mb-2">
              Tags (máx 5)
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                placeholder="Digite e pressione Enter"
                className="flex-1 px-4 py-2 rounded-lg border border-[var(--engine-border)] bg-[var(--engine-surface-2)] text-[var(--engine-text)] placeholder-[var(--engine-text-subtle)] focus:outline-none focus:border-[var(--engine-accent)] transition"
              />
              <button
                type="button"
                onClick={handleAddTag}
                disabled={formData.tags.length >= 5}
                className="px-4 py-2 bg-[var(--engine-accent)] text-white rounded-lg font-semibold hover:opacity-90 transition disabled:opacity-50"
              >
                +
              </button>
            </div>
            {formData.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {formData.tags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-2 px-3 py-1 bg-[var(--engine-accent)]/20 text-[var(--engine-accent)] rounded-full text-sm"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(idx)}
                      className="hover:opacity-70"
                    >
                      <X size={14} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Image Upload */}
          <div>
            <label className="block text-sm font-semibold text-[var(--engine-text)] mb-2">
              Imagem do Clube
            </label>
            {formData.imageUrl ? (
              <div className="relative">
                <img
                  src={formData.imageUrl}
                  alt="Preview"
                  className="w-full h-32 object-cover rounded-lg"
                />
                <button
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, imageUrl: "" }))}
                  className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-lg hover:opacity-90"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-[var(--engine-border)] rounded-lg cursor-pointer hover:border-[var(--engine-accent)] transition bg-[var(--engine-surface-2)]">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload size={24} className="text-[var(--engine-text-muted)] mb-2" />
                  <p className="text-sm text-[var(--engine-text-muted)]">
                    Clique para fazer upload
                  </p>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {/* Public Toggle */}
          <div className="flex items-center justify-between p-3 bg-[var(--engine-surface-2)] rounded-lg">
            <label className="text-sm font-semibold text-[var(--engine-text)]">
              Clube Público
            </label>
            <button
              type="button"
              onClick={handleTogglePublic}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                formData.isPublic
                  ? "bg-[var(--engine-accent)]"
                  : "bg-[var(--engine-border)]"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                  formData.isPublic ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
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
              disabled={loading}
              className="flex-1 py-2 px-4 bg-[var(--engine-accent)] text-white rounded-lg font-semibold hover:opacity-90 transition disabled:opacity-50"
            >
              {loading ? "Criando..." : "Criar Clube"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
