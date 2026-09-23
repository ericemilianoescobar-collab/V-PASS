import { useState, useEffect } from 'react';
import { X, AlertCircle, Loader2, Plus, UserPlus, Ticket as TicketIcon, Lock, Upload, HelpCircle, DollarSign } from 'lucide-react';
import { supabase, type Agency, type Event } from '@/lib/supabase';
import { generateTicketCode } from '@/lib/constants';
import { downloadTicketPDF, downloadTicketImage } from '@/lib/ticketArt';

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
  const [imageAspect, setImageAspect] = useState<number>(16 / 9);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [qrPosX, setQrPosX] = useState(50);
  const [qrPosY, setQrPosY] = useState(50);
  const [qrSize, setQrSize] = useState(30);
  
  const [precioEntrada, setPrecioEntrada] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    setError('');

    try {
      const fileExt = file.name.split('.').pop();
      const randomStr = Math.random().toString(36).substring(2);
      const fileName = `${randomStr}-${Date.now()}.${fileExt}`;
      const filePath = `event-bg/${fileName}`;

      const { error: uploadErr } = await supabase.storage.from('event-assets').upload(filePath, file);
      
      const processImage = (url: string) => {
        setBgImageUrl(url);
        const img = new Image();
        img.src = url;
        img.onload = () => {
          if (img.naturalWidth && img.naturalHeight) {
            setImageAspect(img.naturalWidth / img.naturalHeight);
          }
        };
      };

      if (uploadErr) {
        const reader = new FileReader();
        reader.onloadend = () => {
          processImage(reader.result as string);
          setUploadingImage(false);
        };
        reader.readAsDataURL(file);
        return;
      }

      const { data: publicURLData } = supabase.storage.from('event-assets').getPublicUrl(filePath);
      processImage(publicURLData.publicUrl);
    } catch (err: any) {
      setError('Error al subir la imagen: ' + err.message);
    } finally {
      setUploadingImage(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const eventPayload = {
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
    };

    const { data, error: insertError } = await supabase.from('events').insert(eventPayload).select().single();

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    // Guardar el precio localmente para reportes financieros sin alterar esquemas de Supabase
    if (precioEntrada && data) {
      localStorage.setItem(`event_price_${data.id}`, precioEntrada);
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

        {/* CONTROL FINANCIERO */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
          <div className="flex items-center gap-2">
            <DollarSign size={16} className="text-cyan-400" />
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Control Financiero (Solo para el Organizador)</h4>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Precio de la entrada ($ / S/.)</label>
            <input 
              type="number" 
              step="0.01" 
              min="0"
              value={precioEntrada} 
              onChange={e => setPrecioEntrada(e.target.value)} 
              className="input-field text-xs" 
              placeholder="Ej. 25.00" 
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Imagen de fondo del ticket</label>
          <div className="flex items-center gap-3">
            <label className="btn-secondary text-xs flex items-center gap-2 cursor-pointer py-2 px-3">
              {uploadingImage ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              <span>{uploadingImage ? 'Subiendo...' : 'Subir desde archivo'}</span>
              <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            </label>
            <span className="text-xs text-slate-500">o ingresa enlace URL abajo</span>
          </div>
          <input 
            value={bgImageUrl} 
            onChange={e => setBgImageUrl(e.target.value)} 
            className="input-field mt-2 text-xs" 
            placeholder="https://... o imagen cargada" 
          />
        </div>

        {/* PREVISUALIZACIÓN ADAPTADA */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
          <p className="text-xs font-semibold text-slate-400">Previsualización en vivo (Proporción real):</p>
          <div 
            className="relative w-full rounded-lg bg-slate-950 overflow-hidden flex items-center justify-center border border-slate-800 shadow-inner"
            style={{ aspectRatio: imageAspect }}
          >
            {bgImageUrl ? (
              <img src={bgImageUrl} alt="Fondo Ticket" className="w-full h-full object-cover" />
            ) : (
              <div className="text-slate-500 text-xs py-10">Sube una imagen para ver la previsualización</div>
            )}
            <div className="absolute inset-0 bg-black/30 pointer-events-none" />
            <div 
              className="absolute bg-white rounded-lg p-1.5 shadow-lg flex items-center justify-center"
              style={{
                left: `${qrPosX}%`,
                top: `${qrPosY}%`,
                transform: 'translate(-50%, -50%)',
                width: `${qrSize * 1.2}%`,
                height: `${qrSize * 1.2}%`,
              }}
            >
              <div className="w-full h-full bg-slate-900 rounded flex items-center justify-center text-[8px] text-white font-bold">QR</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">QR Pos X: {qrPosX}%</label>
            <input type="range" min={10} max={90} value={qrPosX} onChange={e => setQrPosX(parseInt(e.target.value))} className="w-full accent-cyan-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">QR Pos Y: {qrPosY}%</label>
            <input type="range" min={10} max={90} value={qrPosY} onChange={e => setQrPosY(parseInt(e.target.value))} className="w-full accent-cyan-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">QR Tamaño: {qrSize}%</label>
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
  const [lastTicket, setLastTicket] = useState<{ code: string; attendeeName: string; guestPhone: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError('');

    const code = generateTicketCode(event.id);
    const cleanPhoneVal = phone.trim() || '';
    
    const { error: insertError } = await supabase.from('tickets').insert({
      event_id: event.id,
      code,
      attendee_name: name.trim(),
      guest_phone: cleanPhoneVal,
    });

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    setLastTicket({
      code,
      attendeeName: name.trim(),
      guestPhone: cleanPhoneVal,
    });
    setName('');
    setPhone('');
    setLoading(false);
    onAdded();
  };

  const handleWhatsApp = () => {
    if (!lastTicket) return;
    const ticketUrl = `${window.location.origin}/#ticket/${lastTicket.code}`;
    const eventLocation = event.location || 'Por confirmar';
    const eventDateStr = `${event.event_date || ''} ${event.event_time ? `- ${event.event_time}${event.am_pm || ''}` : ''}`;

    const textMsg = `Hola *${lastTicket.attendeeName}*, aquí tienes tu pase para *${event.name}*.\n\n` +
      `🎟️ *Código de entrada:* ${lastTicket.code}\n` +
      `📅 *Fecha:* ${eventDateStr}\n` +
      `📍 *Lugar:* ${eventLocation}\n\n` +
      `🔗 *Ver tu entrada:* ${ticketUrl}\n\n` +
      `Presenta este pase en el ingreso.\n\n` +
      `⚠️ *Importante:* No compartas este enlace ni tu entrada con nadie.`;

    const msg = encodeURIComponent(textMsg);
    const cleanPhone = lastTicket.guestPhone ? lastTicket.guestPhone.replace(/\D/g, '') : '';
    const link = cleanPhone ? `https://wa.me/${cleanPhone}?text=${msg}` : `https://wa.me/?text=${msg}`;
    window.open(link, '_blank');
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
          <label className="block text-sm font-medium text-slate-300 mb-1">Número de teléfono (WhatsApp)</label>
          <input value={phone} onChange={e => setPhone(e.target.value)} className="input-field" placeholder="921543755" />
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
          <p className="text-xs text-slate-500 font-mono mb-3">Código: {lastTicket.code} {lastTicket.guestPhone ? `• Tel: ${lastTicket.guestPhone}` : ''}</p>
          <button onClick={handleWhatsApp} className="w-full px-3 py-2.5 rounded-xl font-semibold text-sm bg-green-500/10 text-green-300 border border-green-500/20 hover:bg-green-500/20 transition-all flex items-center justify-center gap-1.5">
            Enviar por WhatsApp
          </button>
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

  // Obtenemos el precio guardado localmente o de la BD si existe
  const savedPriceStr = localStorage.getItem(`event_price_${event.id}`);
  const precioEntrada = savedPriceStr ? parseFloat(savedPriceStr) : ((event as any).price || 0);

  const usedTickets = report?.used_tickets || 0;
  const validTickets = report?.valid_tickets || 0; // Pérdidas
  
  const ingresosReales = usedTickets * precioEntrada;
  const perdidasEstimadas = validTickets * precioEntrada;

  const handleDownloadPDF = async () => {
    if (!report) return;
    setDownloading(true);
    const { jsPDF } = await import('jspdf');
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    pdf.setFillColor(10, 15, 26); pdf.rect(0, 0, 210, 297, 'F');
    pdf.setTextColor(34, 211, 238); pdf.setFontSize(22); pdf.setFont('helvetica', 'bold');
    pdf.text('V-PASS — Reporte Financiero y de Evento', 105, 25, { align: 'center' });
    pdf.setTextColor(255, 255, 255); pdf.setFontSize(16);
    pdf.text(report.event_name || event.name, 105, 42, { align: 'center' });
    pdf.setFontSize(12); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(148, 163, 184);
    pdf.text(`Fecha: ${report.event_date || event.event_date}${report.event_time ? ` - ${report.event_time}${report.am_pm || ''}` : ''}`, 105, 52, { align: 'center' });
    if (report.location) pdf.text(`Ubicacion: ${report.location}`, 105, 60, { align: 'center' });
    pdf.setDrawColor(34, 211, 238); pdf.line(30, 70, 180, 70);
    
    pdf.setTextColor(255, 255, 255); pdf.setFontSize(14); pdf.setFont('helvetica', 'bold');
    let y = 85;
    const rows: [string, string][] = [
      ['Precio por entrada', `S/. ${precioEntrada.toFixed(2)}`],
      ['Total de entradas generadas', String(report.total_tickets || 0)],
      ['Asistentes validados (Ingresaron)', String(usedTickets)],
      ['Entradas sin usar (Pérdidas)', String(validTickets)],
      ['Entradas canceladas', String(report.cancelled_tickets || 0)],
      ['Ingresos Reales Recaudados', `S/. ${ingresosReales.toFixed(2)}`],
      ['Pérdidas por entradas no usadas', `S/. ${perdidasEstimadas.toFixed(2)}`],
    ];
    for (const [label, val] of rows) {
      pdf.text(label, 30, y); pdf.text(val, 180, y, { align: 'right' }); y += 10;
    }
    const pct = report.total_tickets > 0 ? Math.round((usedTickets / report.total_tickets) * 100) : 0;
    pdf.text(`Porcentaje de asistencia`, 30, y); pdf.text(`${pct}%`, 180, y, { align: 'right' });
    pdf.setTextColor(34, 211, 238); pdf.setFontSize(12); pdf.text('V-PASS', 105, 280, { align: 'center' });
    pdf.save(`reporte-financiero-${event.name}.pdf`);
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
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col justify-between">
              <p className="text-xs text-slate-300 font-medium">Ingresos Reales</p>
              <p className="text-2xl font-black text-emerald-400 mt-2">S/. {ingresosReales.toFixed(2)}</p>
              <p className="text-[10px] text-slate-400 mt-1">{usedTickets} entradas validadas</p>
            </div>
            <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 flex flex-col justify-between">
              <p className="text-xs text-slate-300 font-medium">Pérdidas (No usadas)</p>
              <p className="text-2xl font-black text-red-400 mt-2">S/. {perdidasEstimadas.toFixed(2)}</p>
              <p className="text-[10px] text-slate-400 mt-1">{validTickets} entradas sin usar</p>
            </div>
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
              <span className="text-white font-bold">{report.total_tickets > 0 ? Math.round((usedTickets / report.total_tickets) * 100) : 0}%</span>
            </div>
            <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-cyan-400 to-green-400 rounded-full transition-all duration-500" 
                style={{ width: `${report.total_tickets > 0 ? Math.min(100, Math.round((usedTickets / report.total_tickets) * 100)) : 0}%` }}
              />
            </div>
          </div>
          <button 
            onClick={handleDownloadPDF} 
            disabled={downloading}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {downloading ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />} Descargar reporte financiero PDF
          </button>
        </div>
      ) : (
        <p className="text-center text-slate-400 py-6">No hay datos de reporte disponibles.</p>
      )}
    </ModalShell>
  );
}

function ReportStat({ label, value, color }: { label: string; value: number; color: 'cyan' | 'green' | 'yellow' | 'red' }) {
  const colors = {
    cyan: 'border-cyan-500/20 bg-cyan-500/5 text-cyan-400',
    green: 'border-green-500/20 bg-green-500/5 text-green-400',
    yellow: 'border-yellow-500/20 bg-yellow-500/5 text-yellow-400',
    red: 'border-red-500/20 bg-red-500/5 text-red-400',
  };
  return (
    <div className={`p-4 rounded-xl border ${colors[color]} flex flex-col justify-between`}>
      <span className="text-xs text-slate-400 font-medium">{label}</span>
      <span className="text-2xl font-extrabold mt-2">{value ?? 0}</span>
    </div>
  );
}

// ============ 5. SOPORTE TÉCNICO ============

export function SupportModal({ onClose, onSupportLoginSuccess }: { onClose: () => void; onSupportLoginSuccess: () => void }) {
  const [credential, setCredential] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSupportLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    setTimeout(() => {
      if (
        credential.trim().toUpperCase() === 'V-PASS172417@.COM' && 
        password === 'M@rciano172417'
      ) {
        setLoading(false);
        onClose();
        onSupportLoginSuccess();
      } else {
        setError('Credenciales de soporte técnico incorrectas.');
        setLoading(false);
      }
    }, 500);
  };

  return (
    <ModalShell title="Soporte técnico" onClose={onClose}>
      <form onSubmit={handleSupportLogin} className="space-y-4">
        <div className="flex items-center gap-2 p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs">
          <HelpCircle size={16} className="shrink-0" />
          <span>Ingresa con tus credenciales administrativas de soporte para emitir pases de cortesía y gestionar incidencias.</span>
        </div>

        {error && <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">{error}</div>}

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Usuario / Credencial</label>
          <input 
            type="text" 
            value={credential} 
            onChange={e => setCredential(e.target.value)} 
            required 
            className="input-field uppercase" 
            placeholder="V-PASS172417@.COM" 
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Contraseña</label>
          <input 
            type="password" 
            value={password} 
            onChange={e => setPassword(e.target.value)} 
            required 
            className="input-field" 
            placeholder="••••••••••••" 
          />
        </div>

        <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
          {loading ? <Loader2 size={18} className="animate-spin" /> : <Lock size={18} />} Acceder
        </button>
      </form>
    </ModalShell>
  );
}