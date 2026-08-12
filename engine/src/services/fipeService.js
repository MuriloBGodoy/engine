import axios from "axios";

const FIPE_API_URL = "https://parallelum.com.br/fipe/api/v1/carros/marcas";
// Sem variável definida, a base fica vazia — igual ao `db.js`. Caindo em
// localhost, a chamada morria em produção, o consumo INMETRO voltava nulo e o
// modal mostrava o consumo padrão sem nunca avisar que era chute.
const ENGINE_API_URL = import.meta.env.VITE_API_URL || "";

const engineApiUrl = (path) => `${ENGINE_API_URL}${path}`;

export const fipeService = {
  getBrands: async () => {
    const response = await axios.get(
      ENGINE_API_URL ? engineApiUrl("/fipe/brands") : FIPE_API_URL,
    );
    return response.data;
  },

  getModels: async (brandId) => {
    const response = await axios.get(
      ENGINE_API_URL
        ? engineApiUrl(`/fipe/brands/${brandId}/models`)
        : `${FIPE_API_URL}/${brandId}/modelos`,
    );
    return response.data.modelos;
  },

  getYears: async (brandId, modelId) => {
    const response = await axios.get(
      ENGINE_API_URL
        ? engineApiUrl(`/fipe/brands/${brandId}/models/${modelId}/years`)
        : `${FIPE_API_URL}/${brandId}/modelos/${modelId}/anos`,
    );
    return response.data;
  },

  getPrice: async (brandId, modelId, yearId) => {
    const response = await axios.get(
      ENGINE_API_URL
        ? engineApiUrl(
            `/fipe/brands/${brandId}/models/${modelId}/years/${yearId}/price`,
          )
        : `${FIPE_API_URL}/${brandId}/modelos/${modelId}/anos/${yearId}`,
    );
    return response.data.Valor;
  },

  getConsumption: async (modelName) => {
    // Busca consumo real (km/l) do modelo
    if (!ENGINE_API_URL) {
      console.warn("Consumption data only available with backend API");
      return null;
    }
    try {
      const response = await axios.get(
        engineApiUrl(`/fipe/consumption/${encodeURIComponent(modelName)}`),
      );
      return response.data; // { gasoline: 13.5, ethanol: 9.8, diesel: 14.0 }
    } catch (error) {
      console.error("Erro ao carregar consumo real:", error);
      return null;
    }
  },
};
