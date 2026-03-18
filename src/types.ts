export type MaintenanceStatus = 'OK' | 'WARNING' | 'OVERDUE';

export interface Client {
  id: string;
  name: string;
  bikeModel: string;
  oilType: string;
  contact: string;
  lastMaintenanceDate: string;
  nextMaintenanceDate: string;
  recurrenceDays: number;
  status: MaintenanceStatus;
  userId: string;
  createdAt: string;
}

export interface MaintenanceRecord {
  id: string;
  clientId: string;
  clientName: string;
  bikeModel: string;
  date: string;
  oilType: string;
  notes: string;
  userId: string;
}

export interface Settings {
  whatsappTemplate: string;
  userId: string;
  oilTypes: string[];
  warrantyCategories: string[];
}

export interface Warranty {
  id: string;
  clientName: string;
  serviceType: string;
  serviceDescription: string;
  serviceValue: number;
  serviceDate: string;
  durationMonths: number;
  expiryDate: string;
  clientPhone: string;
  warrantyNumber: number;
  userId: string;
  createdAt: string;
}
