import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { storage } from "./firebase";

/**
 * Upload de fotos do usuário.
 *
 * A foto vai para o Storage e só a URL fica no documento. Guardar a imagem
 * em base64 dentro do doc estourava o limite de 1 MiB do Firestore: a
 * gravação ficava pendurada até o timeout e o carro só era salvo localmente.
 *
 * Se o Storage estiver fora do ar, cai para uma versão comprimida em data
 * URL — pequena o suficiente para caber no documento.
 */
const UPLOAD_TIMEOUT_MS = 20000;
const MAX_FILE_BYTES = 6 * 1024 * 1024;
// Foto que VAI para o Storage: redimensionada e reencodada para JPEG. O
// arquivo cru do celular (3–6 MB) esgotaria os 5 GB grátis em ~1.000 fotos;
// a 1600px/0.82 uma foto nítida fica em ~150–300 KB e cabem dezenas de
// milhares. Também deixa o carregamento no mobile muito mais leve.
const UPLOAD_MAX_SIZE = 1600;
const UPLOAD_QUALITY = 0.82;
// Fallback (Storage fora do ar): a foto cai comprimida DENTRO do documento
// e o Firestore corta em 1 MiB por doc. Com até 4 fotos por carro, cada uma
// precisa ficar na casa das dezenas de KB — daí ser bem menor/mais agressivo.
const FALLBACK_MAX_SIZE = 900;
const FALLBACK_QUALITY = 0.6;

const withUploadTimeout = (promise) =>
  Promise.race([
    promise,
    new Promise((_, reject) => {
      window.setTimeout(
        () => reject(new Error("upload demorou demais")),
        UPLOAD_TIMEOUT_MS,
      );
    }),
  ]);

// Desenha o arquivo num canvas redimensionado e entrega o resultado no
// formato pedido: "blob" (para upload no Storage) ou "dataURL" (fallback no
// documento). Centraliza a leitura/redimensionamento das duas rotas.
const renderCompressed = (file, { maxSize, quality, output }) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("Imagem inválida."));
      image.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));

        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("Não foi possível preparar a imagem."));
          return;
        }

        context.drawImage(image, 0, 0, canvas.width, canvas.height);

        if (output === "blob") {
          canvas.toBlob(
            (blob) =>
              blob
                ? resolve(blob)
                : reject(new Error("Não foi possível comprimir a imagem.")),
            "image/jpeg",
            quality,
          );
          return;
        }

        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });

// Fallback pequeno para caber no documento do Firestore (data URL base64).
export const compressImageFile = (file) =>
  renderCompressed(file, {
    maxSize: FALLBACK_MAX_SIZE,
    quality: FALLBACK_QUALITY,
    output: "dataURL",
  });

export const isImageFile = (file) => Boolean(file?.type?.startsWith("image/"));
export const isFileTooBig = (file) => (file?.size || 0) > MAX_FILE_BYTES;

export const uploadUserPhoto = async (file, { userId, folder }) => {
  if (!isImageFile(file)) throw new Error("Arquivo não é uma imagem.");
  if (isFileTooBig(file)) throw new Error("Imagem maior que 6 MB.");

  if (userId) {
    const safeName = file.name
      .replace(/\.[^.]+$/, "")
      .replace(/[^a-zA-Z0-9._-]/g, "-");
    const path = `users/${userId}/${folder}/${Date.now()}-${crypto.randomUUID()}-${safeName}.jpg`;

    try {
      let payload = file;
      let contentType = file.type;
      const isSmallJpeg = file.type === "image/jpeg" && file.size < 500 * 1024;

      const startTime = performance.now();
      console.log("[photos] Iniciando upload:", {
        file: safeName,
        size: `${(file.size / 1024).toFixed(1)}KB`,
        type: file.type,
        skipRecompress: isSmallJpeg,
      });

      if (!isSmallJpeg) {
        try {
          const compressStart = performance.now();
          payload = await renderCompressed(file, {
            maxSize: UPLOAD_MAX_SIZE,
            quality: UPLOAD_QUALITY,
            output: "blob",
          });
          contentType = "image/jpeg";
          console.log(
            `[photos] Compressão concluída em ${(performance.now() - compressStart).toFixed(0)}ms`,
          );
        } catch (compressError) {
          console.warn(
            "[photos] Falha ao comprimir, subindo original.",
            compressError,
          );
        }
      }

      const uploadStart = performance.now();
      const fileRef = ref(storage, path);
      await withUploadTimeout(uploadBytes(fileRef, payload, { contentType }));
      console.log(
        `[photos] Upload Firebase concluído em ${(performance.now() - uploadStart).toFixed(0)}ms`,
      );

      const urlStart = performance.now();
      const url = await withUploadTimeout(getDownloadURL(fileRef));
      console.log(
        `[photos] URL gerada em ${(performance.now() - urlStart).toFixed(0)}ms (total: ${(performance.now() - startTime).toFixed(0)}ms)`,
      );
      return url;
    } catch (error) {
      console.warn("[photos] Storage indisponível, comprimindo local.", error);
    }
  }

  return compressImageFile(file);
};
