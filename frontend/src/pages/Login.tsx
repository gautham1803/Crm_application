import React, { useState, useEffect, useRef } from "react";
import { Sparkles, Eye, EyeOff, ArrowRight, Shield, Zap, BarChart3, Lock } from "lucide-react";

interface LoginPageProps {
  onLogin: () => void;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // Animated particles
  const [particles] = useState(() =>
    Array.from({ length: 40 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 3 + 1,
      duration: Math.random() * 20 + 10,
      delay: Math.random() * 10,
      opacity: Math.random() * 0.4 + 0.1,
    }))
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!username.trim() || !password.trim()) {
      setError("Please enter both username and password");
      setShake(true);
      setTimeout(() => setShake(false), 600);
      return;
    }

    setIsLoading(true);

    // Simulate a brief network delay
    await new Promise((r) => setTimeout(r, 800));

    if (username === "demo" && password === "demo") {
      // Success animation then redirect
      setIsLoading(false);
      onLogin();
    } else {
      setIsLoading(false);
      setError("Invalid credentials. Use demo / demo");
      setShake(true);
      setTimeout(() => setShake(false), 600);
    }
  };

  const features = [
    { icon: Zap, label: "AI-Powered Pipeline", desc: "Autonomous agents qualify leads and draft outreach" },
    { icon: BarChart3, label: "Real-time Analytics", desc: "Live deal tracking with win-probability forecasting" },
    { icon: Shield, label: "Compliance First", desc: "CAN-SPAM & GDPR checks on every message" },
  ];

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        background: "var(--bg-base)",
        fontFamily: "var(--font-body)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Animated background particles */}
      {particles.map((p) => (
        <div
          key={p.id}
          style={{
            position: "absolute",
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            borderRadius: "50%",
            background: "var(--accent)",
            opacity: p.opacity,
            animation: `loginFloat ${p.duration}s ease-in-out ${p.delay}s infinite alternate`,
            pointerEvents: "none",
          }}
        />
      ))}

      {/* Gradient orbs */}
      <div
        style={{
          position: "absolute",
          width: 500,
          height: 500,
          borderRadius: "50%",
          background: "radial-gradient(circle, var(--accent-glow) 0%, transparent 70%)",
          top: "-15%",
          right: "-10%",
          filter: "blur(60px)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 400,
          height: 400,
          borderRadius: "50%",
          background: "radial-gradient(circle, var(--ai-glow) 0%, transparent 70%)",
          bottom: "-10%",
          left: "-5%",
          filter: "blur(60px)",
          pointerEvents: "none",
        }}
      />

      {/* Left panel — branding & features */}
      <div
        style={{
          flex: "1 1 50%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "4rem 5%",
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 48 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "linear-gradient(135deg, var(--accent), var(--ai))",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 32px var(--accent-glow)",
            }}
          >
            <Sparkles style={{ width: 22, height: 22, color: "#fff" }} />
          </div>
          <div>
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 26,
                fontWeight: 800,
                color: "var(--text-primary)",
                letterSpacing: "-0.02em",
              }}
            >
              Acufy
            </span>
            <span
              style={{
                display: "block",
                fontSize: 10,
                fontWeight: 500,
                color: "var(--text-tertiary)",
                textTransform: "uppercase",
                letterSpacing: "0.12em",
              }}
            >
              CRM Platform
            </span>
          </div>
        </div>

        {/* Headline */}
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(2rem, 3.5vw, 3rem)",
            fontWeight: 800,
            color: "var(--text-primary)",
            lineHeight: 1.1,
            marginBottom: 16,
            letterSpacing: "-0.03em",
          }}
        >
          AI-Powered
          <br />
          <span style={{ background: "linear-gradient(135deg, var(--accent), var(--ai))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Sales Intelligence
          </span>
        </h1>
        <p style={{ fontSize: 16, color: "var(--text-secondary)", maxWidth: 440, lineHeight: 1.6, marginBottom: 48 }}>
          Autonomous AI agents that qualify leads, research accounts, draft outreach, and orchestrate your deals — all with compliance built in.
        </p>

        {/* Feature cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 440 }}>
          {features.map((f, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 14,
                padding: "16px 18px",
                borderRadius: "var(--r-md)",
                background: "var(--bg-card)",
                border: "1px solid var(--border-subtle)",
                transition: "border-color 0.3s, box-shadow 0.3s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border-accent)";
                (e.currentTarget as HTMLDivElement).style.boxShadow = "0 0 20px var(--accent-glow)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border-subtle)";
                (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: "var(--accent-glow)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <f.icon style={{ width: 18, height: 18, color: "var(--accent)" }} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 2 }}>{f.label}</div>
                <div style={{ fontSize: 12, color: "var(--text-tertiary)", lineHeight: 1.4 }}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — login form */}
      <div
        style={{
          flex: "1 1 50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 420,
            padding: "40px 36px",
            borderRadius: "var(--r-lg)",
            background: "var(--bg-card)",
            border: "1px solid var(--border-strong)",
            boxShadow: "0 8px 48px rgba(0,0,0,0.25), 0 0 0 1px var(--border-subtle)",
            backdropFilter: "blur(20px)",
            animation: shake ? "loginShake 0.5s ease-in-out" : "loginSlideUp 0.6s ease-out",
          }}
        >
          {/* Card header */}
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 14,
                background: "linear-gradient(135deg, var(--accent-glow), var(--ai-glow))",
                border: "1px solid var(--border-default)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px",
              }}
            >
              <Lock style={{ width: 24, height: 24, color: "var(--accent)" }} />
            </div>
            <h2
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 22,
                fontWeight: 700,
                color: "var(--text-primary)",
                marginBottom: 6,
              }}
            >
              Welcome back
            </h2>
            <p style={{ fontSize: 13, color: "var(--text-tertiary)" }}>Sign in to your dashboard</p>
          </div>

          {/* Form */}
          <form ref={formRef} onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {/* Username */}
            <div>
              <label
                htmlFor="login-username"
                style={{
                  display: "block",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--text-secondary)",
                  marginBottom: 6,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Username
              </label>
              <input
                id="login-username"
                type="text"
                autoComplete="username"
                autoFocus
                placeholder="Enter username"
                value={username}
                onChange={(e) => { setUsername(e.target.value); setError(""); }}
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  borderRadius: "var(--r-sm)",
                  border: `1px solid ${error ? "var(--error)" : "var(--border-default)"}`,
                  background: "var(--bg-elevated)",
                  color: "var(--text-primary)",
                  fontSize: 14,
                  fontFamily: "var(--font-body)",
                  outline: "none",
                  transition: "border-color 0.2s, box-shadow 0.2s",
                }}
                onFocus={(e) => {
                  if (!error) {
                    e.currentTarget.style.borderColor = "var(--accent)";
                    e.currentTarget.style.boxShadow = "0 0 0 3px var(--accent-glow)";
                  }
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = error ? "var(--error)" : "var(--border-default)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="login-password"
                style={{
                  display: "block",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--text-secondary)",
                  marginBottom: 6,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Password
              </label>
              <div style={{ position: "relative" }}>
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  style={{
                    width: "100%",
                    padding: "12px 42px 12px 14px",
                    borderRadius: "var(--r-sm)",
                    border: `1px solid ${error ? "var(--error)" : "var(--border-default)"}`,
                    background: "var(--bg-elevated)",
                    color: "var(--text-primary)",
                    fontSize: 14,
                    fontFamily: "var(--font-body)",
                    outline: "none",
                    transition: "border-color 0.2s, box-shadow 0.2s",
                  }}
                  onFocus={(e) => {
                    if (!error) {
                      e.currentTarget.style.borderColor = "var(--accent)";
                      e.currentTarget.style.boxShadow = "0 0 0 3px var(--accent-glow)";
                    }
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = error ? "var(--error)" : "var(--border-default)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: "absolute",
                    right: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 4,
                    color: "var(--text-tertiary)",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  {showPassword ? <EyeOff style={{ width: 16, height: 16 }} /> : <Eye style={{ width: 16, height: 16 }} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div
                style={{
                  fontSize: 12,
                  color: "var(--error)",
                  padding: "8px 12px",
                  borderRadius: "var(--r-sm)",
                  background: "rgba(248,113,113,0.08)",
                  border: "1px solid rgba(248,113,113,0.2)",
                  textAlign: "center",
                }}
              >
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              style={{
                width: "100%",
                padding: "13px 20px",
                borderRadius: "var(--r-sm)",
                border: "none",
                background: isLoading
                  ? "var(--accent-dim)"
                  : "linear-gradient(135deg, var(--accent), #6366F1)",
                color: "#fff",
                fontSize: 14,
                fontWeight: 600,
                fontFamily: "var(--font-body)",
                cursor: isLoading ? "wait" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                transition: "all 0.3s ease",
                boxShadow: "0 4px 16px var(--accent-glow)",
                marginTop: 4,
              }}
              onMouseEnter={(e) => {
                if (!isLoading) {
                  (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)";
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 6px 24px var(--accent-glow)";
                }
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
                (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 16px var(--accent-glow)";
              }}
            >
              {isLoading ? (
                <>
                  <div
                    style={{
                      width: 16,
                      height: 16,
                      border: "2px solid rgba(255,255,255,0.3)",
                      borderTopColor: "#fff",
                      borderRadius: "50%",
                      animation: "loginSpin 0.6s linear infinite",
                    }}
                  />
                  Signing in…
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight style={{ width: 16, height: 16 }} />
                </>
              )}
            </button>
          </form>

          {/* Demo hint */}
          <div
            style={{
              marginTop: 24,
              padding: "12px 16px",
              borderRadius: "var(--r-sm)",
              background: "var(--ai-glow)",
              border: "1px solid rgba(167,139,250,0.15)",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 11, color: "var(--ai)", fontWeight: 600, marginBottom: 2 }}>
              <Sparkles style={{ width: 12, height: 12, display: "inline", verticalAlign: "-2px", marginRight: 4 }} />
              DEMO CREDENTIALS
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
              Username: <code style={{ fontFamily: "var(--font-mono)", color: "var(--text-primary)", fontWeight: 600 }}>demo</code>
              {" · "}
              Password: <code style={{ fontFamily: "var(--font-mono)", color: "var(--text-primary)", fontWeight: 600 }}>demo</code>
            </div>
          </div>

          {/* Footer */}
          <p style={{ textAlign: "center", fontSize: 11, color: "var(--text-tertiary)", marginTop: 24 }}>
            © 2026 Acufy CRM · AI-Powered Sales Intelligence
          </p>
        </div>
      </div>

      {/* CSS animations */}
      <style>{`
        @keyframes loginSlideUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes loginShake {
          0%, 100% { transform: translateX(0); }
          15%       { transform: translateX(-8px); }
          30%       { transform: translateX(6px); }
          45%       { transform: translateX(-5px); }
          60%       { transform: translateX(4px); }
          75%       { transform: translateX(-2px); }
        }
        @keyframes loginSpin {
          to { transform: rotate(360deg); }
        }
        @keyframes loginFloat {
          from { transform: translateY(0) scale(1); opacity: var(--o, 0.2); }
          to   { transform: translateY(-30px) scale(1.3); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
