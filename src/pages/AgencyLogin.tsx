import { useState } from 'react';
import { LogIn, Loader2, AlertCircle, ArrowLeft } from 'lucide-react';
import VPassLogo from '@/components/VPassLogo';
import { supabase, type Agency } from '@/lib/supabase';

interface Props {
  setAgency: (agency: Agency) => void;
  navigate: (route: string) => void;
}

export default function AgencyLogin({ setAgency, navigate }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // 1. Autenticación con Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });

      if (authError) {
        throw new Error('Credenciales incorrectas o usuario no registrado.');
      }

      if (!authData.user) {
        throw new Error('No se pudo autenticar al usuario.');
      }

      // 2. Obtener datos de la agencia en la tabla 'agencies'
      const { data: agencyData, error: agencyError } = await supabase
        .from('agencies')
        .select('*')
        .eq('email', authData.user.email)
        .single();

      if (agencyError || !agencyData) {
        throw new Error('No se encontró el perfil de la organización.');
      }

      setAgency(agencyData as Agency);
      navigate('dashboard');
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-grid pointer-events-none" />
      
      <div className="relative z-10 w-full max-w-md card p-8 space-y-6 shadow-2xl border border-slate-800 bg-slate-900/90 backdrop-blur-xl">
        <button 
          onClick={() => navigate('home')} 
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={16} /> Volver
        </button>

        <div className="text-center space-y-2">
          <div className="flex justify-center mb-3">
            <VPassLogo size="md" />
          </div>
          <h1 className="text-xl font-bold text-white">Iniciar sesión</h1>
          <p className="text-xs text-slate-400">Acceso exclusivo para agencias y organizadores</p>
        </div>

        {error && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs animate-fade-in">
            <AlertCircle size={16} className="shrink-0" /> 
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Correo electrónico</label>
            <input 
              type="email" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              required 
              className="input-field text-sm" 
              placeholder="organizador@v-pass.com" 
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Contraseña</label>
            <input 
              type="password" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              required 
              className="input-field text-sm" 
              placeholder="••••••••••••" 
            />
          </div>

          <button 
            type="submit" 
            disabled={loading} 
            className="btn-primary w-full flex items-center justify-center gap-2 py-3 mt-2 font-semibold text-sm shadow-lg shadow-cyan-500/10"
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" /> 
                <span>Ingresando...</span>
              </>
            ) : (
              <>
                <LogIn size={18} /> 
                <span>Ingresar al panel</span>
              </>
            )}
          </button>
        </form>

        <div className="text-center pt-2 border-t border-slate-800">
          <p className="text-xs text-slate-500">
            ¿No tienes cuenta?{' '}
            <a 
              href="https://wa.me/" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-cyan-400 hover:underline font-medium"
            >
              Contáctanos por WhatsApp
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}