// src/ui/theme.js

import React from "react";

// --- GLOBAL STYLES & FONTS ---
export const FontLoader = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap');

    html, body, #root {
      height: 100%;
      width: 100%;
      background: #F9F3EF;
      overflow-x: visible; /* important */
    }

    body {
      margin: 0;
      padding: 0;
      overflow-x: auto !important;  /* force scroll */
      overflow-y: auto;
    }

    #root {
      overflow: visible !important; /* prevents root clipping */
      max-width: 100%;
    }

    *, *::before, *::after { box-sizing: border-box; }

    ::-webkit-scrollbar { width: 8px; height: 8px; }
    ::-webkit-scrollbar-track { background: #F9F3EF; }
    ::-webkit-scrollbar-thumb { background: #BFD8D2; border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: #163A5F; }
  `}</style>
);


// --- THEME ---
export const THEME = {
  bg: '#F9F3EF',
  text: '#163A5F',
  textMuted: '#5D7A94',

  brandPrimary: '#163A5F',
  brandSecondary: '#FFC0B3',
  brandAccent: '#BFD8D2',
  brandYellow: '#F8C66D',

  cardBg: '#FFFFFF',
  cardShadow: '6px 6px 0px 0px #BFD8D2',
  cardShadowHover: '8px 8px 0px 0px #BFD8D2',
  cardBorder: 'none',
  radius: '2px',

  serifFont: '"Montserrat", sans-serif',
  sansFont: '"Montserrat", sans-serif',

  status: {
    P: { bg: '#FFFFFF', text: '#163A5F', label: 'To Present', dot: '#163A5F', border: '2px solid #BFD8D2' },
    W: { bg: '#FFF8EB', text: '#163A5F', label: 'Practicing', dot: '#F8C66D', border: '2px solid #F8C66D' },
    M: { bg: '#F1F8F6', text: '#163A5F', label: 'Mastered', dot: '#5E9494', border: '2px solid #5E9494' },
    A: { bg: '#EEF7FF', text: '#163A5F', label: 'Next Month Aim', dot: '#1E88E5', border: '2px solid #90CAF9' },
    DEFAULT: { bg: '#F9F9F9', text: '#718096', label: '-', dot: '#CBD5E0', border: '1px solid #eee' }
  },

  subjects: {
    Math: { bg: '#E3F2FD', text: '#163A5F', border: '#90CAF9', accent: '#1E88E5' },
    English: { bg: '#FFEBEE', text: '#163A5F', border: '#EF9A9A', accent: '#E57373' },
    Sensorial: { bg: '#FFFDE7', text: '#163A5F', border: '#FFF59D', accent: '#FDD835' },
    Culture: { bg: '#E8F5E9', text: '#163A5F', border: '#A5D6A7', accent: '#66BB6A' },
    PracticalLife: { bg: '#FBE9E7', text: '#163A5F', border: '#FFAB91', accent: '#FF7043' },
    DEFAULT: { bg: '#FAFAFA', text: '#4A5568', border: '#E2E8F0', accent: '#CBD5E0' }
  },

  classroomColors: ['#FFC0B3', '#BFD8D2', '#F8C66D', '#AEC6CF', '#F49AC2', '#C3B1E1']
};

export const getStatusStyle = (code) => THEME.status[code] || THEME.status.DEFAULT;

export const getSubjectStyle = (subj) => {
  if (!subj) return THEME.subjects.DEFAULT;
  const normalized = subj.toLowerCase().replace(/\s/g, '');
  if (normalized.includes('math')) return THEME.subjects.Math;
  if (normalized.includes('english') || normalized.includes('language')) return THEME.subjects.English;
  if (normalized.includes('sensor')) return THEME.subjects.Sensorial;
  if (normalized.includes('cultur') || normalized.includes('science') || normalized.includes('geo')) return THEME.subjects.Culture;
  if (normalized.includes('practical')) return THEME.subjects.PracticalLife;
  return THEME.subjects.DEFAULT;
};

// classify sessions so we can color them
export const SESSION_TYPE_STYLE = {
  ASSESSMENT: { bg: '#FFEBEE', border: '#EF9A9A', text: '#B71C1C' },
  THEME:      { bg: '#F3E5F5', border: '#CE93D8', text: '#4A148C' },
  TRIP:       { bg: '#E0F2F1', border: '#80CBC4', text: '#004D40' },
  GENERAL:    { bg: '#ECEFF1', border: '#B0BEC5', text: '#263238' },
  CURR:       { bg: '#FFFFFF', border: '#EEE',    text: THEME.text }
};
