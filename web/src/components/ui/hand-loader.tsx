import Image from 'next/image';

export function HandLoader({ className }: { className?: string }) {
  return (
    <div className={`relative flex flex-col items-center justify-center gap-6 py-6 select-none ${className || ''}`}>
      {/* EasyJob Logo appearing behind the tapping hand */}
      <div className="relative flex items-center justify-center">
        <div className="absolute -top-12 z-0 opacity-85 transition-all animate-pulse">
          <Image
            src="/easyjob-logo.png"
            alt="EasyJob"
            width={160}
            height={50}
            className="h-14 w-auto object-contain drop-shadow-md"
          />
        </div>

        {/* Tapping Hand Animation (From Uiverse.io by Pradeepsaranbishnoi) */}
        <div className="relative z-10 my-4 scale-90 sm:scale-100">
          <div className="🤚">
            <div className="👉"></div>
            <div className="👉"></div>
            <div className="👉"></div>
            <div className="👉"></div>
            <div className="🌴"></div>
            <div className="👍"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
