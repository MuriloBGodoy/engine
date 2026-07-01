import axios from "axios";

const FIPE_API_URL = "https://parallelum.com.br/fipe/api/v1/carros/marcas";
const ENGINE_API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080/api";

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
};
