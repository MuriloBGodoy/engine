// Edge Function do Netlify: expõe a geolocalização por IP que o Netlify já
// resolve na borda (context.geo) como um JSON pequeno. É o "chute inteligente"
// de região para visitantes anônimos, sem depender de API externa nem de chave.
//
// Retorna { country, subdivision, city } — country/subdivision em código ISO
// (ex.: BR, SP), que casam com o dataset de services/locations.js. O cliente
// (RegionProvider) só usa isso quando o usuário AINDA não escolheu região
// manualmente; escolha explícita sempre vence.
export default async (_request, context) => {
  const geo = context.geo || {};
  const body = {
    country: geo.country?.code || null,
    subdivision: geo.subdivision?.code || null,
    city: geo.city || null,
  };
  return new Response(JSON.stringify(body), {
    headers: {
      "content-type": "application/json",
      // Depende do IP de quem pede: nunca cachear numa CDN compartilhada.
      "cache-control": "no-store",
    },
  });
};
