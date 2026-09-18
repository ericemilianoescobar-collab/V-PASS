import { useState, useEffect } from 'react';
import { X, AlertCircle, Loader2, Plus, UserPlus, Ticket as TicketIcon, Calendar, Upload, Lock, Image as ImageIcon } from 'lucide-react';
import { supabase, type Agency, type Event } from '@/lib/supabase';
import { generateTicketCode, getTicketUrl, whatsappLinkToNumber } from '@/lib/constants';
import { downloadTicketPDF, downloadTicketImage, buildWhatsAppMessage } from '@/lib/ticketArt';

/*
 * DashboardModals — todos los modales del panel de agencia:
 * 1. CreateEventModal: crear evento con fecha, hora AM/PM, ubicación, imagen de fondo, posición/tamaño QR. Se bloquea al guardar.
 * 2. CreateValidatorModal: crear validador para un evento (nombre, usuario/correo, contraseña).
 * 3. AddGuestModal: agregar invitado individual (nombre, teléfono opcional) + botones WhatsApp/PDF/Imagen.
 * 4. ReportModal: reporte detallado del evento (solo premium puede descargar PDF).
 */

function ModalShell({ title, children, onClose, wide }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 animate-fade-in" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" />
      <div className={`relative card p-6 w-full ${wide ? 'max-w-2xl' : 'max-w-md'} max-h-[90vh] overflow-y-auto animate-scale-in`} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4 sticky top-0 bg-slate-900/95 backdrop-blur-sm pb-3 -mx-6 px-6 -mt-6 pt-6 z-10 rounded-t-2xl">
          <h3 className="text-lg font-bold text-white">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ============ 1. CREATE EVENT ============

export function CreateEventModal({ agencyId, onClose, onCreated }: { agencyId: string; onClose: () => void; onCreated: (ev: Event) => void }) {
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [amPm, setAmPm] = useState<'AM' | 'PM'>('PM');
  const [location, setLocation] = useState('');
  const [bgImageUrl, setBgImageUrl] = useState('');
  const [qrPosX, setQrPosX] = useState(50);
  const [qrPosY, setQrPosY] = useState(50);
  const [qrSize, setQrSize] = useState(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { data, error: insertError } = await supabase.from('events').insert({
      agency_id: agencyId,
      name,
      event_date: date,
      event_time: time || null,
      am_pm: amPm,
      location: location || null,
      bg_image_url: bgImageUrl || null,
      qr_pos_x: qrPosX,
      qr_pos_y: qrPosY,
      qr_size: qrSize,
      locked: true,
    }).select().single();

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }
    onCreated(data as Event);
  };

  return (
    <ModalShell title="Crear evento" onClose={onClose} wide>
      {error && <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm"><AlertCircle size={16} /> {error}</div>}
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Nombre del evento</label>
          <input value={name} onChange={e => setName(e.target.value)} required className="input-field" placeholder="Concierto, fiesta, conferencia..." />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Fecha</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} required className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Hora</label>
            <div className="flex gap-2">
              <input type="time" value={time} onChange={e => setTime(e.target.value)} className="input-field flex-1" />
              <div className="flex flex-col gap-1">
                <button type="button" onClick={() => setAmPm('AM')} className={`px-3 py-1 rounded-lg text-xs font-semibold ${amPm === 'AM' ? 'bg-cyan-400 text-slate-950' : 'bg-slate-800 text-slate-400'}`}>AM</button>
                <button type="button" onClick={() => setAmPm('PM')} className={`px-3 py-1 rounded-lg text-xs font-semibold ${amPm === 'PM' ? 'bg-cyan-400 text-slate-950' : 'bg-slate-800 text-slate-400'}`}>PM</button>
              </div>
            </div>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Ubicación (opcional)</label>
          <input value={location} onChange={e => setLocation(e.target.value)} className="input-field" placeholder="Lugar del evento" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Imagen de fondo (URL, opcional)</label>
          <div className="flex items-center gap-2">
            <ImageIcon size={18} className="text-slate-500 shrink-0" />
            <input value={bgImageUrl} onChange={e => setBgImageUrl(e.target.value)} className="input-field" placeholder="https://..." />
          </div>
          <p className="text-xs text-slate-500 mt-1">Se mostrará como fondo en las invitadas de los invitados</p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">QR Posición X: {qrPosX}%</label>
            <input type="range" min={10} max={90} value={qrPosX} onChange={e => setQrPosX(parseInt(e.target.value))} className="w-full accent-cyan-400" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">QR Posición Y: {qrPosY}%</label>
            <input type="range" min={10} max={90} value={qrPosY} onChange={e => setQrPosY(parseInt(e.target.value))} className="w-full accent-cyan-400" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">QR Tamaño: {qrSize}%</label>
            <input type="range" min={10} max={60} value={qrSize} onChange={e => setQrSize(parseInt(e.target.value))} className="w-full accent-cyan-400" />
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xs">
          <Lock size={14} /> Al guardar, el evento se bloquea y no podrá editarse ni crearse otro.
        </div>
        <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
          {loading ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />} Guardar evento
        </button>
      </form>
    </ModalShell>
  );
}

