import React, { useState, useEffect, useRef } from 'react';
import {
  MapPin, Calendar, Clock, QrCode, Users, Shield, Zap,
  CheckCircle2, ChevronRight, ArrowRight, Stethoscope,
  Hotel, UtensilsCrossed, Scissors, FlaskConical, Car,
  Dumbbell, Scale, Ticket, Star, TrendingUp, Lock,
  Bell, BarChart3, Menu, X, Scan, Building2, Activity,
  User, Sparkles,
} from 'lucide-react';
import { QGoLogo } from './QGoLogo';
import { useAuth } from '../../context/AuthContext';

/* ─── QR Code Visual (CSS-generated) ─── */
const QR_PATTERN = [
  [1,1,1,1,1,1,1,0,1,0,0,1,0,0,1,1,1,1,1,1,1],
  [1,0,0,0,0,0,1,0,0,1,1,0,1,0,1,0,0,0,0,0,1],
  [1,0,1,1,1,0,1,0,1,0,1,1,0,0,1,0,1,1,1,0,1],
  [1,0,1,1,1,0,1,0,0,1,0,0,1,0,1,0,1,1,1,0,1],
  [1,0,1,1,1,0,1,0,1,1,0,1,0,0,1,0,1,1,1,0,1],
  [1,0,0,0,0,0,1,0,0,0,1,0,1,0,1,0,0,0,0,0,1],
  [1,1,1,1,1,1,1,0,1,0,1,0,1,0,1,1,1,1,1,1,1],
  [0,0,0,0,0,0,0,0,0,1,0,1,0,0,0,0,0,0,0,0,0],
  [1,0,1,1,0,1,1,1,1,0,1,0,1,0,1,1,0,1,1,0,1],
  [0,1,0,0,1,0,0,0,1,1,0,1,0,1,0,0,1,0,0,1,0],
  [1,0,1,0,1,1,1,0,1,0,1,0,1,0,1,1,0,1,0,1,1],
  [0,1,0,1,0,0,0,0,0,1,0,1,0,0,0,1,0,0,1,0,0],
  [1,1,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,1,0,1,1],
  [0,0,0,0,0,0,0,0,1,1,0,1,0,1,0,1,0,1,0,1,0],
  [1,1,1,1,1,1,1,0,0,0,1,0,1,0,1,0,1,1,0,0,1],
  [1,0,0,0,0,0,1,0,1,0,0,1,0,0,0,1,0,0,1,0,0],
  [1,0,1,1,1,0,1,0,1,1,0,1,1,0,1,0,1,0,1,1,0],
  [1,0,1,1,1,0,1,0,0,0,1,0,0,1,0,0,0,1,0,0,1],
  [1,0,1,1,1,0,1,0,1,0,1,0,1,1,0,1,0,1,1,0,1],
  [1,0,0,0,0,0,1,0,0,1,0,1,0,0,1,0,1,0,0,1,0],
  [1,1,1,1,1,1,1,0,1,0,1,0,1,0,0,1,0,1,0,0,1],
];

const MiniQR: React.FC<{ size?: number }> = ({ size = 80 }) => (
  <div
    style={{ width: size, height: size, padding: 6, background: 'white', borderRadius: 8, display: 'grid', gridTemplateColumns: `repeat(21, 1fr)`, gap: 1 }}
  >
    {QR_PATTERN.map((row, ri) =>
      row.map((cell, ci) => (
        <div
          key={`${ri}-${ci}`}
          style={{
            background: cell ? '#080C14' : 'transparent',
            borderRadius: 1,
          }}
        />
      ))
    )}
  </div>
);

/* ─── Animated Queue Counter ─── */
const AnimatedCounter: React.FC<{ from: number; to: number; duration?: number }> = ({ from, to, duration = 2000 }) => {
  const [value, setValue] = useState(from);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        const step = (to - from) / (duration / 16);
        let current = from;
        const timer = setInterval(() => {
          current += step;
          if (current >= to) { setValue(to); clearInterval(timer); }
          else setValue(Math.floor(current));
        }, 16);
        observer.disconnect();
      }
    }, { threshold: 0.5 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [from, to, duration]);

  return <span ref={ref}>{value}</span>;
};

