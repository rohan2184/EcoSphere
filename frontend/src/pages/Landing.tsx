import { useEffect, useRef, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  Leaf, HeartHandshake, Scale, Gauge, LayoutDashboard, FileBarChart,
  Trophy, ShieldCheck, Zap, ArrowRight, LogIn,
} from "lucide-react";

/* Fade-up on scroll — zero deps, IntersectionObserver. */
function Reveal({ children, delay = 0, className = "" }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { el.classList.add("is-in"); io.disconnect(); } },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={`reveal ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

/* The signature: three pillar rings orbiting a live overall ESG score. */
function OrbitalSphere() {
  const rings = [
    { size: 340, dur: "26s", dir: "orbit",    accent: "#34d399", ring: "rgba(52,211,153,0.35)",  label: "E", icon: <Leaf className="h-4 w-4" /> },
    { size: 250, dur: "20s", dir: "orbitRev", accent: "#fcd34d", ring: "rgba(252,211,77,0.30)",   label: "S", icon: <HeartHandshake className="h-4 w-4" /> },
    { size: 168, dur: "14s", dir: "orbit",    accent: "#7dd3fc", ring: "rgba(125,211,252,0.30)",  label: "G", icon: <Scale className="h-4 w-4" /> },
  ];
  return (
    <div className="relative mx-auto h-[360px] w-[360px] shrink-0">
      {rings.map((r) => (
        <div
          key={r.label}
          className="absolute left-1/2 top-1/2 rounded-full border"
          style={{
            width: r.size, height: r.size, marginLeft: -r.size / 2, marginTop: -r.size / 2,
            borderColor: r.ring,
            animation: `${r.dir} ${r.dur} linear infinite`,
          }}
        >
          {/* orbiting pillar node — counter-rotates so its glyph stays upright */}
          <div
            className="absolute left-1/2 -top-4 -ml-4 flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold text-emerald-950 shadow-lg"
            style={{ background: r.accent, animation: `${r.dir === "orbit" ? "orbitRev" : "orbit"} ${r.dur} linear infinite` }}
          >
            {r.icon}
          </div>
        </div>
      ))}
      {/* core score */}
      <div
        className="absolute left-1/2 top-1/2 flex h-28 w-28 -ml-14 -mt-14 flex-col items-center justify-center rounded-full bg-emerald-500/10 backdrop-blur"
        style={{ animation: "corePulse 3.6s ease-in-out infinite" }}
      >
        <span className="text-4xl font-extrabold tracking-tight text-white">82</span>
        <span className="mt-0.5 text-[10px] uppercase tracking-[0.2em] text-emerald-200/80">ESG score</span>
      </div>
    </div>
  );
}

const PILLARS = [
  { icon: <Leaf className="h-5 w-5" />, tag: "Environmental", accent: "text-emerald-300", ring: "ring-emerald-400/30",
    body: "Carbon transactions, emission factors, and reduction goals — CO₂e auto-calculated the moment an operation is logged." },
  { icon: <HeartHandshake className="h-5 w-5" />, tag: "Social", accent: "text-amber-300", ring: "ring-amber-300/30",
    body: "CSR activities, participation, and diversity metrics, with evidence-gated approvals that turn effort into points." },
  { icon: <Scale className="h-5 w-5" />, tag: "Governance", accent: "text-sky-300", ring: "ring-sky-300/30",
    body: "Policies with acknowledgements, audits, and compliance issues that flag themselves the moment they run overdue." },
];

const FEATURES = [
  { icon: <Gauge className="h-5 w-5" />, title: "Live scoring engine",
    body: "Pure E/S/G formulas, weighted by your settings and recomputed on demand. Never stale, never cached." },
  { icon: <LayoutDashboard className="h-5 w-5" />, title: "Unified dashboard",
    body: "Overall ESG, per-department ranking, and compliance alerts in a single view that updates as data moves." },
  { icon: <FileBarChart className="h-5 w-5" />, title: "Reports & exports",
    body: "Every module plus a custom builder with six filters — exported to CSV, Excel, or PDF." },
  { icon: <Trophy className="h-5 w-5" />, title: "Gamification",
    body: "Challenges, XP, auto-awarded badges, and a rewards catalog with atomic, stock-safe redemption." },
  { icon: <ShieldCheck className="h-5 w-5" />, title: "Governance suite",
    body: "Policies, audits, and compliance tracking with owner and due-date enforcement built in." },
  { icon: <Zap className="h-5 w-5" />, title: "Automation rules",
    body: "Four toggles wire the whole loop: log an action, auto-calc the impact, shift the score, fire a notification." },
];

const FLOW = ["Log an operation", "CO₂e auto-calculated", "Scores recompute", "Notification fires"];

export default function Landing() {
  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      {/* ── Nav ── */}
      <header className="absolute inset-x-0 top-0 z-20">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <span className="text-lg font-bold tracking-tight text-white">🌿 EcoSphere</span>
          <nav className="flex items-center gap-2">
            <Link to="/login" className="rounded-md px-3 py-1.5 text-sm font-medium text-emerald-50/90 hover:bg-white/10">
              Sign in
            </Link>
            <Link to="/dashboard" className="rounded-md bg-emerald-400 px-3.5 py-1.5 text-sm font-semibold text-emerald-950 shadow-lg transition-colors hover:bg-emerald-300">
              Enter platform
            </Link>
          </nav>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-emerald-950 text-white">
        {/* ambient drifting glows */}
        <div className="pointer-events-none absolute -left-40 -top-40 h-[520px] w-[520px] rounded-full bg-emerald-500/25 blur-3xl" style={{ animation: "drift 16s ease-in-out infinite" }} />
        <div className="pointer-events-none absolute -bottom-52 right-[-10%] h-[560px] w-[560px] rounded-full bg-teal-400/15 blur-3xl" style={{ animation: "drift 22s ease-in-out infinite reverse" }} />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,transparent,rgba(2,44,34,0.6))]" />

        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-6 pb-24 pt-36 lg:grid-cols-2 lg:pb-32 lg:pt-40">
          <div>
            <p className="opacity-0 [animation:fadeUp_0.6s_ease-out_both] text-xs font-semibold uppercase tracking-[0.28em] text-emerald-300">
              ESG Management Platform
            </p>
            <h1 className="mt-5 text-5xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
              <span className="block opacity-0 [animation:fadeUp_0.7s_ease-out_0.1s_both]">Your entire ESG</span>
              <span className="block opacity-0 [animation:fadeUp_0.7s_ease-out_0.22s_both]">story, measured as</span>
              <span className="block opacity-0 [animation:fadeUp_0.7s_ease-out_0.34s_both]">
                one <span className="italic font-serif text-emerald-300">living score.</span>
              </span>
            </h1>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-emerald-100/80 opacity-0 [animation:fadeUp_0.7s_ease-out_0.5s_both]">
              EcoSphere turns carbon, community work, and compliance into a single, always-current
              ESG score — with the dashboards, reports, and automation to actually move it.
            </p>
            <div className="mt-9 flex flex-wrap gap-3 opacity-0 [animation:fadeUp_0.7s_ease-out_0.66s_both]">
              <Link to="/dashboard" className="group inline-flex items-center gap-2 rounded-lg bg-emerald-400 px-5 py-3 text-sm font-semibold text-emerald-950 shadow-xl transition-colors hover:bg-emerald-300">
                Enter the platform
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link to="/login" className="inline-flex items-center gap-2 rounded-lg border border-emerald-400/30 px-5 py-3 text-sm font-semibold text-emerald-50 transition-colors hover:bg-white/10">
                <LogIn className="h-4 w-4" /> Sign in
              </Link>
            </div>
          </div>

          <div className="opacity-0 [animation:fadeUp_0.9s_ease-out_0.4s_both]">
            <OrbitalSphere />
          </div>
        </div>
      </section>

      {/* ── Three pillars ── */}
      <section className="relative -mt-px bg-emerald-950 pb-20 text-white">
        <div className="mx-auto grid max-w-6xl gap-5 px-6 md:grid-cols-3">
          {PILLARS.map((p, i) => (
            <Reveal key={p.tag} delay={i * 110}>
              <div className={`h-full rounded-2xl bg-white/5 p-6 ring-1 ${p.ring} backdrop-blur transition-transform duration-300 hover:-translate-y-1`}>
                <div className={`inline-flex rounded-lg bg-white/10 p-2.5 ${p.accent}`}>{p.icon}</div>
                <h3 className={`mt-4 text-sm font-bold uppercase tracking-[0.18em] ${p.accent}`}>{p.tag}</h3>
                <p className="mt-2 text-sm leading-relaxed text-emerald-100/70">{p.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-600">What's inside</p>
          <h2 className="mt-3 max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
            One platform for every lever that moves the score.
          </h2>
        </Reveal>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={(i % 3) * 90}>
              <div className="group h-full rounded-2xl border border-stone-200 bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:border-emerald-300 hover:shadow-xl hover:shadow-emerald-100">
                <div className="inline-flex rounded-lg bg-emerald-50 p-2.5 text-emerald-700 transition-colors group-hover:bg-emerald-600 group-hover:text-white">
                  {f.icon}
                </div>
                <h3 className="mt-4 font-semibold text-stone-900">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-stone-500">{f.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── The automation loop ── */}
      <section className="border-y border-stone-200 bg-white py-20">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal>
            <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">
              The loop that runs itself
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-center text-sm text-stone-500">
              Flip the toggles on and the whole chain fires without a human in the middle.
            </p>
          </Reveal>
          <Reveal delay={120}>
            <div className="mt-10 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-center">
              {FLOW.map((step, i) => (
                <div key={step} className="flex items-center gap-3">
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800">
                    {step}
                  </span>
                  {i < FLOW.length - 1 && <ArrowRight className="h-4 w-4 rotate-90 text-emerald-400 sm:rotate-0" />}
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── CTA + footer ── */}
      <section className="bg-emerald-950 py-24 text-center text-white">
        <Reveal>
          <h2 className="mx-auto max-w-2xl px-6 text-3xl font-bold tracking-tight sm:text-4xl">
            Ready to see where you stand?
          </h2>
          <div className="mt-8">
            <Link to="/dashboard" className="group inline-flex items-center gap-2 rounded-lg bg-emerald-400 px-6 py-3 text-sm font-semibold text-emerald-950 shadow-xl transition-colors hover:bg-emerald-300">
              Enter the platform
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </Reveal>
        <p className="mt-16 text-xs text-emerald-300/60">
          React · TypeScript · Tailwind v4 · FastAPI · PostgreSQL · SQLAlchemy
        </p>
        <p className="mt-2 text-xs text-emerald-300/40">Odoo Hackathon '26 · Team EcoSphere</p>
      </section>
    </div>
  );
}
