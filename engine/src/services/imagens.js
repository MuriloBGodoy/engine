/**
 * Reduzir imagem no navegador, antes de guardar.
 *
 * O upload para o Firebase Storage está desligado (precisa do plano Blaze), e
 * enquanto isso a foto de perfil vive como data URI DENTRO do documento em
 * `publicProfiles`. Isso esbarra em dois tetos que ninguém anuncia:
 *
 *   - documento do Firestore: 1 MiB, e o base64 engorda o arquivo em ~33%;
 *   - `photoURL` do Firebase Auth: alguns milhares de caracteres, muito abaixo
 *     de qualquer foto.
 *
 * No computador a pessoa escolhe um arquivo já pequeno e passa. No celular a
 * foto vem da câmera com 3 a 8 MB e nada passa — era esse o "editar imagem não
 * funciona no mobile". A validação de 5 MB que existia deixava entrar arquivo
 * que jamais caberia, e a falha saía num `console.error` que ninguém vê.
 *
 * Aqui a imagem é redesenhada num canvas no tamanho que a tela realmente usa e
 * re-codificada em JPEG, caindo de megabytes para dezenas de KB.
 */

/** Avatar aparece no máximo a ~120px; 2x cobre tela retina. */
export const AVATAR = { largura: 256, altura: 256, qualidade: 0.85, tetoBytes: 200 * 1024 };
/** Banner ocupa a largura toda numa faixa baixa. */
export const BANNER = { largura: 1280, altura: 420, qualidade: 0.82, tetoBytes: 400 * 1024 };

/**
 * Cabe a imagem na caixa sem distorcer e sem ampliar.
 *
 * Só encolhe: uma foto menor que o alvo re-escalada para cima ficaria borrada e
 * mais pesada do que chegou. Pura de propósito — é a única parte com conta, e
 * assim dá para testar sem navegador.
 */
export const calcularDestino = (largura, altura, maxLargura, maxAltura) => {
  if (!largura || !altura) return { largura: 0, altura: 0 };
  const fator = Math.min(maxLargura / largura, maxAltura / altura, 1);
  return {
    largura: Math.max(1, Math.round(largura * fator)),
    altura: Math.max(1, Math.round(altura * fator)),
  };
};

/** Tamanho real, em bytes, do que um data URI vai ocupar no documento. */
export const bytesDoDataUri = (dataUri = "") => {
  const virgula = dataUri.indexOf(",");
  if (virgula < 0) return 0;
  const base64 = dataUri.slice(virgula + 1);
  const enchimento = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - enchimento;
};

const carregarImagem = (file) =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("imagem ilegível"));
    };
    img.src = url;
  });

/**
 * Devolve um data URI JPEG dentro do teto, ou lança.
 *
 * Se mesmo no tamanho alvo o arquivo passar do teto, baixa a qualidade em
 * degraus antes de desistir — desistir calado foi exatamente o problema.
 */
export const reduzirImagem = async (file, opcoes = AVATAR) => {
  const { largura: maxL, altura: maxA, qualidade, tetoBytes } = opcoes;
  const img = await carregarImagem(file);
  const destino = calcularDestino(img.naturalWidth, img.naturalHeight, maxL, maxA);

  const canvas = document.createElement("canvas");
  canvas.width = destino.largura;
  canvas.height = destino.altura;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, destino.largura, destino.altura);

  for (const q of [qualidade, 0.7, 0.55, 0.4]) {
    const dataUri = canvas.toDataURL("image/jpeg", q);
    if (bytesDoDataUri(dataUri) <= tetoBytes) return dataUri;
  }
  throw new Error("imagem muito pesada mesmo depois de reduzida");
};
