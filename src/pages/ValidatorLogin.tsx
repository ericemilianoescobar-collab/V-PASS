import { useState } from 'react';
import { ArrowLeft, Lock, Mail, AlertCircle, Loader2, QrCode } from 'lucide-react';
import VPassLogo from '@/components/VPassLogo';
import { supabase } from '@/lib/supabase';

interface ValidatorData {
  validatorId: string;
  validatorName: string;
  eventName: string;
  eventId: string;
}

interface Props {
  navigate: (route: string) => void;
  onLogin: (data: ValidatorData) => void;
}

export default function ValidatorLogin({ navigate, onLogin }: Props) {
  const [eventId, setEventId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data, error: rpcError } = await supabase.rpc('login_validator', {
        p_event_id: eventId.trim(),
        p_email: email.trim(),
        p_password: password,
      });

      if (rpcError) throw new Error(rpcError.message);

      if (!data || !data[0] || !data[0].validator_id) {
        setError('Credenciales incorrectas o evento no válido.');
        setLoading(false);
        return;
      }

      onLogin({
        validatorId: data[0].validator_id,
        validatorName: data[0].validator_name,
        eventName: data[0].event_name,
        eventId: data[0].event_id,
      });
    } catch {
      setError('Error al iniciar sesión. Verifica tus datos.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 relative overflow-hidden flex items-center justify-center px-6">
      <div className="absolute inset-0 bg-grid pointer-events-none" />
      <div className="absolute inset-0 bg-radial-cyan pointer-events-none" />
      <div className="absolute top-1/4 right-1/4 w-72 h-72 bg-cyan-500/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-md">
        <button onClick={() => navigate('home')} className="btn-ghost flex items-center gap-2 mb-6">
          <ArrowLeft size={18} /> Volver
        </button>

        <div className="card p-8 animate-scale-in">
          <div className="flex flex-col items-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 border border-cyan-400/30 flex items-center justify-center mb-3">
              <QrCode size={32} className="text-cyan-400" />
            </div>
            <h1 className="text-xl font-bold text-white">Acceso Validador</h1>
            <p className="text-sm text-slate-400 mt-1">Ingresa con las credenciales del evento</p>
          </div>

          {error && (
            <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm animate-fade-in">
              <AlertCircle size={18} />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">ID del evento</label>
              <input
                type="text"
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
                required
                placeholder="Ingresa el ID del evento"
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Correo</label>
              <div className="relative">
                <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="validador@evento.com"
                  className="input-field pl-10"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Contraseña</label>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="input-field pl-10"
                />
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
              {loading ? (
                <><Loader2 size={18} className="animate-spin" /> Verificando...</>
              ) : (
                'Ingresar al evento'
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-800">
            <div className="flex items-center justify-center gap-2">
              <VPassLogo size="sm" showText={false} />
              <p className="text-xs text-slate-500">Las credenciales las proporciona el organizador del evento</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
