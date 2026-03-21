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

client.on('ready', () => {
  console.log('WhatsApp Web está pronto!');
});

client.on('auth_failure', (msg) => {
  console.error('Falha na autenticação do WhatsApp:', msg);
});

client.on('disconnected', (reason) => {
  console.log('WhatsApp desconectado:', reason);
});

export const initializeWhatsApp = () => {
  client.initialize();
};

export const sendMessage = async (phone, message) => {
  try {
    // Limpa o número: remove caracteres não numéricos
    let cleanPhone = phone.replace(/\D/g, '');
    
    // Adiciona 55 se for número brasileiro sem prefixo internacional
    if (cleanPhone.length === 10 || cleanPhone.length === 11) {
      cleanPhone = '55' + cleanPhone;
    }

    // Formato final para o WhatsApp Web.js: 5511999999999@c.us
    const chatId = `${cleanPhone}@c.us`;
    
    console.log(`Enviando para ${chatId}...`);
    await client.sendMessage(chatId, message);
    return { success: true };
  } catch (error) {
    console.error(`Erro ao enviar para ${phone}:`, error);
    return { success: false, error: error.message };
  }
};

export default client;
