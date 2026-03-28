import axios from "axios";

const PEXELS_KEY = "xyhRU5iInBsVsBOsk5emLeAuPfnJuhsCKHLLdToXYwKbelJ9WidYWCUv";

export const getCarImage = async (query) => {
  try {
    const optimizedQuery = `${query} car high quality`.toLowerCase();
    const response = await axios.get(
      `https://api.pexels.com/v1/search?query=${optimizedQuery}&per_page=1`,
      {
        headers: {
          Authorization: PEXELS_KEY,
        },
      },
    );

    if (response.data.photos.length === 0) {
      const genericResponse = await axios.get(
        `https://api.pexels.com/v1/search?query=car luxury dark&per_page=1`,
        { headers: { Authorization: PEXELS_KEY } },
      );
      return genericResponse.data.photos[0]?.src?.large || null;
    }

    return response.data.photos[0]?.src?.large || null;
  } catch (error) {
    console.error("Erro no Pexels:", error);
    return null;
  }
};
