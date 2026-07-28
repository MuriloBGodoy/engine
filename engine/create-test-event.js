/**
 * Script de teste para criar um evento dummy no Firestore
 * Execute com: node create-test-event.js
 * (Requer credenciais do Firebase Admin SDK)
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Nota: Este script funcionaria se tivesse credenciais do Firebase Admin
// Para teste rápido, use o Firebase Console ou o app UI:
// 1. Abra http://localhost:5173/events
// 2. Clique "Criar Evento"
// 3. Preencha:
//    - Título: "Test Cars & Coffee"
//    - Descrição: "Evento de teste"
//    - Tipo: "cars-and-coffee"
//    - Data: amanhã
//    - Local: "São Paulo, SP"
//    - Estado: SP
// 4. Clique "Criar Evento"

console.log("⚠️ Para criar um evento de teste:");
console.log("1. Abra http://localhost:5173/events");
console.log("2. Clique no botão AZUL 'Criar Evento'");
console.log("3. Preencha o formulário");
console.log("4. Envie");
console.log("");
console.log("OU use o Firebase Console:");
console.log("https://console.firebase.google.com/project/engine-garage/firestore/databases/(default)/data/events");
