/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// MotoFix ManageRr - Application Root
import React, { useState, useEffect, useMemo } from 'react';
import { 
  auth, 
  db, 
  googleProvider, 
  signInWithPopup, 
  signOut,
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  setDoc,
  getDoc
} from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { 
  format, 
  addDays, 
  isBefore, 
  isAfter, 
  differenceInDays, 
  parseISO,
  startOfDay
} from 'date-fns';
import { 
  Bike, 
  Users, 
  History, 
  Settings as SettingsIcon, 
  Plus, 
  LogOut, 
  AlertTriangle, 
  CheckCircle, 
  Trash2, 
  MessageSquare,
  Search,
  LayoutDashboard,
  Bell,
  ChevronRight,
  ArrowLeft,
  X,
  Calendar,
  ShieldCheck,
  Download,
  FileText,
  Droplets,
  Shield,
  Lock,
  UserCheck,
  UserX,
  AlertCircle,
  ExternalLink
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { Client, MaintenanceRecord, MaintenanceStatus, Settings, Warranty, UserProfile, MessageLog } from './types';
import { AlertService } from './services/alertService';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Toast Component
const Toast = ({ message, type, onClose }: { message: string, type: 'success' | 'error', onClose: () => void }) => (
  <div className={cn(
    "fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-300",
    type === 'success' ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
  )}>
    {type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
    <p className="font-bold text-sm">{message}</p>
    <button onClick={onClose} className="ml-2 hover:opacity-70">
      <X className="w-4 h-4" />
    </button>
  </div>
);

// --- Components ---

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const ErrorBoundary = ({ children }: { children: React.ReactNode }) => {
  const [hasError, setHasError] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleError = (e: ErrorEvent) => {
      setHasError(true);
      setError(e.message);
    };
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (hasError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-dark p-4">
        <div className="bg-slate-800 p-8 rounded-2xl border border-red-500/30 max-w-md w-full text-center">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Algo deu errado</h1>
          <p className="text-slate-400 mb-6">{error || "Ocorreu um erro inesperado."}</p>
          <button 
            onClick={() => window.location.reload()}
            className="w-full py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 transition-all"
          >
            Recarregar Aplicativo
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

const LoadingScreen = () => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-background-dark">
    <div className="relative">
      <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
      <Bike className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 text-primary" />
    </div>
    <p className="mt-4 text-slate-400 font-medium animate-pulse">Carregando MotoFix...</p>
  </div>
);

const AuthScreen = () => (
  <div className="min-h-screen flex items-center justify-center bg-background-dark p-4 overflow-hidden relative">
    {/* Decorative background */}
    <div className="absolute top-0 right-0 -z-10 opacity-10 pointer-events-none">
      <svg width="600" height="600" viewBox="0 0 400 400" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="300" cy="100" r="200" fill="url(#grad1)" />
        <defs>
          <linearGradient id="grad1" x1="150" y1="-50" x2="450" y2="250" gradientUnits="userSpaceOnUse">
            <stop stopColor="#f2780d" />
            <stop offset="1" stopColor="#f2780d" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
    </div>

    <div className="max-w-md w-full space-y-8 text-center">
      <div className="space-y-4">
        <div className="bg-primary/20 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-primary/20">
          <Bike className="w-12 h-12 text-primary" />
        </div>
        <h1 className="text-4xl font-bold text-white tracking-tight">MotoFix Recorrentes</h1>
        <p className="text-slate-400 text-lg">Gerencie a troca de óleo de suas motos com facilidade e alertas automáticos.</p>
      </div>

      <button 
        onClick={() => signInWithPopup(auth, googleProvider)}
        className="w-full flex items-center justify-center gap-3 py-4 bg-white text-slate-900 font-bold rounded-2xl hover:bg-slate-100 transition-all active:scale-95 shadow-xl"
      >
        <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
        Entrar com Google
      </button>

      <div className="pt-8 grid grid-cols-2 gap-4">
        <div className="p-4 bg-slate-800/50 rounded-2xl border border-slate-700">
          <Bell className="w-6 h-6 text-primary mb-2 mx-auto" />
          <p className="text-xs font-bold text-white uppercase tracking-wider">Alertas</p>
          <p className="text-[10px] text-slate-500">WhatsApp automático</p>
        </div>
        <div className="p-4 bg-slate-800/50 rounded-2xl border border-slate-700">
          <History className="w-6 h-6 text-primary mb-2 mx-auto" />
          <p className="text-xs font-bold text-white uppercase tracking-wider">Histórico</p>
          <p className="text-[10px] text-slate-500">Log completo</p>
        </div>
      </div>
    </div>
  </div>
);

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'dashboard' | 'clients' | 'history' | 'settings' | 'new-client' | 'warranties' | 'new-warranty' | 'admin'>('dashboard');
  const [clients, setClients] = useState<Client[]>([]);
  const [maintenances, setMaintenances] = useState<MaintenanceRecord[]>([]);
  const [warranties, setWarranties] = useState<Warranty[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [editingWarranty, setEditingWarranty] = useState<Warranty | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string, type: 'client' | 'maintenance' | 'warranty' | 'message_log' } | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [messageLogs, setMessageLogs] = useState<MessageLog[]>([]);

  const ADMIN_EMAIL = '6snailiw@gmail.com';

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Chart Data Calculation
  const chartData = useMemo(() => {
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const last6Months = [];
    const now = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      last6Months.push({
        month: months[d.getMonth()],
        monthIndex: d.getMonth(),
        year: d.getFullYear(),
        count: 0
      });
    }

    maintenances.forEach(m => {
      const mDate = parseISO(m.date);
      const dataPoint = last6Months.find(p => p.monthIndex === mDate.getMonth() && p.year === mDate.getFullYear());
      if (dataPoint) dataPoint.count++;
    });

    return last6Months;
  }, [maintenances]);

  // Auth listener
  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        // Fetch or create user profile
        const userDoc = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userDoc);
        
        if (userSnap.exists()) {
          setUserProfile(userSnap.data() as UserProfile);
        } else {
          const newProfile: UserProfile = {
            uid: user.uid,
            email: user.email || '',
            displayName: user.displayName || 'Usuário',
            role: user.email === ADMIN_EMAIL ? 'admin' : 'user',
            isActive: user.email === ADMIN_EMAIL, // Admin is active by default, others need approval
            createdAt: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss'Z'")
          };
          await setDoc(userDoc, newProfile);
          setUserProfile(newProfile);
        }
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });
  }, []);

  // Subscription expiry check
  useEffect(() => {
    if (!userProfile || userProfile.role === 'admin' || !userProfile.subscriptionExpiresAt || !userProfile.isActive) return;

    const expiryDate = parseISO(userProfile.subscriptionExpiresAt);
    const today = new Date();

    // If today is after expiry date, block the user
    if (isBefore(expiryDate, today)) {
      updateDoc(doc(db, 'users', userProfile.uid), {
        isActive: false
      }).catch(e => console.error("Error auto-blocking expired user", e));
    }
  }, [userProfile]);

  // Data listeners
  useEffect(() => {
    if (!user || !userProfile?.isActive) return;

    const clientsQuery = query(collection(db, 'clients'), where('userId', '==', user.uid));
    const unsubscribeClients = onSnapshot(clientsQuery, (snapshot) => {
      const clientsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));
      setClients(clientsData);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'clients'));

    const maintenanceQuery = query(collection(db, 'maintenances'), where('userId', '==', user.uid));
    const unsubscribeMaintenances = onSnapshot(maintenanceQuery, (snapshot) => {
      const maintenanceData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MaintenanceRecord));
      setMaintenances(maintenanceData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'maintenances'));

    const warrantyQuery = query(collection(db, 'warranties'), where('userId', '==', user.uid));
    const unsubscribeWarranties = onSnapshot(warrantyQuery, (snapshot) => {
      const warrantyData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Warranty));
      setWarranties(warrantyData.sort((a, b) => b.warrantyNumber - a.warrantyNumber));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'warranties'));

    const settingsDoc = doc(db, 'settings', user.uid);
    const unsubscribeSettings = onSnapshot(settingsDoc, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        const updatedSettings: Settings = {
          userId: user.uid,
          whatsappTemplate: data.whatsappTemplate || "Olá {client}, sua {bike} está agendada para manutenção em {date}. Nos vemos lá!",
          oilTypes: data.oilTypes || ['10W30', '10W40', '20W50', 'Motul 3000', 'Motul 5000', 'Yamalube'],
          warrantyCategories: data.warrantyCategories || ['Motor', 'Câmbio', 'Elétrica', 'Suspensão', 'Freios', 'Pintura', 'Geral'],
          businessName: data.businessName || '',
          businessPhone: data.businessPhone || '',
          businessInstagram: data.businessInstagram || '',
          businessAddress: data.businessAddress || '',
          isProfileComplete: data.isProfileComplete || false
        };
        setSettings(updatedSettings);
        
        // If fields were missing, update the doc
        if (!data.oilTypes || !data.warrantyCategories || data.isProfileComplete === undefined) {
          updateDoc(settingsDoc, {
            oilTypes: updatedSettings.oilTypes,
            warrantyCategories: updatedSettings.warrantyCategories,
            isProfileComplete: updatedSettings.isProfileComplete
          }).catch(e => console.error("Error updating settings with defaults", e));
        }
      } else {
        // Initial settings
        const initialSettings: Settings = {
          userId: user.uid,
          whatsappTemplate: "Olá {client}, sua {bike} está agendada para manutenção em {date}. Nos vemos lá!",
          oilTypes: ['10W30', '10W40', '20W50', 'Motul 3000', 'Motul 5000', 'Yamalube'],
          warrantyCategories: ['Motor', 'Câmbio', 'Elétrica', 'Suspensão', 'Freios', 'Pintura', 'Geral'],
          businessName: '',
          businessPhone: '',
          businessInstagram: '',
          businessAddress: '',
          isProfileComplete: false
        };
        setDoc(settingsDoc, initialSettings).catch(error => handleFirestoreError(error, OperationType.CREATE, 'settings'));
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, 'settings'));

    // Admin listener
    let unsubscribeUsers = () => {};
    if (userProfile.role === 'admin') {
      const usersQuery = collection(db, 'users');
      unsubscribeUsers = onSnapshot(usersQuery, (snapshot) => {
        const usersData = snapshot.docs.map(doc => doc.data() as UserProfile);
        setAllUsers(usersData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      });
    }

    const messageLogsQuery = query(collection(db, 'message_logs'), where('userId', '==', user.uid));
    const unsubscribeMessageLogs = onSnapshot(messageLogsQuery, (snapshot) => {
      const logsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MessageLog));
      setMessageLogs(logsData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'message_logs'));

    return () => {
      unsubscribeClients();
      unsubscribeMaintenances();
      unsubscribeWarranties();
      unsubscribeSettings();
      unsubscribeUsers();
      unsubscribeMessageLogs();
    };
  }, [user, userProfile]);

  // Status calculation logic
  const getStatus = (nextDateStr: string): MaintenanceStatus => {
    const nextDate = parseISO(nextDateStr);
    const today = startOfDay(new Date());
    const daysUntil = differenceInDays(nextDate, today);

    if (daysUntil < 0) return 'OVERDUE';
    if (daysUntil <= 3) return 'WARNING';
    return 'OK';
  };

  // Update statuses periodically
  useEffect(() => {
    const interval = setInterval(() => {
      clients.forEach(async (client) => {
        const currentStatus = getStatus(client.nextMaintenanceDate);
        if (currentStatus !== client.status) {
          await updateDoc(doc(db, 'clients', client.id), { status: currentStatus });
        }
      });
    }, 30000); // Every 30 seconds as requested
    return () => clearInterval(interval);
  }, [clients]);

  // --- Handlers ---

  const handleAddMaintenance = async (client: Client, date: string = format(new Date(), "yyyy-MM-dd'T'HH:mm:ss'Z'")) => {
    if (!user) return;

    const nextDate = format(addDays(parseISO(date), client.recurrenceDays), "yyyy-MM-dd'T'HH:mm:ss'Z'");
    
    try {
      // 1. Add to history
      await addDoc(collection(db, 'maintenances'), {
        clientId: client.id,
        clientName: client.name,
        bikeModel: client.bikeModel,
        date: date,
        oilType: client.oilType,
        userId: user.uid,
        notes: "Manutenção periódica realizada."
      });

      // 2. Update client
      await updateDoc(doc(db, 'clients', client.id), {
        lastMaintenanceDate: date,
        nextMaintenanceDate: nextDate,
        status: getStatus(nextDate),
        notificacao_enviada: false
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'maintenances/clients');
    }
  };

  const handleSaveClient = async (clientData: Partial<Client>) => {
    if (!user) return;

    const lastDate = clientData.lastMaintenanceDate || format(new Date(), "yyyy-MM-dd'T'HH:mm:ss'Z'");
    const recurrence = clientData.recurrenceDays || 29;
    const nextDate = format(addDays(parseISO(lastDate), recurrence), "yyyy-MM-dd'T'HH:mm:ss'Z'");
    
    const finalData = {
      ...clientData,
      userId: user.uid,
      lastMaintenanceDate: lastDate,
      nextMaintenanceDate: nextDate,
      recurrenceDays: recurrence,
      status: getStatus(nextDate),
      notificacao_enviada: clientData.notificacao_enviada || false,
      lastAlertDate: clientData.lastAlertDate || '',
      createdAt: clientData.createdAt || format(new Date(), "yyyy-MM-dd'T'HH:mm:ss'Z'")
    };

    try {
      if (editingClient) {
        await updateDoc(doc(db, 'clients', editingClient.id), finalData);
      } else {
        await addDoc(collection(db, 'clients'), finalData);
      }
      setEditingClient(null);
      setView('clients');
    } catch (error) {
      handleFirestoreError(error, editingClient ? OperationType.UPDATE : OperationType.CREATE, 'clients');
    }
  };

  const handleSaveWarranty = async (warrantyData: Partial<Warranty>) => {
    if (!user) return;

    const serviceDate = warrantyData.serviceDate || format(new Date(), "yyyy-MM-dd'T'HH:mm:ss'Z'");
    const duration = warrantyData.durationMonths || 3;
    const expiryDate = format(addDays(parseISO(serviceDate), duration * 30), "yyyy-MM-dd'T'HH:mm:ss'Z'");
    
    // Get next warranty number
    const nextNumber = warranties.length > 0 ? Math.max(...warranties.map(w => w.warrantyNumber)) + 1 : 1;

    const finalData = {
      ...warrantyData,
      serviceValue: isNaN(warrantyData.serviceValue || 0) ? 0 : (warrantyData.serviceValue || 0),
      userId: user.uid,
      serviceDate,
      durationMonths: duration,
      expiryDate,
      warrantyNumber: warrantyData.warrantyNumber || nextNumber,
      createdAt: warrantyData.createdAt || format(new Date(), "yyyy-MM-dd'T'HH:mm:ss'Z'")
    };

    try {
      if (editingWarranty) {
        await updateDoc(doc(db, 'warranties', editingWarranty.id), finalData);
      } else {
        await addDoc(collection(db, 'warranties'), finalData);
      }
      setEditingWarranty(null);
      setView('warranties');
    } catch (error) {
      handleFirestoreError(error, editingWarranty ? OperationType.UPDATE : OperationType.CREATE, 'warranties');
    }
  };

  const handleDeleteWarranty = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'warranties', id));
      setDeleteConfirm(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'warranties');
    }
  };

  const handleDeleteMaintenance = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'maintenances', id));
      setDeleteConfirm(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'maintenances');
    }
  };

  const generateWarrantyPDF = async (warranty: Warranty) => {
    if (!settings) return;

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;

    // Header
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text(settings.businessName || 'MOTOFIX', margin, 20);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Serviços Especializados em Manutenção', margin, 26);
    doc.text(`WhatsApp: ${settings.businessPhone || 'N/A'} | Instagram: ${settings.businessInstagram || 'N/A'}`, margin, 30);
    if (settings.businessAddress) {
      doc.text(settings.businessAddress, margin, 34);
    }
    
    doc.setLineWidth(0.5);
    doc.line(margin, 37, pageWidth - margin, 37);

    // Title
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('CERTIFICADO DE GARANTIA', pageWidth / 2, 47, { align: 'center' });

    // Main Box
    const boxY = 57;
    const boxHeight = 85; // Increased height for long descriptions
    doc.setDrawColor(0);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, boxY, pageWidth - (margin * 2), boxHeight, 5, 5);

    // Content inside box
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    let currentY = boxY + 10;
    const lineSpacing = 6;

    doc.text(`Nº da Garantia: ${warranty.warrantyNumber}`, margin + 5, currentY); currentY += lineSpacing;
    doc.text(`Cliente: ${warranty.clientName}`, margin + 5, currentY); currentY += lineSpacing;
    doc.text(`Telefone: ${warranty.clientPhone || 'N/A'}`, margin + 5, currentY); currentY += lineSpacing;
    doc.text(`Serviço: ${warranty.serviceType}`, margin + 5, currentY); currentY += lineSpacing;
    
    // Split description to avoid cutting off
    const splitDescription = doc.splitTextToSize(`Descrição: ${warranty.serviceDescription || 'N/A'}`, pageWidth - (margin * 2) - 10);
    doc.text(splitDescription, margin + 5, currentY); 
    currentY += (splitDescription.length * lineSpacing);

    // Ensure we don't overlap if description is very long
    if (currentY > boxY + boxHeight - 20) {
      // If description is too long, we might need to adjust or add a page, 
      // but for now let's just ensure basic fields are printed
    }

    doc.text(`Valor: R$ ${warranty.serviceValue?.toFixed(2) || '0.00'}`, margin + 5, currentY); currentY += lineSpacing;
    doc.text(`Data do Serviço: ${format(parseISO(warranty.serviceDate), 'yyyy-MM-dd')}`, margin + 5, currentY); currentY += lineSpacing;
    doc.text(`Duração: ${warranty.durationMonths} mês(es)`, margin + 5, currentY); currentY += lineSpacing;
    doc.text(`Vencimento: ${format(parseISO(warranty.expiryDate), 'yyyy-MM-dd')}`, margin + 5, currentY);

    // Terms
    const termsY = boxY + boxHeight + 10;
    doc.setFont('helvetica', 'bold');
    doc.text('Termos da garantia', pageWidth - margin - 70, termsY);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const terms = [
      '1) A garantia cobre exclusivamente o serviço descrito neste certificado.',
      `2) Não cobre mau uso, quedas, adaptações, violação de lacres, ou peças não fornecidas/instaladas pela ${settings.businessName || 'empresa'}.`,
      '3) É obrigatório apresentar este certificado (impresso ou digital) para acionamento.',
      '4) O prazo conta a partir da data do serviço, até a data de vencimento informada.'
    ];
    
    let termY = termsY + 6;
    terms.forEach(term => {
      const splitTerm = doc.splitTextToSize(term, 70);
      doc.text(splitTerm, pageWidth - margin - 70, termY);
      termY += (splitTerm.length * 4) + 1;
    });

    // Signatures
    const sigY = 240;
    doc.line(margin, sigY, margin + 80, sigY);
    doc.text('Assinatura do Cliente', margin + 40, sigY + 5, { align: 'center' });

    doc.line(pageWidth - margin - 80, sigY, pageWidth - margin, sigY);
    doc.text(`Assinatura ${settings.businessName || 'MotoFix'}`, pageWidth - margin - 40, sigY + 5, { align: 'center' });

    // Footer
    doc.setFontSize(7);
    const now = format(new Date(), 'dd/MM/yyyy, HH:mm:ss');
    doc.text(`Emitido automaticamente em ${now}`, pageWidth - margin, 265, { align: 'right' });

    doc.save(`Garantia_${warranty.warrantyNumber}_${warranty.clientName}.pdf`);
  };

  const handleDeleteClient = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'clients', id));
      setDeleteConfirm(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'clients');
    }
  };

  const handleDeleteMessageLog = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'message_logs', id));
      setDeleteConfirm(null);
      setToast({ message: "Log excluído com sucesso.", type: 'success' });
    } catch (error) {
      console.error("Erro ao excluir log:", error);
      setToast({ message: "Erro ao excluir log.", type: 'error' });
    }
  };

  const toggleUserStatus = async (targetUser: UserProfile) => {
    if (userProfile?.role !== 'admin') return;
    try {
      // If we are activating a user, we might want to set a default subscription if none exists
      const updates: any = { isActive: !targetUser.isActive };
      
      // If activating and no expiry set, set to 30 days from now by default
      if (!targetUser.isActive && !targetUser.subscriptionExpiresAt) {
        updates.subscriptionExpiresAt = format(addDays(new Date(), 30), "yyyy-MM-dd'T'HH:mm:ss'Z'");
      }

      await updateDoc(doc(db, 'users', targetUser.uid), updates);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'users');
    }
  };

  const updateSubscription = async (uid: string, days: number) => {
    if (userProfile?.role !== 'admin') return;
    try {
      const targetUser = allUsers.find(u => u.uid === uid);
      if (!targetUser) return;
      
      const currentExpiry = targetUser.subscriptionExpiresAt ? parseISO(targetUser.subscriptionExpiresAt) : new Date();
      
      // If adding days and current is expired, start from today
      // If removing days, always subtract from current expiry
      let baseDate = currentExpiry;
      if (days > 0 && isBefore(currentExpiry, new Date())) {
        baseDate = new Date();
      }
      
      const newExpiry = format(addDays(baseDate, days), "yyyy-MM-dd'T'HH:mm:ss'Z'");
      
      await updateDoc(doc(db, 'users', uid), {
        subscriptionExpiresAt: newExpiry,
        isActive: isAfter(parseISO(newExpiry), new Date())
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'users');
    }
  };

  const setSubscriptionDate = async (uid: string, dateStr: string) => {
    if (userProfile?.role !== 'admin') return;
    try {
      const newExpiry = `${dateStr}T23:59:59Z`;
      await updateDoc(doc(db, 'users', uid), {
        subscriptionExpiresAt: newExpiry,
        isActive: isAfter(parseISO(newExpiry), new Date())
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'users');
    }
  };

  const sendWhatsApp = async (client: Client) => {
    if (!settings || !user) return;
    
    try {
      // 1. Montar a mensagem usando o template centralizado
      const message = AlertService.buildReminderMessage(settings.whatsappTemplate, client);
      
      // 2. Validar telefone e criar URL
      const url = AlertService.createWhatsAppUrl(client, message);
      
      // 3. Abrir WhatsApp IMEDIATAMENTE (antes de qualquer await)
      // Isso evita que o iOS bloqueie a abertura da aba por achar que é um pop-up indesejado.
      window.open(url, '_blank');
      
      // 4. Registrar a tentativa em segundo plano (status 'opened_whatsapp')
      const result = await AlertService.registerManualReminderAttempt(db, user.uid, client, message);
      
      if (result.success) {
        setToast({ message: "WhatsApp aberto e tentativa registrada.", type: 'success' });
      } else {
        console.warn("Falha ao registrar log de alerta no banco de dados.");
      }
    } catch (error: any) {
      console.error("Erro ao enviar lembrete:", error);
      setToast({ message: error.message || "Erro inesperado ao processar o lembrete.", type: 'error' });
    }
  };

  // --- Views ---

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.bikeModel.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const overdueClients = clients.filter(c => c.status === 'OVERDUE');
  const warningClients = clients.filter(c => c.status === 'WARNING');
  const pendingAlerts = AlertService.getPendingAlerts(clients);

  if (loading) return <LoadingScreen />;
  if (!user) return <AuthScreen />;

  // Blocked Screen
  if (userProfile && !userProfile.isActive) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-dark p-4">
        <div className="bg-slate-800 p-8 rounded-3xl border border-primary/20 max-w-md w-full text-center space-y-6">
          <div className="bg-primary/20 w-20 h-20 rounded-full flex items-center justify-center mx-auto">
            <Lock className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-white">Acesso Restrito</h1>
          <p className="text-slate-400">Sua conta está aguardando ativação pelo administrador. Entre em contato para liberar seu acesso:</p>
          <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-700 text-left space-y-3">
            <a 
              href="https://wa.me/556999944024" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-sm flex items-center gap-2 text-slate-300 hover:text-primary transition-colors"
            >
              <MessageSquare className="w-4 h-4 text-primary" />
              <span className="font-bold">WhatsApp:</span> +55 69 99944024
            </a>
            <a 
              href="https://instagram.com/motofix_recorrentes" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-sm flex items-center gap-2 text-slate-300 hover:text-primary transition-colors"
            >
              <SettingsIcon className="w-4 h-4 text-primary" />
              <span className="font-bold">Instagram:</span> @motofix_recorrentes
            </a>
          </div>
          <div className="pt-4">
            <p className="text-xs text-slate-500 uppercase font-bold tracking-widest mb-2">Seu ID de Usuário:</p>
            <code className="bg-slate-900 px-3 py-1 rounded-lg text-primary text-xs">{user.uid}</code>
          </div>
          <button 
            onClick={() => signOut(auth)}
            className="w-full py-3 bg-slate-700 text-white font-bold rounded-xl hover:bg-slate-600 transition-all"
          >
            Sair da Conta
          </button>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-background-dark text-slate-100 pb-24 font-display">
        {/* Header */}
        <header className="sticky top-0 z-50 bg-background-dark/80 backdrop-blur-md border-b border-primary/10 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary/20 p-2 rounded-xl">
              <Bike className="text-primary w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">MotoFix Recorrentes</h1>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setView('settings')}
              className="p-2 rounded-full hover:bg-slate-800 transition-colors text-slate-400"
            >
              <SettingsIcon className="w-5 h-5" />
            </button>
            <button 
              onClick={() => signOut(auth)}
              className="p-2 rounded-full hover:bg-red-500/10 transition-colors text-red-500"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        <main className="max-w-5xl mx-auto p-4 space-y-6">
          {view === 'dashboard' && (
            <div className="space-y-8">
              {/* Daily Alerts Section */}
              {pendingAlerts.length > 0 && (
                <div className="bg-primary/5 border border-primary/20 rounded-3xl p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="bg-primary/20 p-2 rounded-lg">
                        <Bell className="w-5 h-5 text-primary animate-bounce" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg">Alertas de Hoje</h3>
                        <p className="text-sm text-slate-400">{pendingAlerts.length} clientes precisam de aviso</p>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {pendingAlerts.slice(0, 4).map(client => (
                      <div key={client.id} className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700 flex items-center justify-between group hover:border-primary/50 transition-all">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center">
                            <Bike className="w-5 h-5 text-slate-400" />
                          </div>
                          <div>
                            <p className="font-bold text-sm">{client.name}</p>
                            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">{client.bikeModel}</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => sendWhatsApp(client)}
                          className="bg-primary p-2 rounded-xl text-white hover:scale-110 transition-transform shadow-lg shadow-primary/20"
                          title="Enviar WhatsApp"
                        >
                          <MessageSquare className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  {pendingAlerts.length > 4 && (
                    <button 
                      onClick={() => setView('clients')}
                      className="text-xs text-primary font-bold uppercase tracking-widest hover:underline"
                    >
                      + {pendingAlerts.length - 4} outros alertas pendentes
                    </button>
                  )}
                </div>
              )}

              {/* Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700">
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Total Clientes</p>
                    <Users className="w-4 h-4 text-primary" />
                  </div>
                  <p className="text-3xl font-bold text-white">{clients.length}</p>
                </div>
                <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700">
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Trocas Hoje</p>
                    <Calendar className="w-4 h-4 text-primary" />
                  </div>
                  <p className="text-3xl font-bold text-white">
                    {maintenances.filter(m => format(parseISO(m.date), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')).length}
                  </p>
                </div>
                <div className="bg-primary/10 p-6 rounded-2xl border border-primary/30 relative overflow-hidden">
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-xs font-bold text-primary uppercase tracking-widest">Vencidos</p>
                    <AlertTriangle className="w-4 h-4 text-primary" />
                  </div>
                  <p className="text-3xl font-bold text-primary">{overdueClients.length}</p>
                  <AlertTriangle className="absolute -right-4 -bottom-4 w-24 h-24 text-primary/5" />
                </div>
              </div>

              {/* Chart */}
              <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-bold text-lg">Histórico de Trocas</h3>
                  <p className="text-xs text-slate-500 uppercase font-bold tracking-widest">Últimos 6 Meses</p>
                </div>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                      <XAxis 
                        dataKey="month" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: '#94a3b8', fontSize: 12 }} 
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: '#94a3b8', fontSize: 12 }} 
                      />
                      <Tooltip 
                        cursor={{ fill: 'rgba(242, 120, 13, 0.1)' }}
                        contentStyle={{ 
                          backgroundColor: '#1e293b', 
                          border: '1px solid #334155',
                          borderRadius: '12px',
                          color: '#fff'
                        }}
                      />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={index === chartData.length - 1 ? '#f2780d' : '#f2780d44'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Quick Action */}
              <button 
                onClick={() => { setEditingClient(null); setView('new-client'); }}
                className="w-full bg-primary p-6 rounded-3xl flex flex-col items-center justify-center gap-3 text-white hover:bg-primary/90 transition-all shadow-2xl shadow-primary/20 group"
              >
                <div className="bg-white/20 p-3 rounded-full group-hover:scale-110 transition-transform">
                  <Plus className="w-6 h-6" />
                </div>
                <span className="text-lg font-bold">Nova Troca de Óleo</span>
              </button>

              {/* Urgent Alerts */}
              {overdueClients.length > 0 && (
                <div className="bg-slate-800/50 rounded-2xl border border-slate-700 overflow-hidden">
                  <div className="p-4 border-b border-slate-700 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-red-500" />
                      <h3 className="font-bold">Alertas Urgentes</h3>
                    </div>
                    <span className="bg-red-500/10 text-red-500 text-xs font-bold px-2 py-1 rounded-lg">
                      {overdueClients.length} VENCIDOS
                    </span>
                  </div>
                  <div className="divide-y divide-slate-700">
                    {overdueClients.slice(0, 5).map(client => (
                      <div key={client.id} className="p-4 flex items-center justify-between hover:bg-slate-800 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-xl bg-slate-700 flex items-center justify-center">
                            <Bike className="w-6 h-6 text-slate-400" />
                          </div>
                          <div>
                            <p className="font-bold">{client.name}</p>
                            <p className="text-sm text-slate-500">{client.bikeModel}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-red-500 font-bold text-sm">Vencido</p>
                          <p className="text-xs text-slate-500">{format(parseISO(client.nextMaintenanceDate), 'dd/MM/yyyy')}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button 
                    onClick={() => setView('clients')}
                    className="w-full p-4 text-primary text-sm font-bold hover:bg-slate-800 transition-colors"
                  >
                    Ver Todos os Alertas
                  </button>
                </div>
              )}
            </div>
          )}

          {view === 'clients' && (
            <div className="space-y-6">
              {/* Quick Action at Top for Mobile Access */}
              <button 
                onClick={() => { setEditingClient(null); setView('new-client'); }}
                className="w-full bg-primary p-4 rounded-2xl flex items-center justify-center gap-3 text-white hover:bg-primary/90 transition-all shadow-lg shadow-primary/10"
              >
                <Plus className="w-5 h-5" />
                <span className="font-bold">Nova Troca de Óleo</span>
              </button>

              <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                <h2 className="text-2xl font-bold">Clientes e Trocas</h2>
                <div className="relative w-full md:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input 
                    type="text" 
                    placeholder="Buscar cliente ou moto..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-800 border-none rounded-xl pl-10 pr-4 py-2 focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredClients.map(client => (
                  <div key={client.id} className="bg-slate-800/50 p-5 rounded-2xl border border-slate-700 space-y-4 relative overflow-hidden">
                    <div className={cn(
                      "absolute top-0 right-0 w-1 h-full",
                      client.status === 'OK' ? 'bg-emerald-500' : 
                      client.status === 'WARNING' ? 'bg-yellow-500' : 'bg-red-500'
                    )} />
                    
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          client.status === 'OK' ? 'bg-emerald-500' : 
                          client.status === 'WARNING' ? 'bg-yellow-500' : 'bg-red-500'
                        )} />
                        <div>
                          <h3 className="font-bold text-lg">{client.name}</h3>
                          <p className="text-sm text-slate-400">{client.bikeModel}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleAddMaintenance(client)}
                          className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition-colors"
                          title="Manutenção Realizada"
                        >
                          <CheckCircle className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => sendWhatsApp(client)}
                          className="p-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                          title="Enviar Alerta"
                        >
                          <MessageSquare className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => { setEditingClient(client); setView('new-client'); }}
                          className="p-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors"
                        >
                          <ChevronRight className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => {
                            if (deleteConfirm?.id === client.id) {
                              handleDeleteClient(client.id);
                            } else {
                              setDeleteConfirm({ id: client.id, type: 'client' });
                            }
                          }}
                          className={cn(
                            "p-2 rounded-lg transition-colors",
                            deleteConfirm?.id === client.id 
                              ? "bg-red-500 text-white animate-pulse" 
                              : "bg-red-500/10 text-red-500 hover:bg-red-500/20"
                          )}
                          title={deleteConfirm?.id === client.id ? "Confirmar Exclusão" : "Excluir Cliente"}
                        >
                          {deleteConfirm?.id === client.id ? <CheckCircle className="w-5 h-5" /> : <Trash2 className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-700">
                      <div>
                        <p className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">Última</p>
                        <p className="text-sm font-medium">{format(parseISO(client.lastMaintenanceDate), 'dd/MM/yyyy')}</p>
                      </div>
                      <div>
                        <p className={cn(
                          "text-[10px] uppercase font-bold tracking-widest",
                          client.status === 'OK' ? 'text-slate-500' : 
                          client.status === 'WARNING' ? 'text-yellow-500' : 'text-red-500'
                        )}>Próxima</p>
                        <p className={cn(
                          "text-sm font-bold",
                          client.status === 'OK' ? 'text-white' : 
                          client.status === 'WARNING' ? 'text-yellow-500' : 'text-red-500'
                        )}>
                          {format(parseISO(client.nextMaintenanceDate), 'dd/MM/yyyy')}
                          {client.status === 'OVERDUE' && " (Vencida)"}
                          {client.status === 'WARNING' && " (Em breve)"}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {view === 'history' && (
            <div className="space-y-8">
              <div className="space-y-6">
                <h2 className="text-2xl font-bold">Histórico de Trocas</h2>
                <div className="space-y-4">
                  {maintenances.map(record => (
                    <div key={record.id} className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="bg-primary/10 p-3 rounded-xl">
                          <History className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-bold">{record.clientName}</p>
                          <p className="text-xs text-slate-500">{record.bikeModel} • {record.oilType}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <p className="font-bold text-white">{format(parseISO(record.date), 'dd/MM/yyyy')}</p>
                          <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Realizada</p>
                        </div>
                        <button 
                          onClick={() => {
                            if (deleteConfirm?.id === record.id) {
                              handleDeleteMaintenance(record.id);
                            } else {
                              setDeleteConfirm({ id: record.id, type: 'maintenance' });
                            }
                          }}
                          className={cn(
                            "p-2 rounded-lg transition-colors ml-2",
                            deleteConfirm?.id === record.id 
                              ? "bg-red-500 text-white animate-pulse" 
                              : "bg-red-500/10 text-red-500 hover:bg-red-500/20"
                          )}
                          title={deleteConfirm?.id === record.id ? "Confirmar Exclusão" : "Excluir Registro"}
                        >
                          {deleteConfirm?.id === record.id ? <CheckCircle className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-6 pt-8 border-t border-slate-800">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <Bell className="w-6 h-6 text-primary" />
                  Logs de Alertas
                </h2>
                <div className="space-y-4">
                  {messageLogs.length === 0 ? (
                    <div className="text-center py-12 bg-slate-800/30 rounded-3xl border border-dashed border-slate-700">
                      <AlertCircle className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                      <p className="text-slate-500">Nenhum alerta enviado ainda.</p>
                    </div>
                  ) : (
                    messageLogs.map(log => (
                      <div key={log.id} className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="bg-emerald-500/10 p-3 rounded-xl">
                            <MessageSquare className="w-5 h-5 text-emerald-500" />
                          </div>
                          <div>
                            <p className="font-bold">{log.clientName}</p>
                            <p className="text-xs text-slate-500">{log.bikeModel}</p>
                          </div>
                        </div>
                          <div className="text-right flex items-center gap-4">
                            <div className="text-right">
                              <p className="font-bold text-white">{format(parseISO(log.createdAt), 'dd/MM/yyyy HH:mm')}</p>
                              <span className={cn(
                                "text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-widest",
                                log.status === 'opened_whatsapp' ? "bg-emerald-500/20 text-emerald-500" : "bg-slate-500/20 text-slate-500"
                              )}>
                                {log.status === 'opened_whatsapp' ? 'WhatsApp Aberto' : log.status}
                              </span>
                            </div>
                            <button 
                              onClick={() => {
                                if (deleteConfirm?.id === log.id) {
                                  handleDeleteMessageLog(log.id!);
                                } else {
                                  setDeleteConfirm({ id: log.id!, type: 'message_log' });
                                }
                              }}
                              className={cn(
                                "p-2 rounded-lg transition-colors",
                                deleteConfirm?.id === log.id 
                                  ? "bg-red-500 text-white animate-pulse" 
                                  : "bg-red-500/10 text-red-500 hover:bg-red-500/20"
                              )}
                              title={deleteConfirm?.id === log.id ? "Confirmar Exclusão" : "Excluir Log"}
                            >
                              {deleteConfirm?.id === log.id ? <CheckCircle className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
                            </button>
                          </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {view === 'warranties' && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                <h2 className="text-2xl font-bold">Garantias de Serviço</h2>
                <button 
                  onClick={() => { setEditingWarranty(null); setView('new-warranty'); }}
                  className="bg-primary px-6 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-primary/90 transition-all"
                >
                  <Plus className="w-5 h-5" /> Nova Garantia
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {warranties.map(warranty => (
                  <div key={warranty.id} className="bg-slate-800/50 p-5 rounded-2xl border border-slate-700 space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <ShieldCheck className="w-5 h-5 text-primary" />
                          <h3 className="font-bold text-lg">{warranty.clientName}</h3>
                        </div>
                        <p className="text-sm text-slate-400">{warranty.serviceType}</p>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => generateWarrantyPDF(warranty)}
                          className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition-colors"
                          title="Baixar PDF"
                        >
                          <Download className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => { setEditingWarranty(warranty); setView('new-warranty'); }}
                          className="p-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors"
                        >
                          <ChevronRight className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => {
                            if (deleteConfirm?.id === warranty.id) {
                              handleDeleteWarranty(warranty.id);
                            } else {
                              setDeleteConfirm({ id: warranty.id, type: 'warranty' });
                            }
                          }}
                          className={cn(
                            "p-2 rounded-lg transition-colors",
                            deleteConfirm?.id === warranty.id 
                              ? "bg-red-500 text-white animate-pulse" 
                              : "bg-red-500/10 text-red-500 hover:bg-red-500/20"
                          )}
                          title={deleteConfirm?.id === warranty.id ? "Confirmar Exclusão" : "Excluir Garantia"}
                        >
                          {deleteConfirm?.id === warranty.id ? <CheckCircle className="w-5 h-5" /> : <Trash2 className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-700">
                      <div>
                        <p className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">Nº Garantia</p>
                        <p className="text-sm font-medium">{warranty.warrantyNumber}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">Vencimento</p>
                        <p className={cn(
                          "text-sm font-bold",
                          isBefore(parseISO(warranty.expiryDate), new Date()) ? "text-red-500" : "text-emerald-500"
                        )}>
                          {format(parseISO(warranty.expiryDate), 'dd/MM/yyyy')}
                        </p>
                      </div>
                    </div>

                    {warranty.serviceDescription && (
                      <div className="pt-3 border-t border-slate-700/50">
                        <p className="text-[10px] uppercase font-bold text-slate-500 tracking-widest mb-1">Descrição</p>
                        <p className="text-xs text-slate-400 whitespace-pre-wrap break-words">{warranty.serviceDescription}</p>
                      </div>
                    )}

                  </div>
                ))}
              </div>
            </div>
          )}

          {view === 'new-warranty' && (
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="flex items-center gap-4">
                <button onClick={() => setView('warranties')} className="p-2 rounded-full hover:bg-slate-800">
                  <ArrowLeft className="w-6 h-6" />
                </button>
                <h2 className="text-2xl font-bold">{editingWarranty ? 'Editar Garantia' : 'Nova Garantia de Serviço'}</h2>
              </div>

              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  handleSaveWarranty({
                    clientName: formData.get('clientName') as string,
                    serviceType: formData.get('serviceType') as string,
                    serviceDescription: formData.get('serviceDescription') as string,
                    serviceValue: parseFloat(formData.get('serviceValue') as string),
                    serviceDate: formData.get('serviceDate') ? `${formData.get('serviceDate')}T12:00:00Z` : undefined,
                    durationMonths: parseInt(formData.get('durationMonths') as string),
                    clientPhone: formData.get('clientPhone') as string
                  });
                }}
                className="bg-slate-800/50 p-6 rounded-3xl border border-slate-700 space-y-6"
              >
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest px-1">Nome do Cliente:</label>
                    <input name="clientName" defaultValue={editingWarranty?.clientName} required placeholder="Ex: João Silva" className="w-full bg-slate-900 border-slate-700 rounded-xl p-3 focus:ring-primary" />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center px-1">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Tipo de Serviço:</label>
                      <button type="button" onClick={() => setView('settings')} className="text-[10px] text-primary hover:underline">Gerenciar Lista</button>
                    </div>
                    <select name="serviceType" defaultValue={editingWarranty?.serviceType || ""} required className="w-full bg-slate-900 border-slate-700 rounded-xl p-3 focus:ring-primary">
                      <option value="" disabled>Selecione um serviço</option>
                      {editingWarranty?.serviceType && !settings?.warrantyCategories?.includes(editingWarranty.serviceType) && (
                        <option value={editingWarranty.serviceType}>{editingWarranty.serviceType}</option>
                      )}
                      {settings?.warrantyCategories?.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest px-1">Descrição do Serviço:</label>
                    <textarea name="serviceDescription" defaultValue={editingWarranty?.serviceDescription} placeholder="Detalhes adicionais do serviço" className="w-full bg-slate-900 border-slate-700 rounded-xl p-3 min-h-[100px] focus:ring-primary" />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest px-1">Valor do Serviço (R$):</label>
                      <input name="serviceValue" type="number" step="0.01" defaultValue={editingWarranty?.serviceValue || 0} className="w-full bg-slate-900 border-slate-700 rounded-xl p-3 focus:ring-primary" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest px-1">Data do Serviço:</label>
                      <input 
                        name="serviceDate" 
                        type="date" 
                        defaultValue={editingWarranty ? format(parseISO(editingWarranty.serviceDate), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')} 
                        required 
                        className="w-full bg-slate-900 border-slate-700 rounded-xl p-3 focus:ring-primary" 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest px-1">Duração da Garantia (meses):</label>
                      <select name="durationMonths" defaultValue={editingWarranty?.durationMonths || 3} className="w-full bg-slate-900 border-slate-700 rounded-xl p-3 focus:ring-primary">
                        <option value={1}>1 mês</option>
                        <option value={3}>3 meses</option>
                        <option value={6}>6 meses</option>
                        <option value={12}>12 meses</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest px-1">Telefone do Cliente:</label>
                      <input name="clientPhone" defaultValue={editingWarranty?.clientPhone} placeholder="(11) 98765-4321" className="w-full bg-slate-900 border-slate-700 rounded-xl p-3 focus:ring-primary" />
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button type="submit" className="flex-1 bg-primary py-4 rounded-2xl font-bold hover:bg-primary/90 transition-all">
                    {editingWarranty ? 'Salvar Alterações' : 'Adicionar Garantia'}
                  </button>
                  <button type="button" onClick={() => setView('warranties')} className="px-8 bg-slate-700 py-4 rounded-2xl font-bold hover:bg-slate-600 transition-all">
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          )}

          {view === 'settings' && (
            <div className="space-y-6 max-w-2xl mx-auto">
              <h2 className="text-2xl font-bold">Configurações</h2>
              
              {/* Subscription Status (for non-admins) */}
              {userProfile?.role !== 'admin' && userProfile?.subscriptionExpiresAt && (
                <div className={cn(
                  "p-6 rounded-2xl border flex items-center justify-between",
                  isBefore(parseISO(userProfile.subscriptionExpiresAt), new Date()) 
                    ? "bg-red-500/10 border-red-500/30 text-red-500" 
                    : "bg-emerald-500/10 border-emerald-500/30 text-emerald-500"
                )}>
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "p-3 rounded-xl",
                      isBefore(parseISO(userProfile.subscriptionExpiresAt), new Date()) ? "bg-red-500/20" : "bg-emerald-500/20"
                    )}>
                      <ShieldCheck className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest opacity-70">Sua Assinatura</p>
                      <p className="text-lg font-bold">
                        {isBefore(parseISO(userProfile.subscriptionExpiresAt), new Date()) 
                          ? "Expirada" 
                          : `Ativa até ${format(parseISO(userProfile.subscriptionExpiresAt), 'dd/MM/yyyy')}`}
                      </p>
                      <p className="text-xs opacity-60">
                        {isBefore(parseISO(userProfile.subscriptionExpiresAt), new Date()) 
                          ? "Renove para continuar usando todos os recursos." 
                          : "Seu acesso está garantido até a data acima."}
                      </p>
                    </div>
                  </div>
                  {isBefore(parseISO(userProfile.subscriptionExpiresAt), new Date()) && (
                    <button 
                      onClick={() => window.open('https://wa.me/5511999999999?text=Olá, gostaria de renovar minha assinatura do MotoFix', '_blank')}
                      className="bg-red-500 text-white px-6 py-3 rounded-xl font-bold hover:bg-red-600 transition-all shadow-lg shadow-red-500/20"
                    >
                      Renovar
                    </button>
                  )}
                </div>
              )}
              
              <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 space-y-4">
                <div className="flex items-center gap-3 mb-2">
                  <Bike className="w-5 h-5 text-primary" />
                  <h3 className="font-bold">Perfil da Empresa</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest px-1">Nome da Empresa</label>
                    <input 
                      value={settings?.businessName || ''}
                      onChange={(e) => setSettings(s => s ? { ...s, businessName: e.target.value } : null)}
                      placeholder="Ex: MotoFix Centro Automotivo"
                      className="w-full bg-slate-900 border-slate-700 rounded-xl p-3 focus:ring-primary"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest px-1">WhatsApp da Empresa</label>
                    <input 
                      value={settings?.businessPhone || ''}
                      onChange={(e) => setSettings(s => s ? { ...s, businessPhone: e.target.value } : null)}
                      placeholder="Ex: (69) 99999-9999"
                      className="w-full bg-slate-900 border-slate-700 rounded-xl p-3 focus:ring-primary"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest px-1">Instagram (@)</label>
                    <input 
                      value={settings?.businessInstagram || ''}
                      onChange={(e) => setSettings(s => s ? { ...s, businessInstagram: e.target.value } : null)}
                      placeholder="Ex: @motofix_oficial"
                      className="w-full bg-slate-900 border-slate-700 rounded-xl p-3 focus:ring-primary"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest px-1">Endereço</label>
                    <input 
                      value={settings?.businessAddress || ''}
                      onChange={(e) => setSettings(s => s ? { ...s, businessAddress: e.target.value } : null)}
                      placeholder="Rua Exemplo, 123 - Centro"
                      className="w-full bg-slate-900 border-slate-700 rounded-xl p-3 focus:ring-primary"
                    />
                  </div>
                </div>
                <button 
                  onClick={async () => {
                    if (user && settings) {
                      const updatedSettings = { ...settings, isProfileComplete: !!settings.businessName };
                      await setDoc(doc(db, 'settings', user.uid), updatedSettings);
                      setSettings(updatedSettings);
                      setSaveMessage("Perfil atualizado com sucesso!");
                      setTimeout(() => setSaveMessage(null), 3000);
                    }
                  }}
                  className="w-full bg-emerald-500/10 text-emerald-500 py-3 rounded-xl font-bold hover:bg-emerald-500/20 transition-all border border-emerald-500/30"
                >
                  Salvar Perfil da Empresa
                </button>
              </div>

              <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 space-y-4">
                <div className="flex items-center gap-3 mb-2">
                  <MessageSquare className="w-5 h-5 text-primary" />
                  <h3 className="font-bold">Template do WhatsApp</h3>
                </div>
                <p className="text-sm text-slate-400">Use as tags: <code>{'{client}'}</code>, <code>{'{bike}'}</code>, <code>{'{date}'}</code></p>
                <textarea 
                  value={settings?.whatsappTemplate || ''}
                  onChange={(e) => setSettings(s => s ? { ...s, whatsappTemplate: e.target.value } : null)}
                  className="w-full bg-slate-900 border-slate-700 rounded-xl p-4 min-h-[120px] focus:ring-primary"
                />
                <button 
                  onClick={async () => {
                    if (user && settings) {
                      try {
                        await setDoc(doc(db, 'settings', user.uid), {
                          ...settings,
                          whatsappTemplate: settings.whatsappTemplate
                        }, { merge: true });
                        setSaveMessage("Configurações salvas com sucesso!");
                        setTimeout(() => setSaveMessage(null), 3000);
                      } catch (error) {
                        handleFirestoreError(error, OperationType.UPDATE, 'settings');
                      }
                    }
                  }}
                  className="w-full bg-primary py-3 rounded-xl font-bold hover:bg-primary/90 transition-all"
                >
                  Salvar Configurações
                </button>
                {saveMessage && (
                  <p className="text-emerald-500 text-center text-sm font-bold animate-bounce">{saveMessage}</p>
                )}
              </div>

              {/* Oil Types Management */}
              <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 space-y-4">
                <div className="flex items-center gap-3 mb-2">
                  <Droplets className="w-5 h-5 text-primary" />
                  <h3 className="font-bold">Tipos de Óleo Disponíveis</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {settings?.oilTypes?.map((type, index) => (
                    <div key={index} className="bg-slate-900 px-3 py-1 rounded-lg border border-slate-700 flex items-center gap-2 group">
                      <span className="text-sm">{type}</span>
                      <button 
                        onClick={() => {
                          const newTypes = settings.oilTypes.filter((_, i) => i !== index);
                          setSettings({ ...settings, oilTypes: newTypes });
                        }}
                        className="text-slate-500 hover:text-red-500 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input 
                    id="newOilType"
                    placeholder="Novo tipo de óleo"
                    className="flex-1 bg-slate-900 border-slate-700 rounded-xl p-2 text-sm focus:ring-primary"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const val = e.currentTarget.value.trim();
                        if (val && settings && !settings.oilTypes.includes(val)) {
                          setSettings({ ...settings, oilTypes: [...settings.oilTypes, val] });
                          e.currentTarget.value = '';
                        }
                      }
                    }}
                  />
                  <button 
                    onClick={() => {
                      const input = document.getElementById('newOilType') as HTMLInputElement;
                      const val = input.value.trim();
                      if (val && settings && !settings.oilTypes.includes(val)) {
                        setSettings({ ...settings, oilTypes: [...settings.oilTypes, val] });
                        input.value = '';
                      }
                    }}
                    className="bg-slate-700 p-2 rounded-xl hover:bg-slate-600"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Warranty Categories Management */}
              <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 space-y-4">
                <div className="flex items-center gap-3 mb-2">
                  <ShieldCheck className="w-5 h-5 text-primary" />
                  <h3 className="font-bold">Categorias de Garantia</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {settings?.warrantyCategories?.map((cat, index) => (
                    <div key={index} className="bg-slate-900 px-3 py-1 rounded-lg border border-slate-700 flex items-center gap-2 group">
                      <span className="text-sm">{cat}</span>
                      <button 
                        onClick={() => {
                          const newCats = settings.warrantyCategories.filter((_, i) => i !== index);
                          setSettings({ ...settings, warrantyCategories: newCats });
                        }}
                        className="text-slate-500 hover:text-red-500 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input 
                    id="newCategory"
                    placeholder="Nova categoria"
                    className="flex-1 bg-slate-900 border-slate-700 rounded-xl p-2 text-sm focus:ring-primary"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const val = e.currentTarget.value.trim();
                        if (val && settings && !settings.warrantyCategories.includes(val)) {
                          setSettings({ ...settings, warrantyCategories: [...settings.warrantyCategories, val] });
                          e.currentTarget.value = '';
                        }
                      }
                    }}
                  />
                  <button 
                    onClick={() => {
                      const input = document.getElementById('newCategory') as HTMLInputElement;
                      const val = input.value.trim();
                      if (val && settings && !settings.warrantyCategories.includes(val)) {
                        setSettings({ ...settings, warrantyCategories: [...settings.warrantyCategories, val] });
                        input.value = '';
                      }
                    }}
                    className="bg-slate-700 p-2 rounded-xl hover:bg-slate-600"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700">
                <h3 className="font-bold mb-4">Sobre o App</h3>
                <p className="text-sm text-slate-400">MotoFix Recorrentes v2.0</p>
                <p className="text-sm text-slate-400">Desenvolvido para gerenciamento de troca de óleo e garantias de serviço.</p>
                <p className="text-xs text-slate-500 mt-4">Todos os direitos reservados.</p>
              </div>
            </div>
          )}

          {view === 'new-client' && (
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="flex items-center gap-4">
                <button onClick={() => setView('clients')} className="p-2 rounded-full hover:bg-slate-800">
                  <ArrowLeft className="w-6 h-6" />
                </button>
                <h2 className="text-2xl font-bold">{editingClient ? 'Editar Cliente' : 'Novo Registro'}</h2>
              </div>

              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  handleSaveClient({
                    name: formData.get('name') as string,
                    bikeModel: formData.get('bikeModel') as string,
                    contact: formData.get('contact') as string,
                    oilType: formData.get('oilType') as string,
                    recurrenceDays: parseInt(formData.get('recurrenceDays') as string),
                    lastMaintenanceDate: formData.get('lastMaintenanceDate') ? `${formData.get('lastMaintenanceDate')}T12:00:00Z` : undefined
                  });
                }}
                className="bg-slate-800/50 p-6 rounded-3xl border border-slate-700 space-y-6"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest px-1">Nome do Cliente</label>
                    <input name="name" defaultValue={editingClient?.name} required className="w-full bg-slate-900 border-slate-700 rounded-xl p-3 focus:ring-primary" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest px-1">Contato (WhatsApp)</label>
                    <input name="contact" defaultValue={editingClient?.contact} required placeholder="Ex: 5511999999999" className="w-full bg-slate-900 border-slate-700 rounded-xl p-3 focus:ring-primary" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest px-1">Modelo da Moto</label>
                    <input name="bikeModel" defaultValue={editingClient?.bikeModel} required className="w-full bg-slate-900 border-slate-700 rounded-xl p-3 focus:ring-primary" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center px-1">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Tipo de Óleo</label>
                      <button type="button" onClick={() => setView('settings')} className="text-[10px] text-primary hover:underline">Gerenciar Lista</button>
                    </div>
                    <select name="oilType" defaultValue={editingClient?.oilType} className="w-full bg-slate-900 border-slate-700 rounded-xl p-3 focus:ring-primary">
                      <option value="">Selecione o óleo</option>
                      {editingClient?.oilType && !settings?.oilTypes?.includes(editingClient.oilType) && (
                        <option value={editingClient.oilType}>{editingClient.oilType}</option>
                      )}
                      {settings?.oilTypes?.map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest px-1">Data da Manutenção</label>
                    <input 
                      name="lastMaintenanceDate" 
                      type="date" 
                      defaultValue={editingClient ? format(parseISO(editingClient.lastMaintenanceDate), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')} 
                      required 
                      className="w-full bg-slate-900 border-slate-700 rounded-xl p-3 focus:ring-primary" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest px-1">Recorrência (Dias)</label>
                    <input name="recurrenceDays" type="number" defaultValue={editingClient?.recurrenceDays || 29} required className="w-full bg-slate-900 border-slate-700 rounded-xl p-3 focus:ring-primary" />
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button type="submit" className="flex-1 bg-primary py-4 rounded-2xl font-bold hover:bg-primary/90 transition-all">
                    {editingClient ? 'Salvar Alterações' : 'Cadastrar Manutenção'}
                  </button>
                  <button type="button" onClick={() => setView('clients')} className="px-8 bg-slate-700 py-4 rounded-2xl font-bold hover:bg-slate-600 transition-all">
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          )}
          {view === 'admin' && userProfile?.role === 'admin' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Painel Administrativo</h2>
                <div className="bg-primary/10 px-3 py-1 rounded-full flex items-center gap-2">
                  <Shield className="w-4 h-4 text-primary" />
                  <span className="text-xs font-bold text-primary">ADMIN</span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {allUsers.map(u => (
                  <div key={u.uid} className="bg-slate-800/50 p-5 rounded-2xl border border-slate-700 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center",
                        u.isActive ? "bg-emerald-500/10" : "bg-red-500/10"
                      )}>
                        {u.isActive ? <UserCheck className="w-6 h-6 text-emerald-500" /> : <UserX className="w-6 h-6 text-red-500" />}
                      </div>
                      <div>
                        <p className="font-bold">{u.displayName}</p>
                        <p className="text-xs text-slate-500">{u.email}</p>
                        <div className="flex flex-col gap-1 mt-1">
                          <p className="text-[10px] text-slate-600">Desde: {format(parseISO(u.createdAt), 'dd/MM/yyyy')}</p>
                          {u.subscriptionExpiresAt && (
                            <p className={cn(
                              "text-[10px] font-bold",
                              isBefore(parseISO(u.subscriptionExpiresAt), new Date()) ? "text-red-500" : "text-emerald-500"
                            )}>
                              Expira: {format(parseISO(u.subscriptionExpiresAt), 'dd/MM/yyyy')}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest",
                          u.isActive ? "bg-emerald-500/20 text-emerald-500" : "bg-red-500/20 text-red-500"
                        )}>
                          {u.isActive ? 'Ativo' : 'Bloqueado'}
                        </div>
                        {u.uid !== user.uid && (
                          <button 
                            onClick={() => toggleUserStatus(u)}
                            className={cn(
                              "p-2 rounded-lg transition-all",
                              u.isActive ? "bg-red-500/10 text-red-500 hover:bg-red-500/20" : "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20"
                            )}
                          >
                            {u.isActive ? <Lock className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
                          </button>
                        )}
                      </div>
                      
                      {/* Subscription Quick Actions */}
                      {u.uid !== user.uid && (
                        <div className="flex flex-col items-end gap-2">
                          <div className="flex flex-wrap justify-end gap-1 max-w-[150px]">
                            <button 
                              onClick={() => updateSubscription(u.uid, -30)}
                              className="px-2 py-1 bg-red-500/10 hover:bg-red-500/20 text-[10px] font-bold rounded text-red-500 transition-colors border border-red-500/20"
                              title="Remover 30 dias"
                            >
                              -30d
                            </button>
                            <button 
                              onClick={() => updateSubscription(u.uid, -7)}
                              className="px-2 py-1 bg-red-500/10 hover:bg-red-500/20 text-[10px] font-bold rounded text-red-500 transition-colors border border-red-500/20"
                              title="Remover 7 dias"
                            >
                              -7d
                            </button>
                            <button 
                              onClick={() => updateSubscription(u.uid, 30)}
                              className="px-2 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-[10px] font-bold rounded text-emerald-500 transition-colors border border-emerald-500/20"
                              title="Adicionar 30 dias"
                            >
                              +30d
                            </button>
                            <button 
                              onClick={() => updateSubscription(u.uid, 90)}
                              className="px-2 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-[10px] font-bold rounded text-emerald-500 transition-colors border border-emerald-500/20"
                              title="Adicionar 90 dias"
                            >
                              +90d
                            </button>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-slate-500 uppercase">Vencimento:</span>
                            <input 
                              type="date" 
                              className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[10px] text-white focus:ring-1 focus:ring-primary outline-none"
                              defaultValue={u.subscriptionExpiresAt ? format(parseISO(u.subscriptionExpiresAt), 'yyyy-MM-dd') : ''}
                              onChange={(e) => {
                                if (e.target.value) {
                                  setSubscriptionDate(u.uid, e.target.value);
                                }
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>

        {/* Bottom Nav */}
        <nav className="fixed bottom-0 left-0 right-0 bg-background-dark/90 backdrop-blur-xl border-t border-slate-800 p-4 z-50">
          <div className="max-w-md mx-auto flex justify-between items-center">
            <button 
              onClick={() => setView('dashboard')}
              className={cn("flex flex-col items-center gap-1 transition-colors", view === 'dashboard' ? 'text-primary' : 'text-slate-500')}
            >
              <LayoutDashboard className="w-6 h-6" />
              <span className="text-[10px] font-bold uppercase tracking-tighter">Início</span>
            </button>
            <button 
              onClick={() => setView('clients')}
              className={cn("flex flex-col items-center gap-1 transition-colors", view === 'clients' ? 'text-primary' : 'text-slate-500')}
            >
              <Users className="w-6 h-6" />
              <span className="text-[10px] font-bold uppercase tracking-tighter">Trocas</span>
            </button>
            {userProfile?.role === 'admin' ? (
              <button 
                onClick={() => setView('admin')}
                className={cn("flex flex-col items-center gap-1 transition-colors", view === 'admin' ? 'text-primary' : 'text-slate-500')}
              >
                <Shield className="w-6 h-6" />
                <span className="text-[10px] font-bold uppercase tracking-tighter">Admin</span>
              </button>
            ) : (
              <button 
                onClick={() => setView('warranties')}
                className={cn("flex flex-col items-center gap-1 transition-colors", view === 'warranties' ? 'text-primary' : 'text-slate-500')}
              >
                <ShieldCheck className="w-6 h-6" />
                <span className="text-[10px] font-bold uppercase tracking-tighter">Garantias</span>
              </button>
            )}
            <button 
              onClick={() => setView('history')}
              className={cn("flex flex-col items-center gap-1 transition-colors", view === 'history' ? 'text-primary' : 'text-slate-500')}
            >
              <History className="w-6 h-6" />
              <span className="text-[10px] font-bold uppercase tracking-tighter">Histórico</span>
            </button>
            <button 
              onClick={() => setView('settings')}
              className={cn("flex flex-col items-center gap-1 transition-colors", view === 'settings' ? 'text-primary' : 'text-slate-500')}
            >
              <SettingsIcon className="w-6 h-6" />
              <span className="text-[10px] font-bold uppercase tracking-tighter">Ajustes</span>
            </button>
          </div>
        </nav>

        {/* First Login Profile Setup Modal */}
        {settings && !settings.isProfileComplete && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-slate-800 w-full max-w-md rounded-3xl border border-primary/30 p-8 shadow-2xl animate-in fade-in zoom-in duration-300">
              <div className="bg-primary/20 w-16 h-16 rounded-2xl flex items-center justify-center mb-6">
                <Bike className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Bem-vindo ao MotoFix!</h2>
              <p className="text-slate-400 mb-8">Para começar, precisamos de alguns dados da sua empresa para os certificados de garantia.</p>
              
              <form 
                onSubmit={async (e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  const businessName = formData.get('businessName') as string;
                  if (!businessName) return;

                  const updatedSettings = {
                    ...settings,
                    businessName,
                    businessPhone: formData.get('businessPhone') as string,
                    businessInstagram: formData.get('businessInstagram') as string,
                    businessAddress: formData.get('businessAddress') as string,
                    isProfileComplete: true
                  };
                  
                  if (user) {
                    await setDoc(doc(db, 'settings', user.uid), updatedSettings);
                    setSettings(updatedSettings);
                  }
                }}
                className="space-y-4"
              >
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Nome da Empresa</label>
                  <input name="businessName" required placeholder="Ex: MotoFix Centro Automotivo" className="w-full bg-slate-900 border-slate-700 rounded-xl p-3 focus:ring-primary" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">WhatsApp</label>
                  <input name="businessPhone" placeholder="Ex: (69) 99999-9999" className="w-full bg-slate-900 border-slate-700 rounded-xl p-3 focus:ring-primary" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Instagram (@)</label>
                  <input name="businessInstagram" placeholder="Ex: @motofix_oficial" className="w-full bg-slate-900 border-slate-700 rounded-xl p-3 focus:ring-primary" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Endereço</label>
                  <input name="businessAddress" placeholder="Rua Exemplo, 123 - Centro" className="w-full bg-slate-900 border-slate-700 rounded-xl p-3 focus:ring-primary" />
                </div>
                <button type="submit" className="w-full bg-primary py-4 rounded-2xl font-bold text-white mt-4 hover:bg-primary/90 transition-all shadow-lg shadow-primary/20">
                  Concluir Cadastro
                </button>
              </form>
            </div>
          </div>
        )}
        {toast && (
          <Toast 
            message={toast.message} 
            type={toast.type} 
            onClose={() => setToast(null)} 
          />
        )}
      </div>
    </ErrorBoundary>
  );
}
