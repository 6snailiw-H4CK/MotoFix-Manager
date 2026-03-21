import cron from 'node-cron';

/**
 * Agenda a execução da rotina de alertas.
 * @param {Function} task - A função que será executada.
 * @param {string} schedule - O horário em formato cron (ex: '0 9 * * *' para 09:00 todos os dias).
 */
export const startScheduler = (task, schedule = '0 9 * * *') => {
  console.log(`Agendador iniciado: a tarefa rodará às ${schedule.split(' ')[1]}:${schedule.split(' ')[0]} todos os dias.`);
  
  cron.schedule(schedule, async () => {
    console.log('--- Iniciando rotina agendada de alertas ---');
    try {
      await task();
      console.log('--- Rotina agendada finalizada com sucesso ---');
    } catch (error) {
      console.error('--- Erro na execução da rotina agendada ---', error);
    }
  });
};
