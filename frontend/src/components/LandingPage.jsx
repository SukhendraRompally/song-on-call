import { useState } from 'react'
import { Disc3, ArrowRight, Mic2, Music4, Pencil, Heart, Volume2 } from 'lucide-react'
import useStore from '../store/useStore'

// Generic animated waveform
function Waveform({ count = 36, heights, animName = 'waveBar', baseColor, hovered }) {
  return (
    <div className="flex items-end gap-[2px] w-full h-full">
      {Array.from({ length: count }).map((_, i) => {
        const h = heights ? heights[i % heights.length] : 40 + (i % 9) * 7
        return (
          <div
            key={i}
            className="flex-1 rounded-full"
            style={{
              height: `${h}%`,
              minHeight: '8%',
              background: baseColor,
              animationName: hovered ? animName : 'none',
              animationDuration: `${0.7 + (i % 6) * 0.18}s`,
              animationTimingFunction: 'ease-in-out',
              animationIterationCount: 'infinite',
              animationDirection: 'alternate',
              animationDelay: `${(i % 10) * 0.07}s`,
            }}
          />
        )
      })}
    </div>
  )
}

const steps = [
  {
    icon: Mic2,
    number: '01',
    title: 'Share your story',
    desc: 'Tell our AI about a person, a memory, or a moment. Names, places, the tiny details that only you know.',
    color: 'from-violet-500/20 to-purple-500/10',
    border: 'hover:border-violet-500/40',
    iconBg: 'bg-violet-500/10',
    iconColor: 'text-violet-400',
  },
  {
    icon: Pencil,
    number: '02',
    title: 'Shape your lyrics',
    desc: 'We write a first draft around your story. Revise lines, shift the tone — until every word feels right.',
    color: 'from-rose-500/20 to-pink-500/10',
    border: 'hover:border-rose-500/40',
    iconBg: 'bg-rose-500/10',
    iconColor: 'text-rose-400',
  },
  {
    icon: Music4,
    number: '03',
    title: 'Generate your song',
    desc: 'Pick your sound — folk, piano, R&B — and get a full song with real vocals and music in under 60 seconds.',
    color: 'from-amber-500/20 to-orange-500/10',
    border: 'hover:border-amber-500/40',
    iconBg: 'bg-amber-500/10',
    iconColor: 'text-amber-400',
  },
]

// Each card has unique waveform heights + animation + color theme
const examples = [
  {
    emoji: '💍',
    title: 'Wedding anniversary',
    desc: 'Ten years, one city, one song',
    style: 'Slow waltz · Acoustic guitar',
    animName: 'waveWedding',
    // Even, graceful peaks — like a waltz rhythm
    heights: [45, 70, 85, 70, 45, 60, 80, 90, 80, 60, 45, 70, 85, 70, 45, 55, 75, 88, 75, 55],
    gradient: 'linear-gradient(to top, #f59e0b, #fcd34d)',
    bg: 'from-amber-500/8 to-yellow-500/5',
    border: 'hover:border-amber-500/30',
    tag: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  },
  {
    emoji: '🐾',
    title: 'A pet who passed',
    desc: 'Gentle, soft, and full of love',
    style: 'Tender ballad · Soft piano',
    animName: 'wavePet',
    // Low gentle ripples — calm and soft
    heights: [25, 35, 30, 40, 28, 38, 32, 42, 30, 36, 28, 34, 40, 30, 35, 26, 38, 32, 36, 28],
    gradient: 'linear-gradient(to top, #8b5cf6, #c4b5fd)',
    bg: 'from-violet-500/8 to-purple-500/5',
    border: 'hover:border-violet-500/30',
    tag: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  },
  {
    emoji: '🌍',
    title: 'Long distance love',
    desc: 'Every timezone, still missing you',
    style: 'Yearning indie pop · Guitar & synth',
    animName: 'waveLongDistance',
    // Big peaks then valleys — intense longing
    heights: [20, 90, 15, 85, 20, 80, 15, 95, 20, 75, 18, 88, 22, 82, 16, 78, 20, 92, 18, 70],
    gradient: 'linear-gradient(to top, #3b82f6, #93c5fd)',
    bg: 'from-blue-500/8 to-indigo-500/5',
    border: 'hover:border-blue-500/30',
    tag: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  },
  {
    emoji: '👶',
    title: 'First year as parents',
    desc: 'Chaos, joy, no sleep, pure love',
    style: 'Joyful R&B · Upbeat rhythm',
    animName: 'waveParents',
    // Rapid irregular heights — chaotic joy
    heights: [60, 30, 90, 20, 75, 45, 85, 25, 70, 40, 95, 30, 65, 50, 80, 35, 55, 88, 28, 72],
    gradient: 'linear-gradient(to top, #10b981, #6ee7b7)',
    bg: 'from-emerald-500/8 to-green-500/5',
    border: 'hover:border-emerald-500/30',
    tag: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  },
]

