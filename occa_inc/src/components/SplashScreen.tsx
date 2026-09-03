import React, { useEffect } from 'react';
import { motion } from 'motion/react';

interface OccaAppIconProps {
  size?: number;
  className?: string;
  animate?: boolean;
}

// Preserved for component compatibilities without layout noise
export function OccaAppIcon({ size = 56, className = '' }: OccaAppIconProps) {
  return (
    <div 
      className={`relative bg-black border border-yellow-500/30 rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(234,179,8,0.2)] shrink-0 select-none ${className}`}
      style={{ width: size, height: size }}
    >
      <div className="absolute inset-0 bg-gradient-to-tr from-yellow-500/5 to-transparent pointer-events-none rounded-xl" />
      <span 
        className="font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-yellow-400 to-amber-500 text-center tracking-tighter"
        style={{ fontSize: size * 0.22, letterSpacing: "-0.05em" }}
      >
        OCCA
      </span>
    </div>
  );
}

interface SplashScreenProps {
  onComplete: () => void;
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete();
    }, 2200);

    return () => {
      clearTimeout(timer);
    };
  }, [onComplete]);

  return (
    <div className="fixed inset-0 bg-black flex flex-col items-center justify-center z-50 overflow-hidden select-none px-6">
      
      {/* Background radial accent flare */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full bg-yellow-500/10 blur-[100px] pointer-events-none" />
      
      {/* Grid Pattern Background overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#09090b_1px,transparent_1px),linear-gradient(to_bottom,#09090b_1px,transparent_1px)] bg-[size:24px_24px] opacity-40 pointer-events-none" />

      {/* Main Branding Block - Centered but shifted a bit up */}
      <div className="flex flex-col items-center justify-center space-y-6 -translate-y-12">
        {/* Text Headers */}
        <div className="text-center space-y-1">
          <motion.h1 
            initial={{ letterSpacing: "-0.08em", opacity: 0, scale: 0.95 }}
            animate={{ letterSpacing: "-0.04em", opacity: 1, scale: 1 }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-yellow-400 to-amber-500 drop-shadow-[0_0_10px_rgba(234,179,8,0.5)] select-none font-sans"
          >
            OCCA
          </motion.h1>
          
          <motion.div
            initial={{ opacity: 0, letterSpacing: "0.15em" }}
            animate={{ opacity: 0.8, letterSpacing: "0.25em" }}
            transition={{ delay: 0.8, duration: 1 }}
            className="text-[8px] text-yellow-400/80 font-black uppercase mt-1 text-center"
          >
            TECHNOLOGY
          </motion.div>
        </div>
      </div>

      {/* Compliance Bottom Footprint - Absolutely positioned at the bottom */}
      <div className="absolute bottom-10 left-0 right-0 mx-auto w-full max-w-[280px] text-center">
        {/* Professional compliance footprint label */}
        <div className="pt-2">
          <p className="text-[7px] text-zinc-600 font-mono tracking-[0.25em] uppercase">
            DIGITAL PRODUCTS & SERVICES
          </p>
        </div>
      </div>

    </div>
  );
}

