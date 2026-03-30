import * as cron from 'node-cron';
import { ReminderAutomation } from './services/reminderAutomation';

/**
 * Gerenciador de agendamentos do servidor.
 */
export const Scheduler = {
  isJobRunning: false,

  /**
   * Inicializa o cron job baseado nas configurações do ambiente.
   */
  init: () => {
    const isEnabled = process.env.REMINDER_SCHEDULER_ENABLED === 'true';
    const cronExpression = process.env.REMINDER_SCHEDULER_CRON || '0 9 * * *'; // Padrão: 9h da manhã todos os dias
    const isDryRun = process.env.REMINDER_DRY_RUN === 'true';

    if (!isEnabled) {
      console.log('ℹ️ Scheduler de lembretes desativado via REMINDER_SCHEDULER_ENABLED.');
      return;
    }

    if (!cron.validate(cronExpression)) {
      console.error(`❌ Expressão cron inválida: "${cronExpression}". O scheduler não foi iniciado.`);
      return;
    }

    console.log(`⏰ Scheduler de lembretes ativado! Cron: "${cronExpression}". Modo: ${isDryRun ? 'DRY RUN' : 'REAL'}`);

    // Agenda a tarefa
    cron.schedule(cronExpression, async () => {
      if (Scheduler.isJobRunning) {
        console.warn('⚠️ Uma tarefa de automação já está em execução. Pulando este ciclo.');
        return;
      }

      Scheduler.isJobRunning = true;
      const startTime = new Date();
      console.log(`🕒 [SCHEDULER] Iniciando execução automática em ${startTime.toISOString()}...`);

      try {
        const results = await ReminderAutomation.run(isDryRun);
        const endTime = new Date();
        const duration = (endTime.getTime() - startTime.getTime()) / 1000;

        console.log(`✅ [SCHEDULER] Execução finalizada em ${duration}s.`);
        console.log(`📊 Resumo: Elegíveis: ${results.eligible}, Enviados: ${results.sent}, Falhas: ${results.failed}, Simulados: ${results.simulated}`);
      } catch (error: any) {
        console.error('❌ [SCHEDULER] Erro fatal durante a execução automática:', error.message);
      } finally {
        Scheduler.isJobRunning = false;
      }
    });
  }
};