export default function LandingPage({ onStart }) {
  const { openAuthModal } = useStore()
  const [hoveredExample, setHoveredExample] = useState(null)

  return (
    <div className="flex flex-col h-full overflow-y-auto scrollbar-hide" style={{ background: '#08080E' }}>

      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5 flex-shrink-0 sticky top-0 z-10 border-b border-white/5"
        style={{ background: 'rgba(8,8,14,0.85)', backdropFilter: 'blur(12px)' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center"
            style={{ boxShadow: '0 0 16px rgba(139,92,246,0.4)' }}>
            <Disc3 size={15} className="text-white" />
          </div>
          <span className="text-base font-bold text-white tracking-tight">Song On Call</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => openAuthModal()} className="text-sm text-white/40 hover:text-white/80 transition-colors">
            Sign in
          </button>
          <button
            onClick={onStart}
            className="text-sm font-semibold px-4 py-2 rounded-lg text-white transition-all"
            style={{ background: 'linear-gradient(135deg, #7C3AED, #4F46E5)', boxShadow: '0 0 20px rgba(124,58,237,0.35)' }}
          >
            Try free
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex-shrink-0 relative overflow-hidden px-8 pt-20 pb-24 text-center">
        {/* Layered background glows */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[-80px] left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full opacity-20"
            style={{ background: 'radial-gradient(ellipse, #7C3AED 0%, transparent 70%)' }} />
          <div className="absolute top-20 left-[15%] w-64 h-64 rounded-full opacity-10"
            style={{ background: 'radial-gradient(ellipse, #F59E0B 0%, transparent 70%)' }} />
          <div className="absolute top-10 right-[10%] w-48 h-48 rounded-full opacity-10"
            style={{ background: 'radial-gradient(ellipse, #EC4899 0%, transparent 70%)' }} />
        </div>

        <div className="relative">
          {/* Sound rings decoration */}
          <div className="flex justify-center mb-8 relative">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 rounded-full border border-violet-500/20 animate-ping" style={{ animationDuration: '2s' }} />
              <div className="absolute inset-2 rounded-full border border-violet-500/30 animate-ping" style={{ animationDuration: '2s', animationDelay: '0.4s' }} />
              <div className="absolute inset-4 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center"
                style={{ boxShadow: '0 0 24px rgba(124,58,237,0.6)' }}>
                <Volume2 size={14} className="text-white" />
              </div>
            </div>
          </div>

          <h1 className="text-[2.4rem] md:text-[3.5rem] font-black text-white leading-[1.05] tracking-tight mb-5 max-w-2xl mx-auto">
            Your story deserves<br />
            <span style={{
              background: 'linear-gradient(135deg, #F59E0B 0%, #EC4899 40%, #7C3AED 80%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              its own song
            </span>
          </h1>

          <p className="text-white/50 text-lg max-w-md mx-auto leading-relaxed mb-10">
            Chat about a memory. Shape your lyrics.<br />
            Get a real song — vocals, music, everything.
          </p>

          <div className="flex flex-col items-center gap-3">
            <button
              onClick={onStart}
              className="inline-flex items-center gap-2.5 text-white font-bold px-8 py-4 rounded-2xl text-base group transition-all hover:scale-[1.02]"
              style={{
                background: 'linear-gradient(135deg, #F59E0B, #EC4899, #7C3AED)',
                boxShadow: '0 0 40px rgba(236,72,153,0.3), 0 4px 24px rgba(0,0,0,0.4)',
              }}
            >
              Start your song
              <ArrowRight size={18} className="group-hover:translate-x-0.5 transition-transform" />
            </button>
            <p className="text-white/20 text-xs">Free to try · 5 songs/day · No music knowledge needed</p>
          </div>

          {/* Live waveform strip */}
          <div className="mt-16 max-w-xl mx-auto" style={{ height: '56px' }}>
            <Waveform
              count={52}
              animName="waveBar"
              hovered={true}
              baseColor="linear-gradient(to top, rgba(124,58,237,0.5), rgba(236,72,153,0.4))"
            />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="flex-shrink-0 px-8 py-16 border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
        <p className="text-center text-xs text-white/25 uppercase tracking-widest font-semibold mb-12">How it works</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-3xl mx-auto">
          {steps.map((step, i) => (
            <div key={i}
              className={`relative rounded-2xl p-5 border border-white/8 bg-gradient-to-b ${step.color} ${step.border} transition-all duration-300 cursor-default`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`w-9 h-9 rounded-xl ${step.iconBg} flex items-center justify-center`}>
                  <step.icon size={16} className={step.iconColor} />
                </div>
                <span className="text-3xl font-black text-white/6 leading-none">{step.number}</span>
              </div>
              <h3 className="text-sm font-bold text-white mb-2">{step.title}</h3>
              <p className="text-xs text-white/40 leading-relaxed">{step.desc}</p>

              {/* Connector arrow */}
              {i < steps.length - 1 && (
                <div className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 z-10 text-white/20">
                  <ArrowRight size={14} />
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Made for moments */}
      <section className="flex-shrink-0 px-8 py-16 border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
        <p className="text-center text-xs text-white/25 uppercase tracking-widest font-semibold mb-3">Made for real moments</p>
        <h2 className="text-center text-2xl font-extrabold text-white mb-12 tracking-tight">
          Songs for the stories only you know
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
          {examples.map((ex, i) => (
            <div
              key={i}
              onMouseEnter={() => setHoveredExample(i)}
              onMouseLeave={() => setHoveredExample(null)}
              onClick={onStart}
              className={`rounded-2xl p-5 border border-white/8 bg-gradient-to-br ${ex.bg} ${ex.border} transition-all duration-300 cursor-pointer group`}
              style={{ minHeight: '140px' }}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">{ex.emoji}</span>
                    <h3 className="text-sm font-bold text-white">{ex.title}</h3>
                  </div>
                  <p className="text-xs text-white/35 mb-2">{ex.desc}</p>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${ex.tag}`}>
                    {ex.style}
                  </span>
                </div>
              </div>

              {/* Themed waveform */}
              <div className="mt-4" style={{ height: '36px' }}>
                <Waveform
                  count={20}
                  heights={ex.heights}
                  animName={ex.animName}
                  hovered={hoveredExample === i}
                  baseColor={ex.gradient}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="flex-shrink-0 px-8 py-20 text-center border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
        <div className="flex justify-center mb-5">
          <Heart size={22} className="text-rose-400" fill="currentColor" />
        </div>
        <h2 className="text-3xl font-extrabold text-white mb-3 tracking-tight">
          Someone deserves a song
        </h2>
        <p className="text-white/40 mb-8 max-w-sm mx-auto text-sm leading-relaxed">
          Take 2 minutes to share the story. We'll handle everything else.
        </p>
        <button
          onClick={onStart}
          className="inline-flex items-center gap-2 text-white font-bold px-8 py-4 rounded-2xl text-base group transition-all hover:scale-[1.02]"
          style={{
            background: 'linear-gradient(135deg, #F59E0B, #EC4899, #7C3AED)',
            boxShadow: '0 0 40px rgba(236,72,153,0.25), 0 4px 20px rgba(0,0,0,0.4)',
          }}
        >
          Write their song
          <ArrowRight size={18} className="group-hover:translate-x-0.5 transition-transform" />
        </button>
      </section>

    </div>
  )
}
