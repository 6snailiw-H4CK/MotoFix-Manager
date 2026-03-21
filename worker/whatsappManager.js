import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;

// Map para armazenar as sessões por userId
// Estrutura: { userId: { status, qr, client, lastError } }
const sessions = new Map();

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
