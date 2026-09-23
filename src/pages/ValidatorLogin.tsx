import { useState } from 'react';
import { QrCode, Lock, User, ArrowLeft, AlertCircle, Loader2 } from 'lucide-react';
import VPassLogo from '@/components/VPassLogo';
import { supabase, type Validator, type Event } from '@/lib/supabase';

interface Props {
  navigate: (route: string) => void;
  setValidatorSession: (validator: Validator, event: Event) => void;
}

export default function ValidatorLogin({ navigate, setValidatorSession }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (eventForm: React.FormEvent) => {
    eventForm.preventDefault();
    setError('');
    setLoading(true);

    try {
      const cleanUser = username.trim();
      const cleanPass = password.trim();

      if (!cleanUser || !cleanPass) {
        throw new Error('Por favor ingresa usuario y contraseña.');
      }

      // Consultamos la tabla validators usando la columna email (que contiene el usuario)
      const { data: validatorsList, error: valError } = await supabase
        .from('validators')
        .select('*')
        .eq('email', cleanUser)
        .eq('password_hash', cleanPass);

      if (valError) {
        console.error('Error de Supabase:', valError);
        throw new Error('Error al conectar con la base de datos.');
      }

      if (!validatorsList || validatorsList.length === 0) {
        throw new Error('Usuario o contraseña incorrectos.');
      }

      const validatorData = validatorsList[0];

      if (validatorData.active === false) {
        throw new Error('Este validador se encuentra inactivo.');
      }

      // Buscamos el evento asociado en la tabla events
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('*')
        .eq('id', validatorData.event_id)
        .single();

      if (eventError || !eventData) {
        throw new Error('No se encontró el evento asociado a este validador.');
      }

      // Guardamos la sesión y redirigimos al escáner
      setValidatorSession(validatorData as Validator, eventData as Event);
      navigate('validator-scanner');
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error al iniciar sesión.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 relative overflow-hidden flex flex-col justify-between">
      <div className="absolute inset-0 bg-grid pointer-events-none" />
      <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="relative z-20 flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/80 backdrop-blur-xl">
        <button onClick={() => navigate('home')} className="flex items-center gap-2">
          <VPassLogo size="sm" />
        </button>
        <button onClick={() => navigate('home')} className="btn-ghost flex items-center gap-2 text-sm text-slate-400 hover:text-white">
          <ArrowLeft size={16} /> Volver al inicio
        </button>
      </header>

      {/* Main Login Box */}
      <main className="relative z-10 max-w-md w-full mx-auto px-4 py-12 flex-1 flex items-center justify-center">
        <div className="card p-8 w-full space-y-6 border border-slate-800 bg-slate-900/90 shadow-2xl">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 bg-cyan-500/10 border border-cyan-500/20 rounded-2xl flex items-center justify-center mx-auto text-cyan-400">
              <QrCode size={28} />
            </div>
            <h2 className="text-xl font-extrabold text-white">Portal de Validador</h2>
            <p className="text-xs text-slate-400">Ingresa las credenciales asignadas para tu puesto de control</p>
          </div>

          {error && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm animate-fade-in">
              <AlertCircle size={18} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-300">Usuario de acceso</label>
              <div className="relative">
                <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  placeholder="Ej: validador5prueba"
                  className="input-field pl-10 text-sm"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-300">Contraseña</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="input-field pl-10 text-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3 text-sm flex items-center justify-center gap-2 mt-2"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <QrCode size={18} />}
              Ingresar al Escáner
            </button>
          </form>
        </div>
      </main>

      <footer className="relative z-20 py-4 text-center text-xs text-slate-600 border-t border-slate-900">
        V-PASS Entry Control • Sistema de Validación por QR
      </footer>
    </div>
  );
}