#!/usr/bin/env node

/**
 * Baixa uma amostra REAL de strings de versão da FIPE para medir o parser.
 *
 * Não versionamos a amostra: ela muda quando a FIPE muda, e medir contra uma
 * cópia velha é medir o passado. Rode antes de `check:fipe-parser`.
 *
 * Uso: node scripts/fetch-fipe-sample.mjs [saida.json]
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = process.argv[2] || path.join(__dirname, ".cache", "fipe-models.json");

const BASE = "https://parallelum.com.br/fipe/api/v1/carros/marcas";

// As marcas que respondem pela quase totalidade da frota brasileira em
// circulação, mais algumas de nicho para não medir só o caso fácil.
const BRANDS = [
  "VW - VolksWagen", "Fiat", "GM - Chevrolet", "Hyundai", "Toyota", "Renault",
  "Honda", "Jeep", "Nissan", "Ford", "Peugeot", "CAOA CHERY/CHERY",
  "Mitsubishi", "Kia Motors", "BYD", "RAM", "Volvo", "BMW", "Land Rover",
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url, tries = 4) {
  for (let attempt = 0; attempt < tries; attempt += 1) {
    const response = await fetch(url);
    if (response.ok) return response.json();
    await sleep(1000 * (attempt + 1));
  }
  throw new Error(`FIPE não respondeu: ${url}`);
}

const brands = await getJson(BASE);
const rows = [];

for (const wanted of BRANDS) {
  const brand = brands.find(
    (b) => b.nome.toLowerCase() === wanted.toLowerCase(),
  );
  if (!brand) {
    console.warn(`marca não encontrada na FIPE: ${wanted}`);
    continue;
  }
  const { modelos } = await getJson(`${BASE}/${brand.codigo}/modelos`);
  for (const model of modelos) {
    rows.push({ brand: brand.nome, model: model.nome });
  }
  console.log(`${brand.nome}: ${modelos.length}`);
  await sleep(300);
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(rows, null, 1));
console.log(`\n${rows.length} versões gravadas em ${OUT}`);
