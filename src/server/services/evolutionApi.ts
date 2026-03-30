import axios from 'axios';
import { PhoneUtils } from '../utils/phoneUtils';

/**
 * Serviço de integração com a Evolution API.
 */
export const EvolutionApi = {
  /**
   * Obtém as configurações do ambiente.
   */
  getConfig: () => ({
    apiUrl: process.env.EVOLUTION_API_URL || '',
    apiKey: process.env.EVOLUTION_API_KEY || '',
    instance: process.env.EVOLUTION_INSTANCE_NAME || '',
  }),

  /**
   * Verifica o status da instância (se está conectada).
   */
  getInstanceStatus: async () => {
    const { apiUrl, apiKey, instance } = EvolutionApi.getConfig();
    const isDryRun = process.env.REMINDER_DRY_RUN === 'true';

    if (!apiUrl || !apiKey || !instance) {
      if (isDryRun) {
        console.log('🧪 [MOCK] Evolution API: Status simulado como "CONNECTED" (Modo Dry Run).');
        return { instance: { state: 'open' } };
      }
      throw new Error('❌ Evolution API: Configurações ausentes no ambiente.');
    }

    try {
      const response = await axios.get(`${apiUrl}/instance/connectionState/${instance}`, {
        headers: { apikey: apiKey }
      });
      return response.data;
    } catch (error: any) {
      console.error('❌ Erro ao buscar status da instância:', error.response?.data || error.message);
      throw error;
    }
  },

  /**
   * Obtém o QR Code para conexão da instância.
   */
  getQRCode: async () => {
    const { apiUrl, apiKey, instance } = EvolutionApi.getConfig();
    const isDryRun = process.env.REMINDER_DRY_RUN === 'true';

    if (!apiUrl || !apiKey || !instance) {
      if (isDryRun) {
        console.log('🧪 [MOCK] Evolution API: QR Code simulado (Modo Dry Run).');
        return { base64: 'data:image/png;base64,MOCK_QR_CODE' };
      }
      throw new Error('❌ Evolution API: Configurações ausentes no ambiente.');
    }

    try {
      const response = await axios.get(`${apiUrl}/instance/connect/${instance}`, {
        headers: { apikey: apiKey }
      });
      return response.data;
    } catch (error: any) {
      console.error('❌ Erro ao buscar QR Code:', error.response?.data || error.message);
      throw error;
    }
  },

  /**
   * Envia uma mensagem de texto simples.
   */
  sendTextMessage: async ({ phone, message }: { phone: string; message: string }) => {
    const { apiUrl, apiKey, instance } = EvolutionApi.getConfig();
    const isDryRun = process.env.REMINDER_DRY_RUN === 'true';
    const normalizedPhone = PhoneUtils.normalizeToBrazil(phone);

    if (!normalizedPhone) {
      throw new Error(`❌ Telefone inválido para envio: ${phone}`);
    }

    // Se estiver em modo Dry Run ou sem chaves, simula o envio
    if (isDryRun || !apiUrl || !apiKey || !instance) {
      console.log(`🧪 [MOCK] Enviando mensagem para ${normalizedPhone}: "${message}"`);
      return { key: { id: 'MOCK_ID_' + Date.now() }, status: 'PENDING' };
    }

    try {
      console.log(`📤 Enviando mensagem para ${normalizedPhone}...`);
      const response = await axios.post(`${apiUrl}/message/sendText/${instance}`, {
        number: normalizedPhone,
        text: message,
        delay: 1200, // Delay em ms para evitar bloqueios
        linkPreview: false
      }, {
        headers: { apikey: apiKey }
      });
      
      console.log(`✅ Mensagem enviada com sucesso para ${normalizedPhone}. ID: ${response.data.key?.id || 'N/A'}`);
      return response.data;
    } catch (error: any) {
      console.error(`❌ Erro ao enviar mensagem para ${normalizedPhone}:`, error.response?.data || error.message);
      throw error;
    }
  }
};
