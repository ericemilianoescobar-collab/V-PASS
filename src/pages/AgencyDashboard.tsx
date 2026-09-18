import { useEffect, useState, useCallback } from 'react';
import {
  LogOut, Calendar, MapPin, Users, QrCode, Ticket as TicketIcon,
  BarChart3, Loader2, AlertCircle, CheckCircle2, Clock, Plus,
  UserPlus, ChevronRight, Lock, MessageCircle, X,
} from 'lucide-react';
import VPassLogo from '@/components/VPassLogo';
import { supabase, type Agency, type Event, type Validator, type Ticket } from '@/lib/supabase';
import { PLAN_FEATURES, whatsappLink } from '@/lib/constants';
import { CreateEventModal, CreateValidatorModal, AddGuestModal, ReportModal } from '@/components/DashboardModals';

/*
 * AgencyDashboard — panel de control del organizador/agencia.
 * Header: logo izquierda, "Bienvenido + nombre" y plan activo, cerrar sesión derecha.
 * Si no hay evento activo: botón "Crear evento".
 * Si hay evento activo (bloqueado): muestra el evento + botones para
 *   agregar invitados, crear validadores, ver reportes.
 * Sistema de plan: plan_active (1=activo, 0=usado) controla si puede crear eventos.
 */

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
            {planInfo.name} {agency.plan_active ? '✓ Activo' : 'Inactivo'}
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
              <StatCard icon={TicketIcon} label="Invitados" value={tickets.length} color="blue" />
              <StatCard icon={CheckCircle2} label="Ingresaron" value={tickets.filter(t => t.status === 'used').length} color="green" />
              <StatCard icon={Users} label="Validadores" value={validators.length} color="yellow" />
            </div>

            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-white">Tu plan</h3>
                  <p className="text-sm text-slate-400">{planInfo.name} — {planInfo.price}</p>
                </div>
                <span className={`badge ${agency.plan_active ? 'bg-green-500/10 text-green-300 border border-green-500/20' : 'bg-red-500/10 text-red-300 border border-red-500/20'}`}>
                  {agency.plan_active ? 'Activo' : 'Inactivo'}
                </span>
              </div>
              <div className="grid sm:grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2 text-slate-300">
                  <TicketIcon size={16} className="text-cyan-400" />
                  {agency.max_tickets ? `${tickets.length} / ${agency.max_tickets} entradas` : 'Entradas ilimitadas'}
                </div>
                <div className="flex items-center gap-2 text-slate-300">
                  <Users size={16} className="text-blue-400" />
                  {validators.length} / {agency.max_validators} validadores
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
              <h3 className="text-lg font-bold text-white">Invitados ({tickets.length})</h3>
              {activeEvent && <button onClick={() => setShowAddGuest(true)} className="btn-primary text-sm flex items-center gap-2"><Plus size={16} /> Agregar invitado</button>}
            </div>
            {!activeEvent ? (
              <div className="card p-12 text-center"><Users size={48} className="text-slate-600 mx-auto mb-3" /><p className="text-slate-400">Crea un evento primero</p></div>
            ) : tickets.length === 0 ? (
              <div className="card p-12 text-center"><Users size={48} className="text-slate-600 mx-auto mb-3" /><p className="text-slate-400 mb-4">Sin invitados todavía</p><button onClick={() => setShowAddGuest(true)} className="btn-primary text-sm flex items-center gap-2 mx-auto"><Plus size={16} /> Agregar primer invitado</button></div>
            ) : (
              <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                {tickets.map(t => (
                  <div key={t.id} className="card p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-cyan-400/10 border border-cyan-400/20 flex items-center justify-center"><Users size={16} className="text-cyan-400" /></div>
                      <div>
                        <p className="text-sm font-semibold text-white">{t.attendee_name || 'Sin nombre'}</p>
                        <p className="text-xs text-slate-500 font-mono">{t.code}</p>
                      </div>
                    </div>
                    <span className={`badge ${t.status === 'valid' ? 'bg-green-500/10 text-green-300' : t.status === 'used' ? 'bg-blue-500/10 text-blue-300' : 'bg-red-500/10 text-red-300'}`}>
                      {t.status === 'valid' ? 'Válida' : t.status === 'used' ? 'Ingresó' : 'Cancelada'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* VALIDATORS TAB */}
        {tab === 'validators' && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex items-center justify-between">
              <div><h3 className="text-lg font-bold text-white">Validadores</h3><p className="text-sm text-slate-400">{validators.length} / {agency.max_validators} usados</p></div>
              {activeEvent && <button onClick={() => setShowCreateValidator(true)} className="btn-primary text-sm flex items-center gap-2"><UserPlus size={16} /> Crear validador</button>}
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
                <Lock size={16} className="text-yellow-400" /> Reporte detallado descargable (PDF) disponible solo en Plan Premium
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreateEvent && <CreateEventModal agencyId={agency.id} onClose={() => setShowCreateEvent(false)} onCreated={handleEventCreated} />}
      {showCreateValidator && activeEvent && <CreateValidatorModal eventId={activeEvent.id} onClose={() => setShowCreateValidator(false)} onCreated={() => { setShowCreateValidator(false); fetchValidators(activeEvent.id); }} />}
      {showAddGuest && activeEvent && <AddGuestModal event={activeEvent} onClose={() => setShowAddGuest(false)} onAdded={() => fetchTickets(activeEvent.id)} />}
      {showReport && activeEvent && <ReportModal event={activeEvent} agency={agency} onClose={() => setShowReport(false)} />}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
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
