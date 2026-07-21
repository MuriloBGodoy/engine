import { useState, useEffect, useRef } from "react";
import { X, Save, Loader2, Upload } from "lucide-react";
import axios from "axios";
import { useTranslation } from "react-i18next";

const fallbackImage =
  "https://images.unsplash.com/photo-1598209279122-8541213a0387?q=80&w=600";

const fieldClass =
  "w-full rounded-xl border border-[var(--engine-border)] bg-[var(--engine-surface-2)] px-4 py-3 text-[var(--engine-text)] outline-none transition-colors focus:border-[var(--engine-accent)] disabled:opacity-40";
const fieldLabelClass =
  "ml-1 text-[10px] font-bold uppercase tracking-widest";

export function ModalNewCar({ isOpen, onClose, onSave, carToEdit = null }) {
  const { i18n, t } = useTranslation();
  const [brands, setBrands] = useState([]);
  const [models, setModels] = useState([]);
  const [years, setYears] = useState([]);
  const [selectedBrand, setSelectedBrand] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [targetValue, setTargetValue] = useState(0);
  const [savedValue, setSavedValue] = useState(0);
  const [loading, setLoading] = useState(false);
  const [customImage, setCustomImage] = useState(null);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  const formatDisplayValue = (val) => {
    return new Intl.NumberFormat(i18n.language, {
      style: "currency",
      currency: "BRL",
    }).format(val);
  };

  const handleMoneyChange = (e) => {
    const rawValue = e.target.value.replace(/\D/g, "");
    setSavedValue(Number(rawValue) / 100);
  };

  useEffect(() => {
    if (!isOpen) return;

    axios
      .get("https://parallelum.com.br/fipe/api/v1/carros/marcas")
      .then((res) => setBrands(res.data))
      .catch(() => {});

    const timer = setTimeout(() => {
      if (carToEdit) {
        setSavedValue(carToEdit.savedValue || 0);
        setTargetValue(carToEdit.targetValue || 0);
        setCustomImage(carToEdit.image || null);
      } else {
        setSavedValue(0);
        setTargetValue(0);
        setCustomImage(null);
        setSelectedBrand("");
        setSelectedModel("");
        setSelectedYear("");
      }
    }, 0);

    return () => clearTimeout(timer);
  }, [isOpen, carToEdit]);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    setError("");

    if (!file) return;

    if (!file.type.startsWith("image/") || file.size > 4 * 1024 * 1024) {
      setError(t("modalCar.imageError"));
      e.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => setCustomImage(reader.result);
    reader.readAsDataURL(file);
  };

  const handleBrandChange = (brandId) => {
    setSelectedBrand(brandId);
    setModels([]);
    if (brandId) {
      setLoading(true);
      axios
        .get(
          `https://parallelum.com.br/fipe/api/v1/carros/marcas/${brandId}/modelos`,
        )
        .then((res) => {
          setModels(res.data.modelos);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  };

  const handleModelChange = (modelId) => {
    setSelectedModel(modelId);
    setYears([]);
    if (modelId) {
      setLoading(true);
      axios
        .get(
          `https://parallelum.com.br/fipe/api/v1/carros/marcas/${selectedBrand}/modelos/${modelId}/anos`,
        )
        .then((res) => {
          setYears(res.data);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  };

  const handleYearSelection = (yearId) => {
    setSelectedYear(yearId);
    if (yearId) {
      setLoading(true);
      axios
        .get(
          `https://parallelum.com.br/fipe/api/v1/carros/marcas/${selectedBrand}/modelos/${selectedModel}/anos/${yearId}`,
        )
        .then((res) => {
          const valorLimpo = Number(res.data.Valor.replace(/\D/g, "")) / 100;
          setTargetValue(valorLimpo);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setError("");

    const brandName =
      brands.find((b) => String(b.codigo) === String(selectedBrand))?.nome ||
      carToEdit?.brand ||
      "";
    const modelName =
      models.find((m) => String(m.codigo) === String(selectedModel))?.nome ||
      carToEdit?.model ||
      "";

    // O select de modelo fica desabilitado enquanto a lista da FIPE não
    // carrega — e navegador nenhum valida campo desabilitado, então dava para
    // salvar carro só com a marca. Aí a publicação saía sem modelo.
    if (!brandName || !modelName) {
      setError(t("modalCar.missingVehicle"));
      setLoading(false);
      return;
    }

    const finalImage = customImage || carToEdit?.image || fallbackImage;

    const carData = {
      id: carToEdit ? carToEdit.id : Date.now(),
      brand: brandName,
      model: modelName,
      year:
        years.find((y) => String(y.codigo) === String(selectedYear))?.nome ||
        carToEdit?.year ||
        "",
      targetValue: targetValue,
      savedValue: savedValue,
      image: finalImage,
    };

    const saved = await onSave(carData);
    setLoading(false);

    if (saved) {
      onClose();
    } else {
      setError(t("modalCar.saveError"));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="engine-modal-overlay">
      <div className="engine-modal-panel engine-pop sm:max-w-md">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--engine-border)] px-5 py-4 sm:px-7">
          <h2 className="text-lg font-extrabold tracking-tight text-[var(--engine-text)]">
            {carToEdit ? t("modalCar.editTitle") : t("modalCar.newTitle")}
          </h2>
          <button
            onClick={onClose}
            aria-label={t("common.cancel")}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[var(--engine-text-subtle)] transition-colors hover:bg-[var(--engine-surface-2)] hover:text-[var(--engine-text)]"
          >
            <X size={20} />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="engine-modal-body engine-scroll engine-safe-bottom space-y-5 px-5 pt-5 sm:px-7 sm:pt-6"
        >
          <div
            onClick={() => fileInputRef.current.click()}
            className="flex h-40 w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-[var(--engine-border-strong)] bg-[var(--engine-surface-2)] transition-colors hover:border-[var(--engine-accent)] sm:h-48"
          >
            {customImage ? (
              <img
                src={customImage}
                className="h-full w-full object-cover"
                alt="Car preview"
              />
            ) : (
              <div className="text-center">
                <Upload className="mx-auto mb-2 text-[var(--engine-text-subtle)]" size={30} />
                <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--engine-text-subtle)]">
                  {t("modalCar.photo")}
                </span>
              </div>
            )}
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*"
              onChange={handleFileUpload}
            />
          </div>

          <div className="space-y-4">
            <div className="space-y-4">
              <select
                onChange={(e) => handleBrandChange(e.target.value)}
                required={!carToEdit}
                value={selectedBrand}
                className={fieldClass}
              >
                <option value="">
                  {carToEdit
                    ? t("modalCar.brandCurrent", { brand: carToEdit.brand })
                    : t("modalCar.brand")}
                </option>
                {brands.map((b) => (
                  <option key={b.codigo} value={b.codigo}>
                    {b.nome}
                  </option>
                ))}
              </select>

              <select
                onChange={(e) => handleModelChange(e.target.value)}
                disabled={!models.length && !carToEdit}
                required={!carToEdit}
                value={selectedModel}
                className={fieldClass}
              >
                <option value="">
                  {carToEdit
                    ? t("modalCar.modelCurrent", { model: carToEdit.model })
                    : t("modalCar.model")}
                </option>
                {models.map((m) => (
                  <option key={m.codigo} value={m.codigo}>
                    {m.nome}
                  </option>
                ))}
              </select>

              <select
                onChange={(e) => handleYearSelection(e.target.value)}
                disabled={!years.length && !carToEdit}
                required={!carToEdit}
                value={selectedYear}
                className={fieldClass}
              >
                <option value="">
                  {carToEdit
                    ? t("modalCar.yearCurrent", { year: carToEdit.year })
                    : t("modalCar.year")}
                </option>
                {years.map((y) => (
                  <option key={y.codigo} value={y.codigo}>
                    {y.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className={`${fieldLabelClass} text-[var(--engine-accent)]`}>
                  {t("modalCar.fipePrice")}
                </label>
                <input
                  value={formatDisplayValue(targetValue)}
                  readOnly
                  className="w-full cursor-not-allowed rounded-xl border border-[var(--engine-accent)]/20 bg-[var(--engine-accent-soft)] px-4 py-3 font-bold text-[var(--engine-text)] outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className={`${fieldLabelClass} text-[var(--engine-text-subtle)]`}>
                  {t("modalCar.savedValue")}
                </label>
                <input
                  type="text"
                  value={formatDisplayValue(savedValue)}
                  onChange={handleMoneyChange}
                  className={fieldClass}
                />
              </div>
            </div>
          </div>

          {error && (
            <p className="text-center text-sm font-semibold text-red-500">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--engine-accent)] py-3 font-semibold tracking-tight text-white shadow-[0_2px_10px_var(--engine-accent-soft)] transition-colors hover:brightness-95 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Save size={18} />
            )}
            {carToEdit ? t("modalCar.update") : t("modalCar.confirm")}
          </button>
        </form>
      </div>
    </div>
  );
}
