'use client';
import { EasyJobFeatureMark } from '@/components/ui/easyjob-feature-mark';


import React, { useState } from 'react';
import { CheckCircle2, TrendingUp, Star, Building2, FileText, Award, Briefcase, Settings } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

const candidateNodes = [
  {
    id: 1,
    name: 'Sarah Chen',
    role: 'Senior AI Engineer',
    match: 99,
    status: 'High Match',
    top: '22%',
    left: '32%',
    gender: 'female',
    badge: 'briefcase',
  },
  {
    id: 2,
    name: 'Alex Rivera',
    role: 'Full Stack Architect',
    match: 98,
    status: 'Matched & Hired',
    top: '48%',
    left: '48%',
    gender: 'male',
    badge: 'stars',
  },
  {
    id: 3,
    name: 'David Kim',
    role: 'Data Scientist',
    match: 96,
    status: 'Interviewing',
    top: '76%',
    left: '30%',
    gender: 'male',
    badge: 'briefcase',
  },
  {
    id: 4,
    name: 'Elena Rostova',
    role: 'Product Lead',
    match: 97,
    status: 'Top 1% Talent',
    top: '20%',
    left: '52%',
    gender: 'female',
    badge: 'growth',
  },
  {
    id: 5,
    name: 'Marcus Vance',
    role: 'DevOps Specialist',
    match: 95,
    status: 'Profile Verified',
    top: '78%',
    left: '50%',
    gender: 'male',
    badge: 'certificate',
  },
];

