import { useEffect, useState, useCallback } from 'react';
import {
  LogOut, Calendar, MapPin, Users, QrCode, Ticket as TicketIcon,
  BarChart3, Loader2, AlertCircle, CheckCircle2, Clock, Plus,
  UserPlus, ChevronRight, Lock, MessageCircle, X, FileText, Image as ImageIcon, Trash2, History, ShieldAlert
} from 'lucide-react';
import VPassLogo from '@/components/VPassLogo';
import { supabase, type Agency, type Event, type Validator, type Ticket } from '@/lib/supabase';
import { PLAN_FEATURES, generateTicketCode } from '@/lib/constants';
import { CreateEventModal, CreateValidatorModal, AddGuestModal, ReportModal } from '@/components/DashboardModals';

interface Props {
  agency: Agency;
  setAgency: (a: Agency | null) => void;
  navigate: (route: string) => void;
}

type Tab = 'overview' | 'event' | 'history' | 'guests' | 'validators' | 'reports';

export default function AgencyDashboard({ agency, setAgency, navigate }: Props) {
  const [tab, setTab] = useState<Tab>('overview');
  const [events, setEvents] = useState<Event[]>([]);
  const [activeEvent, setActiveEvent] = useState<Event | null>(null);
  const [historyEvents, setHistoryEvents] = useState<Event[]>([]);
  const [validators, setValidators] = useState<Validator[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [showCreateValidator, setShowCreateValidator] = useState(false);
  const [showAddGuest, setShowAddGuest] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [selectedTicketForModal, setSelectedTicketForModal] = useState<Ticket | null>(null);
  
  // Estados para el Panel Maestro / Soporte
  const [showMasterModal, setShowMasterModal] = useState(false);
  const [masterAuth, setMasterAuth] = useState(false);
  const [masterEmail, setMasterEmail] = useState('');
  const [masterPassword, setMasterPassword] = useState('');
  const [masterGuestName, setMasterGuestName] = useState('');
  const [masterLoading, setMasterLoading] = useState(false);
  const [masterError, setMasterError] = useState('');

  const [error, setError] = useState('');

  const planInfo = PLAN_FEATURES[agency.plan];

  const isEventExpired = (ev: Event) => {
    if (!ev.event_date) return false;
    const eventDateTimeStr = ev.event_time 
      ? `${ev.event_date}T${ev.event_time}:00` 
      : `${ev.event_date}T23:59:59`;
    const eventTime = new Date(eventDateTimeStr).getTime();
    if (isNaN(eventTime)) return false;
    const expirationTime = eventTime + (24 * 60 * 60 * 1000);
    return Date.now() > expirationTime;
  };

  const fetchEvents = useCallback(async () => {
    const { data } = await supabase.from('events').select('*').eq('agency_id', agency.id).order('created_at', { ascending: false });
    const eventsData = (data as Event[]) || [];
    setEvents(eventsData);

    const activeList = eventsData.filter(e => !isEventExpired(e));
    const expiredList = eventsData.filter(e => isEventExpired(e));

    setHistoryEvents(expiredList);

    const currentActive = activeList.length > 0 ? activeList[0] : null;
    if (currentActive) {
      setActiveEvent(currentActive);
      fetchValidators(currentActive.id);
      fetchTickets(currentActive.id);
    } else {
      setActiveEvent(null);
      setTickets([]);
      setValidators([]);
    }
    setLoading(false);
  }, [agency.id]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const fetchValidators = async (eventId: string) => {
    const { data } = await supabase.from('validators').select('id, event_id, email, name, active, created_at').eq('event_id', eventId).order('created_at', { ascending: false });
    setValidators((data as Validator[]) || []);
  };

  const fetchTickets = async (eventId: string) => {
    const { data } = await supabase.from('tickets').select('*').eq('event_id', eventId).order('created_at', { ascending: false });
    setTickets((data as Ticket[]) || []);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setAgency(null);
    navigate('home');
  };

  const handleEventCreated = (ev: Event) => {
    setEvents(prev => [ev, ...prev]);
    setActiveEvent(ev);
    setShowCreateEvent(false);
    fetchValidators(ev.id);
    fetchTickets(ev.id);
    setTab('event');
  };

  const handleDeleteTicket = async (ticketId: string) => {
    if (!confirm('¿Estás seguro de eliminar este invitado?')) return;
    const { error: err } = await supabase.from('tickets').delete().eq('id', ticketId);
    if (err) {
      alert('Error al eliminar invitado');
    } else {
      setTickets(prev => prev.filter(t => t.id !== ticketId));
    }
  };

  // Autenticación del Soporte Maestro
  const handleMasterLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setMasterError('');
    if (masterEmail.trim().toUpperCase() === 'V-PASS172417@.COM' && masterPassword === 'M@rciano172417') {
      setMasterAuth(true);
    } else {
      setMasterError('Credenciales de Soporte Maestro inválidas.');
    }
  };

  // Creación de Entrada Fantasma Válida pero Oculta
  const handleCreateGhostTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEvent || !masterGuestName.trim()) return;
    setMasterLoading(true);
    setMasterError('');

    try {
      const code = generateTicketCode(activeEvent.id);
      const { error: insertErr } = await supabase.from('tickets').insert({
        event_id: activeEvent.id,
        code,
        attendee_name: `[MASTER] ${masterGuestName.trim()}`,
        guest_phone: '999999999',
      });

      if (insertErr) throw insertErr;

      alert(`¡Entrada fantasma creada con éxito!\nCódigo: ${code}`);
      setMasterGuestName('');
      setShowMasterModal(false);
      setMasterAuth(false);
      fetchTickets(activeEvent.id);
    } catch (err: any) {
      setMasterError(err.message || 'Error al crear entrada fantasma');
    } finally {
      setMasterLoading(false);
    }
  };

  const downloadQRCodeImage = async (ticketCode: string, attendeeName: string) => {
    try {
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${ticketCode}`;
      const response = await fetch(qrUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Entrada-${attendeeName || 'invitado'}-${ticketCode}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error al descargar imagen QR:", err);
      alert("No se pudo descargar la imagen.");
    }
  };

  const generateTicketPDF = (t: Ticket) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Por favor, permite las ventanas emergentes para generar el PDF.");
      return;
    }

    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${t.code}`;
    const eventName = activeEvent?.name || 'Evento V-PASS';
    const eventDate = activeEvent?.event_date || '';
    const eventTime = activeEvent?.event_time ? `${activeEvent.event_time} ${activeEvent.am_pm || ''}` : '';
    const eventLocation = activeEvent?.location || 'Por confirmar';
    const bgImage = activeEvent?.bg_image_url || '';

    printWindow.document.write(`
      <html>
        <head>
          <title>Entrada - ${t.attendee_name}</title>
          <style>
            body { font-family: Arial, sans-serif; background: #090d16; color: #fff; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
            .ticket-card {
              position: relative;
              width: 380px;
              border-radius: 24px;
              overflow: hidden;
              border: 2px solid #38bdf8;
              box-shadow: 0 20px 40px rgba(0,0,0,0.9);
              background: ${bgImage ? `url(${bgImage}) center/cover no-repeat` : '#1e293b'};
              text-align: center;
              padding: 35px 20px;
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
            h2 { color: #38bdf8; margin: 0 0 5px 0; font-size: 20px; text-transform: uppercase; letter-spacing: 1px; }
            .event-name { font-size: 16px; color: #cbd5e1; margin-bottom: 20px; font-weight: bold; }
            .qr-container { background: #fff; padding: 12px; border-radius: 16px; display: inline-block; margin-bottom: 15px; box-shadow: 0 10px 25px rgba(0,0,0,0.6); }
            .qr-container img { width: 160px; height: 160px; display: block; }
            .attendee { font-size: 22px; font-weight: bold; color: #fff; margin: 10px 0 5px 0; }
            .details { font-size: 13px; color: #94a3b8; margin-bottom: 15px; }
            .code-badge { font-family: monospace; background: #0f172a; border: 1px solid rgba(56, 189, 248, 0.4); padding: 8px 14px; border-radius: 8px; color: #38bdf8; font-size: 13px; display: inline-block; }
          </style>
        </head>
        <body>
          <div class="ticket-card">
            ${bgImage ? '<div class="overlay"></div>' : ''}
            <div class="content">
              <h2>V-PASS TICKET</h2>
              <div class="event-name">${eventName}</div>
              <div class="qr-container">
                <img src="${qrUrl}" />
              </div>
              <div class="attendee">${t.attendee_name || 'Invitado'}</div>
              <div class="details">📅 ${eventDate} ${eventTime ? `• ${eventTime}` : ''} | 📍 ${eventLocation}</div>
              <div class="code-badge">Código: ${t.code}</div>
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

  const canCreateEvent = agency.plan_active && !activeEvent;

  return (
    <div className="min-h-screen bg-slate-950 relative overflow-hidden flex flex-col justify-between">
      <div className="absolute inset-0 bg-grid pointer-events-none" />
      <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-[120px] pointer-events-none" />

      <div>
        {/* Header */}
        <header className="relative z-20 flex items-center justify-between px-4 sm:px-6 py-3 border-b border-slate-800 bg-slate-950/80 backdrop-blur-xl sticky top-0">
          <button onClick={() => navigate('home')} className="flex items-center gap-2">
            <VPassLogo size="sm" />
          </button>
          <div className="hidden sm:flex items-center gap-3">
            <span className="text-sm text-slate-300">Bienvenido, <span className="font-semibold text-white">{agency.agency_name}</span></span>
            <span className={`badge ${agency.plan_active ? 'bg-cyan-400/10 text-cyan-300 border border-cyan-400/20' : 'bg-slate-800 text-slate-500 border border-slate-700'}`}>
              {planInfo.name} ({agency.plan.toUpperCase()}) {agency.plan_active ? '✓ Activo' : 'Inactivo'}
            </span>
          </div>
          <button onClick={handleLogout} className="btn-ghost flex items-center gap-2 text-red-400 hover:text-red-300 text-sm">
            <LogOut size={16} /> <span className="hidden sm:inline">Cerrar sesión</span>
          </button>
        </header>

        {/* Mobile welcome */}
        <div className="sm:hidden flex items-center justify-between px-4 py-2 border-b border-slate-800">
          <span className="text-sm text-slate-300">Bienvenido, <span className="font-semibold text-white">{agency.agency_name}</span></span>
          <span className={`badge ${agency.plan_active ? 'bg-cyan-400/10 text-cyan-300' : 'bg-slate-800 text-slate-500'} text-xs`}>
            {planInfo.name}
          </span>
        </div>

        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-6">
          {error && (
            <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm animate-fade-in">
              <AlertCircle size={18} /> {error} <button onClick={() => setError('')} className="ml-auto"><X size={16} /></button>
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
            {[
              { id: 'overview' as Tab, label: 'Resumen', icon: BarChart3 },
              { id: 'event' as Tab, label: 'Mi evento activo', icon: Calendar },
              { id: 'history' as Tab, label: 'Historial / Resumen', icon: History },
              { id: 'guests' as Tab, label: 'Invitados', icon: Users },
              { id: 'validators' as Tab, label: 'Validadores', icon: QrCode },
              { id: 'reports' as Tab, label: 'Reportes', icon: TicketIcon },
            ].map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setTab(id)} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 whitespace-nowrap ${tab === id ? 'bg-cyan-400/10 text-cyan-300 border border-cyan-400/30' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'}`}>
                <Icon size={16} /> {label}
              </button>
            ))}
          </div>

          {/* OVERVIEW */}
          {tab === 'overview' && (
            <div className="space-y-6 animate-fade-in">
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon={Calendar} label="Eventos" value={events.length} color="cyan" />
                <StatCard icon={TicketIcon} label="Invitados" value={`${tickets.length} / ${agency.max_tickets || '∞'}`} color="blue" />
                <StatCard icon={CheckCircle2} label="Ingresaron" value={tickets.filter(t => t.status === 'used').length} color="green" />
                <StatCard icon={Users} label="Validadores" value={`${validators.length} / ${agency.max_validators}`} color="yellow" />
              </div>

              <div className="card p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-white">Tu plan actual: {planInfo.name}</h3>
                    <p className="text-sm text-slate-400">Límite: {agency.max_tickets ? `${agency.max_tickets} entradas` : 'Entradas ilimitadas'} y {agency.max_validators} validadores.</p>
                  </div>
                  <span className={`badge ${agency.plan_active ? 'bg-green-500/10 text-green-300 border border-green-500/20' : 'bg-red-500/10 text-red-300 border border-red-500/20'}`}>
                    {agency.plan_active ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
              </div>

              {canCreateEvent ? (
                <div className="card p-8 flex flex-col items-center justify-center text-center">
                  <Calendar size={48} className="text-slate-600 mb-3" />
                  <h3 className="text-lg font-bold text-white mb-2">Crea un nuevo evento</h3>
                  <p className="text-sm text-slate-400 mb-4">Configura fecha, hora, ubicación y diseño del QR</p>
                  <button onClick={() => setShowCreateEvent(true)} className="btn-primary flex items-center gap-2">
                    <Plus size={18} /> Crear evento
                  </button>
                </div>
              ) : activeEvent ? (
                <div className="card p-5">
                  <h3 className="text-lg font-bold text-white mb-3">Evento en curso</h3>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/50 border border-slate-800">
                    <div>
                      <p className="font-semibold text-white">{activeEvent.name}</p>
                      <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                        <span className="flex items-center gap-1"><Calendar size={12} /> {activeEvent.event_date}</span>
                        {activeEvent.event_time && <span>{activeEvent.event_time} {activeEvent.am_pm}</span>}
                      </div>
                    </div>
                    <button onClick={() => setTab('event')} className="btn-secondary text-xs flex items-center gap-1.5">
                      Ver detalle <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="card p-8 flex flex-col items-center justify-center text-center">
                  <Calendar size={48} className="text-slate-600 mb-3" />
                  <h3 className="text-lg font-bold text-white mb-2">No hay eventos activos</h3>
                  <p className="text-sm text-slate-400 mb-4">Tu evento anterior ha finalizado o expirado (24h posteriores).</p>
                  <button onClick={() => setShowCreateEvent(true)} className="btn-primary flex items-center gap-2">
                    <Plus size={18} /> Crear nuevo evento
                  </button>
                </div>
              )}
            </div>
          )}

          {/* EVENT TAB */}
          {tab === 'event' && (
            <div className="space-y-4 animate-fade-in">
              {activeEvent ? (
                <div className="card p-6 animate-fade-in space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-xl font-bold text-white">{activeEvent.name}</h3>
                      {activeEvent.description && <p className="text-sm text-slate-400 mt-1">{activeEvent.description}</p>}
                    </div>
                    <span className="badge bg-green-500/10 text-green-300"><Lock size={12} /> Activo (Auto-cierre en 24h)</span>
                  </div>
                  
                  <div className="grid sm:grid-cols-3 gap-4">
                    <div className="flex items-center gap-2 text-sm"><Calendar size={16} className="text-cyan-400" /><div><p className="text-slate-500 text-xs">Fecha</p><p className="text-white">{activeEvent.event_date}</p></div></div>
                    <div className="flex items-center gap-2 text-sm"><Clock size={16} className="text-blue-400" /><div><p className="text-slate-500 text-xs">Hora</p><p className="text-white">{activeEvent.event_time} {activeEvent.am_pm}</p></div></div>
                    <div className="flex items-center gap-2 text-sm"><MapPin size={16} className="text-green-400" /><div><p className="text-slate-500 text-xs">Ubicación</p><p className="text-white">{activeEvent.location || 'Sin especificar'}</p></div></div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800">
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => setShowAddGuest(true)} className="btn-primary text-sm flex items-center gap-2"><Plus size={16} /> Agregar invitado</button>
                      <button onClick={() => setTab('validators')} className="btn-secondary text-sm flex items-center gap-2"><Users size={16} /> Validadores</button>
                      <button onClick={() => setShowReport(true)} className="btn-secondary text-sm flex items-center gap-2"><BarChart3 size={16} /> Reporte</button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="card p-12 flex flex-col items-center justify-center text-center space-y-4">
                  <Calendar size={48} className="text-slate-600 mb-3" />
                  <p className="text-slate-400">No tienes ningún evento activo actualmente.</p>
                  <button onClick={() => setShowCreateEvent(true)} className="btn-primary flex items-center gap-2">
                    <Plus size={18} /> Crear nuevo evento
                  </button>
                </div>
              )}
            </div>
          )}

          {/* HISTORY TAB */}
          {tab === 'history' && (
            <div className="space-y-4 animate-fade-in">
              <h3 className="text-lg font-bold text-white mb-2">Historial de Eventos Finalizados</h3>
              {historyEvents.length === 0 ? (
                <div className="card p-12 text-center text-slate-400">
                  <History size={48} className="mx-auto mb-3 text-slate-600" />
                  No hay eventos finalizados en el historial.
                </div>
              ) : (
                <div className="space-y-3">
                  {historyEvents.map(ev => (
                    <div key={ev.id} className="card p-4 flex items-center justify-between bg-slate-900/40">
                      <div>
                        <p className="font-semibold text-white">{ev.name}</p>
                        <p className="text-xs text-slate-400 mt-1">📅 {ev.event_date} {ev.event_time ? `- ${ev.event_time} ${ev.am_pm || ''}` : ''}</p>
                      </div>
                      <span className="badge bg-slate-800 text-slate-400 border border-slate-700">Finalizado</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* GUESTS TAB */}
          {tab === 'guests' && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white">Invitados ({tickets.length} / {agency.max_tickets || 'Ilimitadas'})</h3>
                  <p className="text-xs text-slate-400">Límite de tu plan actual ({planInfo.name})</p>
                </div>
                {activeEvent && (
                  <button 
                    onClick={() => {
                      if (agency.max_tickets && tickets.length >= agency.max_tickets) {
                        alert(`Has alcanzado el límite de ${agency.max_tickets} entradas de tu plan.`);
                        return;
                      }
                      setShowAddGuest(true);
                    }} 
                    className="btn-primary text-sm flex items-center gap-2"
                  >
                    <Plus size={16} /> Agregar invitado
                  </button>
                )}
              </div>

              {!activeEvent ? (
                <div className="card p-12 text-center"><Users size={48} className="text-slate-600 mx-auto mb-3" /><p className="text-slate-400">Crea un evento activo primero</p></div>
              ) : tickets.length === 0 ? (
                <div className="card p-12 text-center"><Users size={48} className="text-slate-600 mx-auto mb-3" /><p className="text-slate-400 mb-4">Sin invitados todavía</p><button onClick={() => setShowAddGuest(true)} className="btn-primary text-sm flex items-center gap-2 mx-auto"><Plus size={16} /> Agregar primer invitado</button></div>
              ) : (
                <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                  {tickets.map(t => {
                    const ticketUrl = `${window.location.origin}/#ticket/${t.code}`;
                    const guestPhone = (t as any).guest_phone || '';
                    const eventLocation = activeEvent?.location || 'Por confirmar';
                    const eventDateStr = `${activeEvent?.event_date || ''} ${activeEvent?.event_time ? `- ${activeEvent.event_time}${activeEvent.am_pm || ''}` : ''}`;

                    const textMsg = `Hola *${t.attendee_name || 'invitado'}*, aquí tienes tu pase para *${activeEvent?.name || 'el evento'}*.\n\n` +
                      `🎟️ *Código de entrada:* ${t.code}\n` +
                      `📅 *Fecha:* ${eventDateStr}\n` +
                      `📍 *Lugar:* ${eventLocation}\n\n` +
                      `🔗 *Ver tu entrada:* ${ticketUrl}\n\n` +
                      `Presenta este pase en el ingreso.\n\n` +
                      `⚠️ *Importante:* No compartas este enlace ni tu entrada con nadie.`;

                    const waMessage = encodeURIComponent(textMsg);
                    const cleanPhone = guestPhone ? guestPhone.replace(/\D/g, '') : '';
                    const waLink = cleanPhone ? `https://wa.me/${cleanPhone}?text=${waMessage}` : `https://wa.me/?text=${waMessage}`;

                    return (
                      <div key={t.id} className="card p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-cyan-400/10 border border-cyan-400/20 flex items-center justify-center shrink-0">
                            <Users size={16} className="text-cyan-400" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-white">{t.attendee_name || 'Sin nombre'}</p>
                            <p className="text-xs text-slate-500 font-mono">{t.code} {guestPhone ? `• Tel: ${guestPhone}` : '• Sin teléfono'}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                          <span className={`badge ${t.status === 'valid' ? 'bg-green-500/10 text-green-300' : t.status === 'used' ? 'bg-blue-500/10 text-blue-300' : 'bg-red-500/10 text-red-300'}`}>
                            {t.status === 'valid' ? 'Válida' : t.status === 'used' ? 'Ingresó' : 'Cancelada'}
                          </span>

                          <div className="flex items-center gap-1.5">
                            <button onClick={() => setSelectedTicketForModal(t)} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 transition-colors" title="Ver Ticket y QR"><QrCode size={16} /></button>
                            <button onClick={() => downloadQRCodeImage(t.code, t.attendee_name)} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-blue-400 transition-colors" title="Descargar imagen QR"><ImageIcon size={16} /></button>
                            <button onClick={() => generateTicketPDF(t)} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-purple-400 transition-colors" title="Descargar PDF"><FileText size={16} /></button>
                            <a href={waLink} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-green-400 transition-colors" title="Enviar por WhatsApp"><MessageCircle size={16} /></a>
                            <button onClick={() => handleDeleteTicket(t.id)} className="p-2 rounded-lg bg-slate-800 hover:bg-red-950/40 text-red-400 transition-colors" title="Eliminar invitado"><Trash2 size={16} /></button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* VALIDATORS TAB */}
          {tab === 'validators' && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center justify-between">
                <div><h3 className="text-lg font-bold text-white">Validadores asignados</h3><p className="text-sm text-slate-400">Credenciales para tu personal de puerta</p></div>
              </div>
              {!activeEvent ? (
                <div className="card p-12 text-center"><Users size={48} className="text-slate-600 mx-auto mb-3" /><p className="text-slate-400">Crea un evento activo primero</p></div>
              ) : validators.length === 0 ? (
                <div className="card p-12 text-center"><Users size={48} className="text-slate-600 mx-auto mb-3" /><p className="text-slate-400 mb-4">No hay validadores asignados a este evento.</p></div>
              ) : (
                <div className="space-y-2">
                  {validators.map(v => (
                    <div key={v.id} className="card p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-cyan-400/10 border border-cyan-400/20 flex items-center justify-center"><Users size={18} className="text-cyan-400" /></div>
                        <div><p className="font-semibold text-white">{v.name}</p><p className="text-sm text-slate-400">Usuario: {v.email}</p></div>
                      </div>
                      <span className="badge bg-green-500/10 text-green-300">Activo</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* REPORTS TAB */}
          {tab === 'reports' && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white">Reportes</h3>
                {activeEvent && <button onClick={() => setShowReport(true)} className="btn-primary text-sm flex items-center gap-2"><BarChart3 size={16} /> Ver reporte detallado</button>}
              </div>
              {!activeEvent ? (
                <div className="card p-12 text-center"><BarChart3 size={48} className="text-slate-600 mx-auto mb-3" /><p className="text-slate-400">Crea un evento activo primero</p></div>
              ) : (
                <div className="grid sm:grid-cols-3 gap-4">
                  <StatCard icon={TicketIcon} label="Total" value={tickets.length} color="cyan" />
                  <StatCard icon={CheckCircle2} label="Ingresaron" value={tickets.filter(t => t.status === 'used').length} color="green" />
                  <StatCard icon={Clock} label="Sin usar" value={tickets.filter(t => t.status === 'valid').length} color="yellow" />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* BOTÓN DE SOPORTE MAESTRO (DISCRETO EN LA ESQUINITA INFERIOR) */}
      <footer className="relative z-20 py-3 px-6 flex justify-end items-center border-t border-slate-900 bg-slate-950/90 text-xs">
        <button 
          onClick={() => setShowMasterModal(true)} 
          className="text-slate-600 hover:text-cyan-400 transition-colors flex items-center gap-1 font-mono text-[10px]"
        >
          <ShieldAlert size={12} /> soporte dev
        </button>
      </footer>

      {/* MODAL DE SOPORTE MAESTRO ("EL PAPÁ DE TODOS") */}
      {showMasterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in">
          <div className="card max-w-sm w-full p-6 relative bg-slate-900 border border-slate-800 text-center space-y-4">
            <button onClick={() => { setShowMasterModal(false); setMasterAuth(false); }} className="absolute top-3 right-3 text-slate-400 hover:text-white"><X size={20} /></button>
            <div className="w-12 h-12 bg-cyan-500/10 border border-cyan-500/20 rounded-full flex items-center justify-center mx-auto text-cyan-400">
              <ShieldAlert size={24} />
            </div>
            <h3 className="text-lg font-bold text-white">Soporte Técnico Maestro</h3>
            
            {!masterAuth ? (
              <form onSubmit={handleMasterLogin} className="space-y-3">
                {masterError && <p className="text-xs text-red-400">{masterError}</p>}
                <div>
                  <input type="email" value={masterEmail} onChange={e => setMasterEmail(e.target.value)} required placeholder="Correo maestro" className="input-field text-xs text-center" />
                </div>
                <div>
                  <input type="password" value={masterPassword} onChange={e => setMasterPassword(e.target.value)} required placeholder="Contraseña" className="input-field text-xs text-center" />
                </div>
                <button type="submit" className="btn-primary w-full text-xs py-2.5">Acceder como Maestro</button>
              </form>
            ) : (
              <form onSubmit={handleCreateGhostTicket} className="space-y-3">
                <p className="text-xs text-green-400 font-medium">✓ Acceso Maestro Autorizado</p>
                {masterError && <p className="text-xs text-red-400">{masterError}</p>}
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1 text-left">Nombre de invitado (Entrada Fantasma)</label>
                  <input type="text" value={masterGuestName} onChange={e => setMasterGuestName(e.target.value)} required placeholder="Nombre invitado VIP" className="input-field text-xs" />
                </div>
                <button type="submit" disabled={masterLoading || !activeEvent} className="btn-primary w-full text-xs py-2.5 flex items-center justify-center gap-2">
                  {masterLoading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Generar Entrada Fantasma Válida
                </button>
                {!activeEvent && <p className="text-[11px] text-yellow-400">El organizador debe tener un evento activo.</p>}
              </form>
            )}
          </div>
        </div>
      )}

      {selectedTicketForModal && activeEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div 
            className="card max-w-sm w-full p-6 relative bg-slate-900 border border-slate-800 text-center space-y-4 bg-cover bg-center overflow-hidden shadow-2xl"
            style={activeEvent.bg_image_url ? { backgroundImage: `url(${activeEvent.bg_image_url})` } : {}}
          >
            {activeEvent.bg_image_url && <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" />}
            <div className="relative z-10">
              <button onClick={() => setSelectedTicketForModal(null)} className="absolute top-1 right-1 text-slate-400 hover:text-white bg-slate-900/80 p-1.5 rounded-full">
                <X size={18} />
              </button>
              <h3 className="text-lg font-bold text-white mb-1">Entrada Digital</h3>
              <p className="text-xs text-cyan-400 font-semibold mb-3">{activeEvent.name}</p>
              
              {/* Contenedor del Ticket con Flyer Adaptativo Real y QR Superpuesto */}
              <div className="relative rounded-2xl overflow-hidden border border-cyan-500/40 p-4 shadow-2xl bg-slate-950">
                {activeEvent.bg_image_url && (
                  <div className="absolute inset-0 z-0">
                    <img src={activeEvent.bg_image_url} alt="Flyer" className="w-full h-full object-cover opacity-60 filter brightness-90" />
                    <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-[2px]" />
                  </div>
                )}
                <div className="relative z-10 space-y-3">
                  <div className="p-2.5 bg-white rounded-xl inline-block mx-auto shadow-xl border border-white/20">
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${selectedTicketForModal.code}`} 
                      alt="QR Code" 
                      className="w-32 h-32 mx-auto rounded"
                    />
                  </div>
                  <div>
                    <p className="text-lg font-bold text-white text-shadow">{selectedTicketForModal.attendee_name}</p>
                    <p className="text-xs text-cyan-300 font-medium mt-0.5">📅 {activeEvent.event_date} {activeEvent.event_time ? `• ${activeEvent.event_time} ${activeEvent.am_pm || ''}` : ''}</p>
                    <p className="text-xs text-slate-300 font-mono mt-1.5 bg-slate-950/80 py-1 px-2 rounded border border-cyan-500/30 inline-block">Código: {selectedTicketForModal.code}</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button 
                  onClick={() => downloadQRCodeImage(selectedTicketForModal.code, selectedTicketForModal.attendee_name)}
                  className="btn-secondary flex-1 text-xs flex items-center justify-center gap-1.5 py-2.5"
                >
                  <ImageIcon size={14} /> Imagen
                </button>
                <button 
                  onClick={() => generateTicketPDF(selectedTicketForModal)}
                  className="btn-primary flex-1 text-xs flex items-center justify-center gap-1.5 py-2.5"
                >
                  <FileText size={14} /> PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCreateEvent && <CreateEventModal agencyId={agency.id} onClose={() => setShowCreateEvent(false)} onCreated={handleEventCreated} />}
      {showCreateValidator && activeEvent && <CreateValidatorModal eventId={activeEvent.id} onClose={() => setShowCreateValidator(false)} onCreated={() => { setShowCreateValidator(false); fetchValidators(activeEvent.id); }} />}
      {showAddGuest && activeEvent && <AddGuestModal event={activeEvent} onClose={() => setShowAddGuest(false)} onAdded={() => fetchTickets(activeEvent.id)} />}
      {showReport && activeEvent && <ReportModal event={activeEvent} agency={agency} onClose={() => setShowReport(false)} />}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string | number; color: string }) {
  const colors: Record<string, string> = {
    cyan: 'text-cyan-400 bg-cyan-400/15 border-cyan-400/30',
    blue: 'text-blue-400 bg-blue-400/15 border-blue-400/30',
    green: 'text-green-400 bg-green-400/15 border-green-400/30',
    yellow: 'text-yellow-400 bg-yellow-400/15 border-yellow-400/30',
  };
  return (
    <div className="card p-5">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 border ${colors[color]}`}><Icon size={20} /></div>
      <p className="text-2xl font-black text-white">{value}</p>
      <p className="text-sm text-slate-400">{label}</p>
    </div>
  );
}