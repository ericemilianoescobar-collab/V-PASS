import { useEffect, useState } from 'react';
import { ArrowLeft, Calendar, Clock, MapPin, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import VPassLogo from '@/components/VPassLogo';
import { supabase } from '@/lib/supabase';
import { generateQRDataUrl } from '@/lib/ticketArt';

/*
 * TicketView — página pública de entrada para el invitado.
 * Acceso por enlace con token único: #ticket/<access_token>
 * Muestra el QR, datos del evento y estado de la entrada.
 */

interface Props {
  accessToken: string;
  navigate: (route: string) => void;
}

interface TicketData {
  ticket_id: string;
  code: string;
  attendee_name: string;
  event_name: string;
  event_date: string;
  event_time: string | null;
  am_pm: string | null;
  location: string | null;
  status: string;
  bg_image_url: string | null;
  qr_pos_x: number;
  qr_pos_y: number;
  qr_size: number;
}

export default function TicketView({ accessToken, navigate }: Props) {
  const [data, setData] = useState<TicketData | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_ticket_by_access_token', {
        p_token: accessToken,
      });

      if (rpcError || !rpcData || !rpcData[0] || !rpcData[0].ticket_id) {
        setError('Enlace inválido o expirado.');
        setLoading(false);
        return;
      }

      const ticket = rpcData[0] as TicketData;
      setData(ticket);

      const qr = await generateQRDataUrl(ticket.code);
      setQrUrl(qr);
      setLoading(false);
    })();
  }, [accessToken]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-cyan-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-6">
        <XCircle size={48} className="text-red-400 mb-4" />
        <p className="text-slate-300 text-lg mb-4">{error}</p>
        <button onClick={() => navigate('home')} className="btn-primary">Volver al inicio</button>
      </div>
    );
  }

  const bgStyle = data?.bg_image_url
    ? { backgroundImage: `url(${data.bg_image_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : {};

  return (
    <div className="min-h-screen bg-slate-950 relative overflow-hidden">
      <div className="absolute inset-0 bg-grid pointer-events-none" />

      {/* Header */}
      <header className="relative z-20 flex items-center justify-between px-4 sm:px-6 py-3 border-b border-slate-800 bg-slate-950/80 backdrop-blur-xl">
        <button onClick={() => navigate('home')} className="btn-ghost flex items-center gap-2 text-sm">
          <ArrowLeft size={16} /> Volver
        </button>
        <VPassLogo size="sm" />
      </header>

      <div className="relative z-10 flex items-center justify-center px-4 py-8">
        <div className="card overflow-hidden max-w-sm w-full animate-scale-in">
          {/* Background image area with QR */}
          <div className="relative h-96 flex items-center justify-center" style={bgStyle}>
            <div className="absolute inset-0 bg-slate-950/50" />
            {/* QR positioned according to event settings */}
            {qrUrl && (
              <div
                className="absolute"
                style={{
                  left: `${data?.qr_pos_x ?? 50}%`,
                  top: `${data?.qr_pos_y ?? 50}%`,
                  transform: 'translate(-50%, -50%)',
                  width: `${(data?.qr_size ?? 30) * 2}px`,
                }}
              >
                <div className="bg-white rounded-xl p-3 shadow-xl">
                  <img src={qrUrl} alt="QR Code" className="w-full h-full" />
                </div>
              </div>
            )}
          </div>

          {/* Ticket info */}
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">{data?.event_name}</h2>
              {data?.status === 'valid' && (
                <span className="badge bg-green-500/10 text-green-300 border border-green-500/20">
                  <CheckCircle2 size={14} /> Válida
                </span>
              )}
              {data?.status === 'used' && (
                <span className="badge bg-blue-500/10 text-blue-300 border border-blue-500/20">
                  Usada
                </span>
              )}
              {data?.status === 'cancelled' && (
                <span className="badge bg-red-500/10 text-red-300 border border-red-500/20">
                  Cancelada
                </span>
              )}
            </div>

            <p className="text-lg font-semibold text-cyan-400 mb-4">{data?.attendee_name || 'Invitado'}</p>

            <div className="space-y-2 text-sm text-slate-300">
              <div className="flex items-center gap-2">
                <Calendar size={16} className="text-slate-500" />
                {data?.event_date}
                {data?.event_time && <span className="text-slate-400">- {data.event_time} {data.am_pm || ''}</span>}
              </div>
              {data?.location && (
                <div className="flex items-center gap-2">
                  <MapPin size={16} className="text-slate-500" /> {data.location}
                </div>
              )}
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-slate-500" />
                <span className="font-mono text-xs text-slate-400">{data?.code}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