/* ─── Use Case Data ─── */
const USE_CASES = [
  { Icon: Stethoscope, label: 'Healthcare', desc: 'Clinics, hospitals, diagnostic labs' },
  { Icon: Hotel, label: 'Hotels', desc: 'Check-in, reservations, concierge' },
  { Icon: UtensilsCrossed, label: 'Restaurants', desc: 'Table booking, dine-in queues' },
  { Icon: Scissors, label: 'Salons & Spas', desc: 'Appointments, walk-in tokens' },
  { Icon: FlaskConical, label: 'Diagnostic Labs', desc: 'Sample collection slots' },
  { Icon: Car, label: 'Auto Service', desc: 'Service center appointments' },
  { Icon: Dumbbell, label: 'Fitness', desc: 'Gym slots, class bookings' },
  { Icon: Scale, label: 'Consultation', desc: 'Lawyers, CAs, advisors' },
  { Icon: Ticket, label: 'Events', desc: 'Entry tokens, seat reservations' },
];

const TRUST_ITEMS = [
  { Icon: Lock, label: 'Secure Bookings', desc: 'All data encrypted end-to-end with industry-standard TLS.' },
  { Icon: CheckCircle2, label: 'Verified Businesses', desc: 'Every business goes through a manual verification process.' },
  { Icon: Activity, label: 'Real-time Updates', desc: 'Live queue status pushed instantly to your device.' },
  { Icon: Shield, label: 'Privacy-first', desc: 'We never sell your data. You own your information.' },
  { Icon: Bell, label: 'Smart Notifications', desc: 'Get alerted when your turn is approaching — not just when it\'s too late.' },
  { Icon: Zap, label: 'Zero Downtime', desc: 'Built for high-availability with 99.9% uptime SLA.' },
];

/* ─── Navbar ─── */
const Navbar: React.FC<{ onSignIn: () => void; onGetStarted: () => void }> = ({ onSignIn, onGetStarted }) => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'backdrop-blur-xl border-b' : ''
      }`}
      style={{
        background: scrolled ? 'rgba(8,12,20,0.92)' : 'transparent',
        borderColor: scrolled ? 'var(--qp-border)' : 'transparent',
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo */}
        <QGoLogo size="md" />

        {/* Desktop Nav Links */}
        <div className="hidden md:flex items-center gap-8">
          {['How it Works', 'For Businesses', 'Features'].map((link) => (
            <a
              key={link}
              href={`#${link.toLowerCase().replace(/ /g, '-')}`}
              className="text-sm font-medium transition-colors"
              style={{ color: 'var(--qp-text-sec)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--qp-text)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--qp-text-sec)')}
            >
              {link}
            </a>
          ))}
        </div>

        {/* Desktop CTAs */}
        <div className="hidden md:flex items-center gap-3">
          <button
            onClick={onSignIn}
            className="text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
            style={{ color: 'var(--qp-text-sec)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--qp-text)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--qp-text-sec)')}
          >
            Sign In
          </button>
          <button onClick={onGetStarted} className="btn-primary" style={{ padding: '10px 20px', fontSize: '0.85rem' }}>
            Get Started
            <ArrowRight size={16} />
          </button>
        </div>

        {/* Mobile Hamburger */}
        <div className="md:hidden flex items-center gap-3">
          <button
            onClick={onSignIn}
            className="text-sm font-semibold px-3 py-1.5 rounded-lg"
            style={{ color: 'var(--qp-text-sec)', border: '1px solid var(--qp-border)' }}
          >
            Sign In
          </button>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-2 rounded-lg"
            style={{ color: 'var(--qp-text-sec)', background: 'var(--qp-surface)' }}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="md:hidden glass border-t" style={{ borderColor: 'var(--qp-border)' }}>
          <div className="px-4 py-4 space-y-1">
            {['How it Works', 'For Businesses', 'Features'].map((link) => (
              <a
                key={link}
                href={`#${link.toLowerCase().replace(/ /g, '-')}`}
                onClick={() => setMobileOpen(false)}
                className="block px-3 py-2.5 rounded-lg text-sm font-medium"
                style={{ color: 'var(--qp-text-sec)' }}
              >
                {link}
              </a>
            ))}
            <div className="pt-2">
              <button
                onClick={() => { onGetStarted(); setMobileOpen(false); }}
                className="btn-primary w-full"
              >
                Get Started <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

