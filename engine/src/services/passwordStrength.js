// Nível da senha: 0 vazia, 1 fraca, 2 média, 3 forte.
// Cadastro só é liberado a partir de 2 (média) — ver Register.
export function passwordLevel(password = "") {
  if (!password) return 0;
  if (password.length < 6) return 1;

  let variety = 0;
  if (/[a-z]/.test(password)) variety += 1;
  if (/[A-Z]/.test(password)) variety += 1;
  if (/\d/.test(password)) variety += 1;
  if (/[^A-Za-z0-9]/.test(password)) variety += 1;

  let score = variety;
  if (password.length >= 10) score += 1;
  if (password.length >= 14) score += 1;

  if (score <= 2) return 1;
  if (score <= 4) return 2;
  return 3;
}
