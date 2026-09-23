import { useState, useEffect } from 'react';
import { ShieldAlert, LogOut, Ticket, Plus, Loader2, ArrowLeft } from 'lucide-react';
import { supabase, type Event } from '@/lib/supabase';
import { generateTicketCode } from '@/lib/constants';
import { downloadTicketImage, downloadTicketPDF } from '@/lib/ticketArt';

export function SupportDashboard({ onLogout }: { onLogout: () => void }) {
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [loadingEvents, setLoadingEvents] = useState(true);

  // Formulario para crear la entrada fantasma/cortesía
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [createdTicket, setCreatedTicket] = useState<{ code: string; attendeeName: string; guestPhone: string; event: Event } | null>(null);
  const [actionLoading, setActionLoading] = useState<string>('');

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    setLoadingEvents(true);
    // Soporte técnico puede ver todos los eventos del sistema para emitir cortesías
    const { data, error } = await supabase.from('events').select('*').order('created_at', { ascending: false });
    if (!error && data) {
      setEvents(data);
      if (data.length > 0) setSelectedEventId(data[0].id);
    }
    setLoadingEvents(false);
  };

  const handleCreateCourtesy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !selectedEventId) return;
    setLoading(true);
    setError('');

    const targetEvent = events.find(ev => ev.id === selectedEventId);
    if (!targetEvent) {
      setError('Selecciona un evento válido.');
      setLoading(false);
      return;
    }

    const code = generateTicketCode(targetEvent.id);
    const cleanPhone = phone.trim() || '';

    // Insertamos la entrada con un identificador o flag especial si la base de datos lo soporta, 
    // o simplemente como un ticket regular pero gestionado desde la interfaz de soporte.
    const { error: insertErr } = await supabase.from('tickets').insert({
      event_id: targetEvent.id,
      code,
      attendee_name: `[CORTESÍA SOPORTE] ${name.trim()}`,
      guest_phone: cleanPhone,
    });

    if (insertErr) {
      setError(insertErr.message);
      setLoading(false);
      return;
    }

    setCreatedTicket({
      code,
      attendeeName: name.trim(),
      guestPhone: cleanPhone,
      event: targetEvent,
    });
    setName('');
    setPhone('');
    setLoading(false);
  };

  const handleWhatsApp = () => {
    if (!createdTicket) return;
    const ticketUrl = `${window.location.origin}/#ticket/${createdTicket.code}`;
    const ev = createdTicket.event;
    const eventDateStr = `${ev.event_date || ''} ${ev.event_time ? `- ${ev.event_time}${ev.am_pm || ''}` : ''}`;

    const textMsg = `Hola *${createdTicket.attendeeName}*, aquí tienes tu pase de cortesía exclusivo para *${ev.name}*.\n\n` +
      `🎟️ *Código:* ${createdTicket.code}\n` +
      `📅 *Fecha:* ${eventDateStr}\n` +
      `📍 *Lugar:* ${ev.location || 'Por confirmar'}\n\n` +
      `🔗 *Ver tu entrada:* ${ticketUrl}\n\n` +
      `Presenta este pase en el ingreso.`;

    const msg = encodeURIComponent(textMsg);
    const cleanPhone = createdTicket.guestPhone ? createdTicket.guestPhone.replace(/\D/g, '') : '';
    const link = cleanPhone ? `https://wa.me/${cleanPhone}?text=${msg}` : `https://wa.me/?text=${msg}`;
    window.open(link, '_blank');
  };

  const handlePDF = async () => {
    if (!createdTicket) return;
    setActionLoading('pdf');
    const ev = createdTicket.event;
    await downloadTicketPDF({
      code: createdTicket.code,
      attendeeName: createdTicket.attendeeName,
      eventName: `${ev.name} (Cortesía)`,
      eventDate: ev.event_date,
      eventTime: ev.event_time,
      amPm: ev.am_pm,
      location: ev.location,
    });
    setActionLoading('');
  };

  const handleImage = async () => {
    if (!createdTicket) return;
    setActionLoading('img');
    const ev = createdTicket.event;
    await downloadTicketImage({
      code: createdTicket.code,
      attendeeName: createdTicket.attendeeName,
      eventName: ev.name,
      eventDate: ev.event_date,
      eventTime: ev.event_time,
      amPm: ev.am_pm,
      location: ev.location,
      bgImageUrl: ev.bg_image_url,
      qrPosX: ev.qr_pos_x,
      qrPosY: ev.qr_pos_y,
      qrSize: ev.qr_size,
    });
    setActionLoading('');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navbar */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <ShieldAlert size={22} />
          </div>
          <div>
            <h1 className="font-bold text-lg text-white">Panel de Soporte Técnico</h1>
            <p className="text-xs text-slate-400">Emisión de pases de cortesía y gestión de incidencias</p>
          </div>
        </div>
        <button 
          onClick={onLogout} 
          className="btn-secondary text-xs flex items-center gap-2 py-2 px-4 hover:border-red-500/40 hover:text-red-400"
        >
          <LogOut size={16} /> Salir del sistema
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-6 space-y-6">
        <div className="card p-6 border-cyan-500/20 bg-cyan-950/5">
          <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
            <Ticket className="text-cyan-400" size={20} /> Generador de Entradas de Cortesía (Soporte)
          </h2>
          <p className="text-sm text-slate-400 mb-6">
            Crea pases especiales que permiten el acceso directo por puerta sin alterar los reportes oficiales ni el panel del organizador principal.
          </p>

          {loadingEvents ? (
            <div className="flex justify-center py-8"><Loader2 className="animate-spin text-cyan-400" size={24} /></div>
          ) : events.length === 0 ? (
            <div className="text-center py-8 text-slate-400">No hay eventos registrados en la plataforma actualmente.</div>
          ) : (
            <form onSubmit={handleCreateCourtesy} className="space-y-4">
              {error && <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>}
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Seleccionar Evento</label>
                <select 
                  value={selectedEventId} 
                  onChange={e => setSelectedEventId(e.target.value)}
                  className="input-field"
                >
                  {events.map(ev => (
                    <option key={ev.id} value={ev.id} className="bg-slate-900 text-white">
                      {ev.name} ({ev.event_date})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Nombre del invitado de cortesía</label>
                  <input 
                    value={name} 
                    onChange={e => setName(e.target.value)} 
                    required 
                    className="input-field" 
                    placeholder="Ej. Invitado Especial / Prensa" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Teléfono WhatsApp (Opcional)</label>
                  <input 
                    value={phone} 
                    onChange={e => setPhone(e.target.value)} 
                    className="input-field" 
                    placeholder="921543755" 
                  />
                </div>
              </div>

              <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2 mt-2">
                {loading ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />} Generar pase de cortesía
              </button>
            </form>
          )}
        </div>

        {createdTicket && (
          <div className="card p-6 border-green-500/30 bg-green-950/10 animate-fade-in space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs uppercase tracking-wider text-green-400 font-bold">¡Cortesía generada con éxito!</span>
                <h3 className="text-xl font-bold text-white">{createdTicket.attendeeName}</h3>
              </div>
              <span className="font-mono text-sm bg-slate-900 px-3 py-1 rounded border border-slate-800 text-cyan-400">
                {createdTicket.code}
              </span>
            </div>
            <p className="text-xs text-slate-400">Evento: <strong className="text-slate-200">{createdTicket.event.name}</strong></p>

            <div className="flex flex-wrap gap-3 pt-2">
              <button onClick={handleWhatsApp} className="flex-1 px-4 py-3 rounded-xl font-semibold text-sm bg-green-500/10 text-green-300 border border-green-500/20 hover:bg-green-500/20 transition-all flex items-center justify-center gap-2">
                Enviar por WhatsApp
              </button>
              <button onClick={handlePDF} disabled={!!actionLoading} className="flex-1 px-4 py-3 rounded-xl font-semibold text-sm bg-red-500/10 text-red-300 border border-red-500/20 hover:bg-red-500/20 transition-all disabled:opacity-40 flex items-center justify-center gap-2">
                {actionLoading === 'pdf' ? <Loader2 size={16} className="animate-spin" /> : 'Descargar PDF'}
              </button>
              <button onClick={handleImage} disabled={!!actionLoading} className="flex-1 px-4 py-3 rounded-xl font-semibold text-sm bg-blue-500/10 text-blue-300 border border-blue-500/20 hover:bg-blue-500/20 transition-all disabled:opacity-40 flex items-center justify-center gap-2">
                {actionLoading === 'img' ? <Loader2 size={16} className="animate-spin" /> : 'Descargar Imagen'}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}