/* ─── Hero Booking Card ─── */
const HeroBookingCard: React.FC = () => (
  <div className="relative w-full max-w-lg mx-auto select-none overflow-hidden sm:overflow-visible" style={{ minHeight: 400, height: 440 }}>
    {/* Background glow */}
    <div
      className="absolute inset-0 rounded-3xl pointer-events-none"
      style={{ background: 'radial-gradient(ellipse at center, rgba(37,99,235,0.15) 0%, transparent 70%)' }}
    />

    {/* Floating mini cards — back layer (hidden on very narrow screens to prevent overflow) */}
    <div
      className="hidden sm:block animate-float-slow absolute top-8 -left-4 glass rounded-2xl p-3 shadow-xl"
      style={{ width: 150, animationDelay: '0s', border: '1px solid rgba(37,99,235,0.3)' }}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: 'var(--qp-success-soft)' }}>
          <Stethoscope size={12} color="var(--qp-success)" />
        </div>
        <span className="text-xs font-semibold" style={{ color: 'var(--qp-text-sec)' }}>City Clinic</span>
      </div>
      <div className="text-xs font-bold" style={{ color: 'var(--qp-text)' }}>Token #36</div>
      <div className="flex items-center gap-1 mt-1">
        <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--qp-success)' }} />
        <span className="text-[10px]" style={{ color: 'var(--qp-success)' }}>Now serving</span>
      </div>
    </div>

    <div
      className="hidden sm:block animate-float absolute top-4 -right-2 glass rounded-2xl p-3 shadow-xl"
      style={{ width: 140, animationDelay: '1s', border: '1px solid rgba(6,182,212,0.25)' }}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <MapPin size={11} color="var(--qp-accent)" />
        <span className="text-[10px] font-semibold" style={{ color: 'var(--qp-accent)' }}>2.1 km away</span>
      </div>
      <div className="text-xs font-bold" style={{ color: 'var(--qp-text)' }}>Grand Salon</div>
      <div className="text-[10px] mt-0.5" style={{ color: 'var(--qp-text-muted)' }}>0 waiting · 0m</div>
    </div>

    {/* Central QGo Ticket Card */}
    <div
      className="relative sm:absolute inset-x-0 mx-auto animate-float rounded-3xl shadow-2xl overflow-hidden animate-pulse-glow"
      style={{
        width: '100%',
        maxWidth: 280,
        top: 20,
        background: 'linear-gradient(145deg, var(--qp-surface-el) 0%, var(--qp-surface) 100%)',
        border: '1px solid rgba(37,99,235,0.4)',
      }}
    >
      {/* Card Header */}
      <div className="p-4 sm:p-5" style={{ background: 'linear-gradient(135deg, var(--qp-primary) 0%, #1e40af 100%)' }}>
        <div className="flex items-center justify-between mb-3">
          <QGoLogo size="sm" />
          <div
            className="text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(255,255,255,0.2)', color: 'white' }}
          >
            LIVE QUEUE
          </div>
        </div>
        <div className="text-white">
          <div className="text-xs font-medium opacity-75 mb-0.5">Apex Diagnostic Lab</div>
          <div className="text-2xl sm:text-3xl font-black tracking-tight">#A042</div>
        </div>
      </div>

      {/* Ticket Perforation */}
      <div className="flex items-center" style={{ marginLeft: -6, marginRight: -6 }}>
        <div className="w-5 h-5 rounded-full" style={{ background: 'var(--qp-bg)', border: '1px solid var(--qp-border)', flexShrink: 0 }} />
        <div className="flex-1 border-t border-dashed" style={{ borderColor: 'var(--qp-border)' }} />
        <div className="w-5 h-5 rounded-full" style={{ background: 'var(--qp-bg)', border: '1px solid var(--qp-border)', flexShrink: 0 }} />
      </div>

      {/* Card Body */}
      <div className="p-4 sm:p-5 space-y-3 sm:space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: 'var(--qp-text-muted)' }}>Now Serving</div>
            <div className="text-base sm:text-lg font-black" style={{ color: 'var(--qp-text)' }}>#A036</div>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: 'var(--qp-text-muted)' }}>Est. Wait</div>
            <div className="text-base sm:text-lg font-black" style={{ color: 'var(--qp-warning)' }}>28 min</div>
          </div>
        </div>

        {/* Progress bar */}
        <div>
          <div className="flex justify-between text-[10px] mb-1" style={{ color: 'var(--qp-text-muted)' }}>
            <span>Queue Progress</span>
            <span style={{ color: 'var(--qp-accent)' }}>6 ahead</span>
          </div>
          <div className="rounded-full overflow-hidden" style={{ height: 6, background: 'var(--qp-border)' }}>
            <div
              className="h-full rounded-full animate-progress"
              style={{ background: 'linear-gradient(90deg, var(--qp-primary), var(--qp-accent))', width: '72%' }}
            />
          </div>
        </div>

        {/* QR + Info */}
        <div className="flex items-end justify-between">
          <div>
            <div className="text-[10px] font-medium mb-1" style={{ color: 'var(--qp-text-muted)' }}>Scan to check in</div>
            <MiniQR size={56} />
          </div>
          <div className="text-right">
            <div className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: 'var(--qp-text-muted)' }}>Booked for</div>
            <div className="text-xs sm:text-sm font-bold" style={{ color: 'var(--qp-text)' }}>10:30 AM</div>
            <div className="text-[10px]" style={{ color: 'var(--qp-success)' }}>Token Active</div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

