import { get, set } from "idb-keyval";

const DB_KEY = "@Engine:database_v1";

export const engineDB = {
  getCars: async () => {
    try {
      const data = await get(DB_KEY);
      // Se não tiver nada, retorna array vazio direto, sem tentar dar JSON.parse
      if (!data) return [];
      return JSON.parse(data);
    } catch (error) {
      console.error("Erro ao ler IndexedDB:", error);
      return []; // Retorna vazio em caso de erro para não travar o App
    }
  },

  saveCars: async (cars) => {
    try {
      await set(DB_KEY, JSON.stringify(cars));
    } catch (error) {
      console.error("Erro ao salvar no IndexedDB:", error);
    }
  },
};
