import React from 'react';
import { supabase } from './supabaseClient';
import { THEME } from './ui/theme';

export default function WaitingApproval({ user, onLogout }) {
  
  // 1. Get email as fallback
  const email = (user?.email || '').toLowerCase();
  
  // 2. Get First Name from metadata (saved during sign up)
  const metadata = user?.user_metadata || {};
  const firstName = (metadata.first_name || '').toLowerCase();

  // --- DEFAULT CONTENT (For strangers/teachers) ---
  let content = {
    emoji: '⏳',
    title: 'Account Pending',
    body: (
      <>
        Thanks for signing up! For security reasons, a school administrator needs to verify your role before granting access.
        <br /><br />
        We will send you an email once your account is active.
      </>
    )
  };

  // --- 1. JEAN (Checks First Name) ---
  if (firstName.includes('jean')) {
    content = {
      emoji: '🎩',
      title: 'Ahla Amo Jean!',
      body: (
        <div style={{ fontSize: 18, direction: 'rtl', fontFamily: 'sans-serif', lineHeight: 1.6 }}>
          عمو جان بعتذر عم في تعديل جديد بيي العظيم طلبوا مني بس خلص بخبركن
        </div>
      )
    };
  }

  // --- 2. RIMA (Checks First Name) ---
  else if (firstName.includes('rima')) {
    content = {
      emoji: '🌸',
      title: 'Ahla Tante Rima!',
      body: (
        <div style={{ fontSize: 18, direction: 'rtl', fontFamily: 'sans-serif', lineHeight: 1.6 }}>
           ريما بعتذر عم في تعديل جديد بيي العظيم طلبوا مني بس خلص بخبركن
        </div>
      )
    };
  }

  // --- 3. JOUD (Checks Name OR Email) ---
  else if (firstName.includes('joud') || email.includes('joud')) {
    content = {
      emoji: '👨‍💻',
      title: 'Welcome Master Joud',
      body: (
        <div style={{ fontSize: 16 }}>
          This is the <b>Pending Screen</b> that users see.
          <br /><br />
          To enter the app, go to your database and set your status to <code style={{ background: '#eee', padding: 4 }}>active</code>.
        </div>
      )
    };
  }

  // --- UI RENDER ---
  const UI = {
    bg: THEME.bg,
    text: THEME.text,
    yellow: THEME.brandYellow,
    secondary: THEME.brandSecondary,
    muted: THEME.textMuted,
    accent: THEME.brandAccent,
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    if (onLogout) onLogout();
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