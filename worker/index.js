import { db } from './firebase.js';
import { initializeWhatsApp, sendMessage } from './whatsapp.js';
import { startScheduler } from './scheduler.js';
import { ReminderEligibility, buildMessage, delay } from './utils.js';
import { format } from 'date-fns';

const DEFAULT_TEMPLATE = "Olá {client}, sua {bike} está com a manutenção programada para {date}. Vamos agendar?";
const MAX_PER_RUN = 30;

/**
 * Função principal que executa a rotina de alertas.
 */
async function runAlertRoutine() {
  console.log('--- Iniciando rotina de alertas ---');
  if (forceRun) {
    console.log('⚠️ MODO FORÇADO ATIVO - enviando para TODOS os clientes');
  }
  console.log('Buscando clientes no Firestore...');
  
  try {
    const clientsSnapshot = await db.collection('clients').get();
    const allClients = clientsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    console.log(`Total clientes: ${allClients.length}`);

    // Filtra clientes elegíveis (ou todos se forçado)
    const pendingClients = forceRun 
      ? allClients 
      : ReminderEligibility.getPendingReminderClients(allClients);
    console.log(`Clientes elegíveis: ${pendingClients.length}`);

    if (pendingClients.length === 0) {
      console.log('Nenhum cliente pendente para hoje.');
      console.log('Rotina finalizada');
      return;
    }

    let sentCount = 0;
    for (const client of pendingClients) {
      if (sentCount >= MAX_PER_RUN) {
        console.log(`Limite de ${MAX_PER_RUN} envios atingido nesta rodada. Parando.`);
        break;
      }

      console.log(`Processando cliente: ${client.name}`);

      if (!client.contact || client.contact.replace(/\D/g, '').length < 10) {
        console.warn(`Cliente sem telefone válido (${client.contact}), pulando`);
        continue;
      }

      const message = buildMessage(DEFAULT_TEMPLATE, client);
      const now = new Date().toISOString();
      const dateOnly = now.split('T')[0];

      console.log(`Enviando mensagem para: ${client.contact}`);
      try {
        // Envia mensagem via WhatsApp
        const result = await sendMessage(client.contact, message);

        if (result.success) {
          console.log('Mensagem enviada com sucesso');
          sentCount++;

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
        console.error('Erro ao enviar:', error.message);

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
      if (sentCount < pendingClients.length && sentCount < MAX_PER_RUN) {
        const waitTime = Math.floor(Math.random() * (20000 - 10000 + 1)) + 10000;
        console.log(`Aguardando ${waitTime / 1000}s para o próximo envio...`);
        await delay(waitTime);
      }
    }

    console.log(`Rotina finalizada. Total enviado: ${sentCount}`);

  } catch (error) {
    console.error('Erro crítico na rotina de alertas:', error);
  }
}

// Inicializa o WhatsApp
initializeWhatsApp();

// Verifica se deve rodar agora via argumento --run-now ou forçar envio --force
const runNow = process.argv.includes('--run-now');
const forceRun = process.argv.includes('--force');

if (runNow) {
  console.log('Modo manual detectado (--run-now). Executando rotina em 5 segundos...');
  setTimeout(() => {
    runAlertRoutine();
  }, 5000);
} else {
  // Inicia o agendador normal (todo dia às 09:00)
  startScheduler(runAlertRoutine, '0 9 * * *');
  
  // Execução automática para teste (desenvolvimento)
  setTimeout(() => {
    console.log('Executando rotina automática para teste...');
    runAlertRoutine();
  }, 5000);
}
