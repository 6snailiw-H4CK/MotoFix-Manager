import { db } from './firebase.js';
import { initializeWhatsApp, sendMessage } from './whatsapp.js';
import { startScheduler } from './scheduler.js';
import { ReminderEligibility, buildMessage, delay } from './utils.js';
import { format } from 'date-fns';

const DEFAULT_TEMPLATE = "Olá {client}, sua {bike} está com a manutenção programada para {date}. Vamos agendar?";

/**
 * Função principal que executa a rotina de alertas.
 */
async function runAlertRoutine() {
  console.log('--- Buscando clientes no Firestore ---');
  
  try {
    const clientsSnapshot = await db.collection('clients').get();
    const allClients = clientsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    console.log(`Total de clientes encontrados: ${allClients.length}`);

    // Filtra clientes elegíveis
    const pendingClients = ReminderEligibility.getPendingReminderClients(allClients);
    console.log(`Clientes elegíveis para alerta hoje: ${pendingClients.length}`);

    if (pendingClients.length === 0) {
      console.log('Nenhum cliente pendente para hoje.');
      return;
    }

    for (const client of pendingClients) {
      console.log(`Processando: ${client.name} (${client.contact})`);

      if (!client.contact) {
        console.warn(`Cliente ${client.name} sem telefone. Pulando...`);
        continue;
      }

      const message = buildMessage(DEFAULT_TEMPLATE, client);
      const now = new Date().toISOString();
      const dateOnly = now.split('T')[0];

      try {
        // Envia mensagem via WhatsApp
        const result = await sendMessage(client.contact, message);

        if (result.success) {
          console.log(`Sucesso: Mensagem enviada para ${client.name}`);

          // 1. Registra log em message_logs
          await db.collection('message_logs').add({
            clientId: client.id,
            clientName: client.name,
            bikeModel: client.bikeModel,
            phone: client.contact,
            channel: 'whatsapp',
            status: 'sent',
            trigger: 'scheduled',
            message: message,
            createdAt: now,
            userId: 'system-worker'
          });

          // 2. Atualiza automation no cliente
          const currentAttempts = client.automation?.sendAttempts || 0;
          await db.collection('clients').doc(client.id).update({
            lastAlertDate: dateOnly,
            automation: {
              ...client.automation,
              lastAlertDate: dateOnly,
              lastSendAt: now,
              lastSendStatus: 'sent',
              lastSendChannel: 'whatsapp',
              sendAttempts: currentAttempts + 1,
              lastError: null
            }
          });
        } else {
          throw new Error(result.error);
        }

      } catch (error) {
        console.error(`Falha ao processar ${client.name}:`, error.message);

        // Registra log de falha
        await db.collection('message_logs').add({
          clientId: client.id,
          clientName: client.name,
          bikeModel: client.bikeModel,
          phone: client.contact,
          channel: 'whatsapp',
          status: 'failed',
          trigger: 'scheduled',
          message: message,
          error: error.message,
          createdAt: now,
          userId: 'system-worker'
        });

        // Atualiza erro no cliente
        await db.collection('clients').doc(client.id).update({
          'automation.lastError': error.message,
          'automation.lastSendStatus': 'failed'
        });
      }

      // Delay entre envios para evitar bloqueio (10 a 20 segundos)
      const waitTime = Math.floor(Math.random() * (20000 - 10000 + 1)) + 10000;
      console.log(`Aguardando ${waitTime / 1000}s para o próximo envio...`);
      await delay(waitTime);
    }

  } catch (error) {
    console.error('Erro crítico na rotina de alertas:', error);
  }
}

// Inicializa o WhatsApp
initializeWhatsApp();

// Inicia o agendador (todo dia às 09:00)
startScheduler(runAlertRoutine, '0 9 * * *');

// Para teste manual imediato (descomente se quiser rodar ao iniciar)
// setTimeout(() => {
//   console.log('Iniciando teste manual imediato...');
//   runAlertRoutine();
// }, 10000);
