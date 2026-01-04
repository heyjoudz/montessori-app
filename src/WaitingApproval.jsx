import React from 'react';
import { supabase } from './supabaseClient';
import { THEME } from './ui/theme';

export default function WaitingApproval({ user, onLogout }) {
  
  // General content for all users
  const content = {
    emoji: '⏳',
    title: 'Account Pending',
    body: (
      <>
        Thanks for signing up! We are currently reviewing your request to join.
        <br /><br />
        You will receive an email confirmation once your account is active.
      </>
    )
  };

  // --- UI RENDER ---
  const UI = {
    bg: THEME.bg,
    text: THEME.text,
    yellow: THEME.brandYellow,
    secondary: THEME.brandSecondary,
    muted: THEME.textMuted,
    accent: THEME.brandAccent,
  };

  // ✅ SAFE LOGOUT HANDLER
  const handleLogout = async () => {
    // 1. Attempt to tell Supabase to sign out
    const { error } = await supabase.auth.signOut();
    if (error) console.log("Logout error (ignored):", error.message);

    // 2. 🔥 NUCLEAR OPTION: Wipe Local Storage
    // This removes the stuck token so the browser forgets who you are.
    localStorage.clear();

    // 3. Force UI update
    if (onLogout) onLogout();
    
    // 4. Force hard reload to clear any stuck cache/state
    window.location.href = '/'; // Better than reload() for redirecting to login
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
        padding: 20,
        boxSizing: 'border-box',
      }}
    >
      <div style={{ width: 'min(460px, 94vw)', textAlign: 'center' }}>
        
        {/* Animated Icon */}
        <div style={{ position: 'relative', width: 80, height: 80, margin: '0 auto 24px' }}>
          <div 
            style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.5)',
              border: `2px dashed ${UI.secondary}`,
              animation: 'spin 8s linear infinite'
            }} 
          />
          <div 
            style={{
              position: 'absolute', inset: 10, borderRadius: '50%',
              background: UI.yellow,
              display: 'grid', placeItems: 'center',
              fontSize: 32
            }}
          >
            {content.emoji}
          </div>
        </div>
        
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

        <h1 style={{ 
          fontFamily: THEME.serifFont, 
          fontSize: 28, 
          marginBottom: 12,
          color: UI.text 
        }}>
          {content.title}
        </h1>

        <div style={{ 
          fontSize: 16, 
          lineHeight: 1.6, 
          color: UI.muted,
          marginBottom: 32 
        }}>
          {content.body}
        </div>

        {/* Action Button */}
        <button
          onClick={handleLogout}
          style={{
            background: 'transparent',
            border: `1px solid ${UI.accent}`,
            color: UI.text,
            padding: '12px 24px',
            borderRadius: 999,
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 500,
            fontFamily: THEME.sansFont,
            transition: 'background 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.5)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        >
          Sign out & Check Later
        </button>

      </div>
    </div>
  );
}