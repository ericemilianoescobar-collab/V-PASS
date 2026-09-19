import { useEffect, useState } from 'react';
import { supabase, type Agency } from '@/lib/supabase';
import LandingPage from '@/pages/LandingPage';
import AgencyLogin from '@/pages/AgencyLogin';
import AgencyDashboard from '@/pages/AgencyDashboard';
import ValidatorLogin from '@/pages/ValidatorLogin';
import ValidatorScanner from '@/pages/ValidatorScanner';
import TicketView from '@/pages/TicketView';

type Route = 'home' | 'login' | 'dashboard' | 'validator' | 'scanner' | 'ticket';

interface ValidatorData {
  validatorId: string;
  validatorName: string;
  eventName: string;
  eventId: string;
}

export default function App() {
  const [route, setRoute] = useState<Route>('home');
  const [agency, setAgency] = useState<Agency | null>(null);
  const [loading, setLoading] = useState(true);
  const [validatorData, setValidatorData] = useState<ValidatorData | null>(null);
  const [ticketToken, setTicketToken] = useState<string | null>(null);

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash.startsWith('ticket/')) {
      setTicketToken(hash.slice(7));
      setRoute('ticket');
    } else if (hash === 'login') setRoute('login');
    else if (hash === 'validator') setRoute('validator');
    else if (hash === 'dashboard') setRoute('dashboard');
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        fetchAgency(data.session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        if (session) {
          await fetchAgency(session.user.id);
        } else {
          setAgency(null);
          setRoute('home');
          setLoading(false);
        }
      })();
    });

    return () => authListener.subscription.unsubscribe();
  }, []);

  async function fetchAgency(userId: string) {
    const { data } = await supabase
      .from('agencies')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (data) {
      setAgency(data as Agency);
      setRoute('dashboard');
    }
    setLoading(false);
  }

  function navigate(route: string) {
    setRoute(route as Route);
    if (route === 'home') {
      window.location.hash = '';
    } else {
      window.location.hash = route;
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
          <p className="text-slate-400 text-sm font-medium">Cargando V-PASS...</p>
        </div>
      </div>
    );
  }

  // Ticket view is public — opens the unique attendee ticket view without dashboard access
  if (route === 'ticket' && ticketToken) {
    return <TicketView accessToken={ticketToken} navigate={navigate} />;
  }

  switch (route) {
    case 'login':
      return <AgencyLogin navigate={navigate} />;
    case 'dashboard':
      if (!agency) return <AgencyLogin navigate={navigate} />;
      return <AgencyDashboard agency={agency} setAgency={setAgency} navigate={navigate} />;
    case 'validator':
      if (validatorData) {
        return <ValidatorScanner validatorData={validatorData} onLogout={() => { setValidatorData(null); navigate('validator'); }} />;
      }
      return <ValidatorLogin navigate={navigate} onLogin={setValidatorData} />;
    case 'scanner':
      if (validatorData) return <ValidatorScanner validatorData={validatorData} onLogout={() => { setValidatorData(null); navigate('validator'); }} />;
      return <ValidatorLogin navigate={navigate} onLogin={setValidatorData} />;
    default:
      return <LandingPage navigate={navigate} />;
  }
}