import { getApps, initializeApp } from 'firebase-admin/app';
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

const { credential } = admin;

// Tenta carregar as credenciais do ambiente ou do arquivo local
// Em produção no Cloud Run, o Admin SDK usa as credenciais da conta de serviço padrão
let app;

try {
  const apps = getApps();
  if (apps.length === 0) {
    app = initializeApp({
      credential: credential.applicationDefault(),
    });
    console.log('✅ Firebase Admin inicializado com credenciais padrão.');
  } else {
    app = apps[0];
  }
} catch (error) {
  console.error('❌ Erro ao inicializar Firebase Admin:', error);
  // Em caso de erro, tenta inicializar sem credenciais explícitas
  const apps = getApps();
  if (apps.length === 0) {
    app = initializeApp();
  } else {
    app = apps[0];
  }
}

export const dbAdmin = getFirestore(app);
export const authAdmin = getAuth(app);
