import express from 'express';
import { EvolutionApi } from '../services/evolutionApi';
import { ReminderAutomation } from '../services/reminderAutomation';

const router = express.Router();

/**
 * GET /api/automation/health
 * Verifica se as configurações básicas estão presentes.
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    config: {
      apiUrl: process.env.EVOLUTION_API_URL ? 'Configurada' : 'Ausente',
      instance: process.env.EVOLUTION_INSTANCE_NAME || 'Não definida',
      dryRun: process.env.REMINDER_DRY_RUN === 'true'
    }
  });
});

/**
 * GET /api/automation/evolution/status
 * Verifica o estado da conexão da instância no WhatsApp.
 */
router.get('/evolution/status', async (req, res) => {
  try {
    const status = await EvolutionApi.getInstanceStatus();
    res.json(status);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/automation/evolution/qrcode
 * Retorna o QR Code para conexão (se necessário).
 */
router.get('/evolution/qrcode', async (req, res) => {
  try {
    const qrcode = await EvolutionApi.getQRCode();
    res.json(qrcode);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/automation/reminders/run
 * Executa o lote completo de lembretes para todos os clientes elegíveis.
 */
router.post('/reminders/run', async (req, res) => {
  try {
    const results = await ReminderAutomation.run();
    res.json({
      message: 'Execução de lote finalizada.',
      results
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/automation/reminders/test/:clientId
 * Executa o envio de teste para um cliente específico.
 */
router.post('/reminders/test/:clientId', async (req, res) => {
  const { clientId } = req.params;
  const isDryRun = req.query.dryRun === 'true' || process.env.REMINDER_DRY_RUN === 'true';

  try {
    const result = await ReminderAutomation.runForClient(clientId, isDryRun);
    res.json({
      message: 'Teste de lembrete finalizado.',
      result
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
