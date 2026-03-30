import { dbAdmin } from '../firebaseAdmin';
import { EvolutionApi } from './evolutionApi';
import { ReminderEligibility } from '../../utils/reminderEligibility';
import { AlertService } from '../../services/alertService';
import { Client, MessageLog, Settings } from '../../types';

/**
 * Serviço de automação de lembretes no backend.
 * Varre o Firestore, identifica clientes elegíveis e envia mensagens via Evolution API.
 */
export const ReminderAutomation = {
  /**
   * Executa o lote de automação para todos os clientes de todos os usuários.
   */
  run: async (isDryRun: boolean = process.env.REMINDER_DRY_RUN === 'true') => {
    const now = new Date().toISOString();
    const dateOnly = now.split('T')[0];
    const results = {
      totalFound: 0,
      eligible: 0,
      sent: 0,
      failed: 0,
      simulated: 0,
      errors: [] as { clientId: string; error: string }[]
    };

    console.log(`🚀 Iniciando automação de lembretes. Modo: ${isDryRun ? 'DRY RUN (Simulação)' : 'REAL'}`);

    try {
      // 1. Busca todos os clientes do Firestore (Acesso Admin)
      const clientsSnap = await dbAdmin.collection('clients').get();
      results.totalFound = clientsSnap.size;
      const clients = clientsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));

      // 2. Filtra clientes elegíveis usando a lógica centralizada do projeto
      const eligibleClients = ReminderEligibility.getPendingReminderClients(clients);
      results.eligible = eligibleClients.length;

      console.log(`🔍 Encontrados ${results.totalFound} clientes. ${results.eligible} são elegíveis hoje.`);

      // 3. Processa cada cliente elegível
      for (const client of eligibleClients) {
        try {
          // Busca as configurações do usuário dono do cliente para obter o template
          const settingsSnap = await dbAdmin.collection('settings').doc(client.userId).get();
          const settings = settingsSnap.data() as Settings;

          if (!settings || !settings.whatsappTemplate) {
            console.warn(`⚠️ Configurações ou template ausentes para o usuário ${client.userId}. Pulando cliente ${client.name}.`);
            continue;
          }

          // Monta a mensagem usando o serviço de alerta existente
          const message = AlertService.buildReminderMessage(settings.whatsappTemplate, client);

          if (isDryRun) {
            console.log(`🧪 [DRY RUN] Simulação de envio para ${client.name} (${client.contact}): "${message}"`);
            results.simulated++;
            continue;
          }

          // 4. Envio Real via Evolution API
          try {
            await EvolutionApi.sendTextMessage({
              phone: client.contact,
              message: message
            });

            // 5. Registro de Log no Firestore
            const logData: MessageLog = {
              clientId: client.id,
              clientName: client.name,
              bikeModel: client.bikeModel,
              phone: client.contact,
              channel: 'whatsapp',
              status: 'sent',
              trigger: 'scheduled',
              message: message,
              createdAt: now,
              sentAt: now,
              userId: client.userId
            };
            await dbAdmin.collection('message_logs').add(logData);

            // 6. Atualização do Cliente (Metadados de Automação)
            const currentAttempts = client.automation?.sendAttempts || 0;
            const updateData = {
              lastAlertDate: dateOnly,
              notificacao_enviada: true,
              notificacaoStatus: 'concluido',
              automation: {
                ...client.automation,
                lastAlertDate: dateOnly,
                lastSendAt: now,
                lastSendStatus: 'sent',
                lastSendChannel: 'whatsapp',
                sendAttempts: currentAttempts + 1,
                lastError: null
              }
            };
            await dbAdmin.collection('clients').doc(client.id).update(updateData);

            results.sent++;
          } catch (sendError: any) {
            console.error(`❌ Falha ao enviar para ${client.name}:`, sendError.message);
            
            // Registra o erro no log e no cliente
            await dbAdmin.collection('message_logs').add({
              clientId: client.id,
              clientName: client.name,
              phone: client.contact,
              channel: 'whatsapp',
              status: 'failed',
              trigger: 'scheduled',
              message: message,
              createdAt: now,
              error: sendError.message,
              userId: client.userId
            });

            await dbAdmin.collection('clients').doc(client.id).update({
              'automation.lastError': sendError.message,
              'automation.lastSendStatus': 'failed',
              'automation.lastSendAt': now
            });

            results.failed++;
            results.errors.push({ clientId: client.id, error: sendError.message });
          }
        } catch (innerError: any) {
          console.error(`❌ Erro crítico ao processar cliente ${client.id}:`, innerError.message);
          results.failed++;
          results.errors.push({ clientId: client.id, error: innerError.message });
        }
      }

      console.log(`🏁 Automação finalizada. Enviados: ${results.sent}, Falhas: ${results.failed}, Simulados: ${results.simulated}`);
      return results;

    } catch (error: any) {
      console.error('❌ Erro fatal na automação de lembretes:', error.message);
      throw error;
    }
  },

  /**
   * Executa a automação para um único cliente específico (útil para testes).
   */
  runForClient: async (clientId: string, isDryRun: boolean = process.env.REMINDER_DRY_RUN === 'true') => {
    const now = new Date().toISOString();
    const dateOnly = now.split('T')[0];

    console.log(`🧪 Iniciando teste de automação para o cliente ${clientId}. Modo: ${isDryRun ? 'DRY RUN' : 'REAL'}`);

    try {
      const clientSnap = await dbAdmin.collection('clients').doc(clientId).get();
      if (!clientSnap.exists) {
        throw new Error(`Cliente ${clientId} não encontrado.`);
      }

      const client = { id: clientSnap.id, ...clientSnap.data() } as Client;

      // Busca as configurações do usuário dono do cliente
      const settingsSnap = await dbAdmin.collection('settings').doc(client.userId).get();
      const settings = settingsSnap.data() as Settings;

      if (!settings || !settings.whatsappTemplate) {
        throw new Error(`Configurações ou template ausentes para o usuário ${client.userId}.`);
      }

      const message = AlertService.buildReminderMessage(settings.whatsappTemplate, client);

      if (isDryRun) {
        return { simulated: true, client: client.name, message };
      }

      // Envio Real
      await EvolutionApi.sendTextMessage({
        phone: client.contact,
        message: message
      });

      // Registro de Log
      await dbAdmin.collection('message_logs').add({
        clientId: client.id,
        clientName: client.name,
        phone: client.contact,
        channel: 'whatsapp',
        status: 'sent',
        trigger: 'retry', // Marcado como retry por ser manual/teste
        message: message,
        createdAt: now,
        sentAt: now,
        userId: client.userId
      });

      // Atualização do Cliente
      await dbAdmin.collection('clients').doc(client.id).update({
        lastAlertDate: dateOnly,
        notificacao_enviada: true,
        notificacaoStatus: 'concluido',
        'automation.lastAlertDate': dateOnly,
        'automation.lastSendAt': now,
        'automation.lastSendStatus': 'sent',
        'automation.lastSendChannel': 'whatsapp'
      });

      return { success: true, client: client.name, message };
    } catch (error: any) {
      console.error(`❌ Erro no teste para o cliente ${clientId}:`, error.message);
      throw error;
    }
  }
};
