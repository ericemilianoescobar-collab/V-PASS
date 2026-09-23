import { useState, useEffect } from 'react';
import LandingPage from '@/pages/LandingPage';
import AgencyLogin from '@/pages/AgencyLogin';
import AgencyDashboard from '@/pages/AgencyDashboard';
import TicketView from '@/pages/TicketView';
import ValidatorLogin from '@/pages/ValidatorLogin';
import ValidatorScanner from '@/pages/ValidatorScanner';
import { supabase, type Agency, type Validator, type Event } from '@/lib/supabase';

export default function App() {
  const [route, setRoute] = useState<string>('home');
  const [agency, setAgency] = useState<Agency | null>(null);
  const [ticketCode, setTicketCode] = useState<string | null>(null);
  const [validatorSession, setValidatorSession] = useState<{ validator: Validator; event: Event } | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const handleNavigation = async () => {
      const hash = window.location.hash;
      
      if (hash.startsWith('#ticket/')) {
        const code = hash.replace('#ticket/', '');
        setTicketCode(code);
        setRoute('ticket');
        setLoading(false);
        return;
      }

      if (hash === '#login') {
        setRoute('login');
        setLoading(false);
        return;
      }

      if (hash === '#validator-login') {
        setRoute('validator-login');
        setLoading(false);
        return;
      }

      if (hash === '#validator-scanner') {
        setRoute('validator-scanner');
        setLoading(false);
        return;
      }

      // Verificamos sesión activa en Supabase
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const { data: agencyData } = await supabase
            .from('agencies')
            .select('*')
            .eq('email', session.user.email)
            .single();
          if (agencyData) {
            setAgency(agencyData as Agency);
            setRoute('dashboard');
          }
        }
      } catch (err) {
        console.error("Error al verificar sesión:", err);
      }
      setLoading(false);
    };

    handleNavigation();
    window.addEventListener('hashchange', handleNavigation);
    return () => window.removeEventListener('hashchange', handleNavigation);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-cyan-400 font-medium">
        Cargando V-PASS...
      </div>
    );
  }

  if (route === 'ticket' && ticketCode) {
    return <TicketView code={ticketCode} />;
  }

  if (route === 'login') {
    return <AgencyLogin setAgency={(ag) => { setAgency(ag); setRoute('dashboard'); }} navigate={(r) => setRoute(r)} />;
  }

  if (route === 'dashboard' && agency) {
    return <AgencyDashboard agency={agency} setAgency={setAgency} navigate={(r) => setRoute(r)} />;
  }

  if (route === 'validator-login') {
    return (
      <ValidatorLogin 
        navigate={(r) => setRoute(r)} 
        setValidatorSession={(val, ev) => {
          setValidatorSession({ validator: val, event: ev });
        }} 
      />
    );
  }

  if (route === 'validator-scanner' && validatorSession) {
    return (
      <ValidatorScanner 
        navigate={(r) => setRoute(r)} 
        validator={validatorSession.validator} 
        event={validatorSession.event} 
      />
    );
  }

  return <LandingPage navigate={(r) => setRoute(r)} />;
}