/* ─── Business Dashboard Preview ─── */
const DashboardPreview: React.FC = () => (
  <div
    className="rounded-2xl overflow-hidden shadow-2xl"
    style={{ background: 'var(--qp-surface-el)', border: '1px solid var(--qp-border)' }}
  >
    {/* Header */}
    <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--qp-border)' }}>
      <div className="flex items-center gap-2">
        <div className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ background: 'var(--qp-success)' }} />
        <span className="text-sm font-semibold" style={{ color: 'var(--qp-text)' }}>Business Dashboard</span>
      </div>
      <div className="text-xs font-mono" style={{ color: 'var(--qp-text-muted)' }}>Live · Today</div>
    </div>

    {/* Stats */}
    <div className="grid grid-cols-2 gap-px" style={{ background: 'var(--qp-border)' }}>
      {[
        { label: "Today's Bookings", value: '84', color: 'var(--qp-accent)' },
        { label: 'Waiting Now', value: '12', color: 'var(--qp-warning)' },
        { label: 'Completed', value: '56', color: 'var(--qp-success)' },
        { label: 'Revenue', value: '₹24,500', color: 'var(--qp-primary)' },
      ].map(({ label, value, color }) => (
        <div key={label} className="p-4" style={{ background: 'var(--qp-surface-el)' }}>
          <div className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--qp-text-muted)' }}>
            {label}
          </div>
          <div className="text-2xl font-black" style={{ color }}>
            {value}
          </div>
        </div>
      ))}
    </div>

    {/* Chart Bar (decorative) */}
    <div className="p-4">
      <div className="text-[10px] font-semibold uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: 'var(--qp-text-muted)' }}>
        <BarChart3 size={12} />
        Hourly Queue Traffic
      </div>
      <div className="flex items-end gap-1" style={{ height: 56 }}>
        {[30, 50, 70, 45, 85, 60, 90, 75, 40, 65, 80, 55].map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-sm transition-all"
            style={{
              height: `${h}%`,
              background: i === 6
                ? 'linear-gradient(to top, var(--qp-primary), var(--qp-accent))'
                : 'var(--qp-surface)',
              border: '1px solid var(--qp-border)',
            }}
          />
        ))}
      </div>
      <div className="flex justify-between mt-1.5">
        {['9am','10am','11am','12pm','1pm','2pm','3pm','4pm','5pm','6pm','7pm','8pm'].map(t => (
          <div key={t} className="text-[8px] flex-1 text-center" style={{ color: 'var(--qp-text-muted)' }}>{t.replace('am','').replace('pm','')}</div>
        ))}
      </div>
    </div>

    {/* Avg wait */}
    <div className="px-4 pb-4">
      <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'var(--qp-surface)', border: '1px solid var(--qp-border)' }}>
        <div className="flex items-center gap-2">
          <Clock size={14} color="var(--qp-warning)" />
          <span className="text-xs font-medium" style={{ color: 'var(--qp-text-sec)' }}>Average Wait Time</span>
        </div>
        <span className="text-sm font-bold" style={{ color: 'var(--qp-warning)' }}>18 min</span>
      </div>
    </div>
  </div>
);

