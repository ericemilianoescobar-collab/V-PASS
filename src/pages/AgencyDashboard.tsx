import { useEffect, useState, useCallback } from 'react';
import {
  LogOut, Calendar, MapPin, Users, QrCode, Ticket as TicketIcon,
  BarChart3, Loader2, AlertCircle, CheckCircle2, Clock, Plus,
  UserPlus, ChevronRight, Lock, MessageCircle, X, Download, FileText, Image as ImageIcon, Trash2
} from 'lucide-react';
import VPassLogo from '@/components/VPassLogo';
import { supabase, type Agency, type Event, type Validator, type Ticket } from '@/lib/supabase';
import { PLAN_FEATURES, whatsappLink } from '@/lib/constants';
import { CreateEventModal, CreateValidatorModal, AddGuestModal, ReportModal } from '@/components/DashboardModals';

interface Props {
  agency: Agency;
  setAgency: (a: Agency | null) => void;
  navigate: (route: string) => void;
}

type Tab = 'overview' | 'event' | 'guests' | 'validators' | 'reports';

export default function AgencyDashboard({ agency, setAgency, navigate }: Props) {
  const [tab, setTab] = useState<Tab>('overview');
  const [events, setEvents] = useState<Event[]>([]);
  const [activeEvent, setActiveEvent] = useState<Event | null>(null);
  const [validators, setValidators] = useState<Validator[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [showCreateValidator, setShowCreateValidator] = useState(false);
  const [showAddGuest, setShowAddGuest] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [selectedTicketForModal, setSelectedTicketForModal] = useState<Ticket | null>(null);
  const [error, setError] = useState('');

  const planInfo = PLAN_FEATURES[agency.plan];

  const fetchEvents = useCallback(async () => {
    const { data } = await supabase.from('events').select('*').eq('agency_id', agency.id).order('created_at', { ascending: false });
    const eventsData = (data as Event[]) || [];
    setEvents(eventsData);
    const active = eventsData.find(e => e.status === 'active' && e.locked);
    if (active) {
      setActiveEvent(active);
      fetchValidators(active.id);
      fetchTickets(active.id);
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

  // Función para eliminar invitado
  const handleDeleteTicket = async (ticketId: string) => {
    if (!confirm('¿Estás seguro de eliminar este invitado?')) return;
    const { error: err } = await supabase.from('tickets').delete().eq('id', ticketId);
    if (err) {
      alert('Error al eliminar invitado');
    } else {
      setTickets(prev => prev.filter(t => t.id !== ticketId));
    }
  };

  // Funciones de descarga e impresión reales
  const downloadQRCodeImage = async (ticketCode: string, attendeeName: string) => {
    try {
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${ticketCode}`;
      const response = await fetch(qrUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `QR-${attendeeName || 'invitado'}-${ticketCode}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error al descargar imagen QR:", err);
      alert("No se pudo descargar la imagen del QR.");
    }
  };

  const generateTicketPDF = (t: Ticket) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Por favor, permite las ventanas emergentes para generar el PDF.");
      return;
    }

    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${t.code}`;
    const eventName = activeEvent?.name || 'Evento V-PASS';
    const eventDate = activeEvent?.event_date || '';
    const eventLocation = activeEvent?.location || '';

    printWindow.document.write(`
      <html>
        <head>
          <title>Entrada - ${t.attendee_name}</title>
          <style>
            body { font-family: Arial, sans-serif; background: #0f172a; color: #fff; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
            .ticket { background: #1e293b; border: 2px solid #38bdf8; border-radius: 16px; padding: 24px; text-align: center; width: 320px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
            h2 { color: #38bdf8; margin-bottom: 5px; }
            p { margin: 8px 0; color: #94a3b8; font-size: 14px; }
            .name { font-size: 20px; font-weight: bold; color: #fff; margin: 12px 0; }
            .code { font-family: monospace; background: #0f172a; padding: 6px 12px; border-radius: 8px; color: #38bdf8; display: inline-block; margin-top: 8px; }
            .qr-box { background: #fff; padding: 12px; border-radius: 12px; display: inline-block; margin: 15px 0; }
            img { width: 160px; height: 160px; display: block; }
          </style>
        </head>
        <body>
          <div class="ticket">
            <h2>V-PASS TICKET</h2>
            <p>${eventName}</p>
            <div class="qr-box">
              <img src="${qrUrl}" />
            </div>
            <div class="name">${t.attendee_name || 'Invitado'}</div>
            <p>📅 ${eventDate} | 📍 ${eventLocation}</p>
            <div class="code">Código: ${t.code}</div>
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
    <div className="min-h-screen bg-slate-950 relative overflow-hidden">
      <div className="absolute inset-0 bg-grid pointer-events-none" />
      <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-[120px] pointer-events-none" />

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
            { id: 'event' as Tab, label: 'Mi evento', icon: Calendar },
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
              <div className="grid sm:grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2 text-slate-300">
                  <TicketIcon size={16} className="text-cyan-400" />
                  Utilizadas: {tickets.length} de {agency.max_tickets || 'Ilimitadas'}
                </div>
                <div className="flex items-center gap-2 text-slate-300">
                  <Users size={16} className="text-blue-400" />
                  Validadores activos: {validators.length} / {agency.max_validators}
                </div>
              </div>
            </div>

            {canCreateEvent ? (
              <div className="card p-8 flex flex-col items-center justify-center text-center">
                <Calendar size={48} className="text-slate-600 mb-3" />
                <h3 className="text-lg font-bold text-white mb-2">Crea tu primer evento</h3>
                <p className="text-sm text-slate-400 mb-4">Configura fecha, hora, ubicación, imagen de fondo y posición del QR</p>
                <button onClick={() => setShowCreateEvent(true)} className="btn-primary flex items-center gap-2">
                  <Plus size={18} /> Crear evento
                </button>
              </div>
            ) : !agency.plan_active ? (
              <div className="card p-6 flex flex-col items-center text-center">
                <Lock size={40} className="text-slate-600 mb-3" />
                <p className="text-slate-400 mb-2">Tu plan está inactivo</p>
                <a href={whatsappLink('Hola, quiero reactivar mi plan de V-PASS')} target="_blank" rel="noopener noreferrer" className="btn-primary text-sm flex items-center gap-2">
                  <MessageCircle size={16} /> Contactar por WhatsApp
                </a>
              </div>
            ) : activeEvent ? (
              <div className="card p-5">
                <h3 className="text-lg font-bold text-white mb-3">Evento activo</h3>
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
            ) : null}
          </div>
        )}

        {/* EVENT TAB */}
        {tab === 'event' && (
          <div className="space-y-4 animate-fade-in">
            {activeEvent ? (
              <div className="card p-6 animate-fade-in">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-white">{activeEvent.name}</h3>
                    {activeEvent.description && <p className="text-sm text-slate-400 mt-1">{activeEvent.description}</p>}
                  </div>
                  <span className="badge bg-green-500/10 text-green-300"><Lock size={12} /> Bloqueado</span>
                </div>
                <div className="grid sm:grid-cols-3 gap-4 mb-4">
                  <div className="flex items-center gap-2 text-sm"><Calendar size={16} className="text-cyan-400" /><div><p className="text-slate-500 text-xs">Fecha</p><p className="text-white">{activeEvent.event_date}</p></div></div>
                  <div className="flex items-center gap-2 text-sm"><Clock size={16} className="text-blue-400" /><div><p className="text-slate-500 text-xs">Hora</p><p className="text-white">{activeEvent.event_time} {activeEvent.am_pm}</p></div></div>
                  <div className="flex items-center gap-2 text-sm"><MapPin size={16} className="text-green-400" /><div><p className="text-slate-500 text-xs">Ubicación</p><p className="text-white">{activeEvent.location || 'Sin especificar'}</p></div></div>
                </div>
                {activeEvent.bg_image_url && (
                  <div className="mb-4 rounded-xl overflow-hidden h-32 bg-cover bg-center" style={{ backgroundImage: `url(${activeEvent.bg_image_url})` }} />
                )}
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => setShowAddGuest(true)} className="btn-primary text-sm flex items-center gap-2"><Plus size={16} /> Agregar invitado</button>
                  <button onClick={() => setTab('validators')} className="btn-secondary text-sm flex items-center gap-2"><Users size={16} /> Validadores</button>
                  <button onClick={() => setShowReport(true)} className="btn-secondary text-sm flex items-center gap-2"><BarChart3 size={16} /> Reporte</button>
                </div>
              </div>
            ) : canCreateEvent ? (
              <div className="card p-12 flex flex-col items-center justify-center text-center">
                <Calendar size={48} className="text-slate-600 mb-3" />
                <p className="text-slate-400 mb-4">No tienes evento activo</p>
                <button onClick={() => setShowCreateEvent(true)} className="btn-primary flex items-center gap-2"><Plus size={18} /> Crear evento</button>
              </div>
            ) : (
              <div className="card p-12 flex flex-col items-center text-center">
                <Lock size={48} className="text-slate-600 mb-3" />
                <p className="text-slate-400">Plan inactivo. Contacta por WhatsApp para reactivar.</p>
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
                      alert(`Has alcanzado el límite de ${agency.max_tickets} entradas de tu plan. Actualiza tu plan para agregar más.`);
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
              <div className="card p-12 text-center"><Users size={48} className="text-slate-600 mx-auto mb-3" /><p className="text-slate-400">Crea un evento primero</p></div>
            ) : tickets.length === 0 ? (
              <div className="card p-12 text-center"><Users size={48} className="text-slate-600 mx-auto mb-3" /><p className="text-slate-400 mb-4">Sin invitados todavía</p><button onClick={() => setShowAddGuest(true)} className="btn-primary text-sm flex items-center gap-2 mx-auto"><Plus size={16} /> Agregar primer invitado</button></div>
            ) : (
              <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                {tickets.map(t => {
                  // Enlace exclusivo público al ticket individual del invitado (sin acceso al panel)
                  const ticketUrl = `${window.location.origin}/#ticket=${t.code}`;
                  const guestPhone = t.phone || (t as any).whatsapp || '';
                  
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
                          {/* 1. Botón Ver / QR */}
                          <button
                            onClick={() => setSelectedTicketForModal(t)}
                            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 transition-colors"
                            title="Ver Ticket y Código QR"
                          >
                            <QrCode size={16} />
                          </button>

                          {/* 2. Botón Descargar Imagen / QR */}
                          <button
                            onClick={() => downloadQRCodeImage(t.code, t.attendee_name)}
                            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-blue-400 transition-colors"
                            title="Descargar imagen QR"
                          >
                            <ImageIcon size={16} />
                          </button>

                          {/* 3. Botón Descargar PDF */}
                          <button
                            onClick={() => generateTicketPDF(t)}
                            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-purple-400 transition-colors"
                            title="Descargar entrada en PDF"
                          >
                            <FileText size={16} />
                          </button>

                          {/* 4. Botón WhatsApp */}
                          <a
                            href={waLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-green-400 transition-colors"
                            title="Enviar por WhatsApp"
                          >
                            <MessageCircle size={16} />
                          </a>

                          {/* 5. Botón Eliminar Invitado */}
                          <button
                            onClick={() => handleDeleteTicket(t.id)}
                            className="p-2 rounded-lg bg-slate-800 hover:bg-red-950/40 text-red-400 transition-colors"
                            title="Eliminar invitado"
                          >
                            <Trash2 size={16} />
                          </button>
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
              <div><h3 className="text-lg font-bold text-white">Validadores ({validators.length} / {agency.max_validators})</h3><p className="text-sm text-slate-400">Límite de tu plan</p></div>
              {activeEvent && (
                <button 
                  onClick={() => {
                    if (validators.length >= agency.max_validators) {
                      alert(`Has alcanzado el límite de ${agency.max_validators} validadores de tu plan.`);
                      return;
                    }
                    setShowCreateValidator(true);
                  }} 
                  className="btn-primary text-sm flex items-center gap-2"
                >
                  <UserPlus size={16} /> Crear validador
                </button>
              )}
            </div>
            {!activeEvent ? (
              <div className="card p-12 text-center"><Users size={48} className="text-slate-600 mx-auto mb-3" /><p className="text-slate-400">Crea un evento primero</p></div>
            ) : validators.length === 0 ? (
              <div className="card p-12 text-center"><Users size={48} className="text-slate-600 mx-auto mb-3" /><p className="text-slate-400 mb-4">Sin validadores</p><button onClick={() => setShowCreateValidator(true)} className="btn-primary text-sm flex items-center gap-2 mx-auto"><UserPlus size={16} /> Crear validador</button></div>
            ) : (
              <div className="space-y-2">
                {validators.map(v => (
                  <div key={v.id} className="card p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-cyan-400/10 border border-cyan-400/20 flex items-center justify-center"><Users size={18} className="text-cyan-400" /></div>
                      <div><p className="font-semibold text-white">{v.name}</p><p className="text-sm text-slate-400">{v.email}</p></div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`badge ${v.active ? 'bg-green-500/10 text-green-300' : 'bg-slate-800 text-slate-400'}`}>{v.active ? 'Activo' : 'Inactivo'}</span>
                      <button onClick={async () => { await supabase.from('validators').update({ active: !v.active }).eq('id', v.id); fetchValidators(activeEvent.id); }} className="btn-ghost text-xs">{v.active ? 'Desactivar' : 'Activar'}</button>
                    </div>
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
              <div className="card p-12 text-center"><BarChart3 size={48} className="text-slate-600 mx-auto mb-3" /><p className="text-slate-400">Crea un evento primero</p></div>
            ) : tickets.length === 0 ? (
              <div className="card p-12 text-center"><BarChart3 size={48} className="text-slate-600 mx-auto mb-3" /><p className="text-slate-400">Sin datos para reportar</p></div>
            ) : (
              <div className="grid sm:grid-cols-3 gap-4">
                <StatCard icon={TicketIcon} label="Total" value={tickets.length} color="cyan" />
                <StatCard icon={CheckCircle2} label="Ingresaron" value={tickets.filter(t => t.status === 'used').length} color="green" />
                <StatCard icon={Clock} label="Sin usar" value={tickets.filter(t => t.status === 'valid').length} color="yellow" />
              </div>
            )}
            {agency.plan !== 'premium' && (
              <div className="card p-4 flex items-center gap-2 text-sm text-slate-400">
                <Lock size={16} className="text-yellow-400" /> Reporte detallado descargable (PDF) disponible solo en Plan Premium (S/ 250)
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal para ver Ticket / QR individual */}
      {selectedTicketForModal && activeEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="card max-w-sm w-full p-6 relative bg-slate-900 border border-slate-800 text-center space-y-4">
            <button onClick={() => setSelectedTicketForModal(null)} className="absolute top-3 right-3 text-slate-400 hover:text-white">
              <X size={20} />
            </button>
            <h3 className="text-lg font-bold text-white">Entrada Digital</h3>
            <p className="text-sm text-cyan-400 font-semibold">{activeEvent.name}</p>
            <div className="p-4 bg-white rounded-xl inline-block mx-auto">
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${selectedTicketForModal.code}`} 
                alt="QR Code" 
                className="w-36 h-36 mx-auto"
              />
            </div>
            <div>
              <p className="text-base font-bold text-white">{selectedTicketForModal.attendee_name}</p>
              <p className="text-xs text-slate-400 font-mono mt-1">Código: {selectedTicketForModal.code}</p>
            </div>
            <div className="flex gap-2 pt-2">
              <button 
                onClick={() => downloadQRCodeImage(selectedTicketForModal.code, selectedTicketForModal.attendee_name)}
                className="btn-secondary flex-1 text-xs flex items-center justify-center gap-1.5"
              >
                <ImageIcon size={14} /> Imagen
              </button>
              <button 
                onClick={() => generateTicketPDF(selectedTicketForModal)}
                className="btn-primary flex-1 text-xs flex items-center justify-center gap-1.5"
              >
                <FileText size={14} /> PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {showCreateEvent && <CreateEventModal agencyId={agency.id} onClose={() => setShowCreateEvent(false)} onCreated={handleEventCreated} />}
      {showCreateValidator && activeEvent && <CreateValidatorModal eventId={activeEvent.id} onClose={() => setShowCreateValidator(false)} onCreated={() => { setShowCreateValidator(false); fetchValidators(activeEvent.id); }} />}
      {showAddGuest && activeEvent && <AddGuestModal event={activeEvent} onClose={() => setShowAddGuest(false)} onAdded={() => fetchTickets(activeEvent.id)} />}
      {showReport && activeEvent && <ReportModal event={activeEvent} agency={agency} onClose={() => setShowReport(false)} />}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string | number; color: string }) {
  const colors: Record<string, string> = {
    cyan: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20',
    blue: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
    green: 'text-green-400 bg-green-400/10 border-green-400/20',
    yellow: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  };
  return (
    <div className="card p-5">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 border ${colors[color]}`}><Icon size={20} /></div>
      <p className="text-2xl font-black text-white">{value}</p>
      <p className="text-sm text-slate-400">{label}</p>
    </div>
  );
}