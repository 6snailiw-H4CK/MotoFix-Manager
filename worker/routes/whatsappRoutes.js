import express from 'express';
import { initSession, getSessionStatus, disconnectSession } from '../whatsappManager.js';

const router = express.Router();

/**
 * POST /api/whatsapp/connect
 * Inicia a conexão do WhatsApp para um usuário
 */
router.post('/connect', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'userId é obrigatório' });
    }

    // TODO: Validar se o usuário autenticado no backend é o mesmo do userId
    // Se estiver usando Firebase Auth, pode-se verificar o token aqui.
    
    console.log(`[WhatsAppRoutes] Recebida solicitação de conexão para o usuário: ${userId}`);
    const status = await initSession(userId);
    res.json(status);
  } catch (error) {
    console.error('[WhatsAppRoutes] Erro ao conectar:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/whatsapp/status?userId=XXX
 * Consulta o status atual da sessão
 */
router.get('/status', (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ error: 'userId é obrigatório' });
    }

    const status = getSessionStatus(userId);
    res.json(status);
  } catch (error) {
    console.error('[WhatsAppRoutes] Erro ao obter status:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/whatsapp/disconnect
 * Encerra a sessão do WhatsApp
 */
router.post('/disconnect', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'userId é obrigatório' });
    }

    const result = await disconnectSession(userId);
    res.json(result);
  } catch (error) {
    console.error('[WhatsAppRoutes] Erro ao desconectar:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