/* ─── Main Landing Page ─── */
interface LandingPageProps {
  onGetStarted: () => void;
  onSignIn: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted, onSignIn }) => {
  const { loginAsDemo } = useAuth();

  return (
    <div className="min-h-screen" style={{ background: 'var(--qp-bg)' }}>
      <Navbar onSignIn={onSignIn} onGetStarted={onGetStarted} />

      {/* ─── HERO ─── */}
      <section className="relative min-h-screen flex flex-col justify-center pt-16 overflow-hidden">
        {/* Background radial glow */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(37,99,235,0.18) 0%, transparent 60%)',
          }}
        />
        {/* Grid overlay */}
        <div
          className="pointer-events-none absolute inset-0 opacity-5"
          style={{
            backgroundImage: 'linear-gradient(var(--qp-border) 1px, transparent 1px), linear-gradient(90deg, var(--qp-border) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left: Copy */}
            <div>
              <div className="section-tag mb-6">
                One App. Every Queue. Every Booking.
              </div>

              <h1 className="font-black leading-none tracking-tight" style={{ fontSize: 'clamp(2.8rem, 6vw, 4.5rem)', color: 'var(--qp-text)' }}>
                Book Before<br />
                <span style={{ background: 'linear-gradient(90deg, #2563EB, #06B6D4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  You Go.
                </span>
              </h1>
              <h2 className="font-black leading-none tracking-tight mt-2" style={{ fontSize: 'clamp(2.2rem, 4vw, 3.5rem)', color: 'var(--qp-text-sec)' }}>
                Know Before<br />You Wait.
              </h2>

              <p className="mt-8 text-lg leading-relaxed max-w-lg" style={{ color: 'var(--qp-text-sec)' }}>
                Discover businesses, reserve appointments, join live queues, and manage your bookings — all from one intelligent platform.
              </p>

              <div className="flex flex-wrap items-center gap-4 mt-10">
                <button onClick={onGetStarted} className="btn-primary" style={{ fontSize: '1rem', padding: '14px 28px' }}>
                  Get Started Free
                  <ArrowRight size={18} />
                </button>
                <button onClick={onSignIn} className="btn-secondary" style={{ fontSize: '1rem', padding: '14px 28px' }}>
                  Sign In
                </button>
              </div>

              {/* 1-Click Instant Demo Launch Bar */}
              <div className="mt-6 p-4 rounded-2xl bg-slate-900/90 border border-blue-500/30 backdrop-blur-md">
                <div className="flex items-center gap-1.5 mb-2.5 text-xs font-black text-blue-400 uppercase tracking-wider">
                  <Sparkles size={14} className="text-amber-400" />
                  <span>Explore App Directly (Instant Demo Mode):</span>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    onClick={() => loginAsDemo('consumer')}
                    className="px-3.5 py-3 rounded-xl bg-blue-600/20 hover:bg-blue-600 text-blue-200 hover:text-white border border-blue-500/40 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    <User size={14} />
                    <span>Customer View</span>
                  </button>
                  <button
                    onClick={() => loginAsDemo('owner')}
                    className="px-3.5 py-3 rounded-xl bg-purple-600/20 hover:bg-purple-600 text-purple-200 hover:text-white border border-purple-500/40 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    <Building2 size={14} />
                    <span>Owner View</span>
                  </button>
                </div>
              </div>

              {/* Trust chips */}
              <div className="flex flex-wrap items-center gap-3 mt-8">
                {[
                  { Icon: Shield, text: 'Secure & Verified' },
                  { Icon: Zap, text: 'Real-time Queue' },
                  { Icon: QrCode, text: 'QR Check-in' },
                ].map(({ Icon, text }) => (
                  <div key={text} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
                    style={{ background: 'var(--qp-surface)', border: '1px solid var(--qp-border)', color: 'var(--qp-text-sec)' }}>
                    <Icon size={12} color="var(--qp-accent)" />
                    {text}
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Hero Visual */}
            <div className="hidden lg:block">
              <HeroBookingCard />
            </div>
          </div>
        </div>

        {/* Scroll hint */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-40">
          <div className="w-px h-12 rounded-full" style={{ background: 'linear-gradient(to bottom, transparent, var(--qp-border))' }} />
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--qp-text-muted)' }} />
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section id="how-it-works" className="py-24 lg:py-32" style={{ background: 'var(--qp-surface)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="section-tag">How it Works</div>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight mt-4" style={{ color: 'var(--qp-text)' }}>
              From discovery to arrival in<br />four simple steps.
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { step: '01', Icon: MapPin, title: 'Discover', desc: 'Find nearby businesses and services. Filter by category, wait time, or location.', color: '#2563EB' },
              { step: '02', Icon: Calendar, title: 'Book', desc: 'Reserve your appointment, slot, table, or room. Or simply join the live queue.', color: '#06B6D4' },
              { step: '03', Icon: Activity, title: 'Track', desc: 'Follow your token in real-time. Know exactly how many people are ahead of you.', color: '#F59E0B' },
              { step: '04', Icon: Scan, title: 'Arrive', desc: 'Head over when your turn is near. Scan the QR code for instant check-in.', color: '#10B981' },
            ].map(({ step, Icon, title, desc, color }) => (
              <div
                key={step}
                className="group relative rounded-2xl p-6 transition-all duration-300 cursor-default"
                style={{ background: 'var(--qp-surface-el)', border: '1px solid var(--qp-border)' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = `${color}60`; e.currentTarget.style.transform = 'translateY(-4px)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--qp-border)'; e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                <div className="text-5xl font-black mb-4 leading-none" style={{ color: 'var(--qp-border)' }}>{step}</div>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: `${color}22` }}>
                  <Icon size={20} color={color} />
                </div>
                <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--qp-text)' }}>{title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--qp-text-muted)' }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── USE CASES ─── */}
      <section className="py-24 lg:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="section-tag">Universal Platform</div>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight mt-4" style={{ color: 'var(--qp-text)' }}>
              One App. Every Queue.<br />Every Booking.
            </h2>
            <p className="mt-4 max-w-2xl mx-auto text-lg" style={{ color: 'var(--qp-text-sec)' }}>
              QGo is built first for salons and barber shops where time and queues matter.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-4">
            {USE_CASES.map(({ Icon, label, desc }) => (
              <div
                key={label}
                className="group rounded-2xl p-5 transition-all duration-300 cursor-default"
                style={{ background: 'var(--qp-surface)', border: '1px solid var(--qp-border)' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(37,99,235,0.4)'; e.currentTarget.style.background = 'var(--qp-surface-el)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--qp-border)'; e.currentTarget.style.background = 'var(--qp-surface)'; }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 transition-colors"
                  style={{ background: 'var(--qp-primary-soft)' }}>
                  <Icon size={20} color="var(--qp-accent)" />
                </div>
                <h3 className="font-bold text-sm mb-1" style={{ color: 'var(--qp-text)' }}>{label}</h3>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--qp-text-muted)' }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── LIVE QUEUE SHOWCASE ─── */}
      <section className="py-24 lg:py-32" style={{ background: 'var(--qp-surface)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="section-tag">Live Queue</div>
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight mt-4 mb-6" style={{ color: 'var(--qp-text)' }}>
                Why Wait When<br />You Can Know?
              </h2>
              <p className="text-lg leading-relaxed mb-8" style={{ color: 'var(--qp-text-sec)' }}>
                QGo gives you complete visibility into live salon queues before you even leave your home. Track your position in real time and arrive when your turn is close.
              </p>
              <div className="space-y-3">
                {[
                  'See live queue position updated every 30 seconds',
                  'Get notified when you\'re 3 people away',
                  'View estimated wait time with accuracy',
                  'Cancel or reschedule with one tap',
                ].map(item => (
                  <div key={item} className="flex items-start gap-3">
                    <CheckCircle2 size={18} color="var(--qp-success)" className="mt-0.5 shrink-0" />
                    <span className="text-sm" style={{ color: 'var(--qp-text-sec)' }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Live Queue Card */}
            <div>
              <div
                className="rounded-3xl overflow-hidden shadow-2xl max-w-sm mx-auto"
                style={{ background: 'var(--qp-surface-el)', border: '1px solid var(--qp-border)' }}
              >
                {/* Header */}
                <div className="p-5" style={{ background: 'linear-gradient(135deg, var(--qp-primary) 0%, #1e40af 100%)' }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-white font-semibold text-sm">City Medical Clinic</span>
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold"
                      style={{ background: 'rgba(255,255,255,0.2)', color: 'white' }}>
                      <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                      LIVE
                    </div>
                  </div>
                  <div className="text-white/70 text-xs">General Medicine · Dr. Priya S.</div>
                </div>

                <div className="p-5 space-y-4">
                  {/* Now Serving vs Your Token */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl p-4 text-center" style={{ background: 'var(--qp-surface)', border: '1px solid var(--qp-border)' }}>
                      <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--qp-text-muted)' }}>Now Serving</div>
                      <div className="text-3xl font-black" style={{ color: 'var(--qp-success)' }}>
                        #<AnimatedCounter from={30} to={36} />
                      </div>
                    </div>
                    <div className="rounded-xl p-4 text-center" style={{ background: 'var(--qp-primary-soft)', border: '1px solid rgba(37,99,235,0.4)' }}>
                      <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--qp-accent)' }}>Your Token</div>
                      <div className="text-3xl font-black" style={{ color: 'var(--qp-text)' }}>#42</div>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl p-3 flex items-center gap-2" style={{ background: 'var(--qp-surface)' }}>
                      <Users size={14} color="var(--qp-text-muted)" />
                      <div>
                        <div className="text-[10px]" style={{ color: 'var(--qp-text-muted)' }}>Ahead</div>
                        <div className="text-sm font-bold" style={{ color: 'var(--qp-text)' }}>5 people</div>
                      </div>
                    </div>
                    <div className="rounded-xl p-3 flex items-center gap-2" style={{ background: 'var(--qp-surface)' }}>
                      <Clock size={14} color="var(--qp-warning)" />
                      <div>
                        <div className="text-[10px]" style={{ color: 'var(--qp-text-muted)' }}>Est. Wait</div>
                        <div className="text-sm font-bold" style={{ color: 'var(--qp-warning)' }}>28 min</div>
                      </div>
                    </div>
                  </div>

                  {/* Progress */}
                  <div>
                    <div className="flex justify-between text-xs mb-2" style={{ color: 'var(--qp-text-muted)' }}>
                      <span>Queue progress</span>
                      <span style={{ color: 'var(--qp-accent)' }}>72% complete</span>
                    </div>
                    <div className="rounded-full overflow-hidden" style={{ height: 8, background: 'var(--qp-border)' }}>
                      <div
                        className="h-full rounded-full animate-progress"
                        style={{ background: 'linear-gradient(90deg, var(--qp-primary), var(--qp-accent))' }}
                      />
                    </div>
                  </div>

                  {/* Notification */}
                  <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}>
                    <Bell size={14} color="var(--qp-warning)" />
                    <span className="text-xs font-medium" style={{ color: 'var(--qp-warning)' }}>
                      You'll be notified when 3 people remain.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── QR EXPERIENCE ─── */}
      <section id="features" className="py-24 lg:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* QR Visual */}
            <div className="flex justify-center">
              <div
                className="relative rounded-3xl p-8 shadow-2xl"
                style={{ background: 'var(--qp-surface-el)', border: '1px solid var(--qp-border)', maxWidth: 340 }}
              >
                <div className="text-center mb-6">
                  <QGoLogo size="sm" className="justify-center mb-2" />
                  <div className="text-xs font-semibold" style={{ color: 'var(--qp-text-muted)' }}>QGo Business QR</div>
                </div>

                {/* QR Code */}
                <div className="flex justify-center mb-6 relative">
                  <div className="relative">
                    <MiniQR size={160} />
                    {/* Shimmer overlay */}
                    <div className="absolute inset-0 animate-shimmer rounded-lg opacity-50" />
                  </div>
                </div>

                <div className="text-center space-y-1">
                  <div className="text-sm font-bold" style={{ color: 'var(--qp-text)' }}>Apex Diagnostic Lab</div>
                  <div className="text-xs" style={{ color: 'var(--qp-text-muted)' }}>Scan to book · Join queue · Check-in</div>
                </div>

                {/* Flow steps */}
                <div className="mt-6 space-y-2">
                  {['Scan QR', 'View Services', 'Book / Join Queue', 'Get Token'].map((step, i) => (
                    <div key={step} className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                        style={{ background: 'var(--qp-primary)', color: 'white' }}>
                        {i + 1}
                      </div>
                      <span className="text-xs font-medium" style={{ color: 'var(--qp-text-sec)' }}>{step}</span>
                      {i < 3 && <div className="flex-1 h-px" style={{ background: 'var(--qp-border)' }} />}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <div className="section-tag">QR Check-in</div>
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight mt-4 mb-6" style={{ color: 'var(--qp-text)' }}>
                One Scan.<br />Instant Access.
              </h2>
              <p className="text-lg leading-relaxed mb-8" style={{ color: 'var(--qp-text-sec)' }}>
                Every QGo business gets a unique QR code. Customers scan once to see services, real-time availability, and book or join the queue.
              </p>
              <div className="space-y-3">
                {[
                  'No download required for QR scanning',
                  'Instantly see live availability and wait times',
                  'Book appointment or join queue in seconds',
                  'Share QR code on physical or digital surfaces',
                ].map(item => (
                  <div key={item} className="flex items-start gap-3">
                    <CheckCircle2 size={18} color="var(--qp-success)" className="mt-0.5 shrink-0" />
                    <span className="text-sm" style={{ color: 'var(--qp-text-sec)' }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── BUSINESS OWNER ─── */}
      <section id="for-businesses" className="py-24 lg:py-32" style={{ background: 'var(--qp-surface)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="section-tag">For Business Owners</div>
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight mt-4 mb-6" style={{ color: 'var(--qp-text)' }}>
                Your Business.<br />Your Queue.<br />
                <span style={{ color: 'var(--qp-accent)' }}>Your Control.</span>
              </h2>
              <p className="text-lg leading-relaxed mb-8" style={{ color: 'var(--qp-text-sec)' }}>
                QGo gives owners a simple command center to manage bookings, control queues, track staff, and understand daily performance.
              </p>

              <div className="grid grid-cols-2 gap-3 mb-8">
                {[
                  { Icon: Calendar, label: 'Manage Bookings' },
                  { Icon: Users, label: 'Queue Control' },
                  { Icon: Building2, label: 'Staff Management' },
                  { Icon: QrCode, label: 'Generate QR' },
                  { Icon: TrendingUp, label: 'Analytics' },
                  { Icon: Bell, label: 'Smart Alerts' },
                ].map(({ Icon, label }) => (
                  <div key={label} className="flex items-center gap-2.5 p-3 rounded-xl"
                    style={{ background: 'var(--qp-surface-el)', border: '1px solid var(--qp-border)' }}>
                    <Icon size={16} color="var(--qp-accent)" />
                    <span className="text-sm font-medium" style={{ color: 'var(--qp-text-sec)' }}>{label}</span>
                  </div>
                ))}
              </div>

              <button onClick={onGetStarted} className="btn-primary" style={{ fontSize: '1rem' }}>
                Create Your Business
                <ArrowRight size={18} />
              </button>
            </div>

            <div>
              <DashboardPreview />
            </div>
          </div>
        </div>
      </section>

      {/* ─── TRUST ─── */}
      <section className="py-24 lg:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="section-tag">Trust & Security</div>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight mt-4" style={{ color: 'var(--qp-text)' }}>
              Built for reliability.<br />Designed for trust.
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {TRUST_ITEMS.map(({ Icon, label, desc }) => (
              <div
                key={label}
                className="rounded-2xl p-6 transition-all duration-300"
                style={{ background: 'var(--qp-surface)', border: '1px solid var(--qp-border)' }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: 'var(--qp-primary-soft)' }}>
                  <Icon size={20} color="var(--qp-primary)" />
                </div>
                <h3 className="font-bold text-base mb-2" style={{ color: 'var(--qp-text)' }}>{label}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--qp-text-muted)' }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FINAL CTA ─── */}
      <section className="py-24 lg:py-32" style={{ background: 'var(--qp-surface)' }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div
            className="rounded-3xl p-12 lg:p-16 relative overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, var(--qp-primary-soft) 0%, var(--qp-surface-el) 60%)',
              border: '1px solid rgba(37,99,235,0.3)',
            }}
          >
            <div
              className="pointer-events-none absolute inset-0"
              style={{ background: 'radial-gradient(ellipse at top, rgba(37,99,235,0.15) 0%, transparent 70%)' }}
            />
            <div className="relative">
              <div className="section-tag mb-6">Start Today</div>
              <h2 className="text-3xl sm:text-5xl font-black tracking-tight mb-6" style={{ color: 'var(--qp-text)' }}>
                Ready to stop<br />
                <span style={{ background: 'linear-gradient(90deg, #2563EB, #06B6D4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  unnecessary waiting?
                </span>
              </h2>
              <p className="text-lg mb-10 max-w-xl mx-auto" style={{ color: 'var(--qp-text-sec)' }}>
                Join thousands of businesses and customers who've made queuing a thing of the past.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-4">
                <button onClick={onGetStarted} className="btn-primary" style={{ fontSize: '1rem', padding: '16px 36px' }}>
                  Get Started Free
                  <ArrowRight size={18} />
                </button>
                <button onClick={onSignIn} className="btn-secondary" style={{ fontSize: '1rem', padding: '16px 36px' }}>
                  Sign In
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="py-12" style={{ background: 'var(--qp-bg)', borderTop: '1px solid var(--qp-border)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div>
              <QGoLogo size="sm" />
              <p className="text-xs mt-2 max-w-xs" style={{ color: 'var(--qp-text-muted)' }}>
                Book Before You Go. Know Before You Wait.
              </p>
            </div>
            <div className="flex flex-col items-end gap-3">
              <div className="flex items-center gap-4">
                {['Privacy', 'Terms', 'Contact'].map(link => (
                  <a key={link} href="#" className="text-xs hover:underline transition-colors"
                    style={{ color: 'var(--qp-text-muted)' }}>
                    {link}
                  </a>
                ))}
              </div>
              <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--qp-text-muted)' }}>
                <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--qp-success)' }} />
                <span>© {new Date().getFullYear()} QGo Technologies. All rights reserved.</span>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
