export const WHATSAPP_NUMBER = '921543755';
export const WHATSAPP_DISPLAY = '+51 921 543 755';

export const PLAN_FEATURES = {
  basic: {
    name: 'Plan Básico',
    price: 'S/100',
    tickets: '250 entradas',
    validators: '1 validador',
    features: [
      '250 entradas incluidas',
      '1 validador con escáner QR',
      'Panel de control básico',
      'Códigos QR únicos por entrada',
      'Soporte por WhatsApp',
    ],
    highlight: false,
  },
  standard: {
    name: 'Plan Estándar',
    price: 'S/150',
    tickets: '350 entradas',
    validators: '3 validadores',
    features: [
      '350 entradas incluidas',
      '3 validadores con escáner QR',
      'Panel de control avanzado',
      'Códigos QR únicos por entrada',
      'Validación en tiempo real',
      'Soporte prioritario por WhatsApp',
    ],
    highlight: true,
  },
  premium: {
    name: 'Plan Premium',
    price: 'S/250',
    tickets: 'Entradas ilimitadas',
    validators: '5 validadores',
    features: [
      'Entradas ilimitadas',
      '5 validadores con escáner QR',
      'Panel de control premium',
      'Reportes detallados de asistencia (PDF)',
      'Códigos QR únicos por entrada',
      'Validación en tiempo real',
      'Soporte VIP 24/7 por WhatsApp',
    ],
    highlight: false,
  },
} as const;

export function whatsappLink(message: string): string {
  return `https://wa.me/51${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

export function whatsappLinkToNumber(phone: string, message: string): string {
  const clean = phone.replace(/\D/g, '');
  const withCountry = clean.startsWith('51') ? clean : `51${clean}`;
  return `https://wa.me/${withCountry}?text=${encodeURIComponent(message)}`;
}

export function generateTicketCode(eventId: string): string {
  const part = eventId.slice(0, 6).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 10).toUpperCase();
  return `VP-${part}-${rand}`;
}

export function getTicketUrl(accessToken: string): string {
  const base = window.location.origin + window.location.pathname;
  return `${base}#ticket/${accessToken}`;
}
