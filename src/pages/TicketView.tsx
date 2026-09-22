import { useEffect, useState } from 'react';
import { Ticket as TicketIcon, Calendar, MapPin, Download, FileText, Image as ImageIcon, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import VPassLogo from '@/components/VPassLogo';

interface Props {
  code: string;
}

export default function TicketView({ code }: Props) {
  const [ticket, setTicket] = useState<any>(null);
  const [event, setEvent] = useState<any>(null);
  const [agency, setAgency] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    const fetchTicketData = async () => {
      try {
        // Buscamos el ticket por su código único
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

        // Buscamos el evento asociado
        const { data: eventData } = await supabase
          .from('events')
          .select('*')
          .eq('id', ticketData.event_id)
          .single();

        if (eventData) {
          setEvent(eventData);

          // Buscamos la agencia organizadora
          const { data: agencyData } = await supabase
            .from('agencies')
            .select('*')
            .eq('id', eventData.agency_id)
            .single();

          if (agencyData) {
            setAgency(agencyData);
          }
        }
      } catch (err) {
        console.error("Error al cargar ticket:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchTicketData();
  }, [code]);

  const downloadImage = async () => {
    if (!ticket || !event) return;
    setActionLoading(true);
    try {
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${ticket.code}`;
      const res = await fetch(qrUrl);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Entrada-${ticket.attendee_name || 'invitado'}-${ticket.code}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert("No se pudo descargar la imagen.");
    } finally {
      setActionLoading(false);
    }
  };

  const downloadPDF = () => {
    if (!ticket || !event) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Por favor, permite las ventanas emergentes para generar el PDF.");
      return;
    }

    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${ticket.code}`;
    const bgImage = event.bg_image_url || '';

    printWindow.document.write(`
      <html>
        <head>
          <title>Entrada - ${ticket.attendee_name}</title>
          <style>
            body { font-family: Arial, sans-serif; background: #090d16; color: #fff; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
            .ticket-card {
              position: relative;
              width: 340px;
              border-radius: 20px;
              overflow: hidden;
              border: 2px solid #38bdf8;
              box-shadow: 0 15px 35px rgba(0,0,0,0.9);
              background: ${bgImage ? `url(${bgImage}) center/cover no-repeat` : '#1e293b'};
              text-align: center;
              padding: 30px 20px;
            }
            .overlay {
              position: absolute;
              inset: 0;
              background: rgba(15, 23, 42, 0.82);
              z-index: 1;
            }
            .content {
              position: relative;
              z-index: 2;
            }
            h2 { color: #38bdf8; margin: 0 0 5px 0; font-size: 22px; text-transform: uppercase; letter-spacing: 1px; }
            .event-name { font-size: 15px; color: #94a3b8; margin-bottom: 20px; font-weight: 600; }
            .qr-container { background: #fff; padding: 12px; border-radius: 14px; display: inline-block; margin-bottom: 15px; box-shadow: 0 8px 20px rgba(0,0,0,0.5); }
            .qr-container img { width: 160px; height: 160px; display: block; }
            .attendee { font-size: 20px; font-weight: bold; color: #fff; margin: 10px 0 5px 0; }
            .details { font-size: 13px; color: #cbd5e1; margin-bottom: 15px; }
            .code-badge { font-family: monospace; background: #0f172a; border: 1px solid rgba(56, 189, 248, 0.4); padding: 8px 14px; border-radius: 8px; color: #38bdf8; font-size: 13px; display: inline-block; }
          </style>
        </head>
        <body>
          <div class="ticket-card">
            ${bgImage ? '<div class="overlay"></div>' : ''}
            <div class="content">
              <h2>V-PASS TICKET</h2>
              <div class="event-name">${event.name}</div>
              <div class="qr-container">
                <img src="${qrUrl}" />
              </div>
              <div class="attendee">${ticket.attendee_name || 'Invitado'}</div>
              <div class="details">📅 ${event.event_date || ''} ${event.event_time ? `• ${event.event_time}${event.am_pm || ''}` : ''}</div>
              <div class="code-badge">Código: ${ticket.code}</div>
            </div>
          </div>
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

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
          className="absolute inset-0 bg-cover bg-center opacity-15 blur-2xl pointer-events-none" 
          style={{ backgroundImage: `url(${event.bg_image_url})` }} 
        />
      )}

      <div className="relative z-10 w-full max-w-sm">
        <div className="text-center mb-6">
          <VPassLogo size="sm" />
        </div>

        {/* Tarjeta del Ticket con fondo adaptado */}
        <div 
          className="card relative overflow-hidden text-center p-6 border border-slate-700/80 shadow-2xl bg-cover bg-center"
          style={event.bg_image_url ? { backgroundImage: `url(${event.bg_image_url})` } : { backgroundColor: '#1e293b' }}
        >
          {event.bg_image_url && <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md" />}
          
          <div className="relative z-10 space-y-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-cyan-400">V-PASS TICKET</span>
              <h2 className="text-lg font-extrabold text-white mt-1">{event.name}</h2>
            </div>

            <div className="p-3.5 bg-white rounded-2xl inline-block shadow-xl border border-white/20">
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${ticket.code}`} 
                alt="QR Code" 
                className="w-40 h-40 mx-auto rounded-lg"
              />
            </div>

            <div>
              <p className="text-xl font-bold text-white">{ticket.attendee_name || 'Invitado'}</p>
              <div className="flex items-center justify-center gap-2 text-xs text-slate-300 mt-1.5">
                <Calendar size={14} className="text-cyan-400" />
                <span>{event.event_date || ''} {event.event_time ? `• ${event.event_time} ${event.am_pm || ''}` : ''}</span>
              </div>
              {event.location && (
                <div className="flex items-center justify-center gap-2 text-xs text-slate-300 mt-1">
                  <MapPin size={14} className="text-green-400" />
                  <span>{event.location}</span>
                </div>
              )}
            </div>

            <div className="pt-2">
              <span className="font-mono text-xs bg-slate-950/80 text-cyan-300 px-3 py-1.5 rounded-lg border border-cyan-500/30 inline-block">
                Código: {ticket.code}
              </span>
            </div>

            <div className="flex gap-2 pt-2">
              <button 
                onClick={downloadImage} 
                disabled={actionLoading}
                className="btn-secondary flex-1 text-xs py-2.5 flex items-center justify-center gap-1.5 shadow-md"
              >
                <ImageIcon size={14} /> Imagen
              </button>
              <button 
                onClick={downloadPDF} 
                disabled={actionLoading}
                className="btn-primary flex-1 text-xs py-2.5 flex items-center justify-center gap-1.5 shadow-md"
              >
                <FileText size={14} /> PDF
              </button>
            </div>
          </div>
        </div>

        <p className="text-center text-[11px] text-slate-500 mt-4">
          Presenta este código QR en la entrada del evento. No lo compartas con nadie.
        </p>
      </div>
    </div>
  );
}