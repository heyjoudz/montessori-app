import React, { useState } from 'react';
import { supabase } from './supabaseClient';
import { THEME, FontLoader } from './ui/theme';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // ✅ Changed: Split fullName into two states
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // --- small color helpers ---
  const hexToRgb = (hex) => {
    const h = (hex || '').replace('#', '').trim();
    if (h.length === 3) {
      const r = parseInt(h[0] + h[0], 16);
      const g = parseInt(h[1] + h[1], 16);
      const b = parseInt(h[2] + h[2], 16);
      return { r, g, b };
    }
    if (h.length === 6) {
      const r = parseInt(h.slice(0, 2), 16);
      const g = parseInt(h.slice(2, 4), 16);
      const b = parseInt(h.slice(4, 6), 16);
      return { r, g, b };
    }
    return { r: 0, g: 0, b: 0 };
  };

  const rgba = (hex, a = 1) => {
    const { r, g, b } = hexToRgb(hex);
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  };

  const mixHex = (a, b, t = 0.5) => {
    const A = hexToRgb(a);
    const B = hexToRgb(b);
    const r = Math.round(A.r + (B.r - A.r) * t);
    const g = Math.round(A.g + (B.g - A.g) * t);
    const bl = Math.round(A.b + (B.b - A.b) * t);
    const toHex = (n) => n.toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(bl)}`;
  };

  const UI = {
    bg: THEME.bg,
    text: THEME.text,
    muted: THEME.textMuted,

    primary: THEME.brandPrimary,      // navy (for text)
    secondary: THEME.brandSecondary,  // peach
    accent: THEME.brandAccent,        // teal
    yellow: THEME.brandYellow,

    line: rgba(THEME.brandAccent, 0.55),
    soft: rgba(THEME.brandAccent, 0.22),
    soft2: rgba(THEME.brandSecondary, 0.14),

    // CTA colors
    ctaBg: THEME.brandAccent,
    ctaBgHover: mixHex(THEME.brandAccent, THEME.brandPrimary, 0.18),
    ctaText: THEME.brandPrimary,
  };

  // --- “spacier” layout knobs ---
  const SP = {
    cardPad: 36,
    fieldGap: 20,
    toggleGap: 12,
    brandBottom: 26,
  };

  const inputBase = {
    width: '100%',
    padding: '14px 16px',
    borderRadius: 14,
    border: `1px solid ${UI.line}`,
    outline: 'none',
    fontSize: 15,
    lineHeight: 1.4,
    fontFamily: THEME.sansFont,
    fontWeight: 400,
    color: UI.text,
    background: '#fff',
    boxSizing: 'border-box',
    transition: 'box-shadow 0.15s, border-color 0.15s',
  };

  const labelBase = {
    display: 'block',
    fontSize: 11,
    fontWeight: 500, // lighter
    color: UI.muted,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  };

  const focusIn = (e) => {
    e.target.style.borderColor = UI.secondary;
    e.target.style.boxShadow = `0 0 0 5px ${UI.soft2}`;
  };

  const focusOut = (e) => {
    e.target.style.borderColor = UI.line;
    e.target.style.boxShadow = 'none';
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setError(null);

    try {
      if (isSignUp) {
        // ✅ Changed: Sending first_name and last_name in metadata
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { 
            data: { 
              first_name: firstName, 
              last_name: lastName 
            } 
          }
        });
        if (error) throw error;
        alert('Check your email for the confirmation link!');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      setError(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100vw',
        display: 'grid',
        placeItems: 'center',
        background: UI.bg,
        fontFamily: THEME.sansFont,
        color: UI.text,
        padding: 28,
        boxSizing: 'border-box',
      }}
    >
      <FontLoader />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      <div style={{ width: 'min(500px, 94vw)' }}>
        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: SP.brandBottom }}>
          <div
            style={{
              width: 76,
              height: 76,
              margin: '0 auto 18px',
              background: UI.yellow,
              clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)'
            }}
          />
          <div
            style={{
              fontFamily: THEME.serifFont,
              fontWeight: 600, // lighter
              fontSize: 28,
              letterSpacing: '-0.01em',
              lineHeight: 1.15,
              color: UI.text
            }}
          >
            Montessori <span style={{ color: UI.secondary, fontWeight: 600 }}>OS</span>
          </div>

          <div style={{ marginTop: 10, color: UI.muted, fontWeight: 450, fontSize: 15, lineHeight: 1.4 }}>
            Sign in to continue
          </div>
        </div>

        {/* Card */}
        <div
          style={{
            background: '#fff',
            borderRadius: 22,
            padding: SP.cardPad,
            boxShadow: THEME.cardShadow,
            border: `1px solid ${rgba(UI.accent, 0.35)}`,
          }}
        >
          {/* Mode toggle */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: SP.toggleGap,
              marginBottom: 24
            }}
          >
            <button
              type="button"
              onClick={() => { setIsSignUp(false); setError(null); }}
              style={{
                border: `1px solid ${isSignUp ? rgba(UI.accent, 0.55) : rgba(UI.secondary, 0.55)}`,
                background: isSignUp ? '#fff' : rgba(UI.secondary, 0.14),
                color: UI.text,
                borderRadius: 999,
                padding: '12px 14px',
                fontWeight: 500, // lighter
                cursor: 'pointer',
                fontFamily: THEME.sansFont
              }}
            >
              Sign In
            </button>

            <button
              type="button"
              onClick={() => { setIsSignUp(true); setError(null); }}
              style={{
                border: `1px solid ${isSignUp ? rgba(UI.secondary, 0.55) : rgba(UI.accent, 0.55)}`,
                background: isSignUp ? rgba(UI.secondary, 0.14) : '#fff',
                color: UI.text,
                borderRadius: 999,
                padding: '12px 14px',
                fontWeight: 500, // lighter
                cursor: 'pointer',
                fontFamily: THEME.sansFont
              }}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleAuth}>
            {isSignUp && (
              // ✅ Changed: Split inputs side-by-side
              <div style={{ display: 'flex', gap: 16, marginBottom: SP.fieldGap }}>
                <div style={{ flex: 1 }}>
                  <label style={labelBase}>First Name</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    style={inputBase}
                    onFocus={focusIn}
                    onBlur={focusOut}
                    placeholder="e.g. Joud"
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelBase}>Last Name</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                    style={inputBase}
                    onFocus={focusIn}
                    onBlur={focusOut}
                    placeholder="Chamoun"
                  />
                </div>
              </div>
            )}

            <div style={{ marginBottom: SP.fieldGap }}>
              <label style={labelBase}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={inputBase}
                onFocus={focusIn}
                onBlur={focusOut}
                placeholder="you@school.com"
                autoComplete="email"
              />
            </div>

            <div style={{ marginBottom: 26 }}>
              <label style={labelBase}>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={inputBase}
                onFocus={focusIn}
                onBlur={focusOut}
                placeholder="••••••••"
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
              />
            </div>

            {error && (
              <div
                style={{
                  marginTop: 14,
                  marginBottom: 18,
                  padding: '12px 14px',
                  borderRadius: 14,
                  background: rgba('#EF9A9A', 0.16),
                  border: `1px solid ${rgba('#EF9A9A', 0.40)}`,
                  color: UI.text,
                  fontWeight: 450,
                  fontSize: 13.5,
                  lineHeight: 1.45
                }}
              >
                {error}
              </div>
            )}

            {/* CTA */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '14px 18px',
                borderRadius: 999,
                border: `1px solid ${rgba(UI.primary, 0.12)}`,
                background: UI.ctaBg,
                color: UI.ctaText,
                fontWeight: 600, // lighter than before
                fontSize: 15,
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: `8px 8px 0px 0px ${UI.accent}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                opacity: loading ? 0.9 : 1,
                transition: 'transform 0.06s, background 0.15s'
              }}
              onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = UI.ctaBgHover; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = UI.ctaBg; }}
              onMouseDown={(e) => { if (!loading) e.currentTarget.style.transform = 'scale(0.99)'; }}
              onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
            >
              {loading ? (
                <>
                  <span
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      border: `2px solid ${rgba(UI.primary, 0.25)}`,
                      borderTopColor: UI.primary,
                      display: 'inline-block',
                      animation: 'spin 0.9s linear infinite'
                    }}
                  />
                  Processing…
                </>
              ) : (
                isSignUp ? 'Create account' : 'Sign in'
              )}
            </button>

            <div style={{ marginTop: 22, textAlign: 'center' }}>
              <button
                type="button"
                onClick={() => { setIsSignUp(!isSignUp); setError(null); }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: UI.primary,
                  cursor: 'pointer',
                  fontWeight: 450, // lighter
                  fontSize: 13.5,
                  textDecoration: 'underline',
                  textUnderlineOffset: 4,
                  padding: 8
                }}
              >
                {isSignUp ? 'Already have an account? Sign in' : 'Need an account? Sign up'}
              </button>
            </div>
          </form>
        </div>

        <div style={{ textAlign: 'center', marginTop: 18, color: UI.muted, fontSize: 12.5, fontWeight: 450 }}>
          Montessori Digital Planner • secure sign-in
        </div>
      </div>
    </div>
  );
}