# MotoFix Worker - Automação de Alertas WhatsApp

Este worker é responsável por enviar lembretes automáticos de manutenção via WhatsApp Web, utilizando agendamento diário.

## 🚀 Como Rodar Localmente

### 1. Pré-requisitos
- Node.js instalado (v16 ou superior)
- Uma conta do WhatsApp disponível para escanear o QR Code

### 2. Instalação
Entre na pasta do worker e instale as dependências:
```bash
cd worker
npm install
```

### 3. Configuração do Firebase
Para que o worker acesse o banco de dados, você precisa de uma chave de conta de serviço:
1. Vá ao [Firebase Console](https://console.firebase.google.com/).
2. Selecione seu projeto.
3. Vá em **Configurações do Projeto** (ícone de engrenagem) > **Contas de Serviço**.
4. Clique em **Gerar nova chave privada**.
5. Salve o arquivo JSON baixado dentro da pasta `/worker` com o nome exato: `serviceAccountKey.json`.

### 4. Execução
Inicie o worker:
```bash
npm start
```

### 5. Escaneando o QR Code
Ao iniciar, um QR Code aparecerá no seu terminal.
1. Abra o WhatsApp no seu celular.
2. Vá em **Aparelhos Conectados** > **Conectar um Aparelho**.
3. Escaneie o código no terminal.
4. O terminal exibirá "WhatsApp Web está pronto!" quando a conexão for estabelecida.

---

## 📅 Agendamento
O worker está configurado para rodar **todos os dias às 09:00**.
Você pode alterar este horário no arquivo `worker/index.js`, na linha:
`startScheduler(runAlertRoutine, '0 9 * * *');`

---

## 🛠️ Como Subir para Produção

### Opção 1: VPS (DigitalOcean, AWS, Google Cloud VM)
Esta é a melhor opção para manter o WhatsApp conectado 24/7.
1. Clone o repositório na sua VPS.
2. Instale o Node.js e as dependências.
3. Use o **PM2** para manter o processo rodando:
   ```bash
   npm install -g pm2
   pm2 start index.js --name "motofix-worker"
   pm2 save
   ```
4. O PM2 garantirá que o worker reinicie se cair.

### Opção 2: Cloud Run (Google Cloud)
*Nota: O Cloud Run é "serverless", o que pode ser desafiador para manter a sessão do WhatsApp Web.js ativa por longos períodos sem persistência de volume.*
1. Crie um Dockerfile para o worker.
2. Configure um volume persistente (Cloud Storage FUSE) para a pasta `.wwebjs_auth`.
3. Use o **Cloud Scheduler** para disparar uma rota HTTP no seu worker que inicie a rotina (em vez de usar `node-cron` interno).

---

## 🔄 Fluxo de Funcionamento
1. O **Scheduler** acorda o worker no horário definido.
2. O worker busca todos os clientes no **Firestore**.
3. Filtra apenas os clientes que:
   - Têm manutenção vencida ou para hoje.
   - Não receberam alerta hoje.
   - Respeitam a data de próxima elegibilidade (`nextSendEligibleAt`).
4. Para cada cliente elegível:
   - Monta a mensagem personalizada.
   - Envia via **WhatsApp Web**.
   - Se sucesso: Grava log `sent` e incrementa `sendAttempts`.
   - Se erro: Grava log `failed` e salva o erro no cliente.
5. Aguarda entre 10 e 20 segundos antes de processar o próximo cliente (para evitar banimento).
