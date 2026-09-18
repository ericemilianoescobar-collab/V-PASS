import { useState } from 'react';
import { Menu, X, ShieldCheck, Zap, MessageCircle, Check, ArrowRight, QrCode, BarChart3, Users, Clock } from 'lucide-react';
import VPassLogo from '@/components/VPassLogo';
import { PLAN_FEATURES, whatsappLink, WHATSAPP_DISPLAY } from '@/lib/constants';

interface Props {
  navigate: (route: string) => void;
}

export default function LandingPage({ navigate }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);

  const handleRegister = () => {
    window.open(
      whatsappLink('Hola, vengo desde la página web de V-PASS y quiero contratar sus servicios. ¿Me pueden ayudar con el registro?'),
      '_blank'
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-grid pointer-events-none" />
      <div className="absolute inset-0 bg-radial-cyan pointer-events-none" />
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="relative z-20 flex items-center justify-between px-6 lg:px-12 py-5">
        <VPassLogo size="md" />

        {/* Desktop buttons */}
        <div className="hidden md:flex items-center gap-3">
          <button onClick={() => navigate('validator')} className="btn-ghost flex items-center gap-2">
            <QrCode size={18} />
            Validador
          </button>
          <button onClick={() => navigate('login')} className="btn-secondary">
            Iniciar sesión
          </button>
          <button onClick={handleRegister} className="btn-primary flex items-center gap-2">
            Regístrate
            <ArrowRight size={18} />
          </button>
        </div>

        {/* Mobile menu button */}
        <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden text-slate-300 p-2">
          {menuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </header>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 z-30 bg-slate-900/95 backdrop-blur-xl border-b border-slate-800 p-4 flex flex-col gap-3 animate-fade-in">
          <button onClick={() => { navigate('validator'); setMenuOpen(false); }} className="btn-ghost flex items-center gap-2 text-left">
            <QrCode size={18} /> Validador
          </button>
          <button onClick={() => { navigate('login'); setMenuOpen(false); }} className="btn-secondary text-center">
            Iniciar sesión
          </button>
          <button onClick={() => { handleRegister(); setMenuOpen(false); }} className="btn-primary text-center flex items-center justify-center gap-2">
            Regístrate <ArrowRight size={18} />
          </button>
        </div>
      )}

      {/* Hero section */}
      <section className="relative z-10 flex flex-col items-center pt-12 pb-8 px-6">
        <div className="animate-fade-in-up">
          <VPassLogo size="xl" />
        </div>

        <p className="mt-6 text-slate-400 text-center max-w-md text-sm leading-relaxed animate-fade-in-up delay-200">
          Control de entradas online mediante lector QR. Gestión privada, confiable y rápida,
          conectada con WhatsApp.
        </p>

        {/* Feature badges */}
        <div className="mt-8 flex flex-wrap justify-center gap-3 animate-fade-in-up delay-300">
          <div className="badge bg-cyan-400/10 text-cyan-300 border border-cyan-400/20">
            <ShieldCheck size={14} /> Control privado
          </div>
          <div className="badge bg-blue-400/10 text-blue-300 border border-blue-400/20">
            <Zap size={14} /> Validación rápida
          </div>
          <div className="badge bg-green-400/10 text-green-300 border border-green-400/20">
            <MessageCircle size={14} /> Conectado a WhatsApp
          </div>
        </div>
      </section>

      {/* Plans section */}
      <section className="relative z-10 px-6 pb-16">
        <h2 className="text-center text-2xl font-bold text-white mb-2">Nuestros planes</h2>
        <p className="text-center text-slate-400 text-sm mb-10">Elige el plan que mejor se adapte a tu evento</p>

        <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-6">
          {Object.entries(PLAN_FEATURES).map(([key, plan], idx) => (
            <div
              key={key}
              className={`card p-6 flex flex-col animate-fade-in-up delay-${(idx + 2) * 100} ${
                plan.highlight
                  ? 'border-cyan-400/40 shadow-xl shadow-cyan-400/10 md:scale-105'
                  : ''
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="badge bg-cyan-400 text-slate-950 font-bold text-xs">
                    Más popular
                  </span>
                </div>
              )}

              <h3 className="text-lg font-bold text-white mb-1">{plan.name}</h3>
              <div className="flex items-baseline gap-1 mb-4">
                <span className="text-3xl font-black text-white">{plan.price}</span>
                <span className="text-slate-500 text-sm">/ evento</span>
              </div>

              <div className="flex gap-2 mb-5">
                <span className="badge bg-slate-800 text-cyan-300 border border-slate-700">
                  {plan.tickets}
                </span>
                <span className="badge bg-slate-800 text-blue-300 border border-slate-700">
                  {plan.validators}
                </span>
              </div>

              <ul className="space-y-3 mb-6 flex-1">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-slate-300">
                    <Check size={16} className="text-cyan-400 mt-0.5 shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={handleRegister}
                className={`w-full py-3 rounded-xl font-semibold transition-all duration-200 active:scale-[0.97] flex items-center justify-center gap-2 ${
                  plan.highlight
                    ? 'bg-gradient-to-r from-cyan-400 to-cyan-300 text-slate-950 hover:from-cyan-300 hover:to-cyan-200 shadow-lg shadow-cyan-400/20'
                    : 'bg-slate-800 text-white hover:bg-slate-700 border border-slate-700'
                }`}
              >
                Contratar
                <ArrowRight size={16} />
              </button>
            </div>
          ))}
        </div>

        {/* WhatsApp CTA */}
        <div className="max-w-5xl mx-auto mt-8">
          <div className="card p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center border border-green-500/20">
                <MessageCircle size={24} className="text-green-400" />
              </div>
              <div>
                <h3 className="font-bold text-white">¿Listo para empezar?</h3>
                <p className="text-sm text-slate-400">Contáctanos directamente por WhatsApp</p>
              </div>
            </div>
            <a
              href={whatsappLink('Hola, quiero más información sobre V-PASS')}
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 rounded-xl font-semibold bg-green-500 hover:bg-green-400 text-white transition-all duration-200 active:scale-[0.97] flex items-center gap-2"
            >
              <MessageCircle size={18} />
              {WHATSAPP_DISPLAY}
            </a>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="relative z-10 px-6 pb-20">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-center text-2xl font-bold text-white mb-10">¿Cómo funciona?</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="card p-6 text-center">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-cyan-400/10 flex items-center justify-center mb-4 border border-cyan-400/20">
                <Users size={28} className="text-cyan-400" />
              </div>
              <h3 className="font-bold text-white mb-2">1. Contrata tu plan</h3>
              <p className="text-sm text-slate-400">Escríbenos por WhatsApp y te creamos una cuenta con correo y contraseña.</p>
            </div>
            <div className="card p-6 text-center">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-blue-400/10 flex items-center justify-center mb-4 border border-blue-400/20">
                <QrCode size={28} className="text-blue-400" />
              </div>
              <h3 className="font-bold text-white mb-2">2. Genera entradas</h3>
              <p className="text-sm text-slate-400">Crea tu evento, genera entradas con QR y asigna validadores.</p>
            </div>
            <div className="card p-6 text-center">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-green-400/10 flex items-center justify-center mb-4 border border-green-400/20">
                <BarChart3 size={28} className="text-green-400" />
              </div>
              <h3 className="font-bold text-white mb-2">3. Controla el acceso</h3>
              <p className="text-sm text-slate-400">Los validadores escanean QR y tú ves todo en tiempo real.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-800 px-6 py-8">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <VPassLogo size="sm" />
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Clock size={14} />
            <span>Soporte 24/7 por WhatsApp</span>
          </div>
          <p className="text-xs text-slate-600">© 2026 V-PASS. Todos los derechos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
