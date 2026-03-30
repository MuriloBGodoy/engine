import { useState, useEffect, useRef } from "react";
import { X, Save, Loader2, Upload } from "lucide-react";
import axios from "axios";
import { getCarImage } from "../services/imageService";

export function ModalNewCar({ isOpen, onClose, onSave, carToEdit = null }) {
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
  const fileInputRef = useRef(null);

  const formatDisplayValue = (val) => {
    return new Intl.NumberFormat("pt-BR", {
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
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setCustomImage(reader.result);
      reader.readAsDataURL(file);
    }
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
        });
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
        });
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
        });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const brandName =
      brands.find((b) => b.codigo === selectedBrand)?.nome ||
      carToEdit?.brand ||
      "";
    const modelName =
      models.find((m) => m.codigo === selectedModel)?.nome ||
      carToEdit?.model ||
      "";

    let finalImage = customImage;
    if (!finalImage && (!carToEdit || (carToEdit && !carToEdit.image))) {
      const query = `${brandName} ${modelName}`;
      finalImage = await getCarImage(query);
    }

    const carData = {
      id: carToEdit ? carToEdit.id : Date.now(),
      brand: brandName,
      model: modelName,
      year:
        years.find((y) => y.codigo === selectedYear)?.nome ||
        carToEdit?.year ||
        "",
      targetValue: targetValue,
      savedValue: savedValue,
      image:
        finalImage ||
        "https://images.unsplash.com/photo-1598209279122-8541213a0387?q=80&w=600",
    };

    await onSave(carData);
    setLoading(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/95 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#181818] w-full max-w-md rounded-3xl border border-white/5 p-8 shadow-2xl overflow-y-auto max-h-[95vh]">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-black italic text-white tracking-tighter uppercase">
            {carToEdit ? "Edit Machine" : "Tune Your Dream"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white transition-colors"
          >
            <X size={28} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div
            onClick={() => fileInputRef.current.click()}
            className="w-full h-48 bg-[#121212] border-2 border-dashed border-[#222] rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:border-red-600/40 transition-all overflow-hidden"
          >
            {customImage ? (
              <img
                src={customImage}
                className="w-full h-full object-cover"
                alt="Car preview"
              />
            ) : (
              <div className="text-center">
                <Upload className="text-gray-600 mx-auto mb-2" size={32} />
                <span className="text-[10px] text-gray-500 uppercase font-bold">
                  Custom Photo (Click to Upload)
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
                className="w-full bg-[#121212] border border-[#222] rounded-xl px-4 py-3 text-white focus:border-red-600 outline-none"
              >
                <option value="">
                  {carToEdit ? `Brand: ${carToEdit.brand}` : "1. Select Brand"}
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
                className="w-full bg-[#121212] border border-[#222] rounded-xl px-4 py-3 text-white focus:border-red-600 outline-none disabled:opacity-20"
              >
                <option value="">
                  {carToEdit ? `Model: ${carToEdit.model}` : "2. Select Model"}
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
                className="w-full bg-[#121212] border border-[#222] rounded-xl px-4 py-3 text-white focus:border-red-600 outline-none disabled:opacity-20"
              >
                <option value="">
                  {carToEdit ? `Year: ${carToEdit.year}` : "3. Select Year"}
                </option>
                {years.map((y) => (
                  <option key={y.codigo} value={y.codigo}>
                    {y.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-red-500 uppercase tracking-widest ml-1">
                  Fipe Price
                </label>
                <input
                  value={formatDisplayValue(targetValue)}
                  readOnly
                  className="w-full bg-[#121212] border border-red-600/20 rounded-xl px-4 py-3 text-white font-bold outline-none cursor-not-allowed"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">
                  I Already Have
                </label>
                <input
                  type="text"
                  value={formatDisplayValue(savedValue)}
                  onChange={handleMoneyChange}
                  className="w-full bg-[#121212] border border-[#222] rounded-xl px-4 py-3 text-white focus:border-red-600 outline-none"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-black italic py-4 rounded-xl mt-4 flex items-center justify-center gap-3 active:scale-95 transition-all shadow-xl shadow-red-900/10 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Save size={20} />
            )}
            {carToEdit ? "UPDATE GARAGE" : "CONFIRM TO GARAGE"}
          </button>
        </form>
      </div>
    </div>
  );
}
