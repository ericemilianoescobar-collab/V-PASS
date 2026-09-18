import { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import {
  LogOut, Camera, CheckCircle2, XCircle, AlertTriangle, Loader2,
  QrCode, User, Search, Hand, Keyboard, Pause, Play,
} from 'lucide-react';
import VPassLogo from '@/components/VPassLogo';
import { supabase } from '@/lib/supabase';

/*
 * ValidatorScanner — pantalla del validador en el evento.
 * Layout: logo arriba-izquierda, nombre evento centro, cerrar sesión arriba-derecha.
 * Centro: cámara QR + código manual. Abajo: botón ignorar, lista de validados.
 * Esquina abajo-derecha: buscar por nombre de invitado.
 */

interface ValidatorData {
  validatorId: string;
  validatorName: string;
  eventName: string;
  eventId: string;
}

interface Props {
  validatorData: ValidatorData;
  onLogout: () => void;
}

interface ScanResult {
  status: string;
  attendeeName: string | null;
  code?: string;
  time: string;
}

interface GuestSearchResult {
  ticket_id: string;
  code: string;
  attendee_name: string | null;
  status: string;
}

export default function ValidatorScanner({ validatorData, onLogout }: Props) {
  const [scanning, setScanning] = useState(false);
  const [lastResult, setLastResult] = useState<ScanResult | null>(null);
  const [scanHistory, setScanHistory] = useState<ScanResult[]>([]);
  const [error, setError] = useState('');
  const [manualCode, setManualCode] = useState('');
  const [manualLoading, setManualLoading] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GuestSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerId = 'qr-reader';
  const cooldownRef = useRef(false);

  const stopScanning = useCallback(async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); scannerRef.current.clear(); } catch { /* ignore */ }
      scannerRef.current = null;
    }
    setScanning(false);
  }, []);

  const handleScan = useCallback(async (code: string) => {
    try {
      const { data, error: rpcError } = await supabase.rpc('manual_validate_ticket', {
        p_code: code,
        p_validator_id: validatorData.validatorId,
      });
      if (rpcError || !data || !data[0]) return;
      const r = data[0];
      const result: ScanResult = {
        status: r.status,
        attendeeName: r.attendee_name,
        code,
        time: new Date().toLocaleTimeString('es-PE'),
      };
      setLastResult(result);
      setScanHistory((prev) => [result, ...prev].slice(0, 50));
    } catch { /* ignore */ }
  }, [validatorData.validatorId]);

  const startScanning = useCallback(async () => {
    setError('');
    setScanning(true);
    try {
      const scanner = new Html5Qrcode(containerId);
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (decodedText: string) => {
          if (cooldownRef.current) return;
          cooldownRef.current = true;
          await handleScan(decodedText);
          setTimeout(() => { cooldownRef.current = false; }, 2000);
        },
        () => {}
      );
    } catch {
      setError('No se pudo acceder a la cámara. Verifica los permisos.');
      setScanning(false);
    }
  }, [handleScan]);

  useEffect(() => {
    startScanning();
    return () => { void stopScanning(); };
  }, [startScanning, stopScanning]);

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    setManualLoading(true);
    await handleScan(manualCode.trim());
    setManualCode('');
    setManualLoading(false);
  };

  const handleIgnore = () => {
    setLastResult(null);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    const { data } = await supabase.rpc('search_ticket_by_guest', {
      p_event_id: validatorData.eventId,
      p_search_name: searchQuery.trim(),
    });
    setSearchResults((data as GuestSearchResult[]) || []);
    setSearchLoading(false);
  };

  const markEntered = async (ticketId: string) => {
    const { data } = await supabase.rpc('mark_ticket_entered_by_id', {
      p_ticket_id: ticketId,
      p_validator_id: validatorData.validatorId,
    });
    if (data && data[0]) {
      const r = data[0];
      const result: ScanResult = {
        status: r.status,
        attendeeName: r.attendee_name,
        time: new Date().toLocaleTimeString('es-PE'),
      };
      setLastResult(result);
      setScanHistory((prev) => [result, ...prev].slice(0, 50));
      setSearchResults((prev) => prev.map(s => s.ticket_id === ticketId ? { ...s, status: 'used' } : s));
    }
  };

  const resultConfig: Record<string, { icon: any; color: string; bg: string; border: string; title: string }> = {
    success: { icon: CheckCircle2, color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20', title: 'Entrada válida' },
    already_used: { icon: AlertTriangle, color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', title: 'Ya utilizada' },
    invalid: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', title: 'Código inválido' },
    cancelled: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', title: 'Entrada cancelada' },
    wrong_event: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', title: 'No pertenece al evento' },
  };

  const cfg = lastResult ? resultConfig[lastResult.status] : null;
  const Icon = cfg?.icon;
  const validCount = scanHistory.filter(s => s.status === 'success').length;

  return (
    <div className="min-h-screen bg-slate-950 relative overflow-hidden">
      <div className="absolute inset-0 bg-grid pointer-events-none" />

      {/* Header: logo left, event center, logout right */}
      <header className="relative z-20 flex items-center justify-between px-4 sm:px-6 py-3 border-b border-slate-800 bg-slate-950/80 backdrop-blur-xl sticky top-0">
        <VPassLogo size="sm" />
        <div className="absolute left-1/2 -translate-x-1/2 text-center hidden sm:block">
          <p className="text-sm font-bold text-white">{validatorData.eventName}</p>
          <p className="text-xs text-cyan-400">{validatorData.validatorName}</p>
        </div>
        <button onClick={onLogout} className="btn-ghost flex items-center gap-2 text-red-400 hover:text-red-300 text-sm">
          <LogOut size={16} /> <span className="hidden sm:inline">Cerrar sesión</span>
        </button>
      </header>

      {/* Mobile event name */}
      <div className="sm:hidden text-center py-2 px-4 border-b border-slate-800">
        <p className="text-sm font-bold text-white">{validatorData.eventName}</p>
        <p className="text-xs text-cyan-400">{validatorData.validatorName}</p>
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-4">
        {/* Last result banner */}
        {lastResult && cfg && Icon && (
          <div className={`card p-4 mb-4 ${cfg.bg} ${cfg.border} animate-scale-in flex items-center justify-between`}>
            <div className="flex items-center gap-3">
              <Icon size={28} className={cfg.color} />
              <div>
                <h3 className={`font-bold ${cfg.color}`}>{cfg.title}</h3>
                {lastResult.attendeeName && <p className="text-sm text-slate-300">{lastResult.attendeeName}</p>}
              </div>
            </div>
            <button onClick={handleIgnore} className="btn-ghost text-sm flex items-center gap-1.5">
              <Hand size={16} /> Ignorar
            </button>
          </div>
        )}

        {error && (
          <div className="card p-3 mb-4 bg-red-500/10 border-red-500/20 flex items-center gap-2 animate-fade-in">
            <AlertTriangle size={18} className="text-red-400 shrink-0" />
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-4">
          {/* Left: Scanner + Manual code */}
          <div className="space-y-4">
            {/* Camera scanner */}
            <div className="card p-3">
              <div className="relative rounded-xl overflow-hidden bg-slate-950 aspect-square">
                <div id={containerId} className="w-full h-full" />
                {scanning && (
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="relative w-[250px] h-[250px]">
                      <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-cyan-400 rounded-tl-lg" />
                      <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-cyan-400 rounded-tr-lg" />
                      <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-cyan-400 rounded-bl-lg" />
                      <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-cyan-400 rounded-br-lg" />
                      <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent" style={{ animation: 'scan-line 2s linear infinite' }} />
                    </div>
                  </div>
                )}
                {!scanning && !error && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                    <Camera size={48} className="text-slate-600" />
                    <p className="text-slate-500 text-sm">Cámara pausada</p>
                    <button onClick={startScanning} className="btn-primary text-sm flex items-center gap-2">
                      <Play size={16} /> Activar cámara
                    </button>
                  </div>
                )}
              </div>
              {scanning && (
                <button onClick={() => { void stopScanning(); }} className="btn-secondary w-full mt-2 text-sm flex items-center justify-center gap-2">
                  <Pause size={16} /> Pausar
                </button>
              )}
            </div>

            {/* Manual code entry */}
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-2">
                <Keyboard size={18} className="text-cyan-400" />
                <h3 className="text-sm font-semibold text-white">Código manual</h3>
              </div>
              <form onSubmit={handleManualSubmit} className="flex gap-2">
                <input
                  value={manualCode}
                  onChange={e => setManualCode(e.target.value)}
                  placeholder="Ingresa el código de la entrada"
                  className="input-field text-sm font-mono"
                />
                <button type="submit" disabled={manualLoading} className="btn-primary text-sm px-4 flex items-center gap-1.5 shrink-0">
                  {manualLoading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                </button>
              </form>
              <p className="text-xs text-slate-500 mt-2">Úsalo si hay poca luz o la cámara falla</p>
            </div>
          </div>

          {/* Right: Validation list + Guest search */}
          <div className="space-y-4">
            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="card p-3 text-center">
                <p className="text-2xl font-black text-green-400">{validCount}</p>
                <p className="text-xs text-slate-400">Validados</p>
              </div>
              <div className="card p-3 text-center">
                <p className="text-2xl font-black text-cyan-400">{scanHistory.length}</p>
                <p className="text-xs text-slate-400">Total escaneos</p>
              </div>
            </div>

            {/* Validation list */}
            <div className="card p-4">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <QrCode size={16} className="text-cyan-400" /> Lista de validación
              </h3>
              {scanHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-slate-500">
                  <QrCode size={32} className="mb-2 opacity-40" />
                  <p className="text-sm">Sin escaneos todavía</p>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                  {scanHistory.map((scan, i) => {
                    const sc = resultConfig[scan.status];
                    const SIcon = sc?.icon;
                    return (
                      <div key={i} className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-slate-900/50 border border-slate-800 animate-fade-in">
                        {SIcon && <SIcon size={16} className={sc.color} />}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-200 truncate">{scan.attendeeName || scan.code || 'Sin nombre'}</p>
                          <p className="text-xs text-slate-500">{scan.time}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Guest search */}
            <div className="card p-4">
              <button onClick={() => setShowSearch(!showSearch)} className="w-full flex items-center justify-between text-left">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Search size={16} className="text-cyan-400" /> Buscar por invitado
                </h3>
                <span className="text-slate-500 text-xs">{showSearch ? '▼' : '▲'}</span>
              </button>
              {showSearch && (
                <div className="mt-3 animate-fade-in">
                  <form onSubmit={(e) => { e.preventDefault(); handleSearch(); }} className="flex gap-2 mb-3">
                    <div className="relative flex-1">
                      <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Nombre del invitado"
                        className="input-field pl-9 text-sm"
                      />
                    </div>
                    <button type="submit" disabled={searchLoading} className="btn-primary text-sm px-4 shrink-0">
                      {searchLoading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                    </button>
                  </form>
                  {searchResults.length > 0 && (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {searchResults.map(r => (
                        <div key={r.ticket_id} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/50 border border-slate-800">
                          <div>
                            <p className="text-sm text-slate-200">{r.attendee_name || 'Sin nombre'}</p>
                            <p className="text-xs text-slate-500 font-mono">{r.code}</p>
                          </div>
                          {r.status === 'used' ? (
                            <span className="badge bg-blue-500/10 text-blue-300 text-xs">Ingresó</span>
                          ) : r.status === 'cancelled' ? (
                            <span className="badge bg-red-500/10 text-red-300 text-xs">Cancelada</span>
                          ) : (
                            <button onClick={() => markEntered(r.ticket_id)} className="btn-primary text-xs px-3 py-1.5">
                              Ingresó
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {searchResults.length === 0 && searchQuery && !searchLoading && (
                    <p className="text-sm text-slate-500 text-center py-2">Sin resultados</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
