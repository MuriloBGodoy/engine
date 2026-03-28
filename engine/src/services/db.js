import { get, set, del } from "idb-keyval";

const DB_KEY = "@Engine:database_v1";

export const engineDB = {
  getCars: async () => {
    try {
      const data = await get(DB_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error("Erro ao ler IndexedDB:", error);
      return [];
    }
  },

  saveCars: async (cars) => {
    try {
      await set(DB_KEY, JSON.stringify(cars));
    } catch (error) {
      console.error("Erro ao salvar no IndexedDB:", error);
    }
  },

  clearDB: async () => {
    await del(DB_KEY);
  },
};
