import axios from "axios";

const API_URL = "https://parallelum.com.br/fipe/api/v1/carros/marcas";

export const fipeService = {
  // 1. Busca todas as marcas (Ford, Ferrari, etc)
  getBrands: async () => {
    const response = await axios.get(API_URL);
    return response.data; // [{nome: "Acura", codigo: "1"}, ...]
  },

  // 2. Busca modelos de uma marca específica
  getModels: async (brandId) => {
    const response = await axios.get(`${API_URL}/${brandId}/modelos`);
    return response.data.modelos;
  },

  // 3. Busca anos de um modelo
  getYears: async (brandId, modelId) => {
    const response = await axios.get(
      `${API_URL}/${brandId}/modelos/${modelId}/anos`,
    );
    return response.data;
  },

  // 4. Pega o preço final (O Valor do Sonho!)
  getPrice: async (brandId, modelId, yearId) => {
    const response = await axios.get(
      `${API_URL}/${brandId}/modelos/${modelId}/anos/${yearId}`,
    );
    return response.data.Valor; // Retorna ex: "R$ 450.000,00"
  },
};
