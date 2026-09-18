import { QrCode } from 'lucide-react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
}

const sizeMap = {
  sm: { icon: 24, text: 'text-lg' },
  md: { icon: 32, text: 'text-xl' },
  lg: { icon: 48, text: 'text-2xl' },
  xl: { icon: 72, text: 'text-4xl' },
};

export default function VPassLogo({ size = 'md', showText = true, className = '' }: LogoProps) {
  const s = sizeMap[size];
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div className="relative">
        <div className="absolute inset-0 bg-cyan-400/30 rounded-xl blur-md" />
        <div className="relative flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl border border-cyan-400/30" style={{ width: s.icon + 8, height: s.icon + 8 }}>
          <QrCode size={s.icon} className="text-cyan-400" strokeWidth={2} />
        </div>
      </div>
      {showText && (
        <div className="flex flex-col leading-none">
          <span className={`font-black tracking-tight text-white ${s.text}`}>
            V-PASS
          </span>
          {size !== 'sm' && (
            <span className="text-[10px] tracking-[0.2em] text-cyan-400/70 font-semibold uppercase mt-0.5">
              Entry Control
            </span>
          )}
        </div>
      )}
    </div>
  );
}
