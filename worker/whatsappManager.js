import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import path from 'path';

// Inicializa Firebase Admin se ainda não estiver inicializado
if (admin.apps.length === 0) {
  try {
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    const config = JSON.parse(readFileSync(configPath, 'utf8'));
    admin.initializeApp({
      projectId: config.projectId,
      databaseId: config.firestoreDatabaseId
    });
    console.log('[WhatsAppManager] Firebase Admin inicializado com sucesso.');
  } catch (error) {
    console.error('[WhatsAppManager] Erro ao inicializar Firebase Admin:', error);
  }
}

const db = admin.firestore();

// Map para armazenar as sessões por userId
const sessions = new Map();

/**
 * Executa a automação de lembretes para um usuário
 * @param {string} userId 
 */
export const runAutomation = async (userId) => {
  const session = sessions.get(userId);
  if (!session || session.status !== 'ready') {
    throw new Error('WhatsApp não está conectado ou pronto.');
  }

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD

  console.log(`[WhatsAppManager] Iniciando automação para o usuário ${userId} no dia ${todayStr}`);

  try {
    // 1. Buscar configurações do usuário (template de mensagem)
    const settingsSnap = await db.collection('settings').doc(userId).get();
    const settings = settingsSnap.exists ? settingsSnap.data() : {};
    const template = settings.whatsappTemplate || 
      "Olá {client}, sua {bike} está agendada para manutenção em {date}. Nos vemos lá!";

    // 2. Buscar clientes pendentes/vencidos
    // Filtros: 
    // - userId == userId
    // - nextMaintenanceDate <= hoje
    // - notificacao_enviada != true
    const snapshot = await db.collection('clients')
      .where('userId', '==', userId)
      .where('nextMaintenanceDate', '<=', todayStr + 'T23:59:59Z')
      .where('notificacao_enviada', '==', false)
      .get();

    if (snapshot.empty) {
      return { success: true, count: 0, message: 'Nenhum cliente para notificar hoje.' };
    }

    let sentCount = 0;
    let failCount = 0;

    for (const doc of snapshot.docs) {
      const clientData = doc.data();
      const clientId = doc.id;

      // Pula se o status for OK (não precisa de alerta)
      if (clientData.status === 'OK') continue;

      try {
        const nextDate = clientData.nextMaintenanceDate.split('T')[0].split('-').reverse().join('/');
        const message = template
          .replace(/{client}/g, clientData.name)
          .replace(/{bike}/g, clientData.bikeModel)
          .replace(/{date}/g, nextDate);

        const phone = clientData.contact.replace(/\D/g, '');
        const formattedPhone = phone.length <= 11 ? '55' + phone : phone;
        const chatId = `${formattedPhone}@c.us`;

        // Envia a mensagem via whatsapp-web.js
        await session.client.sendMessage(chatId, message);

        // Atualiza Firestore
        await db.collection('clients').doc(clientId).update({
          notificacao_enviada: true,
          'automation.lastSendAt': admin.firestore.FieldValue.serverTimestamp(),
          'automation.lastSendStatus': 'sent_automated_local'
        });

        // Log
        await db.collection('message_logs').add({
          clientId: clientId,
          clientName: clientData.name,
          phone: clientData.contact,
          channel: 'whatsapp_local',
          status: 'sent',
          trigger: 'automated_local',
          message: message,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          userId: userId
        });

        sentCount++;
        console.log(`[WhatsAppManager] Mensagem enviada para ${clientData.name}`);
      } catch (err) {
        console.error(`[WhatsAppManager] Erro ao enviar para ${clientData.name}:`, err.message);
        failCount++;
      }
    }

    return { success: true, sentCount, failCount };
  } catch (error) {
    console.error(`[WhatsAppManager] Erro na automação para ${userId}:`, error);
    throw error;
  }
};

/**
 * Inicializa uma sessão para um usuário específico
 * @param {string} userId 
 */
export const initSession = async (userId) => {
  if (!userId) throw new Error('userId é obrigatório');

  // Se já existe uma sessão e ela está pronta ou conectando, retorna o estado atual
  if (sessions.has(userId)) {
    const session = sessions.get(userId);
    if (session.status === 'ready' || session.status === 'connecting' || session.status === 'qr_ready') {
      return getSessionStatus(userId);
    }
    // Se estiver em erro ou desconectada, vamos tentar limpar antes de reiniciar
    if (session.client) {
      try { await session.client.destroy(); } catch (e) {}
    }
  }

  // Cria novo estado inicial
  const sessionState = {
    userId,
    status: 'connecting',
    qr: null,
    client: null,
    lastError: null
  };
  sessions.set(userId, sessionState);

  try {
    const client = new Client({
      authStrategy: new LocalAuth({
        clientId: userId,
        dataPath: './.wwebjs_auth'
      }),
      puppeteer: {
        headless: true, // No backend/server sempre headless
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu'
        ]
      }
    });

    sessionState.client = client;

    // Listeners
    client.on('qr', (qr) => {
      console.log(`[WhatsAppManager] QR Code gerado para o usuário: ${userId}`);
      sessionState.status = 'qr_ready';
      sessionState.qr = qr;
      sessionState.lastError = null;
    });

    client.on('ready', () => {
      console.log(`[WhatsAppManager] WhatsApp pronto para o usuário: ${userId}`);
      sessionState.status = 'ready';
      sessionState.qr = null;
      sessionState.lastError = null;
    });

    client.on('authenticated', () => {
      console.log(`[WhatsAppManager] Autenticado para o usuário: ${userId}`);
      // O status 'ready' virá depois no evento ready
    });

    client.on('auth_failure', (msg) => {
      console.error(`[WhatsAppManager] Falha na autenticação para o usuário: ${userId}`, msg);
      sessionState.status = 'error';
      sessionState.lastError = `Falha na autenticação: ${msg}`;
    });

    client.on('disconnected', (reason) => {
      console.log(`[WhatsAppManager] Desconectado para o usuário: ${userId}`, reason);
      sessionState.status = 'disconnected';
      sessionState.qr = null;
    });

    client.on('loading_screen', (percent, message) => {
      console.log(`[WhatsAppManager] Carregando para o usuário ${userId}: ${percent}% - ${message}`);
    });

    // Inicializa sem dar await no initialize para não travar a requisição HTTP
    client.initialize().catch(err => {
      console.error(`[WhatsAppManager] Erro ao inicializar cliente para ${userId}:`, err);
      sessionState.status = 'error';
      sessionState.lastError = err.message;
    });

    return getSessionStatus(userId);
  } catch (error) {
    console.error(`[WhatsAppManager] Erro na criação da sessão para ${userId}:`, error);
    sessionState.status = 'error';
    sessionState.lastError = error.message;
    return getSessionStatus(userId);
  }
};

/**
 * Retorna o status simplificado da sessão
 * @param {string} userId 
 */
export const getSessionStatus = (userId) => {
  const session = sessions.get(userId);
  if (!session) {
    return {
      userId,
      status: 'idle',
      qr: null,
      lastError: null
    };
  }

  return {
    userId: session.userId,
    status: session.status,
    qr: session.qr,
    lastError: session.lastError
  };
};

/**
 * Encerra e remove uma sessão
 * @param {string} userId 
 */
export const disconnectSession = async (userId) => {
  const session = sessions.get(userId);
  if (session && session.client) {
    try {
      await session.client.logout();
      await session.client.destroy();
    } catch (error) {
      console.error(`[WhatsAppManager] Erro ao desconectar sessão de ${userId}:`, error);
    }
  }
  sessions.delete(userId);
  return { success: true };
};
