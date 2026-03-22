/**
 * MotoFix Recorrentes - Cloud Functions
 * Sistema de Notificações Automáticas via WhatsApp (Cron Job)
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const axios = require("axios");

admin.initializeApp();

const db = admin.firestore();

/**
 * Scheduled Function: Roda todos os dias às 09:00 AM (Horário de Brasília/UTC-3)
 * Nota: O cron do Firebase Functions usa UTC. 09:00 BRT = 12:00 UTC.
 */
exports.scheduledOilChangeNotification = functions.pubsub
  .schedule("0 9 * * *")
  .timeZone("America/Sao_Paulo")
  .onRun(async (context) => {
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0]; // YYYY-MM-DD

    console.log(`Iniciando processamento de notificações para o dia: ${todayStr}`);

    try {
      /**
       * Lógica de Filtro:
       * Busca na coleção 'clients' (mapeada como 'servicos' no pedido)
       * Filtros: 
       * - status == 'pendente' (ou 'OVERDUE'/'WARNING' conforme o sistema atual)
       * - nextMaintenanceDate <= hoje
       * - notificacao_enviada != true (para evitar duplicidade)
       */
      const snapshot = await db.collection("clients")
        .where("nextMaintenanceDate", "<=", todayStr + "T23:59:59Z")
        .where("notificacao_enviada", "==", false)
        // Nota: Firestore não permite múltiplos filtros de desigualdade em campos diferentes facilmente.
        // Se 'status' for usado como filtro de igualdade, funciona bem.
        // No blueprint atual, o status é 'OVERDUE' ou 'WARNING'.
        .get();

      if (snapshot.empty) {
        console.log("Nenhuma moto precisando de revisão hoje.");
        return null;
      }

      console.log(`Encontrados ${snapshot.size} registros para processar.`);

      const promises = [];

      for (const doc of snapshot.docs) {
        const client = doc.data();
        const clientId = doc.id;

        // Pula se o status não for um dos que precisam de alerta (pendente/atrasado)
        // No sistema MotoFix, usamos 'OVERDUE' ou 'WARNING'
        if (client.status === "OK") continue;

        promises.push(processNotification(clientId, client));
      }

      await Promise.all(promises);
      console.log("Processamento concluído com sucesso.");
      return null;
    } catch (error) {
      console.error("Erro ao processar notificações agendadas:", error);
      return null;
    }
  });

/**
 * Função auxiliar para enviar a mensagem e atualizar o Firestore
 */
async function processNotification(clientId, client) {
  try {
    // 1. Buscar configurações do usuário (template de mensagem)
    const settingsSnap = await db.collection("settings").doc(client.userId).get();
    const settings = settingsSnap.exists ? settingsSnap.data() : {};
    
    const template = settings.whatsappTemplate || 
      "Olá {client}, sua {bike} está agendada para manutenção em {date}. Nos vemos lá!";
    
    // 2. Montar a mensagem
    const nextDate = client.nextMaintenanceDate.split("T")[0].split("-").reverse().join("/");
    const message = template
      .replace(/{client}/g, client.name)
      .replace(/{bike}/g, client.bikeModel)
      .replace(/{date}/g, nextDate);

    // 3. Disparar via Provedor (Exemplo: Evolution API)
    // Nota: O usuário deve configurar estas variáveis no Firebase Functions Config
    const apiUrl = functions.config().evolution?.url; // ex: https://api.evolution-api.com
    const apiKey = functions.config().evolution?.key;
    const instance = functions.config().evolution?.instance;

    if (!apiUrl || !apiKey || !instance) {
      console.error(`Configurações da Evolution API ausentes para o usuário ${client.userId}`);
      // Se não houver API configurada, não marcamos como enviado para tentar novamente depois
      return;
    }

    const phone = client.contact.replace(/\D/g, "");
    const formattedPhone = phone.length <= 11 ? "55" + phone : phone;

    await axios.post(`${apiUrl}/message/sendText/${instance}`, {
      number: formattedPhone,
      options: {
        delay: 1200,
        presence: "composing",
        linkPreview: false
      },
      textMessage: {
        text: message
      }
    }, {
      headers: {
        "apikey": apiKey,
        "Content-Type": "application/json"
      }
    });

    // 4. Atualizar campo de controle para evitar reenvio
    await db.collection("clients").doc(clientId).update({
      notificacao_enviada: true,
      "automation.lastSendAt": admin.firestore.FieldValue.serverTimestamp(),
      "automation.lastSendStatus": "sent_automated"
    });

    // 5. Registrar no log de mensagens
    await db.collection("message_logs").add({
      clientId: clientId,
      clientName: client.name,
      phone: client.contact,
      channel: "whatsapp",
      status: "sent",
      trigger: "scheduled",
      message: message,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      userId: client.userId
    });

    console.log(`Notificação enviada com sucesso para: ${client.name} (${client.contact})`);
  } catch (error) {
    console.error(`Falha ao processar notificação para o cliente ${clientId}:`, error.message);
    
    // Opcional: Registrar falha no log
    await db.collection("message_logs").add({
      clientId: clientId,
      clientName: client.name,
      phone: client.contact,
      channel: "whatsapp",
      status: "failed",
      trigger: "scheduled",
      message: "Erro no disparo automático",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      userId: client.userId,
      error: error.message
    });
  }
}
