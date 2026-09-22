import { useState, useEffect } from 'react';
import LandingPage from '@/pages/LandingPage';
import AgencyLogin from '@/pages/AgencyLogin';
import AgencyDashboard from '@/pages/AgencyDashboard';
import TicketView from '@/pages/TicketView';
import ValidatorLogin from '@/pages/ValidatorLogin';
import ValidatorScanner from '@/pages/ValidatorScanner';
import { supabase, type Agency } from '@/lib/supabase';

export default function App() {
  const [route, setRoute] = useState<string>('home');
  const [agency, setAgency] = useState<Agency | null>(null);
  const [ticketCode, setTicketCode] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Manejador de rutas basado en Hash (ej. #ticket/VP-12345 o #dashboard)
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#ticket/')) {
        const code = hash.replace('#ticket/', '');
        setTicketCode(code);
        setRoute('ticket');
      } else if (hash === '#login') {
        setRoute('login');
      } else if (hash === '#dashboard' && agency) {
        setRoute('dashboard');
      } else {
        // Si no hay hash específico de ticket, revisamos sesión activa
        checkAuth();
      }
    };

    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: agencyData } = await supabase
          .from('agencies')
          .select('*')
          .eq('email', session.user.email)
          .single();
        if (agencyData) {
          setAgency(agencyData as Agency);
        }
      }
      setLoading(false);
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [agency]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-cyan-400">
        Cargando V-PASS...
      </div>
    );
  }

  // Vista exclusiva y limpia para el invitado (Repositorio de ticket individual)
  if (route === 'ticket' && ticketCode) {
    return <TicketView code={ticketCode} />;
  }

  // Vistas generales de la plataforma
  if (route === 'login') {
    return <AgencyLogin setAgency={(ag) => { setAgency(ag); setRoute('dashboard'); }} navigate={(r) => setRoute(r)} />;
  }

  if (route === 'dashboard' && agency) {
    return <AgencyDashboard agency={agency} setAgency={setAgency} navigate={(r) => setRoute(r)} />;
  }

  if (route === 'validator-login') {
    return <ValidatorLogin navigate={(r) => setRoute(r)} />;
  }

  if (route === 'validator-scanner') {
    return <ValidatorScanner navigate={(r) => setRoute(r)} />;
  }

  return <LandingPage navigate={(r) => setRoute(r)} />;
}