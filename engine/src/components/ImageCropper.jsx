import { useState, useCallback, useRef, useEffect } from "react";
import { X, ZoomIn, ZoomOut, RotateCw, RotateCcw, Save } from "lucide-react";
import Cropper from "react-easy-crop";
import { useTranslation } from "react-i18next";

export function ImageCropper({ imageFile, isOpen, onClose, onSave }) {
  const { t } = useTranslation();
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [saving, setSaving] = useState(false);
  const [imageSrc, setImageSrc] = useState(null);
  const [error, setError] = useState("");

  // Read image file and set as src
  const fileReaderRef = useRef(null);

  const handleCropComplete = useCallback((croppedArea, croppedAreaPixelsData) => {
    setCroppedAreaPixels(croppedAreaPixelsData);
  }, []);

  const handleZoomChange = (e) => {
    setZoom(Number(e.target.value));
  };

  const handleRotate = (degrees) => {
    setRotation((prev) => (prev + degrees) % 360);
  };

  const handleReset = () => {
    setZoom(1);
    setRotation(0);
    setCrop({ x: 0, y: 0 });
  };

  const generateCroppedImage = async () => {
    if (!imageSrc || !croppedAreaPixels) return null;

    return new Promise((resolve) => {
      const image = new Image();
      image.src = imageSrc;

      image.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        const { width, height } = croppedAreaPixels;
        const maxSize = 1600;
        const scale = Math.min(1, maxSize / Math.max(width, height));
        const finalWidth = Math.round(width * scale);
        const finalHeight = Math.round(height * scale);

        canvas.width = finalWidth;
        canvas.height = finalHeight;

        if (rotation) {
          ctx.translate(finalWidth / 2, finalHeight / 2);
          ctx.rotate((rotation * Math.PI) / 180);
          ctx.translate(-finalWidth / 2, -finalHeight / 2);
        }

        ctx.drawImage(
          image,
          croppedAreaPixels.x,
          croppedAreaPixels.y,
          croppedAreaPixels.width,
          croppedAreaPixels.height,
          0,
          0,
          finalWidth,
          finalHeight,
        );

        canvas.toBlob(
          (blob) => {
            resolve(blob);
          },
          "image/jpeg",
          0.82,
        );
      };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const croppedBlob = await generateCroppedImage();

      if (!croppedBlob) {
        const errorMsg = t("imageCropper.error") || "Erro ao cortar imagem. Tente novamente.";
        console.error("[ImageCropper] Blob não foi criado");
        setError(errorMsg);
        setSaving(false);
        return;
      }

      // Valida tamanho do blob
      if (croppedBlob.size === 0) {
        const errorMsg = t("imageCropper.emptyError") || "Imagem vazia. Tente novamente.";
        console.error("[ImageCropper] Blob vazio:", croppedBlob.size);
        setError(errorMsg);
        setSaving(false);
        return;
      }

      console.log("[ImageCropper] Blob criado com sucesso:", {
        size: croppedBlob.size,
        type: croppedBlob.type,
      });

      // Cria um File object a partir do blob para compatibilidade com uploadUserPhoto
      const fileName = `cropped-${Date.now()}.jpg`;
      const file = new File([croppedBlob], fileName, { type: "image/jpeg" });

      console.log("[ImageCropper] Chamando onSave com File object");
      const result = await onSave(file);

      if (result === false) {
        const errorMsg = t("modalCar.imageError") || "Erro ao fazer upload da imagem.";
        console.error("[ImageCropper] Upload falhou");
        setError(errorMsg);
      } else {
        handleReset();
        onClose();
      }
    } catch (err) {
      console.error("[ImageCropper] Erro:", err);
      const errorMsg = err.message || t("imageCropper.error") || "Erro ao cortar imagem.";
      setError(errorMsg);
    } finally {
      setSaving(false);
    }
  };

  // Initialize image when component mounts with a new file
  useEffect(() => {
    if (!imageFile || !isOpen) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setImageSrc(event.target.result);
      handleReset();
    };
    reader.readAsDataURL(imageFile);
  }, [imageFile, isOpen]);

  if (!isOpen || !imageSrc) return null;

  return (
    <div className="engine-modal-overlay">
      <div className="engine-modal-panel engine-pop sm:max-w-3xl">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--engine-border)] px-5 py-4 sm:px-7">
          <h2 className="text-lg font-extrabold tracking-tight text-[var(--engine-text)]">
            {t("imageCropper.title") || "Cortar imagem"}
          </h2>
          <button
            onClick={onClose}
            aria-label={t("common.cancel")}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[var(--engine-text-subtle)] transition-colors hover:bg-[var(--engine-surface-2)] hover:text-[var(--engine-text)]"
          >
            <X size={20} />
          </button>
        </div>

        <div className="engine-modal-body engine-scroll engine-safe-bottom flex flex-col gap-4 px-5 pt-5 sm:px-7 sm:pt-6 pb-5">
          {/* Crop Preview */}
          <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-[var(--engine-border)] bg-black">
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={16 / 9}
              cropShape="rect"
              showGrid
              onCropChange={setCrop}
              onCropComplete={handleCropComplete}
              onZoomChange={setZoom}
              onRotationChange={setRotation}
              restrictPosition={false}
            />
          </div>

          {/* Controls */}
          <div className="space-y-4">
            {/* Zoom Control */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--engine-text-subtle)]">
                  {t("imageCropper.zoom") || "Zoom"}
                </label>
                <span className="text-xs font-semibold text-[var(--engine-text)]">
                  {Math.round(zoom * 100)}%
                </span>
              </div>
              <div className="flex items-center gap-3">
                <ZoomOut size={16} className="text-[var(--engine-text-subtle)]" />
                <input
                  type="range"
                  min="0.5"
                  max="3"
                  step="0.1"
                  value={zoom}
                  onChange={handleZoomChange}
                  className="flex-1 h-2 bg-[var(--engine-surface-2)] rounded-full outline-none appearance-none cursor-pointer accent-[var(--engine-accent)]"
                />
                <ZoomIn size={16} className="text-[var(--engine-text-subtle)]" />
              </div>
            </div>

            {/* Rotation Control */}
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--engine-text-subtle)]">
                {t("imageCropper.rotate") || "Rotação"}
              </p>
              <div className="grid grid-cols-4 gap-2">
                {[0, 90, 180, 270].map((deg) => (
                  <button
                    key={deg}
                    type="button"
                    onClick={() => {
                      const diff = (deg - rotation) % 360;
                      handleRotate(diff);
                    }}
                    className={`flex items-center justify-center rounded-lg border py-2.5 text-xs font-bold uppercase transition-colors ${
                      rotation === deg
                        ? "border-[var(--engine-accent)] bg-[var(--engine-accent-soft)] text-[var(--engine-accent)]"
                        : "border-[var(--engine-border)] bg-[var(--engine-surface-2)] text-[var(--engine-text-subtle)] hover:border-[var(--engine-accent)]"
                    }`}
                  >
                    {deg}°
                  </button>
                ))}
              </div>
            </div>

            {/* Reset Button */}
            <button
              type="button"
              onClick={handleReset}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--engine-border)] bg-[var(--engine-surface-2)] px-4 py-2.5 text-sm font-semibold text-[var(--engine-text)] transition-colors hover:border-[var(--engine-border-strong)] hover:bg-[var(--engine-surface)]"
            >
              <RotateCcw size={16} />
              {t("imageCropper.reset") || "Redefinir"}
            </button>
          </div>
        </div>

        {error && (
          <div className="border-t border-[var(--engine-border)] bg-red-500/10 px-5 py-3 sm:px-7 flex gap-2 items-start">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-red-600 dark:text-red-400">
                {error}
              </p>
            </div>
            <button
              onClick={() => setError("")}
              aria-label={t("common.cancel")}
              className="flex-shrink-0 text-red-600/60 hover:text-red-600 dark:text-red-400/60 dark:hover:text-red-400 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        )}

        <div className="border-t border-[var(--engine-border)] bg-[var(--engine-surface)] px-5 py-4 sm:px-7 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-[var(--engine-border)] bg-[var(--engine-surface)] px-4 py-3 font-semibold text-[var(--engine-text)] transition-colors hover:bg-[var(--engine-surface-2)]"
          >
            {t("common.cancel")}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-[var(--engine-accent)] px-4 py-3 font-semibold text-white shadow-[0_2px_10px_var(--engine-accent-soft)] transition-colors hover:brightness-95 disabled:opacity-50"
          >
            <Save size={16} />
            {t("imageCropper.save") || "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
