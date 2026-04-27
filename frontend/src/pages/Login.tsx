import React, { useState, useRef } from "react";
import { useAppStore } from "../lib/store";
import {
  Sparkles, Eye, EyeOff, ArrowRight, Shield, Zap, BarChart3,
  Lock, Sun, Moon, BrainCircuit, Target, TrendingUp,
} from "lucide-react";

interface LoginPageProps {
  onLogin: () => void;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const { theme, toggleTheme } = useAppStore();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const [success, setSuccess] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!username.trim() || !password.trim()) {
      setError("Please enter both username and password");
      triggerShake();
      return;
    }

    setIsLoading(true);
    await new Promise((r) => setTimeout(r, 900));

    if (username === "demo" && password === "demo") {
      setIsLoading(false);
      setSuccess(true);
      await new Promise((r) => setTimeout(r, 600));
      onLogin();
    } else {
      setIsLoading(false);
      setError("Invalid credentials — try demo / demo");
      triggerShake();
    }
  };

  const triggerShake = () => { setShake(true); setTimeout(() => setShake(false), 600); };

  const stats = [
    { value: "12k+", label: "Deals Closed" },
    { value: "98%", label: "Uptime" },
    { value: "4.9★", label: "User Rating" },
  ];

  const features = [
    { icon: BrainCircuit, title: "Autonomous Agents", desc: "AI qualifies leads, drafts outreach & schedules meetings" },
    { icon: Target, title: "Pipeline Intelligence", desc: "Real-time win probability and deal health scoring" },
    { icon: TrendingUp, title: "Revenue Signals", desc: "Opportunity watch detects expansion & upsell signals" },
    { icon: Shield, title: "Compliance Built-In", desc: "CAN-SPAM, GDPR & consent checks on every message" },
  ];

  return (
    <div style={{
      minHeight: "100vh", display: "flex",
      background: "var(--bg-base)", fontFamily: "var(--font-body)",
      position: "relative", overflow: "hidden",
    }}>

      {/* ── Animated mesh gradient background ────────────── */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
        <div style={{
          position: "absolute", width: 700, height: 700, borderRadius: "50%",
          background: "radial-gradient(circle, var(--accent-glow) 0%, transparent 60%)",
          top: "-20%", right: "-10%", filter: "blur(80px)",
          animation: "loginOrb1 12s ease-in-out infinite alternate",
        }} />
        <div style={{
          position: "absolute", width: 600, height: 600, borderRadius: "50%",
          background: "radial-gradient(circle, var(--ai-glow) 0%, transparent 60%)",
          bottom: "-15%", left: "-8%", filter: "blur(80px)",
          animation: "loginOrb2 14s ease-in-out infinite alternate",
        }} />
        <div style={{
          position: "absolute", width: 350, height: 350, borderRadius: "50%",
          background: "radial-gradient(circle, var(--success-glow) 0%, transparent 60%)",
          top: "40%", left: "50%", transform: "translateX(-50%)", filter: "blur(60px)",
          animation: "loginOrb3 10s ease-in-out infinite alternate",
        }} />

        {/* Grid pattern overlay */}
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: `linear-gradient(var(--border-subtle) 1px, transparent 1px),
                            linear-gradient(90deg, var(--border-subtle) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
          opacity: 0.4,
          maskImage: "radial-gradient(ellipse at 60% 40%, black 20%, transparent 70%)",
          WebkitMaskImage: "radial-gradient(ellipse at 60% 40%, black 20%, transparent 70%)",
        }} />
      </div>

      {/* ── Theme toggle (top-right) ─────────────────────── */}
      <button
        onClick={toggleTheme}
        style={{
          position: "fixed", top: 20, right: 20, zIndex: 100,
          width: 44, height: 44, borderRadius: 12,
          background: "var(--bg-card)", border: "1px solid var(--border-strong)",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", transition: "all 0.3s",
          boxShadow: "0 2px 12px rgba(0,0,0,0.12)",
          color: "var(--text-secondary)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "var(--accent)";
          e.currentTarget.style.boxShadow = "0 0 20px var(--accent-glow)";
          e.currentTarget.style.color = "var(--accent)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "var(--border-strong)";
          e.currentTarget.style.boxShadow = "0 2px 12px rgba(0,0,0,0.12)";
          e.currentTarget.style.color = "var(--text-secondary)";
        }}
        title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      >
        {theme === "dark"
          ? <Sun style={{ width: 18, height: 18 }} />
          : <Moon style={{ width: 18, height: 18 }} />}
      </button>

      {/* ── Left panel: Branding ─────────────────────────── */}
      <div style={{
        flex: "1 1 55%", display: "flex", flexDirection: "column",
        justifyContent: "center", padding: "4rem 6%",
        position: "relative", zIndex: 1,
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 56 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: "linear-gradient(135deg, var(--accent), #8B5CF6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 40px var(--accent-glow), 0 4px 16px rgba(0,0,0,0.2)",
            animation: "loginPulse 3s ease-in-out infinite",
          }}>
            <Sparkles style={{ width: 24, height: 24, color: "#fff" }} />
          </div>
          <div>
            <span style={{
              fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 800,
              color: "var(--text-primary)", letterSpacing: "-0.02em",
            }}>Acufy</span>
            <span style={{
              display: "block", fontSize: 10, fontWeight: 600,
              color: "var(--text-tertiary)", textTransform: "uppercase",
              letterSpacing: "0.14em",
            }}>CRM Platform</span>
          </div>
        </div>

        {/* Headline */}
        <h1 style={{
          fontFamily: "var(--font-display)",
          fontSize: "clamp(2.2rem, 3.8vw, 3.4rem)",
          fontWeight: 800, color: "var(--text-primary)",
          lineHeight: 1.08, marginBottom: 20, letterSpacing: "-0.03em",
        }}>
          Close deals faster<br />
          <span style={{
            background: "linear-gradient(135deg, var(--accent), #8B5CF6, var(--accent))",
            backgroundSize: "200% 100%",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            animation: "loginGradient 4s ease-in-out infinite",
          }}>
            with AI intelligence
          </span>
        </h1>
        <p style={{
          fontSize: 16, color: "var(--text-secondary)", maxWidth: 460,
          lineHeight: 1.7, marginBottom: 40,
        }}>
          Autonomous agents that research accounts, qualify leads, draft compliant outreach, and forecast your pipeline — while you focus on relationships.
        </p>

        {/* Stats row */}
        <div style={{ display: "flex", gap: 32, marginBottom: 48 }}>
          {stats.map((s, i) => (
            <div key={i} style={{ textAlign: "center" }}>
              <div style={{
                fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 800,
                background: "linear-gradient(135deg, var(--accent), var(--ai))",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              }}>{s.value}</div>
              <div style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 500, marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Feature grid */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr",
          gap: 14, maxWidth: 500,
        }}>
          {features.map((f, i) => (
            <div
              key={i}
              style={{
                display: "flex", alignItems: "flex-start", gap: 12,
                padding: "14px 16px", borderRadius: "var(--r-md)",
                background: "var(--bg-card)", border: "1px solid var(--border-subtle)",
                transition: "all 0.3s ease", cursor: "default",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--border-accent)";
                e.currentTarget.style.boxShadow = "0 0 24px var(--accent-glow)";
                e.currentTarget.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--border-subtle)";
                e.currentTarget.style.boxShadow = "none";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              <div style={{
                width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                background: i % 2 === 0 ? "var(--accent-glow)" : "var(--ai-glow)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <f.icon style={{ width: 16, height: 16, color: i % 2 === 0 ? "var(--accent)" : "var(--ai)" }} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 2 }}>{f.title}</div>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)", lineHeight: 1.4 }}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right panel: Login form ──────────────────────── */}
      <div style={{
        flex: "1 1 45%", display: "flex", alignItems: "center",
        justifyContent: "center", padding: "2rem", position: "relative", zIndex: 1,
      }}>
        <div style={{
          width: "100%", maxWidth: 400, padding: "36px 32px",
          borderRadius: 20,
          background: "var(--bg-card)",
          border: "1px solid var(--border-strong)",
          boxShadow: `0 24px 80px rgba(0,0,0,0.2),
                      0 0 0 1px var(--border-subtle),
                      inset 0 1px 0 rgba(255,255,255,0.04)`,
          backdropFilter: "blur(24px)",
          animation: shake ? "loginShake 0.5s ease-in-out" : success ? "loginSuccess 0.5s ease-out" : "loginCardIn 0.7s cubic-bezier(0.16, 1, 0.3, 1)",
        }}>

          {/* Card header */}
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16, margin: "0 auto 16px",
              background: success
                ? "linear-gradient(135deg, var(--success), #059669)"
                : "linear-gradient(135deg, var(--accent-glow), var(--ai-glow))",
              border: `1px solid ${success ? "var(--success)" : "var(--border-default)"}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.4s ease",
              boxShadow: success ? "0 0 32px var(--success-glow)" : "none",
            }}>
              {success
                ? <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" style={{ strokeDasharray: 30, strokeDashoffset: 0, animation: "loginCheck 0.4s ease-out" }} /></svg>
                : <Lock style={{ width: 26, height: 26, color: "var(--accent)" }} />}
            </div>
            <h2 style={{
              fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 700,
              color: "var(--text-primary)", marginBottom: 6,
            }}>
              {success ? "Welcome!" : "Sign in"}
            </h2>
            <p style={{ fontSize: 13, color: "var(--text-tertiary)" }}>
              {success ? "Redirecting to your dashboard…" : "Enter your credentials to continue"}
            </p>
          </div>

          {/* Form */}
          {!success && (
            <form ref={formRef} onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Username */}
              <div>
                <label htmlFor="login-username" style={{
                  display: "block", fontSize: 11, fontWeight: 600,
                  color: "var(--text-secondary)", marginBottom: 6,
                  textTransform: "uppercase", letterSpacing: "0.08em",
                }}>Username</label>
                <input
                  id="login-username" type="text" autoComplete="username" autoFocus
                  placeholder="Enter username" value={username}
                  onChange={(e) => { setUsername(e.target.value); setError(""); }}
                  style={{
                    width: "100%", padding: "12px 14px", borderRadius: 8,
                    border: `1.5px solid ${error ? "var(--error)" : "var(--border-default)"}`,
                    background: "var(--bg-elevated)", color: "var(--text-primary)",
                    fontSize: 14, fontFamily: "var(--font-body)", outline: "none",
                    transition: "all 0.2s",
                  }}
                  onFocus={(e) => {
                    if (!error) { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.boxShadow = "0 0 0 3px var(--accent-glow)"; }
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = error ? "var(--error)" : "var(--border-default)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                />
              </div>

              {/* Password */}
              <div>
                <label htmlFor="login-password" style={{
                  display: "block", fontSize: 11, fontWeight: 600,
                  color: "var(--text-secondary)", marginBottom: 6,
                  textTransform: "uppercase", letterSpacing: "0.08em",
                }}>Password</label>
                <div style={{ position: "relative" }}>
                  <input
                    id="login-password" type={showPassword ? "text" : "password"}
                    autoComplete="current-password" placeholder="Enter password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(""); }}
                    style={{
                      width: "100%", padding: "12px 44px 12px 14px", borderRadius: 8,
                      border: `1.5px solid ${error ? "var(--error)" : "var(--border-default)"}`,
                      background: "var(--bg-elevated)", color: "var(--text-primary)",
                      fontSize: 14, fontFamily: "var(--font-body)", outline: "none",
                      transition: "all 0.2s",
                    }}
                    onFocus={(e) => {
                      if (!error) { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.boxShadow = "0 0 0 3px var(--accent-glow)"; }
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = error ? "var(--error)" : "var(--border-default)";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} style={{
                    position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                    background: "none", border: "none", cursor: "pointer", padding: 4,
                    color: "var(--text-tertiary)", display: "flex", alignItems: "center",
                    transition: "color 0.2s",
                  }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text-primary)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-tertiary)"; }}
                  >
                    {showPassword ? <EyeOff style={{ width: 16, height: 16 }} /> : <Eye style={{ width: 16, height: 16 }} />}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div style={{
                  fontSize: 12, color: "var(--error)", padding: "10px 14px",
                  borderRadius: 8, background: "rgba(248,113,113,0.06)",
                  border: "1px solid rgba(248,113,113,0.15)", textAlign: "center",
                  animation: "loginFadeIn 0.3s ease-out",
                }}>
                  {error}
                </div>
              )}

              {/* Submit */}
              <button type="submit" disabled={isLoading} style={{
                width: "100%", padding: "13px 20px", borderRadius: 10,
                border: "none",
                background: isLoading ? "var(--accent-dim)" : "linear-gradient(135deg, var(--accent), #7C3AED)",
                color: "#fff", fontSize: 14, fontWeight: 600,
                fontFamily: "var(--font-body)", cursor: isLoading ? "wait" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                transition: "all 0.3s ease",
                boxShadow: "0 4px 20px var(--accent-glow)",
                marginTop: 4,
              }}
                onMouseEnter={(e) => {
                  if (!isLoading) { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 32px var(--accent-glow)"; }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 4px 20px var(--accent-glow)";
                }}
              >
                {isLoading ? (
                  <>
                    <div style={{
                      width: 16, height: 16,
                      border: "2px solid rgba(255,255,255,0.25)", borderTopColor: "#fff",
                      borderRadius: "50%", animation: "loginSpin 0.6s linear infinite",
                    }} />
                    Signing in…
                  </>
                ) : (
                  <>Sign In <ArrowRight style={{ width: 16, height: 16 }} /></>
                )}
              </button>
            </form>
          )}

          {/* Demo hint */}
          {!success && (
            <div style={{
              marginTop: 20, padding: "12px 16px", borderRadius: 10,
              background: "linear-gradient(135deg, var(--ai-glow), rgba(56,189,248,0.05))",
              border: "1px solid rgba(167,139,250,0.12)",
              textAlign: "center",
            }}>
              <div style={{ fontSize: 10, color: "var(--ai)", fontWeight: 700, marginBottom: 4, letterSpacing: "0.08em" }}>
                <Sparkles style={{ width: 11, height: 11, display: "inline", verticalAlign: "-1.5px", marginRight: 4 }} />
                DEMO ACCESS
              </div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                Username:{" "}
                <code style={{
                  fontFamily: "var(--font-mono)", color: "var(--text-primary)", fontWeight: 600,
                  background: "var(--bg-elevated)", padding: "2px 6px", borderRadius: 4, fontSize: 11,
                }}>demo</code>
                {"  ·  "}Password:{" "}
                <code style={{
                  fontFamily: "var(--font-mono)", color: "var(--text-primary)", fontWeight: 600,
                  background: "var(--bg-elevated)", padding: "2px 6px", borderRadius: 4, fontSize: 11,
                }}>demo</code>
              </div>
            </div>
          )}

          {/* Footer */}
          <p style={{ textAlign: "center", fontSize: 10, color: "var(--text-tertiary)", marginTop: 20, letterSpacing: "0.02em" }}>
            © 2026 Acufy CRM · Built with AI
          </p>
        </div>
      </div>

      {/* ── CSS Keyframes ────────────────────────────────── */}
      <style>{`
        @keyframes loginCardIn {
          from { opacity: 0; transform: translateY(32px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes loginShake {
          0%, 100% { transform: translateX(0); }
          15% { transform: translateX(-10px); }
          30% { transform: translateX(8px); }
          45% { transform: translateX(-6px); }
          60% { transform: translateX(4px); }
          75% { transform: translateX(-2px); }
        }
        @keyframes loginSuccess {
          0%   { transform: scale(1); }
          50%  { transform: scale(1.02); }
          100% { transform: scale(1); }
        }
        @keyframes loginSpin { to { transform: rotate(360deg); } }
        @keyframes loginFadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes loginPulse {
          0%, 100% { box-shadow: 0 0 40px var(--accent-glow), 0 4px 16px rgba(0,0,0,0.2); }
          50% { box-shadow: 0 0 56px var(--accent-glow), 0 4px 24px rgba(0,0,0,0.25); }
        }
        @keyframes loginGradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes loginOrb1 {
          from { transform: translate(0, 0) scale(1); }
          to   { transform: translate(-40px, 30px) scale(1.15); }
        }
        @keyframes loginOrb2 {
          from { transform: translate(0, 0) scale(1); }
          to   { transform: translate(30px, -40px) scale(1.1); }
        }
        @keyframes loginOrb3 {
          from { transform: translate(-50%, 0) scale(1); opacity: 0.5; }
          to   { transform: translate(-50%, -20px) scale(1.2); opacity: 0.8; }
        }
        @keyframes loginCheck {
          from { stroke-dashoffset: 30; }
          to   { stroke-dashoffset: 0; }
        }
      `}</style>
    </div>
  );
}
