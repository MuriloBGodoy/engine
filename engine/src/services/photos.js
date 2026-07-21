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
// Enquanto o Storage não estiver ligado no projeto, a foto cai comprimida
// dentro do documento — e o Firestore corta em 1 MiB por documento. Com até
// 4 fotos por carro, cada uma precisa ficar na casa das dezenas de KB.
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

export const compressImageFile = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("Imagem inválida."));
      image.onload = () => {
        const scale = Math.min(
          1,
          FALLBACK_MAX_SIZE / Math.max(image.width, image.height),
        );
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));

        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("Não foi possível preparar a imagem."));
          return;
        }

        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", FALLBACK_QUALITY));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });

export const isImageFile = (file) => Boolean(file?.type?.startsWith("image/"));
export const isFileTooBig = (file) => (file?.size || 0) > MAX_FILE_BYTES;

export const uploadUserPhoto = async (file, { userId, folder }) => {
  if (!isImageFile(file)) throw new Error("Arquivo não é uma imagem.");
  if (isFileTooBig(file)) throw new Error("Imagem maior que 6 MB.");

  if (userId) {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const path = `users/${userId}/${folder}/${Date.now()}-${crypto.randomUUID()}-${safeName}`;

    try {
      const fileRef = ref(storage, path);
      await withUploadTimeout(
        uploadBytes(fileRef, file, { contentType: file.type }),
      );
      return await withUploadTimeout(getDownloadURL(fileRef));
    } catch (error) {
      console.warn("[photos] Storage indisponível, comprimindo local.", error);
    }
  }

  return compressImageFile(file);
};
