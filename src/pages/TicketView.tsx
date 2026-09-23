import { useEffect, useState } from 'react';
import { Calendar, MapPin, AlertCircle, Loader2, QrCode } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import VPassLogo from '@/components/VPassLogo';

interface Props {
  code: string;
}

export default function TicketView({ code }: Props) {
  const [ticket, setTicket] = useState<any>(null);
  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTicketData = async () => {
      try {
        const { data: ticketData, error: ticketErr } = await supabase
          .from('tickets')
          .select('*')
          .eq('code', code.trim())
          .single();

        if (ticketErr || !ticketData) {
          setLoading(false);
          return;
        }

        setTicket(ticketData);

        const { data: eventData } = await supabase
          .from('events')
          .select('*')
          .eq('id', ticketData.event_id)
          .single();

        if (eventData) {
          setEvent(eventData);
        }
      } catch (err) {
        console.error("Error al cargar ticket:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchTicketData();
  }, [code]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-cyan-400 gap-3">
        <Loader2 size={32} className="animate-spin" />
        <p className="text-sm text-slate-400 font-medium">Validando entrada...</p>
      </div>
    );
  }

  if (!ticket || !event) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="card max-w-md w-full p-8 text-center space-y-4 border border-slate-800 bg-slate-900/90 backdrop-blur-xl">
          <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center mx-auto text-red-400">
            <AlertCircle size={32} />
          </div>
          <h2 className="text-xl font-bold text-white">Enlace inválido o expirado</h2>
          <p className="text-sm text-slate-400">Este pase no existe o el código de acceso es incorrecto.</p>
          <a href="/" className="btn-primary inline-flex items-center justify-center w-full py-3">
            Volver al inicio
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-grid pointer-events-none" />
      {event.bg_image_url && (
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-20 blur-xl pointer-events-none" 
          style={{ backgroundImage: `url(${event.bg_image_url})` }} 
        />
      )}

      <div className="relative z-10 w-full max-w-sm">
        <div className="text-center mb-6">
          <VPassLogo size="sm" />
        </div>

        <div className="relative rounded-3xl overflow-hidden border border-cyan-500/40 shadow-2xl bg-slate-950 p-6 text-center">
          {event.bg_image_url && (
            <div className="absolute inset-0 z-0">
              <img src={event.bg_image_url} alt="Flyer" className="w-full h-full object-cover opacity-60 filter brightness-90" />
              <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-[2px]" />
            </div>
          )}

          <div className="relative z-10 space-y-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-cyan-400">V-PASS TICKET DIGITAL</span>
              <h2 className="text-lg font-extrabold text-white mt-1 text-shadow">{event.name}</h2>
            </div>

            <div className="p-3 bg-white rounded-2xl inline-block shadow-2xl border border-white/20">
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${ticket.code}`} 
                alt="QR Code" 
                className="w-40 h-40 mx-auto rounded-lg"
              />
            </div>

            <div>
              <p className="text-xl font-bold text-white text-shadow">{ticket.attendee_name || 'Invitado'}</p>
              <div className="flex items-center justify-center gap-1.5 text-xs text-cyan-200 mt-1 font-medium">
                <Calendar size={14} className="text-cyan-400" />
                <span>{event.event_date || ''} {event.event_time ? `• ${event.event_time} ${event.am_pm || ''}` : ''}</span>
              </div>
              {event.location && (
                <div className="flex items-center justify-center gap-1.5 text-xs text-slate-200 mt-1">
                  <MapPin size={14} className="text-green-400" />
                  <span>{event.location}</span>
                </div>
              )}
            </div>

            <div className="pt-1">
              <span className="font-mono text-xs bg-slate-950/90 text-cyan-300 px-3 py-1.5 rounded-lg border border-cyan-500/40 inline-block shadow">
                Código: {ticket.code}
              </span>
            </div>

            <div className="pt-2">
              <div className="w-full py-2.5 px-4 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-medium flex items-center justify-center gap-2">
                <QrCode size={16} /> Pase válido solo en pantalla
              </div>
            </div>
          </div>
        </div>

        <p className="text-center text-[11px] text-slate-500 mt-4">
          Muestra este código QR directamente desde este enlace en la puerta del evento.
        </p>
      </div>
    </div>
  );
}