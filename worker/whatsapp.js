import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';

const client = new Client({
  authStrategy: new LocalAuth({
    dataPath: './.wwebjs_auth'
  }),
  puppeteer: {
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  }
});

client.on('qr', (qr) => {
  console.log('--- ESCANEIE O QR CODE ABAIXO ---');
  qrcode.generate(qr, { small: true });
});

let isReady = false;

client.on('ready', () => {
  isReady = true;
  console.log('✅ WhatsApp Web está pronto!');
  
  // Logar informações da conta conectada
  if (client.info) {
    console.log('--- Informações da Conta Conectada ---');
    console.log(`📌 Usuário: ${client.info.wid?.user || 'N/A'}`);
    console.log(`📌 ID Completo: ${client.info.wid?._serialized || 'N/A'}`);
    console.log(`📌 Nome (Pushname): ${client.info.pushname || 'N/A'}`);
    console.log(`📌 Plataforma: ${client.info.platform || 'N/A'}`);
    console.log('--------------------------------------');
  }
});

client.on('auth_failure', (msg) => {
  isReady = false;
  console.error('❌ Falha na autenticação do WhatsApp:', msg);
});

client.on('disconnected', (reason) => {
  isReady = false;
  console.log('⚠️ WhatsApp desconectado:', reason);
});

export const initializeWhatsApp = () => {
  console.log('Iniciando WhatsApp...');
  client.initialize();
};

export const sendMessage = async (phone, message) => {
  try {
    if (!isReady) {
      return { success: false, error: 'WhatsApp não está pronto. Aguarde a inicialização.' };
    }

    console.log(`\n--- Processando envio para: ${phone} ---`);
    
    // 1. Limpa o número: remove caracteres não numéricos
    let cleanPhone = phone.replace(/\D/g, '');
    console.log(`Número original: ${phone}`);
    console.log(`Número limpo: ${cleanPhone}`);
    
    // 2. Normaliza: Adiciona 55 se for número brasileiro (10 ou 11 dígitos)
    if (cleanPhone.length === 10 || cleanPhone.length === 11) {
      cleanPhone = '55' + cleanPhone;
    }
    console.log(`Número com DDI: ${cleanPhone}`);

    // 3. Resolve o ID real do número no WhatsApp
    console.log('Resolvendo número no WhatsApp (getNumberId)...');
    const numberId = await client.getNumberId(cleanPhone);
    
    if (!numberId) {
      console.error('❌ getNumberId retornou null. Número não resolvido pelo WhatsApp.');
      return { success: false, error: 'Número não resolvido pelo WhatsApp' };
    }

    const realChatId = numberId._serialized;
    console.log(`✅ Número resolvido com sucesso: ${realChatId}`);

    // 4. Busca o chat para garantir que ele está carregado
    console.log('Buscando chat...');
    let chat;
    try {
      chat = await client.getChatById(realChatId);
      console.log('✅ Chat encontrado');
    } catch (chatError) {
      console.warn('⚠️ Chat não encontrado diretamente. Tentando via contato...');
      try {
        const contact = await client.getContactById(realChatId);
        if (!contact) {
          throw new Error('Contato não encontrado no WhatsApp');
        }
        chat = await contact.getChat();
        console.log('✅ Chat obtido via contato');
      } catch (contactError) {
        console.error('❌ Falha ao obter chat/contato:', contactError.message);
        return { success: false, error: 'Falha ao obter chat para o número informado' };
      }
    }

    if (!chat) {
      return { success: false, error: 'Não foi possível instanciar o chat' };
    }

    // 5. Envia a mensagem via objeto de chat
    console.log(`Enviando para ID real: ${realChatId}...`);
    await chat.sendMessage(message);
    
    console.log('✅ Mensagem enviada com sucesso');
    return { success: true };
  } catch (error) {
    console.error('❌ Erro ao enviar:', error.message);
    return { success: false, error: error.message };
  }
};

export default client;
