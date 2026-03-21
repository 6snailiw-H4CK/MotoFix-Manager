import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Tenta carregar a chave do service account
// O usuário deve baixar este arquivo do console do Firebase:
// Configurações do Projeto -> Contas de Serviço -> Gerar nova chave privada
let serviceAccount;
try {
  const keyPath = join(__dirname, 'serviceAccountKey.json');
  serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));
} catch (error) {
  console.error('ERRO: Arquivo serviceAccountKey.json não encontrado na pasta /worker.');
  console.error('Por favor, baixe a chave do Firebase Console e salve como /worker/serviceAccountKey.json');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

export const db = admin.firestore();
export const auth = admin.auth();
