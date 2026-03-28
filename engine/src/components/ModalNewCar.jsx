import { useState, useEffect } from "react";
import { X, Save, Loader2, DollarSign } from "lucide-react";
import axios from "axios";
import { getCarImage } from "../services/imageService";

export function ModalNewCar({ isOpen, onClose, onSave }) {
  const [brands, setBrands] = useState([]);
  const [models, setModels] = useState([]);
  const [years, setYears] = useState([]);
  const [selectedBrand, setSelectedBrand] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [targetValue, setTargetValue] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      axios
        .get("https://parallelum.com.br/fipe/api/v1/carros/marcas")
        .then((res) => setBrands(res.data));
    }
  }, [isOpen]);

  const handleBrandChange = (brandId) => {
    setSelectedBrand(brandId);
    setModels([]);
    setYears([]);
    setSelectedModel("");
    setSelectedYear("");
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
    setSelectedYear("");
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

  const handleYearChange = (yearId) => {
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

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);

    const brandName =
      brands.find((b) => b.codigo === selectedBrand)?.nome || "";
    const modelName =
      models.find((m) => m.codigo === selectedModel)?.nome || "";

    const query = `${brandName} ${modelName}`;
    const pexelsImage = await getCarImage(query);

    const newCar = {
      id: Date.now(),
      brand: brandName,
      model: modelName,
      year: years.find((y) => y.codigo === selectedYear)?.nome,
      targetValue: targetValue,
      savedValue: Number(formData.get("savedValue")),
      image:
        pexelsImage ||
        "https://images.unsplash.com/photo-1598209279122-8541213a0387?q=80&w=600",
    };

    onSave(newCar);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-[#181818] w-full max-w-md rounded-2xl border border-red-600/20 p-8 shadow-2xl overflow-y-auto max-h-[90vh]">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-black italic text-white tracking-tighter uppercase">
            Tune Your Dream
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest ml-1">
              1. Brand
            </label>
            <select
              onChange={(e) => handleBrandChange(e.target.value)}
              required
              className="w-full bg-[#121212] border border-[#222] rounded-xl px-4 py-3 text-white focus:border-red-600 outline-none"
            >
              <option value="">Select Brand</option>
              {brands.map((b) => (
                <option key={b.codigo} value={b.codigo}>
                  {b.nome}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest ml-1">
              2. Model
            </label>
            <select
              onChange={(e) => handleModelChange(e.target.value)}
              disabled={!models.length}
              required
              className="w-full bg-[#121212] border border-[#222] rounded-xl px-4 py-3 text-white focus:border-red-600 outline-none disabled:opacity-20"
            >
              <option value="">Select Model</option>
              {models.map((m) => (
                <option key={m.codigo} value={m.codigo}>
                  {m.nome}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest ml-1">
              3. Year
            </label>
            <select
              onChange={(e) => handleYearChange(e.target.value)}
              disabled={!years.length}
              required
              className="w-full bg-[#121212] border border-[#222] rounded-xl px-4 py-3 text-white focus:border-red-600 outline-none disabled:opacity-20"
            >
              <option value="">Select Year</option>
              {years.map((y) => (
                <option key={y.codigo} value={y.codigo}>
                  {y.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4">
            <div>
              <label className="text-[9px] font-bold text-red-500 uppercase tracking-widest ml-1 underline">
                Fipe Price
              </label>
              <div className="relative">
                <input
                  value={targetValue.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                  readOnly
                  className="w-full bg-[#121212] border border-red-600/30 rounded-xl px-4 py-3 text-white font-bold outline-none cursor-not-allowed"
                />
                {loading && (
                  <Loader2
                    className="absolute right-3 top-3 animate-spin text-red-600"
                    size={18}
                  />
                )}
              </div>
            </div>
            <div>
              <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest ml-1">
                I Already Have
              </label>
              <input
                name="savedValue"
                type="number"
                required
                className="w-full bg-[#121212] border border-[#222] rounded-xl px-4 py-3 text-white focus:border-red-600 outline-none"
                placeholder="0"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-red-600 hover:bg-red-700 text-white font-black italic py-4 rounded-xl mt-4 flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-red-900/20"
          >
            <Save size={18} /> CONFIRM TO GARAGE
          </button>
        </form>
      </div>
    </div>
  );
}
