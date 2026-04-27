import React, { useState, useRef } from "react";
import { useAppStore } from "../lib/store";
import {
  Eye, EyeOff, ArrowRight,
  Lock, Sun, Moon, Sparkles,
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

  return (
    <div style={{
      height: "100vh", display: "flex",
      background: "var(--bg-base)", fontFamily: "var(--font-body)",
      position: "relative", overflow: "hidden",
    }}>

      {/* ── Background effects ───────────────────────────── */}
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
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: `linear-gradient(var(--border-subtle) 1px, transparent 1px),
                            linear-gradient(90deg, var(--border-subtle) 1px, transparent 1px)`,
          backgroundSize: "60px 60px", opacity: 0.4,
          maskImage: "radial-gradient(ellipse at 60% 40%, black 20%, transparent 70%)",
          WebkitMaskImage: "radial-gradient(ellipse at 60% 40%, black 20%, transparent 70%)",
        }} />
      </div>

      {/* ── Theme toggle ─────────────────────────────────── */}
      <button
        onClick={toggleTheme}
        style={{
          position: "fixed", top: 20, right: 20, zIndex: 100,
          width: 44, height: 44, borderRadius: 12,
          background: "var(--bg-card)", border: "1px solid var(--border-strong)",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", transition: "all 0.3s",
          boxShadow: "0 2px 12px rgba(0,0,0,0.12)", color: "var(--text-secondary)",
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
        justifyContent: "center", alignItems: "center",
        padding: "2rem 4%", position: "relative", zIndex: 1,
      }}>
        {/* Logo image */}
        <img
          src="/acufy-logo.svg"
          alt="Acufy AI"
          style={{
            maxWidth: 360, width: "80%", height: "auto",
            marginBottom: 32, filter: theme === "dark" ? "drop-shadow(0 0 40px var(--accent-glow))" : "none",
            animation: "loginLogoIn 1s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        />

        {/* Tagline */}
        <h1 style={{
          fontFamily: "var(--font-display)",
          fontSize: "clamp(1.6rem, 2.8vw, 2.4rem)",
          fontWeight: 800, color: "var(--text-primary)",
          lineHeight: 1.15, textAlign: "center", marginBottom: 14,
          letterSpacing: "-0.03em",
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
          fontSize: 14, color: "var(--text-secondary)", maxWidth: 400,
          lineHeight: 1.6, textAlign: "center",
        }}>
          Autonomous agents that qualify leads, draft outreach, and orchestrate your pipeline — with compliance built in.
        </p>
      </div>

      {/* ── Right panel: Login form ──────────────────────── */}
      <div style={{
        flex: "1 1 45%", display: "flex", alignItems: "center",
        justifyContent: "center", padding: "2rem", position: "relative", zIndex: 1,
      }}>
        <div style={{
          width: "100%", maxWidth: 380, padding: "32px 28px",
          borderRadius: 20, background: "var(--bg-card)",
          border: "1px solid var(--border-strong)",
          boxShadow: `0 24px 80px rgba(0,0,0,0.2),
                      0 0 0 1px var(--border-subtle),
                      inset 0 1px 0 rgba(255,255,255,0.04)`,
          backdropFilter: "blur(24px)",
          animation: shake ? "loginShake 0.5s ease-in-out" : success ? "loginSuccess 0.5s ease-out" : "loginCardIn 0.7s cubic-bezier(0.16, 1, 0.3, 1)",
        }}>

          {/* Card header */}
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div style={{
              width: 52, height: 52, borderRadius: 14, margin: "0 auto 14px",
              background: success
                ? "linear-gradient(135deg, var(--success), #059669)"
                : "linear-gradient(135deg, var(--accent-glow), var(--ai-glow))",
              border: `1px solid ${success ? "var(--success)" : "var(--border-default)"}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.4s ease",
              boxShadow: success ? "0 0 32px var(--success-glow)" : "none",
            }}>
              {success
                ? <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" style={{ strokeDasharray: 30, strokeDashoffset: 0, animation: "loginCheck 0.4s ease-out" }} /></svg>
                : <Lock style={{ width: 24, height: 24, color: "var(--accent)" }} />}
            </div>
            <h2 style={{
              fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700,
              color: "var(--text-primary)", marginBottom: 4,
            }}>
              {success ? "Welcome!" : "Sign in"}
            </h2>
            <p style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
              {success ? "Redirecting to your dashboard…" : "Enter your credentials to continue"}
            </p>
          </div>

          {/* Form */}
          {!success && (
            <form ref={formRef} onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Username */}
              <div>
                <label htmlFor="login-username" style={{
                  display: "block", fontSize: 11, fontWeight: 600,
                  color: "var(--text-secondary)", marginBottom: 5,
                  textTransform: "uppercase", letterSpacing: "0.08em",
                }}>Username</label>
                <input
                  id="login-username" type="text" autoComplete="username" autoFocus
                  placeholder="Enter username" value={username}
                  onChange={(e) => { setUsername(e.target.value); setError(""); }}
                  style={{
                    width: "100%", padding: "11px 14px", borderRadius: 8,
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
                  color: "var(--text-secondary)", marginBottom: 5,
                  textTransform: "uppercase", letterSpacing: "0.08em",
                }}>Password</label>
                <div style={{ position: "relative" }}>
                  <input
                    id="login-password" type={showPassword ? "text" : "password"}
                    autoComplete="current-password" placeholder="Enter password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(""); }}
                    style={{
                      width: "100%", padding: "11px 44px 11px 14px", borderRadius: 8,
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
                  fontSize: 12, color: "var(--error)", padding: "9px 14px",
                  borderRadius: 8, background: "rgba(248,113,113,0.06)",
                  border: "1px solid rgba(248,113,113,0.15)", textAlign: "center",
                  animation: "loginFadeIn 0.3s ease-out",
                }}>
                  {error}
                </div>
              )}

              {/* Submit */}
              <button type="submit" disabled={isLoading} style={{
                width: "100%", padding: "12px 20px", borderRadius: 10,
                border: "none",
                background: isLoading ? "var(--accent-dim)" : "linear-gradient(135deg, var(--accent), #7C3AED)",
                color: "#fff", fontSize: 14, fontWeight: 600,
                fontFamily: "var(--font-body)", cursor: isLoading ? "wait" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                transition: "all 0.3s ease",
                boxShadow: "0 4px 20px var(--accent-glow)", marginTop: 2,
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
              marginTop: 16, padding: "10px 14px", borderRadius: 10,
              background: "linear-gradient(135deg, var(--ai-glow), rgba(56,189,248,0.05))",
              border: "1px solid rgba(167,139,250,0.12)", textAlign: "center",
            }}>
              <div style={{ fontSize: 10, color: "var(--ai)", fontWeight: 700, marginBottom: 3, letterSpacing: "0.08em" }}>
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

          <p style={{ textAlign: "center", fontSize: 10, color: "var(--text-tertiary)", marginTop: 16, letterSpacing: "0.02em" }}>
            © 2026 Acufy CRM · Precision Intelligence
          </p>
        </div>
      </div>

      {/* ── CSS Keyframes ────────────────────────────────── */}
      <style>{`
        @keyframes loginCardIn {
          from { opacity: 0; transform: translateY(32px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes loginLogoIn {
          from { opacity: 0; transform: scale(0.8) translateY(20px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
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
