import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 1. Carregar Chave do Service Account
let serviceAccount;
try {
  const keyPath = join(__dirname, 'serviceAccountKey.json');
  serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));
} catch (error) {
  console.error('ERRO: Arquivo serviceAccountKey.json não encontrado na pasta /worker.');
  console.error('Por favor, baixe a chave do Firebase Console e salve como /worker/serviceAccountKey.json');
  process.exit(1);
}

// 2. Inicializar Firebase Admin
try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log('✅ Firebase Admin inicializado com sucesso');
} catch (error) {
  console.error('❌ Erro ao inicializar Firebase Admin:', error.message);
  process.exit(1);
}

// 3. Configurações de Projeto e Banco
export const PROJECT_ID = serviceAccount.project_id;
export const FIRESTORE_DATABASE_ID = 'ai-studio-69fab381-893d-44cb-960c-7d7392ca53d3';

// 4. Inicializar Firestore e Auth
export const db = getFirestore(admin.app(), FIRESTORE_DATABASE_ID);
export const auth = admin.auth();

// Logs de Inicialização
console.log(`📌 Project ID: ${PROJECT_ID}`);
console.log(`📌 Database ID: ${FIRESTORE_DATABASE_ID}`);
console.log('✅ Firestore conectado com sucesso');

export { admin };
