import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';

/*
 * ticketArt.ts — utilidades para generar QR, PDF e imagen de entradas.
 * generateQRDataUrl: genera el código QR como data URL (PNG).
 * downloadTicketImage: descarga la entrada como imagen limpia basada en las coordenadas del organizador.
 * downloadTicketPDF: descarga la entrada como PDF.
 * buildWhatsAppMessage: construye el mensaje predeterminado para enviar al invitado.
 */

export async function generateQRDataUrl(code: string): Promise<string> {
  return QRCode.toDataURL(code, { width: 400, margin: 1, color: { dark: '#0a0f1a', light: '#ffffff' } });
}

export async function downloadTicketImage(opts: {
  code: string;
  attendeeName: string;
  eventName: string;
  eventDate: string;
  eventTime: string | null;
  amPm: string | null;
  location: string | null;
  bgImageUrl: string | null;
  qrPosX: number;
  qrPosY: number;
  qrSize: number;
}): Promise<void> {
  const { code, bgImageUrl, qrPosX, qrPosY, qrSize, attendeeName } = opts;
  const W = 800, H = 1200;
  const canvas = document.createElement('canvas');
  canvas.width = W; 
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // 1. Dibujar el fondo configurado por el organizador (o fallback corporativo si no hay)
  if (bgImageUrl) {
    try {
      const img = await loadImage(bgImageUrl);
      const ratio = Math.max(W / img.width, H / img.height);
      const dw = img.width * ratio, dh = img.height * ratio;
      ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
    } catch {
      drawFallbackBg(ctx, W, H);
    }
  } else {
    drawFallbackBg(ctx, W, H);
  }

  // 2. Generar y posicionar el código QR exactamente según los porcentajes definidos en el panel
  const qrDataUrl = await generateQRDataUrl(code);
  const qrImg = await loadImage(qrDataUrl);

  // El tamaño base del QR se calcula con base en el ancho del canvas y el slider qrSize (porcentaje)
  const qrW = (qrSize / 100) * W;
  
  // Posicionamiento preciso basado en los porcentajes X e Y del organizador
  const qrX = (qrPosX / 100) * W - (qrW / 2);
  const qrY = (qrPosY / 100) * H - (qrW / 2);

  // Fondo blanco con esquinas redondeadas bajo el QR para garantizar lectura perfecta en cualquier fondo
  const pad = 16;
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, qrX - pad, qrY - pad, qrW + pad * 2, qrW + pad * 2, 16);
  ctx.fill();

  // Dibujar el código QR limpio
  ctx.drawImage(qrImg, qrX, qrY, qrW, qrW);

  // Descarga directa del archivo de imagen optimizado
  const link = document.createElement('a');
  link.download = `entrada-${attendeeName ? attendeeName.toLowerCase().replace(/\s+/g, '-') : 'invitado'}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

export async function downloadTicketPDF(opts: {
  code: string;
  attendeeName: string;
  eventName: string;
  eventDate: string;
  eventTime: string | null;
  amPm: string | null;
  location: string | null;
}): Promise<void> {
  const { code, attendeeName, eventName, eventDate, eventTime, amPm, location } = opts;
  const qrDataUrl = await generateQRDataUrl(code);
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // Background
  pdf.setFillColor(10, 15, 26);
  pdf.rect(0, 0, 210, 297, 'F');

  // Event name
  pdf.setTextColor(34, 211, 238);
  pdf.setFontSize(22);
  pdf.setFont('helvetica', 'bold');
  pdf.text(eventName, 105, 30, { align: 'center' });

  // QR code
  pdf.addImage(qrDataUrl, 'PNG', 55, 50, 100, 100);

  // Attendee
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(18);
  pdf.text(attendeeName || 'Invitado', 105, 170, { align: 'center' });

  // Details
  pdf.setTextColor(148, 163, 184);
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'normal');
  const dateStr = `Fecha: ${eventDate}${eventTime ? ` - ${eventTime}${amPm || ''}` : ''}`;
  pdf.text(dateStr, 105, 185, { align: 'center' });
  if (location) pdf.text(`Ubicación: ${location}`, 105, 195, { align: 'center' });

  // Code
  pdf.setFontSize(10);
  pdf.text(`Codigo: ${code}`, 105, 210, { align: 'center' });

  // V-PASS footer
  pdf.setTextColor(34, 211, 238);
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text('V-PASS', 105, 280, { align: 'center' });

  pdf.save(`entrada-${attendeeName || 'invitado'}.pdf`);
}

export function buildWhatsAppMessage(attendeeName: string, eventName: string, ticketUrl: string): string {
  return `Hola ${attendeeName}! Esta es tu entrada para el evento "${eventName}". Presenta este código QR en la puerta para ingresar. Tu enlace seguro: ${ticketUrl}`;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function drawFallbackBg(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#0a0f1a');
  grad.addColorStop(0.5, '#111827');
  grad.addColorStop(1, '#0a0f1a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}