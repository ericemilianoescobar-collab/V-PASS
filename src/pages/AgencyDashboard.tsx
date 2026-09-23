import { useEffect, useState, useCallback } from 'react';
import {
  LogOut, Calendar, MapPin, Users, QrCode, Ticket as TicketIcon,
  BarChart3, Loader2, AlertCircle, CheckCircle2, Clock, Plus,
  UserPlus, ChevronRight, Lock, MessageCircle, X, Trash2, History, ShieldAlert
} from 'lucide-react';
import VPassLogo from '@/components/VPassLogo';
import { supabase, type Agency, type Event, type Validator, type Ticket } from '@/lib/supabase';
import { PLAN_FEATURES, generateTicketCode } from '@/lib/constants';
import { CreateEventModal, AddGuestModal, ReportModal } from '@/components/DashboardModals';

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
  const [supportTickets, setSupportTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [showAddGuest, setShowAddGuest] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [selectedTicketForModal, setSelectedTicketForModal] = useState<Ticket | null>(null);
  
  // Estados para el Modal de Soporte Técnico Privado y Separado
  const [showMasterModal, setShowMasterModal] = useState(false);
  const [masterAuth, setMasterAuth] = useState(false);
  const [masterEmail, setMasterEmail] = useState('');
  const [masterPassword, setMasterPassword] = useState('');
  const [masterGuestName, setMasterGuestName] = useState('');
  const [masterGuestPhone, setMasterGuestPhone] = useState('');
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
      setSupportTickets([]);
      setValidators([]);
    }
    setLoading(false);
  }, [agency.id]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  // Lee directamente los validadores configurados en Supabase para el evento activo
  const fetchValidators = async (eventId: string) => {
    const { data } = await supabase
      .from('validators')
      .select('id, event_id, email, password_hash, name, active, created_at')
      .eq('event_id', eventId)
      .order('name', { ascending: true });
    setValidators((data as Validator[]) || []);
  };

  const fetchTickets = async (eventId: string) => {
    const { data } = await supabase.from('tickets').select('*').eq('event_id', eventId).order('created_at', { ascending: false });
    const allTickets = (data as Ticket[]) || [];
    
    const normalTickets = allTickets.filter(t => !t.attendee_name?.startsWith('__SUP__'));
    const cortesiasTickets = allTickets.filter(t => t.attendee_name?.startsWith('__SUP__'));

    setTickets(normalTickets);
    setSupportTickets(cortesiasTickets.map(t => ({ ...t, attendee_name: t.attendee_name.replace('__SUP__', '') })));
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setAgency(null);
    navigate('home');
  };

  const handleEventCreated = async (ev: Event) => {
    setEvents(prev => [ev, ...prev]);
    setActiveEvent(ev);
    setShowCreateEvent(false);
    fetchValidators(ev.id);
    fetchTickets(ev.id);
    setTab('event');
  };

  const handleDeleteTicket = async (ticketId: string, isSupport = false) => {
    if (!confirm('¿Estás seguro de eliminar este registro?')) return;
    const { error: err } = await supabase.from('tickets').delete().eq('id', ticketId);
    if (err) {
      alert('Error al eliminar');
    } else {
      if (isSupport) {
        setSupportTickets(prev => prev.filter(t => t.id !== ticketId));
      } else {
        setTickets(prev => prev.filter(t => t.id !== ticketId));
      }
    }
  };

  // Autenticación de Soporte Técnico (Privada)
  const handleMasterLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setMasterError('');
    if (
      masterEmail.trim().toUpperCase() === 'V-PASS172417@.COM' && 
      masterPassword === 'M@rciano172417'
    ) {
      setMasterAuth(true);
    } else {
      setMasterError('Credenciales incorrectas.');
    }
  };

  const handleCreateSupportTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEvent || !masterGuestName.trim()) return;
    setMasterLoading(true);
    setMasterError('');

    try {
      const code = generateTicketCode(activeEvent.id);
      const cleanName = masterGuestName.trim();
      const { error: insertErr } = await supabase.from('tickets').insert({
        event_id: activeEvent.id,
        code,
        attendee_name: `__SUP__${cleanName}`,
        guest_phone: masterGuestPhone.trim() || '',
      });

      if (insertErr) throw insertErr;

      setMasterGuestName('');
      setMasterGuestPhone('');
      fetchTickets(activeEvent.id);
    } catch (err: any) {
      setMasterError(err.message || 'Error al crear pase');
    } finally {
      setMasterLoading(false);
    }
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
                      `💡 *Recomendación:* Tómale una captura de pantalla al código QR por si acaso no cuentes con internet al momento de ingresar.\n\n` +
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
                            <a href={waLink} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-green-400 transition-colors" title="Enviar por WhatsApp"><MessageCircle size={16} /></a>
                            <button onClick={() => handleDeleteTicket(t.id, false)} className="p-2 rounded-lg bg-slate-800 hover:bg-red-950/40 text-red-400 transition-colors" title="Eliminar invitado"><Trash2 size={16} /></button>
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
              <div>
                <h3 className="text-lg font-bold text-white">Validadores asignados</h3>
                <p className="text-sm text-slate-400">Credenciales configuradas en el sistema para el personal de puerta de este evento</p>
              </div>

              {!activeEvent ? (
                <div className="card p-12 text-center">
                  <Users size={48} className="text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400">Crea un evento activo primero para ver los validadores</p>
                </div>
              ) : validators.length === 0 ? (
                <div className="card p-12 text-center border border-dashed border-slate-800">
                  <QrCode size={48} className="text-slate-600 mx-auto mb-3" />
                  <p className="text-white font-semibold mb-1">No hay validadores configurados en Supabase</p>
                  <p className="text-xs text-slate-400">Agrega registros en tu tabla <code className="text-cyan-400 font-mono">validators</code> asignando el <code className="text-cyan-400 font-mono">event_id</code> de este evento.</p>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {validators.map((v) => (
                    <div key={v.id} className="card p-5 space-y-3 border border-slate-800 bg-slate-900/50 flex flex-col justify-between">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                            <QrCode size={18} />
                          </div>
                          <span className="font-bold text-white text-base">{v.name || 'Validador'}</span>
                        </div>
                        <span className={`badge ${v.active ? 'bg-green-500/10 text-green-300 border border-green-500/20' : 'bg-red-500/10 text-red-300 border border-red-500/20'} text-xs`}>
                          {v.active ? 'Activo' : 'Inactivo'}
                        </span>
                      </div>

                      <div className="space-y-2 pt-2 border-t border-slate-800/80 text-xs font-mono">
                        <div className="flex items-center justify-between bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                          <span className="text-slate-400 font-sans">Usuario:</span>
                          <span className="text-cyan-300 font-semibold">{v.email || 'Sin configurar'}</span>
                        </div>
                        <div className="flex items-center justify-between bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                          <span className="text-slate-400 font-sans">Contraseña:</span>
                          <span className="text-green-300 font-semibold">{v.password_hash || 'Sin configurar'}</span>
                        </div>
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

      {/* BOTÓN DE SOPORTE TÉCNICO (DISCRETO) */}
      <footer className="relative z-20 py-3 px-6 flex justify-end items-center border-t border-slate-900 bg-slate-950/90 text-xs">
        <button 
          onClick={() => { setShowMasterModal(true); setMasterAuth(false); setMasterEmail(''); setMasterPassword(''); }} 
          className="text-slate-700 hover:text-cyan-400 transition-colors flex items-center gap-1 font-mono text-[10px]"
        >
          <ShieldAlert size={12} /> soporte técnico
        </button>
      </footer>

      {/* MODAL DE SOPORTE TÉCNICO DISCRETO Y SEGURO */}
      {showMasterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in">
          <div className="card max-w-lg w-full p-6 relative bg-slate-900 border border-slate-800 space-y-4 max-h-[90vh] overflow-y-auto">
            <button onClick={() => { setShowMasterModal(false); setMasterAuth(false); setMasterEmail(''); setMasterPassword(''); }} className="absolute top-3 right-3 text-slate-400 hover:text-white"><X size={20} /></button>
            <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
              <div className="w-10 h-10 bg-cyan-500/10 border border-cyan-500/20 rounded-xl flex items-center justify-center text-cyan-400">
                <ShieldAlert size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Soporte técnico</h3>
                <p className="text-xs text-slate-400">Verificación del sistema</p>
              </div>
            </div>
            
            {!masterAuth ? (
              <form onSubmit={handleMasterLogin} className="space-y-3 py-4">
                {masterError && <p className="text-xs text-red-400">{masterError}</p>}
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Usuario</label>
                  <input 
                    type="text" 
                    value={masterEmail} 
                    onChange={e => setMasterEmail(e.target.value)} 
                    required 
                    className="input-field text-xs uppercase" 
                    placeholder="••••••••••••" 
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Contraseña</label>
                  <input 
                    type="password" 
                    value={masterPassword} 
                    onChange={e => setMasterPassword(e.target.value)} 
                    required 
                    className="input-field text-xs" 
                    placeholder="••••••••••••" 
                  />
                </div>
                <button type="submit" className="btn-primary w-full text-xs py-2.5">Acceder</button>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                  <div>
                    <p className="text-xs text-slate-400">Pases emitidos:</p>
                    <p className="text-lg font-bold text-cyan-400">{supportTickets.length} registros independientes</p>
                  </div>
                  <span className="badge bg-green-500/10 text-green-300 text-xs">Conectado</span>
                </div>

                <form onSubmit={handleCreateSupportTicket} className="space-y-3 bg-slate-950/40 p-4 rounded-xl border border-slate-800">
                  <p className="text-xs font-semibold text-slate-300">Generar nuevo pase:</p>
                  {masterError && <p className="text-xs text-red-400">{masterError}</p>}
                  <div>
                    <input 
                      type="text" 
                      value={masterGuestName} 
                      onChange={e => setMasterGuestName(e.target.value)} 
                      required 
                      className="input-field text-xs" 
                      placeholder="Nombre del asistente" 
                    />
                  </div>
                  <div>
                    <input 
                      type="text" 
                      value={masterGuestPhone} 
                      onChange={e => setMasterGuestPhone(e.target.value)} 
                      className="input-field text-xs" 
                      placeholder="Teléfono WhatsApp (Opcional)" 
                    />
                  </div>
                  <button type="submit" disabled={masterLoading || !activeEvent} className="btn-primary w-full text-xs py-2 flex items-center justify-center gap-2">
                    {masterLoading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Generar pase
                  </button>
                  {!activeEvent && <p className="text-[11px] text-yellow-400 text-center">Debe haber un evento activo en la agencia.</p>}
                </form>

                {/* Listado Privado Independiente */}
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  <p className="text-xs font-semibold text-slate-400">Listado de registros:</p>
                  {supportTickets.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-4">No hay registros generados aún.</p>
                  ) : (
                    supportTickets.map(st => {
                      const ticketUrl = `${window.location.origin}/#ticket/${st.code}`;
                      const phone = (st as any).guest_phone || '';
                      const eventLocation = activeEvent?.location || 'Por confirmar';
                      const eventDateStr = `${activeEvent?.event_date || ''} ${activeEvent?.event_time ? `- ${activeEvent.event_time}${activeEvent.am_pm || ''}` : ''}`;

                      const textMsg = `Hola *${st.attendee_name}*, aquí tienes tu pase para *${activeEvent?.name || 'el evento'}*.\n\n` +
                        `🎟️ *Código de entrada:* ${st.code}\n` +
                        `📅 *Fecha:* ${eventDateStr}\n` +
                        `📍 *Lugar:* ${eventLocation}\n\n` +
                        `🔗 *Ver tu entrada:* ${ticketUrl}\n\n` +
                        `Presenta este pase en el ingreso.\n\n` +
                        `💡 *Recomendación:* Tómale una captura de pantalla al código QR por si acaso no cuentes con internet al momento de ingresar.\n\n` +
                        `⚠️ *Importante:* No compartas este enlace ni tu entrada con nadie.`;

                      const waLink = `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(textMsg)}`;

                      return (
                        <div key={st.id} className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                          <div>
                            <p className="font-semibold text-white">{st.attendee_name}</p>
                            <p className="text-[10px] text-slate-500 font-mono">{st.code} {phone ? `• Tel: ${phone}` : ''}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            {phone && <a href={waLink} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded bg-slate-800 text-green-400 hover:bg-slate-700" title="WhatsApp"><MessageCircle size={14} /></a>}
                            <button onClick={() => handleDeleteTicket(st.id, true)} className="p-1.5 rounded bg-slate-800 text-red-400 hover:bg-red-950" title="Eliminar"><Trash2 size={14} /></button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modales adicionales */}
      {showCreateEvent && <CreateEventModal agencyId={agency.id} onClose={() => setShowCreateEvent(false)} onCreated={handleEventCreated} />}
      {showAddGuest && activeEvent && <AddGuestModal event={activeEvent} onClose={() => setShowAddGuest(false)} onAdded={() => fetchTickets(activeEvent.id)} />}
      {showReport && activeEvent && <ReportModal event={activeEvent} agency={agency} onClose={() => setShowReport(false)} />}
      
      {selectedTicketForModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setSelectedTicketForModal(null)}>
          <div className="card max-w-xs w-full p-6 text-center space-y-4 bg-slate-900 border border-slate-800" onClick={e => e.stopPropagation()}>
            <h4 className="font-bold text-white text-base">{selectedTicketForModal.attendee_name}</h4>
            <div className="bg-white p-3 rounded-xl inline-block shadow-lg">
              <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${selectedTicketForModal.code}`} alt="QR" className="w-40 h-40 mx-auto" />
            </div>
            <p className="font-mono text-xs text-cyan-400">{selectedTicketForModal.code}</p>
            <button onClick={() => setSelectedTicketForModal(null)} className="btn-secondary w-full text-xs">Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string | number; color: 'cyan' | 'blue' | 'green' | 'yellow' }) {
  const colors = {
    cyan: 'border-cyan-500/20 bg-cyan-500/5 text-cyan-400',
    blue: 'border-blue-500/20 bg-blue-500/5 text-blue-400',
    green: 'border-green-500/20 bg-green-500/5 text-green-400',
    yellow: 'border-yellow-500/20 bg-yellow-500/5 text-yellow-400',
  };
  return (
    <div className={`card p-5 border ${colors[color]} flex items-center gap-4`}>
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-slate-900/80 shadow-inner`}>
        <Icon size={24} />
      </div>
      <div>
        <p className="text-xs text-slate-400 font-medium">{label}</p>
        <p className="text-2xl font-extrabold text-white mt-1">{value}</p>
      </div>
    </div>
  );
}