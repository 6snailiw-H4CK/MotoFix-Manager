import React, { useState, useEffect, useCallback } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Loader2, CheckCircle2, AlertCircle, RefreshCw, LogOut } from 'lucide-react';

interface WhatsAppStatus {
  userId: string;
  status: 'idle' | 'connecting' | 'qr_ready' | 'ready' | 'disconnected' | 'error';
  qr: string | null;
  lastError: string | null;
}

interface WhatsAppConnectionProps {
  userId: string;
}

const WhatsAppConnection: React.FC<WhatsAppConnectionProps> = ({ userId }) => {
  const [status, setStatus] = useState<WhatsAppStatus>({
    userId,
    status: 'idle',
    qr: null,
    lastError: null
  });
  const [loading, setLoading] = useState(false);
  const [automationLoading, setAutomationLoading] = useState(false);
  const [automationResult, setAutomationResult] = useState<{ sentCount: number, failCount: number } | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch(`/api/whatsapp/status?userId=${userId}`);
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      }
    } catch (error) {
      console.error('Erro ao buscar status do WhatsApp:', error);
    }
  }, [userId]);

  // Polling para o status
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (status.status === 'connecting' || status.status === 'qr_ready') {
      interval = setInterval(fetchStatus, 2000);
    } else {
      // Polling menos frequente quando está pronto ou em erro
      interval = setInterval(fetchStatus, 10000);
    }
    return () => clearInterval(interval);
  }, [status.status, fetchStatus]);

  // Busca inicial
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleConnect = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/whatsapp/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      }
    } catch (error) {
      console.error('Erro ao conectar WhatsApp:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerAutomation = async () => {
    setAutomationLoading(true);
    setAutomationResult(null);
    try {
      const response = await fetch('/api/whatsapp/trigger-automation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      if (response.ok) {
        const data = await response.json();
        setAutomationResult(data);
      } else {
        const error = await response.json();
        alert(`Erro na automação: ${error.error || 'Erro desconhecido'}`);
      }
    } catch (error) {
      console.error('Erro ao disparar automação:', error);
      alert('Erro ao disparar automação. Verifique o console.');
    } finally {
      setAutomationLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Tem certeza que deseja desconectar o WhatsApp?')) return;
    
    setLoading(true);
    try {
      const response = await fetch('/api/whatsapp/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      if (response.ok) {
        setStatus({ userId, status: 'idle', qr: null, lastError: null });
      }
    } catch (error) {
      console.error('Erro ao desconectar WhatsApp:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 max-w-md w-full">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
          Conexão WhatsApp
        </h3>
        <div className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 ${
          status.status === 'ready' ? 'bg-emerald-50 text-emerald-600' :
          status.status === 'error' ? 'bg-rose-50 text-rose-600' :
          status.status === 'qr_ready' ? 'bg-amber-50 text-amber-600' :
          'bg-slate-50 text-slate-500'
        }`}>
          {status.status === 'ready' && <CheckCircle2 size={14} />}
          {status.status === 'error' && <AlertCircle size={14} />}
          {status.status === 'qr_ready' && <Loader2 size={14} className="animate-spin" />}
          {status.status === 'ready' ? 'Conectado' :
           status.status === 'qr_ready' ? 'Aguardando Escaneamento' :
           status.status === 'connecting' ? 'Iniciando...' :
           status.status === 'error' ? 'Erro' :
           status.status === 'disconnected' ? 'Desconectado' : 'Não Iniciado'}
        </div>
      </div>

      <div className="flex flex-col items-center justify-center min-h-[260px] border-2 border-dashed border-slate-100 rounded-xl bg-slate-50/50 p-4">
        {status.status === 'idle' || status.status === 'disconnected' ? (
          <div className="text-center">
            <p className="text-slate-500 text-sm mb-4">
              Conecte seu WhatsApp para começar a enviar alertas automáticos.
            </p>
            <button
              onClick={handleConnect}
              disabled={loading}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
              Conectar WhatsApp
            </button>
          </div>
        ) : status.status === 'connecting' ? (
          <div className="flex flex-col items-center gap-3 text-slate-500">
            <Loader2 size={40} className="animate-spin text-emerald-600" />
            <p className="text-sm font-medium">Preparando ambiente...</p>
          </div>
        ) : status.status === 'qr_ready' && status.qr ? (
          <div className="flex flex-col items-center gap-4">
            <div className="bg-white p-3 rounded-xl shadow-md">
              <QRCodeCanvas value={status.qr} size={220} />
            </div>
            <p className="text-xs text-slate-500 text-center max-w-[220px]">
              Abra o WhatsApp no seu celular, vá em Aparelhos Conectados e escaneie o código acima.
            </p>
          </div>
        ) : status.status === 'ready' ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
              <CheckCircle2 size={32} />
            </div>
            <div>
              <p className="text-slate-800 font-semibold">WhatsApp Conectado!</p>
              <p className="text-slate-500 text-sm mt-1">
                Seu sistema já pode enviar mensagens automaticamente.
              </p>
            </div>
            <div className="mt-6 flex flex-col gap-3 w-full">
              <button
                onClick={handleTriggerAutomation}
                disabled={automationLoading}
                className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-6 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50 w-full"
              >
                {automationLoading ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
                Testar Automação Agora
              </button>

              {automationResult && (
                <div className={`p-3 rounded-lg text-xs font-medium ${
                  automationResult.sentCount > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-slate-50 text-slate-600 border border-slate-100'
                }`}>
                  {automationResult.sentCount > 0 
                    ? `Sucesso! ${automationResult.sentCount} mensagens enviadas.` 
                    : 'Nenhum cliente vencido encontrado para notificar agora.'}
                  {automationResult.failCount > 0 && ` (${automationResult.failCount} falhas)`}
                </div>
              )}

              <button
                onClick={handleDisconnect}
                disabled={loading}
                className="flex items-center justify-center gap-2 text-rose-600 hover:text-rose-700 text-sm font-medium transition-colors"
              >
                <LogOut size={16} />
                Desconectar Conta
              </button>
            </div>
          </div>
        ) : status.status === 'error' ? (
          <div className="text-center p-4">
            <AlertCircle size={40} className="text-rose-500 mx-auto mb-3" />
            <p className="text-slate-800 font-medium mb-1">Ocorreu um erro</p>
            <p className="text-rose-600 text-xs mb-4">{status.lastError || 'Falha ao inicializar o WhatsApp'}</p>
            <button
              onClick={handleConnect}
              disabled={loading}
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-6 py-2 rounded-lg text-sm font-medium mx-auto transition-colors"
            >
              Tentar Novamente
            </button>
          </div>
        ) : null}
      </div>

      {status.status !== 'idle' && status.status !== 'disconnected' && status.status !== 'ready' && (
        <button
          onClick={handleDisconnect}
          className="w-full mt-4 text-slate-400 hover:text-slate-600 text-xs font-medium transition-colors"
        >
          Cancelar tentativa
        </button>
      )}
    </div>
  );
};

export default WhatsAppConnection;
