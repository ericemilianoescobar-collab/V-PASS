import { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import {
  LogOut, Camera, CheckCircle2, XCircle, AlertTriangle, Loader2,
  QrCode, User, Search, Hand, Keyboard, Pause, Play,
} from 'lucide-react';
import VPassLogo from '@/components/VPassLogo';
import { supabase } from '@/lib/supabase';

interface ValidatorData {
  validatorId?: string;
  validatorName?: string;
  eventName?: string;
  eventId?: string;
}

interface Props {
  validatorData?: ValidatorData;
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
  // Valores por defecto seguros para evitar cualquier error de "undefined"
  const safeValidatorId = validatorData?.validatorId || '';
  const safeValidatorName = validatorData?.validatorName || 'Validador';
  const safeEventName = validatorData?.eventName || 'Evento';
  const safeEventId = validatorData?.eventId || '';

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
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        await scannerRef.current.clear();
      } catch {
        // Ignorar errores de limpieza
      }
      scannerRef.current = null;
    }
    setScanning(false);
  }, []);

  const handleScan = useCallback(async (code: string) => {
    if (!safeValidatorId) {
      setError('Falta el ID del validador. Vuelve a iniciar sesión.');
      return;
    }
    try {
      const { data, error: rpcError } = await supabase.rpc('manual_validate_ticket', {
        p_code: code,
        p_validator_id: safeValidatorId,
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
    } catch {
      // Ignorar errores puntuales de red
    }
  }, [safeValidatorId]);

  const startScanning = useCallback(async () => {
    setError('');
    
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        await scannerRef.current.clear();
      } catch {
        // Continuar
      }
      scannerRef.current = null;
    }

    setScanning(true);

    setTimeout(async () => {
      try {
        const scanner = new Html5Qrcode(containerId);
        scannerRef.current = scanner;
        
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 230, height: 230 } },
          async (decodedText: string) => {
            if (cooldownRef.current) return;
            cooldownRef.current = true;
            await handleScan(decodedText);
            setTimeout(() => { cooldownRef.current = false; }, 2000);
          },
          () => {}
        );
      } catch {
        setError('No se pudo acceder a la cámara. Verifica los permisos de tu navegador.');
        setScanning(false);
        scannerRef.current = null;
      }
    }, 100);
  }, [handleScan]);

  useEffect(() => {
    startScanning();
    return () => {
      void stopScanning();
    };
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
    if (!searchQuery.trim() || !safeEventId) return;
    setSearchLoading(true);
    const { data } = await supabase.rpc('search_ticket_by_guest', {
      p_event_id: safeEventId,
      p_search_name: searchQuery.trim(),
    });
    setSearchResults((data as GuestSearchResult[]) || []);
    setSearchLoading(false);
  };

  const markEntered = async (ticketId: string) => {
    if (!safeValidatorId) return;
    const { data } = await supabase.rpc('mark_ticket_entered_by_id', {
      p_ticket_id: ticketId,
      p_validator_id: safeValidatorId,
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
    <div className="min-h-screen bg-slate-950 text-slate-100 relative overflow-x-hidden flex flex-col">
      <div className="absolute inset-0 bg-grid pointer-events-none opacity-20" />

      {/* Header unificado */}
      <header className="relative z-20 flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-950/90 backdrop-blur-xl sticky top-0">
        <div className="flex items-center">
          <VPassLogo size="sm" />
        </div>
        
        <div className="text-center px-2 flex-1 max-w-[200px] sm:max-w-md mx-auto truncate">
          <p className="text-xs sm:text-sm font-bold text-white truncate">{safeEventName}</p>
          <p className="text-[10px] sm:text-xs text-cyan-400 font-medium truncate">{safeValidatorName}</p>
        </div>

        <button 
          onClick={onLogout} 
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium hover:bg-red-500/20 transition-all shrink-0"
        >
          <LogOut size={14} /> 
          <span className="hidden sm:inline">Cerrar sesión</span>
        </button>
      </header>

      <div className="relative z-10 max-w-4xl w-full mx-auto px-4 py-4 space-y-4 flex-1">
        
        {lastResult && cfg && Icon && (
          <div className={`p-4 rounded-xl border ${cfg.bg} ${cfg.border} animate-scale-in flex items-center justify-between shadow-lg`}>
            <div className="flex items-center gap-3">
              <Icon size={28} className={`${cfg.color} shrink-0`} />
              <div>
                <h3 className={`font-bold text-sm ${cfg.color}`}>{cfg.title}</h3>
                {lastResult.attendeeName && <p className="text-xs sm:text-sm text-slate-200 font-medium">{lastResult.attendeeName}</p>}
                {lastResult.code && <p className="text-[10px] text-slate-400 font-mono">Código: {lastResult.code}</p>}
              </div>
            </div>
            <button onClick={handleIgnore} className="px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-300 text-xs flex items-center gap-1 transition-all border border-slate-700">
              <Hand size={14} /> Ignorar
            </button>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-2 animate-fade-in text-xs text-red-300">
            <AlertTriangle size={18} className="text-red-400 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-4">
          
          <div className="space-y-4">
            <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl backdrop-blur-md">
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Camera size={14} className="text-cyan-400" /> Cámara Validadora
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border ${scanning ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                  {scanning ? 'Activa' : 'Pausada'}
                </span>
              </div>

              <div className="relative rounded-xl overflow-hidden bg-slate-950 aspect-square border border-slate-800/80 flex items-center justify-center">
                <div id={containerId} className="w-full h-full" />
                
                {!scanning && !error && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/90 z-10">
                    <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                      <Camera size={24} />
                    </div>
                    <p className="text-slate-400 text-xs">Cámara en pausa</p>
                    <button onClick={startScanning} className="btn-primary text-xs px-4 py-2 flex items-center gap-2 font-medium">
                      <Play size={14} /> Activar cámara
                    </button>
                  </div>
                )}
              </div>

              {scanning ? (
                <button 
                  onClick={() => void stopScanning()} 
                  className="w-full mt-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700/80 text-slate-200 text-xs font-medium flex items-center justify-center gap-2 border border-slate-700 transition-all"
                >
                  <Pause size={14} className="text-amber-400" /> Pausar Cámara
                </button>
              ) : (
                <button 
                  onClick={startScanning} 
                  className="w-full mt-3 py-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 text-xs font-medium flex items-center justify-center gap-2 border border-cyan-500/30 transition-all"
                >
                  <Play size={14} /> Reanudar Cámara
                </button>
              )}
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl backdrop-blur-md">
              <div className="flex items-center gap-2 mb-2">
                <Keyboard size={16} className="text-cyan-400" />
                <h3 className="text-xs font-semibold text-white">Ingreso Manual de Código</h3>
              </div>
              <form onSubmit={handleManualSubmit} className="flex gap-2">
                <input
                  value={manualCode}
                  onChange={e => setManualCode(e.target.value)}
                  placeholder="Ej: TKT-XYZ123"
                  className="input-field text-xs font-mono uppercase flex-1"
                />
                <button 
                  type="submit" 
                  disabled={manualLoading || !manualCode.trim()} 
                  className="btn-primary text-xs px-4 flex items-center justify-center shrink-0 font-medium"
                >
                  {manualLoading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                </button>
              </form>
              <p className="text-[10px] text-slate-500 mt-2">Úsalo si el código QR está dañado o no hay buena iluminación.</p>
            </div>
          </div>

          <div className="space-y-4">
            
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 text-center shadow-lg">
                <p className="text-2xl font-black text-emerald-400">{validCount}</p>
                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mt-0.5">Validados Hoy</p>
              </div>
              <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 text-center shadow-lg">
                <p className="text-2xl font-black text-cyan-400">{scanHistory.length}</p>
                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mt-0.5">Total Escaneados</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl backdrop-blur-md">
              <h3 className="text-xs font-semibold text-white mb-3 flex items-center gap-2">
                <QrCode size={16} className="text-cyan-400" /> Últimos Registros
              </h3>
              {scanHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-slate-500 space-y-1">
                  <QrCode size={28} className="opacity-30" />
                  <p className="text-xs">No hay escaneos recientes en esta sesión</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {scanHistory.map((scan, i) => {
                    const sc = resultConfig[scan.status];
                    const SIcon = sc?.icon;
                    return (
                      <div key={i} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          {SIcon && <SIcon size={16} className={`${sc.color} shrink-0`} />}
                          <div className="min-w-0">
                            <p className="text-slate-200 font-medium truncate">{scan.attendeeName || scan.code || 'Asistente'}</p>
                            <p className="text-[10px] text-slate-500 font-mono">{scan.time}</p>
                          </div>
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${sc ? `${sc.bg} ${sc.color}${sc.border} border` : 'text-slate-400'}`}>
                          {sc?.title || scan.status}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl backdrop-blur-md">
              <button 
                onClick={() => setShowSearch(!showSearch)} 
                className="w-full flex items-center justify-between text-left focus:outline-none"
              >
                <h3 className="text-xs font-semibold text-white flex items-center gap-2">
                  <Search size={16} className="text-cyan-400" /> Búsqueda por Nombre (Caso Extremo)
                </h3>
                <span className="text-slate-400 text-xs font-mono">{showSearch ? '▲' : '▼'}</span>
              </button>

              {showSearch && (
                <div className="mt-3 space-y-3 animate-fade-in pt-2 border-t border-slate-800/80">
                  <form onSubmit={(e) => { e.preventDefault(); handleSearch(); }} className="flex gap-2">
                    <div className="relative flex-1">
                      <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Nombre o apellido..."
                        className="input-field pl-8 text-xs w-full"
                      />
                    </div>
                    <button type="submit" disabled={searchLoading} className="btn-primary text-xs px-3 py-1.5 shrink-0">
                      {searchLoading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                    </button>
                  </form>

                  {searchResults.length > 0 && (
                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                      {searchResults.map(r => (
                        <div key={r.ticket_id} className="flex items-center justify-between p-2 rounded-xl bg-slate-950/80 border border-slate-800 text-xs">
                          <div className="min-w-0 pr-2">
                            <p className="text-slate-200 font-medium truncate">{r.attendee_name || 'Sin nombre'}</p>
                            <p className="text-[10px] text-slate-500 font-mono">Código: {r.code}</p>
                          </div>
                          {r.status === 'used' ? (
                            <span className="px-2 py-1 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20 text-[10px] font-medium shrink-0">
                              Ingresó
                            </span>
                          ) : r.status === 'cancelled' ? (
                            <span className="px-2 py-1 rounded bg-red-500/10 text-red-300 border border-red-500/20 text-[10px] font-medium shrink-0">
                              Cancelada
                            </span>
                          ) : (
                            <button 
                              onClick={() => markEntered(r.ticket_id)} 
                              className="px-2.5 py-1 rounded bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 text-[10px] font-medium transition-all shrink-0"
                            >
                              Registrar Ingreso
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {searchResults.length === 0 && searchQuery && !searchLoading && (
                    <p className="text-xs text-slate-500 text-center py-2">No se encontraron invitados con ese nombre.</p>
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