// ============ 2. CREATE VALIDATOR ============

export function CreateValidatorModal({ eventId, onClose, onCreated }: { eventId: string; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { error: rpcError } = await supabase.rpc('create_validator', {
      p_event_id: eventId, p_email: email.trim(), p_password: password, p_name: name,
    });
    if (rpcError) { setError(rpcError.message); setLoading(false); return; }
    onCreated();
  };

  return (
    <ModalShell title="Crear validador" onClose={onClose}>
      {error && <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm"><AlertCircle size={16} /> {error}</div>}
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Nombre del validador</label>
          <input value={name} onChange={e => setName(e.target.value)} required className="input-field" placeholder="Puerta 1" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Usuario (correo)</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="input-field" placeholder="validador@evento.com" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Contraseña</label>
          <input type="text" value={password} onChange={e => setPassword(e.target.value)} required className="input-field" placeholder="Contraseña para este evento" />
        </div>
        <p className="text-xs text-slate-500">Solo para este evento. El validador ingresa desde el botón "Validador" en la página principal.</p>
        <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
          {loading ? <Loader2 size={18} className="animate-spin" /> : <UserPlus size={18} />} Crear validador
        </button>
      </form>
    </ModalShell>
  );
}

// ============ 3. ADD GUEST ============

export function AddGuestModal({ event, onClose, onAdded }: { event: Event; onClose: () => void; onAdded: () => void }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastTicket, setLastTicket] = useState<{ code: string; attendeeName: string; accessToken: string; guestPhone: string } | null>(null);
  const [actionLoading, setActionLoading] = useState<string>('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError('');

    const code = generateTicketCode(event.id);
    const { data, error: insertError } = await supabase.from('tickets').insert({
      event_id: event.id,
      code,
      attendee_name: name.trim(),
      guest_phone: phone.trim() || null,
    }).select().single();

    if (insertError) { setError(insertError.message); setLoading(false); return; }

    setLastTicket({
      code,
      attendeeName: name.trim(),
      accessToken: data.access_token,
      guestPhone: phone.trim(),
    });
    setName('');
    setPhone('');
    setLoading(false);
    onAdded();
  };

  const handleWhatsApp = () => {
    if (!lastTicket) return;
    const url = getTicketUrl(lastTicket.accessToken);
    const msg = buildWhatsAppMessage(lastTicket.attendeeName, event.name, url);
    window.open(whatsappLinkToNumber(lastTicket.guestPhone, msg), '_blank');
  };

  const handlePDF = async () => {
    if (!lastTicket) return;
    setActionLoading('pdf');
    await downloadTicketPDF({
      code: lastTicket.code,
      attendeeName: lastTicket.attendeeName,
      eventName: event.name,
      eventDate: event.event_date,
      eventTime: event.event_time,
      amPm: event.am_pm,
      location: event.location,
    });
    setActionLoading('');
  };

  const handleImage = async () => {
    if (!lastTicket) return;
    setActionLoading('img');
    await downloadTicketImage({
      code: lastTicket.code,
      attendeeName: lastTicket.attendeeName,
      eventName: event.name,
      eventDate: event.event_date,
      eventTime: event.event_time,
      amPm: event.am_pm,
      location: event.location,
      bgImageUrl: event.bg_image_url,
      qrPosX: event.qr_pos_x,
      qrPosY: event.qr_pos_y,
      qrSize: event.qr_size,
    });
    setActionLoading('');
  };

  return (
    <ModalShell title="Agregar invitado" onClose={onClose}>
      {error && <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm"><AlertCircle size={16} /> {error}</div>}
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Nombre del invitado</label>
          <input value={name} onChange={e => setName(e.target.value)} required className="input-field" placeholder="Juan Pérez" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Número (opcional)</label>
          <input value={phone} onChange={e => setPhone(e.target.value)} className="input-field" placeholder="921 543 755" />
        </div>
        <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
          {loading ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />} Guardar invitado
        </button>
      </form>

      {lastTicket && (
        <div className="mt-4 p-4 rounded-xl bg-slate-900/60 border border-slate-800 animate-fade-in">
          <div className="flex items-center gap-2 mb-3">
            <TicketIcon size={18} className="text-cyan-400" />
            <p className="font-semibold text-white">{lastTicket.attendeeName}</p>
          </div>
          <p className="text-xs text-slate-500 font-mono mb-3">{lastTicket.code}</p>
          <div className="flex gap-2">
            <button onClick={handleWhatsApp} disabled={!lastTicket.guestPhone} className="flex-1 px-3 py-2.5 rounded-xl font-semibold text-sm bg-green-500/10 text-green-300 border border-green-500/20 hover:bg-green-500/20 transition-all disabled:opacity-40 flex items-center justify-center gap-1.5">
              WhatsApp
            </button>
            <button onClick={handlePDF} disabled={!!actionLoading} className="flex-1 px-3 py-2.5 rounded-xl font-semibold text-sm bg-red-500/10 text-red-300 border border-red-500/20 hover:bg-red-500/20 transition-all disabled:opacity-40 flex items-center justify-center gap-1.5">
              {actionLoading === 'pdf' ? <Loader2 size={14} className="animate-spin" /> : 'PDF'}
            </button>
            <button onClick={handleImage} disabled={!!actionLoading} className="flex-1 px-3 py-2.5 rounded-xl font-semibold text-sm bg-blue-500/10 text-blue-300 border border-blue-500/20 hover:bg-blue-500/20 transition-all disabled:opacity-40 flex items-center justify-center gap-1.5">
              {actionLoading === 'img' ? <Loader2 size={14} className="animate-spin" /> : 'Imagen'}
            </button>
          </div>
          {!lastTicket.guestPhone && <p className="text-xs text-slate-500 mt-2">Sin número de WhatsApp. Usa PDF o Imagen para enviar manualmente.</p>}
        </div>
      )}
    </ModalShell>
  );
}

// ============ 4. REPORT MODAL ============

export function ReportModal({ event, agency, onClose }: { event: Event; agency: Agency; onClose: () => void }) {
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc('get_event_report', { p_event_id: event.id });
      setReport(data?.[0] || null);
      setLoading(false);
    })();
  }, [event.id]);

  const handleDownloadPDF = async () => {
    if (!report) return;
    setDownloading(true);
    const { jsPDF } = await import('jspdf');
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    pdf.setFillColor(10, 15, 26); pdf.rect(0, 0, 210, 297, 'F');
    pdf.setTextColor(34, 211, 238); pdf.setFontSize(22); pdf.setFont('helvetica', 'bold');
    pdf.text('V-PASS — Reporte de Evento', 105, 30, { align: 'center' });
    pdf.setTextColor(255, 255, 255); pdf.setFontSize(16);
    pdf.text(report.event_name || event.name, 105, 50, { align: 'center' });
    pdf.setFontSize(12); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(148, 163, 184);
    pdf.text(`Fecha: ${report.event_date || event.event_date}${report.event_time ? ` - ${report.event_time} ${report.am_pm || ''}` : ''}`, 105, 62, { align: 'center' });
    if (report.location) pdf.text(`Ubicacion: ${report.location}`, 105, 72, { align: 'center' });
    pdf.setDrawColor(34, 211, 238); pdf.line(30, 85, 180, 85);
    pdf.setTextColor(255, 255, 255); pdf.setFontSize(14); pdf.setFont('helvetica', 'bold');
    let y = 105;
    const rows: [string, string][] = [
      ['Total de entradas generadas', String(report.total_tickets || 0)],
      ['Personas que ingresaron (escaneadas)', String(report.used_tickets || 0)],
      ['Entradas sin usar', String(report.valid_tickets || 0)],
      ['Entradas canceladas', String(report.cancelled_tickets || 0)],
      ['Total de validaciones', String(report.total_validations || 0)],
    ];
    for (const [label, val] of rows) {
      pdf.text(label, 30, y); pdf.text(val, 180, y, { align: 'right' }); y += 12;
    }
    const pct = report.total_tickets > 0 ? Math.round((report.used_tickets / report.total_tickets) * 100) : 0;
    pdf.text(`Porcentaje de asistencia`, 30, y); pdf.text(`${pct}%`, 180, y, { align: 'right' });
    pdf.setTextColor(34, 211, 238); pdf.setFontSize(12); pdf.text('V-PASS', 105, 280, { align: 'center' });
    pdf.save(`reporte-${event.name}.pdf`);
    setDownloading(false);
  };

  return (
    <ModalShell title="Reporte del evento" onClose={onClose} wide>
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-cyan-400" /></div>
      ) : report ? (
        <div className="space-y-4">
          <div className="text-center mb-4">
            <h4 className="text-xl font-bold text-white">{report.event_name || event.name}</h4>
            <p className="text-sm text-slate-400">{report.event_date} {report.event_time} {report.am_pm || ''}</p>
            {report.location && <p className="text-sm text-slate-400">{report.location}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <ReportStat label="Entradas generadas" value={report.total_tickets} color="cyan" />
            <ReportStat label="Personas ingresaron" value={report.used_tickets} color="green" />
            <ReportStat label="Sin usar" value={report.valid_tickets} color="yellow" />
            <ReportStat label="Canceladas" value={report.cancelled_tickets} color="red" />
          </div>
          <div className="card p-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-slate-300">Porcentaje de asistencia</span>
              <span className="text-white font-bold">{report.total_tickets > 0 ? Math.round((report.used_tickets / report.total_tickets) * 100) : 0}%</span>
            </div>
            <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-cyan-400 to-green-400 rounded-full transition-all duration-500" style={{ width: `${report.total_tickets > 0 ? (report.used_tickets / report.total_tickets) * 100 : 0}%` }} />
            </div>
          </div>
          {agency.plan === 'premium' ? (
            <button onClick={handleDownloadPDF} disabled={downloading} className="btn-primary w-full flex items-center justify-center gap-2">
              {downloading ? <Loader2 size={18} className="animate-spin" /> : <TicketIcon size={18} />} Descargar reporte PDF
            </button>
          ) : (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700 text-slate-400 text-sm">
              <Lock size={14} /> Descarga de PDF disponible solo en Plan Premium
            </div>
          )}
        </div>
      ) : <p className="text-slate-400 text-center py-6">No hay datos</p>}
    </ModalShell>
  );
}

function ReportStat({ label, value, color }: { label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    cyan: 'text-cyan-400', green: 'text-green-400', yellow: 'text-yellow-400', red: 'text-red-400',
  };
  return (
    <div className="card p-4 text-center">
      <p className={`text-2xl font-black ${colors[color]}`}>{value}</p>
      <p className="text-xs text-slate-400 mt-1">{label}</p>
    </div>
  );
}