export function HeroVisualAnimation() {
  const { t } = useI18n();
  const [activeNode, setActiveNode] = useState<number>(1);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 8;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * -8;
    setTilt({ x, y });
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
    setActiveNode(1);
  };

  const currentCand = candidateNodes[activeNode];

  return (
    <div
      className="relative w-full max-w-xl lg:mx-0 transition-transform duration-300 ease-out select-none"
      style={{
        transform: `perspective(1000px) rotateX(${tilt.y}deg) rotateY(${tilt.x}deg)`,
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Browser Card Frame */}
      <div className="relative overflow-hidden rounded-2xl border border-gray-200/90 bg-white p-2.5 shadow-2xl shadow-indigo-950/10">
        {/* Top Browser Dots & Nav Bar */}
        <div className="flex items-center justify-between rounded-t-xl bg-slate-50 border-b border-gray-100 px-4 py-2.5">
          <div className="flex items-center gap-1.5">
            <div className="size-2.5 rounded-full bg-slate-300" />
            <div className="size-2.5 rounded-full bg-slate-300" />
            <div className="size-2.5 rounded-full bg-slate-300" />
          </div>
          <div className="flex items-center gap-4 text-[11px] font-medium text-gray-400">
            <span>{t.auth.login}</span>
            <span>{t.nav.pricing}</span>
            <span>{t.nav.jobs}</span>
            <span>{t.nav.about}</span>
          </div>
        </div>

        {/* Deep Indigo/Purple Native AI Graphic Panel */}
        <div className="relative min-h-[360px] sm:min-h-[410px] w-full overflow-hidden rounded-b-xl bg-gradient-to-br from-[#0e072b] via-[#1a0e4c] to-[#2c1363] p-4 sm:p-6 flex items-center justify-between">
          {/* Ambient Lighting Background Effects */}
          <div className="absolute left-[-10%] top-[30%] size-64 rounded-full bg-cyan-500/15 blur-3xl pointer-events-none" />
          <div className="absolute right-[5%] bottom-[10%] size-56 rounded-full bg-indigo-500/20 blur-3xl pointer-events-none" />

          {/* Native SVG Network & Flow Funnel */}
          <svg className="absolute inset-0 size-full pointer-events-none" viewBox="0 0 520 400" fill="none">
            <defs>
              <linearGradient id="streamGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.9" />
                <stop offset="50%" stopColor="#818CF8" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#C084FC" stopOpacity="0.3" />
              </linearGradient>

              <radialGradient id="hubGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#38BDF8" stopOpacity="0" />
              </radialGradient>

              <style>{`
                @keyframes flowDashes {
                  0% { stroke-dashoffset: 80; }
                  100% { stroke-dashoffset: 0; }
                }
                @keyframes gearSpinSlow {
                  from { transform: rotate(0deg); }
                  to { transform: rotate(360deg); }
                }
                .flow-path {
                  stroke-dasharray: 6 6;
                  animation: flowDashes 2s linear infinite;
                }
                .gear-rotate {
                  transform-origin: center;
                  animation: gearSpinSlow 14s linear infinite;
                }
              `}</style>
            </defs>

            {/* AI Funnel Outer Path */}
            <path d="M 0 130 C 50 130, 80 180, 110 200 C 80 220, 50 270, 0 270" stroke="url(#streamGrad)" strokeWidth="1.5" strokeOpacity="0.4" fill="none" />
            <path d="M 110 200 C 140 100, 240 70, 310 140 C 350 180, 310 280, 240 320 C 150 330, 110 260, 110 200" stroke="url(#streamGrad)" strokeWidth="1.5" strokeOpacity="0.3" fill="#130a38" fillOpacity="0.4" />

            {/* Intake Flow Particles */}
            <path d="M 0 150 Q 50 170 110 200" stroke="url(#streamGrad)" strokeWidth="1.5" className="flow-path" />
            <path d="M 0 200 L 110 200" stroke="url(#streamGrad)" strokeWidth="2.5" className="flow-path" />
            <path d="M 0 250 Q 50 230 110 200" stroke="url(#streamGrad)" strokeWidth="1.5" className="flow-path" />

            {/* Glowing Core Hub at Funnel Throat */}
            <circle cx="110" cy="200" r="28" fill="url(#hubGlow)" />
            <circle cx="110" cy="200" r="10" fill="#38BDF8" fillOpacity="0.8" className="animate-pulse" />

            {/* Neural Network Lines inside body */}
            <path d="M 110 200 L 175 90" stroke="#38BDF8" strokeWidth="1.5" strokeOpacity="0.5" />
            <path d="M 110 200 L 260 200" stroke="#38BDF8" strokeWidth="2" strokeOpacity="0.7" className="flow-path" />
            <path d="M 110 200 L 165 310" stroke="#38BDF8" strokeWidth="1.5" strokeOpacity="0.5" />
            <path d="M 175 90 L 260 200" stroke="#818CF8" strokeWidth="1.5" strokeOpacity="0.6" />
            <path d="M 165 310 L 260 200" stroke="#818CF8" strokeWidth="1.5" strokeOpacity="0.6" />
            <path d="M 175 90 L 285 85" stroke="#818CF8" strokeWidth="1.5" strokeOpacity="0.5" />
            <path d="M 260 200 L 335 200" stroke="#C084FC" strokeWidth="2" className="flow-path" />
            <path d="M 165 310 L 275 320" stroke="#818CF8" strokeWidth="1.5" strokeOpacity="0.5" />

            {/* Output Lines to Right Cards */}
            <path d="M 335 200 Q 380 140 430 110" stroke="url(#streamGrad)" strokeWidth="1.5" className="flow-path" />
            <path d="M 335 200 Q 380 200 440 200" stroke="url(#streamGrad)" strokeWidth="2" className="flow-path" />
            <path d="M 335 200 Q 380 260 430 290" stroke="url(#streamGrad)" strokeWidth="1.5" className="flow-path" />
          </svg>

          {/* Central Animated Gears */}
          <div className="absolute left-[39%] top-[38%] size-14 text-cyan-400/30 pointer-events-none gear-rotate z-0">
            <Settings className="size-full" />
          </div>

          {/* Left Intake Funnel Indicator */}
          <div className="absolute left-2 top-1/2 -translate-y-1/2 z-10 flex flex-col items-center gap-1">
            <div className="size-10 rounded-full border border-cyan-400/50 bg-cyan-950/60 p-2 flex items-center justify-center backdrop-blur-md shadow-lg shadow-cyan-500/30">
              <EasyJobFeatureMark size="md" className=" text-cyan-300 animate-pulse" />
            </div>
          </div>

          {/* Native Candidate Avatar Nodes Grid */}
          <div className="relative w-[65%] h-[320px] z-10">
            {candidateNodes.map((node, idx) => {
              const isSelected = activeNode === idx;
              return (
                <div
                  key={node.id}
                  className="absolute cursor-pointer transition-all duration-300 group"
                  style={{ top: node.top, left: node.left, transform: 'translate(-50%, -50%)' }}
                  onMouseEnter={() => setActiveNode(idx)}
                >
                  <div className={`relative flex items-center justify-center size-11 sm:size-12 rounded-full border-2 transition-all duration-300 ${
                    isSelected
                      ? 'border-cyan-300 scale-125 bg-slate-900 shadow-xl shadow-cyan-400/60 ring-4 ring-cyan-400/30'
                      : 'border-indigo-400/70 bg-[#150a3d] hover:border-cyan-400 hover:scale-110'
                  }`}>
                    {/* Native Vector Silhouette Avatar */}
                    <div className="size-full rounded-full bg-slate-200/90 flex items-center justify-center overflow-hidden border border-white/20">
                      <svg className="size-7 text-slate-800" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                      </svg>
                    </div>

                    {/* Briefcase/Stars Badge */}
                    <div className="absolute -bottom-1 -right-1 rounded-full bg-[#3F5FDE] p-1 text-white shadow-md">
                      {node.badge === 'briefcase' && <Briefcase className="size-2.5" />}
                      {node.badge === 'stars' && <Star className="size-2.5 fill-amber-300 text-amber-300" />}
                      {node.badge === 'growth' && <TrendingUp className="size-2.5 text-cyan-200" />}
                      {node.badge === 'certificate' && <Award className="size-2.5 text-purple-200" />}
                    </div>

                    {/* Ping Ring for Selected Node */}
                    {isSelected && (
                      <div className="absolute -inset-2 rounded-full border border-cyan-400 animate-ping pointer-events-none" />
                    )}
                  </div>
                </div>
              );
            })}

            {/* Upward Career Growth Floating Badges */}
            <div className="absolute left-[54%] top-[10%] animate-bounce duration-1000">
              <div className="flex items-center gap-1 rounded-full bg-blue-600/30 px-2 py-0.5 border border-blue-400/50 backdrop-blur-md">
                <TrendingUp className="size-3 text-cyan-300" />
                <span className="text-[9px] font-bold text-cyan-200">+48% Career Fit</span>
              </div>
            </div>

            {/* Native Output Hub Cards on Right of Funnel (Matching Image 3) */}
            <div className="absolute right-[2%] top-[18%] flex items-center gap-1.5 rounded-lg bg-slate-900/80 p-1.5 border border-indigo-400/40 backdrop-blur-md">
              <Building2 className="size-3.5 text-blue-300" />
              <div className="flex text-amber-300">
                <Star className="size-2.5 fill-amber-300" />
                <Star className="size-2.5 fill-amber-300" />
                <Star className="size-2.5 fill-amber-300" />
              </div>
            </div>

            <div className="absolute right-[0%] top-[46%] flex items-center gap-1 rounded-lg bg-slate-900/80 p-1.5 border border-indigo-400/40 backdrop-blur-md">
              <FileText className="size-3.5 text-cyan-300" />
              <span className="text-[8px] font-semibold text-white">AI Resume</span>
            </div>

            <div className="absolute right-[4%] top-[72%] flex items-center gap-1 rounded-lg bg-slate-900/80 p-1.5 border border-indigo-400/40 backdrop-blur-md">
              <Award className="size-3.5 text-purple-300" />
              <span className="text-[8px] font-semibold text-white">Verified</span>
            </div>
          </div>

          {/* Right 33%: Overlay Text Card & Selected Node Live Detail */}
          <div className="w-[33%] flex flex-col justify-center items-end text-right z-20 space-y-3">
            <div>
              <h3 className="font-sans font-bold text-white text-base sm:text-xl leading-tight">
                Find Your<br />
                Career Fit<br />
                Instantly
              </h3>
              <p className="mt-1 text-[11px] sm:text-xs text-indigo-200 leading-tight font-medium">
                Join the Future<br />
                of Recruitment
              </p>
            </div>

            {/* Interactive Live Selected Candidate Card */}
            <div className="w-full rounded-xl bg-slate-950/90 border border-cyan-400/50 p-2.5 shadow-2xl backdrop-blur-md transition-all duration-300">
              <div className="flex items-center justify-between gap-1 mb-1">
                <span className="rounded bg-cyan-500/20 px-1.5 py-0.5 text-[9px] font-bold text-cyan-300 border border-cyan-400/40">
                  {currentCand.match}% AI Match
                </span>
                <CheckCircle2 className="size-3 text-emerald-400 shrink-0" />
              </div>
              <h4 className="font-bold text-white text-xs truncate">{currentCand.name}</h4>
              <p className="text-[10px] text-indigo-200 truncate">{currentCand.role}</p>
              <div className="mt-1 flex items-center justify-end text-[9px] text-cyan-300 gap-1">
                <EasyJobFeatureMark size="sm" className=" text-cyan-300" />
                <span>{currentCand.status}</span>
              </div>
            </div>

            {/* Action Button */}
            <button className="bg-[#3F5FDE] hover:bg-[#3252c8] text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-lg shadow-blue-600/30 transition-all hover:scale-105 cursor-pointer">
              {t.auth.register}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
