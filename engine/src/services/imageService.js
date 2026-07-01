import axios from "axios";

const PEXELS_KEY = "xyhRU5iInBsVsBOsk5emLeAuPfnJuhsCKHLLdToXYwKbelJ9WidYWCUv";
const ENGINE_API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080/api";

const searchPexels = async (query) => {
  const response = await axios.get(
    `https://api.pexels.com/v1/search?query=${query}&per_page=1`,
    {
      headers: {
        Authorization: PEXELS_KEY,
      },
    },
  );

  return response.data.photos[0]?.src?.large || null;
};

export const getCarImage = async (query) => {
  try {
    if (ENGINE_API_URL) {
      const response = await axios.get(`${ENGINE_API_URL}/images/car`, {
        params: { query },
      });
      return response.data.url || null;
    }

    const optimizedQuery = `${query} car high quality`.toLowerCase();
    const imageUrl = await searchPexels(optimizedQuery);

    return imageUrl || searchPexels("car luxury dark");
  } catch (error) {
    console.error("Erro no Pexels:", error);
    return null;
  }
};
