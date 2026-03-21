import { parseISO, format, isValid, addDays, startOfDay } from 'date-fns';

/**
 * Replicando a lógica de elegibilidade do frontend para o worker.
 */
export const ReminderEligibility = {
  isPending: (client) => {
    if (!client.nextMaintenanceDate) return false;

    const today = startOfDay(new Date());
    const nextDate = startOfDay(parseISO(client.nextMaintenanceDate));
    
    // Se a data de manutenção já passou ou é hoje
    const isMaintenanceDue = nextDate <= today;
    if (!isMaintenanceDue) return false;

    // Se já enviou hoje, não envia de novo
    const lastAlertDateStr = client.automation?.lastAlertDate || client.lastAlertDate;
    if (lastAlertDateStr === format(today, 'yyyy-MM-dd')) return false;

    // Se existe uma data de próxima elegibilidade agendada, respeita
    if (client.automation?.nextSendEligibleAt) {
      const nextEligible = startOfDay(parseISO(client.automation.nextSendEligibleAt));
      if (today < nextEligible) return false;
    }

    return true;
  },

  getPendingReminderClients: (clients) => {
    return clients.filter(client => ReminderEligibility.isPending(client));
  }
};

/**
 * Lógica de construção de mensagem idêntica ao frontend.
 */
export const buildMessage = (template, client) => {
  const nextDate = parseISO(client.nextMaintenanceDate);
  const dateStr = isValid(nextDate) ? format(nextDate, 'dd/MM/yyyy') : 'em breve';
  
  return template
    .replace(/{client}/g, client.name)
    .replace(/{bike}/g, client.bikeModel)
    .replace(/{date}/g, dateStr);
};

/**
 * Helper para delay (aguarda n milissegundos).
 */
export const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
