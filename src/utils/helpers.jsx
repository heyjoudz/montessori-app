import React from 'react';
import { SESSION_TYPE_STYLE, THEME } from '../ui/theme'; 

// --- CONSTANTS ---
export const SUBJECT_KEYS = ['Math', 'English', 'Sensorial', 'Culture', 'Practical Life'];
export const ACADEMIC_START = '2025-09-08';
export const WINTER_BREAK_START = '2025-12-20'; // Adjust if your break started on a different day
export const WINTER_BREAK_OFFSET_WEEKS = 2;
export const PAGE_SIZE = 1000;

// --- STATUS & TYPES ---
export const normalizeStatusCode = (raw) => {
  const s = (raw ?? '').toString().trim();
  if (!s) return 'P';
  
  const u = s.toUpperCase();
  if (u === 'P' || u === 'W' || u === 'M' || u === 'A') return u;

  const n = s.toLowerCase().replace(/[_-]/g, ' ').trim();
  
  if (n === 'to present' || n === 'present' || n === 'planned' || n === 'todo' || n === 'to do') return 'P';
  if (n === 'practicing' || n === 'working' || n === 'in progress') return 'W';
  if (n === 'mastered' || n === 'done' || n === 'complete' || n === 'completed') return 'M';
  if (n === 'aim' || n === 'next month aim' || n === 'goal') return 'A';
  if (u === 'ARCHIVED' || n === 'archived') return 'Archived';
  
  return 'P'; 
};

export const inferDashboardType = (row) => {
  if (!row) return 'other';
  const explicit = row.entry_type || row.plan_entry_type || row.type || row.item_type || row.kind;
  if (explicit) return String(explicit).toLowerCase();
  if (row.curriculum_activity_id) return 'curriculum';
  
  const label = String(row.category || row.category_name || row.session_category || row.group || '').toLowerCase();
  
  if (label.includes('theme')) return 'theme';
  if (label.includes('assessment') || label.includes('evaluation') || label.includes('progress')) return 'assessment';
  if (label.includes('map')) return 'map';
  
  return 'other';
};

export const matchesTypeFilter = (row, selected) => {
  const s = String(selected || 'ALL').toUpperCase();
  if (s === 'ALL') return true;
  
  const t = inferDashboardType(row);
  
  if (s === 'CURRICULUM') return t === 'curriculum';
  if (s === 'THEME') return t === 'theme';
  if (s === 'ASSESSMENT') return t === 'assessment';
  if (s === 'MAP') return t === 'map';
  if (s === 'OTHER') return t === 'other';
  
  return t === s.toLowerCase();
};

export const getSessionType = (s) => {
  if (!s) return 'GENERAL';
  
  const area = (s.curriculum_areas?.name || s.area || 'General').toLowerCase();
  const cat = (s.curriculum_categories?.name || s.category || '').toLowerCase();
  const label = (s.curriculum_activities?.name || s.raw_activity || s.session_label || '').toLowerCase();
  
  const hay = `${area} ${cat} ${label}`;

  if (/assessment|evaluation|progress/.test(hay)) return 'ASSESSMENT';
  if (/theme|orientation|unit|season|winter|spring|summer|fall|autumn/.test(hay)) return 'THEME';
  if (/trip|outing|field trip|visit|excursion/.test(hay)) return 'TRIP';
  
  if (area.includes('general') || (!s.curriculum_area_id && !s.curriculum_activity_id)) return 'GENERAL';
  
  return 'CURR';
};

// --- DATES ---
export const dateISO = (d) => {
  if (!d) return null;
  
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}/.test(d)) {
    return d.substring(0, 10);
  }

  const dt = new Date(d);
  if (isNaN(dt.getTime())) return null;

  const yyyy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  
  return `${yyyy}-${mm}-${dd}`;
};

export const safeDate = (dateStr) => {
  if (!dateStr) return 'No Date';
  
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'No Date';
  
  if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  }

  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export const addDays = (d, n) => {
  const dt = new Date(d);
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt;
};

export const startOfWeekMonday = (d) => {
  const dt = typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) 
    ? new Date(`${d}T00:00:00Z`) 
    : new Date(d);

  const day = dt.getUTCDay(); 
  const diffToMon = (day === 0 ? -6 : 1) - day;
  
  dt.setUTCDate(dt.getUTCDate() + diffToMon);
  dt.setUTCHours(0, 0, 0, 0);
  return dt;
};

export const isDateInWeek = (iso, weekStartISO) => {
  if (!iso || !weekStartISO) return false;
  const d = new Date(iso);
  const ws = new Date(weekStartISO);
  if (isNaN(d.getTime()) || isNaN(ws.getTime())) return false;
  const we = addDays(ws, 4);
  return d >= ws && d <= we;
};

export const getWeekFromDate = (dateValue) => {
  if (!dateValue) return 1;
  
  const start = new Date(`${ACADEMIC_START}T00:00:00Z`);
  const t = new Date(dateValue);
  const target = new Date(Date.UTC(t.getFullYear(), t.getMonth(), t.getDate()));
  
  const diffTime = target - start;
  const diffDays = diffTime / (1000 * 60 * 60 * 24);
  
  let diffWeeks = Math.floor(diffDays / 7) + 1;
  
  // ADJUSTMENT: Subtract holiday weeks if we are past the winter break
  const breakStart = new Date(`${WINTER_BREAK_START}T00:00:00Z`);
  if (target >= breakStart) {
    diffWeeks -= WINTER_BREAK_OFFSET_WEEKS;
  }
  
  if (diffWeeks < 1) return 1;
  return Math.max(1, Math.min(diffWeeks, 40));
};

export const getWeekStartFromAcademic = (weekNum) => {
  const base = startOfWeekMonday(ACADEMIC_START);
  const w = Math.max(1, Number(weekNum || 1));
  
  let targetDate = addDays(base, (w - 1) * 7);

  // ADJUSTMENT: Push the date forward if the target week happens after the holiday
  const breakStart = new Date(`${WINTER_BREAK_START}T00:00:00Z`);
  const weeksBeforeBreak = Math.floor((breakStart - base) / (1000 * 60 * 60 * 24) / 7) + 1;

  if (w >= weeksBeforeBreak) {
    targetDate = addDays(targetDate, WINTER_BREAK_OFFSET_WEEKS * 7);
  }

  return targetDate;
};

export const getWeekRangeLabel = (weekNum) => {
  const ws = getWeekStartFromAcademic(weekNum);
  const we = addDays(ws, 4); 
  
  const start = safeDate(dateISO(ws));
  const end = safeDate(dateISO(we));
  return `${start} – ${end}`;
};

export const getMonthName = (monthNum) => {
  const startMonthIndex = 8; 
  const d = new Date(new Date().getFullYear(), startMonthIndex + (monthNum - 1), 1);
  return d.toLocaleString('default', { month: 'long' });
};

// --- STRINGS & FORMATTING ---
export const getFirstName = (displayName) => (displayName ? displayName.split(' ')[0] : 'Teacher');

export const getDisplayName = (profile, user) => {
  const first = (profile?.first_name || '').trim();
  const last = (profile?.last_name || '').trim();
  if (first && last) return `${first} ${last}`;
  if (first) return first;
  const full = (profile?.full_name || '').trim();
  if (full) return full;
  const email = (user?.email || '').trim();
  if (email && email.includes('@')) return email.split('@')[0];
  return 'Teacher';
};

export const formatStudentName = (s, { shortLast = true } = {}) => {
  if (!s) return 'Unknown';
  const first = (s.first_name || '').trim();
  const last = (s.last_name || '').trim();
  if (!first && !last) return 'Student';
  if (!last) return first || 'Student';
  return shortLast ? `${first} ${last[0].toUpperCase()}.` : `${first} ${last}`;
};

export const renderS1S2Italic = (text) => {
  const t = String(text || '').trim();
  const m = t.match(/^(S[12])\s*[:\-]?\s*(.*)$/i);
  if (!m) return t;
  const tag = m[1].toUpperCase();
  const rest = m[2] || '';
  return (
    <span>
      <i>{tag}</i>{rest ? ` — ${rest}` : ''}
    </span>
  );
};

// --- DATA NORMALIZATION ---
export const getNormalizedItem = (item) => {
  if (!item) return {};

  const linkedName = item.curriculum_activities?.name;
  const manualActivity = item.activity || 'Untitled';
  const normTitle = linkedName || manualActivity;
  const normArea = item.curriculum_areas?.name || item.area || item.subject || 'General';
  const rawActivity = item.activity || '';
  
  return {
    id: item.id,
    title: normTitle,
    rawActivity: rawActivity,
    area: normArea,
    status: item.status,
    notes: item.notes,
    original: item
  };
};

export const getSubActivityKey = (item) => {
  const n = getNormalizedItem(item);
  const isLinked = !!item.curriculum_activity_id;
  const raw = (n.rawActivity || '').trim();
  const title = (n.title || '').trim();
  
  if (isLinked && raw && title && raw.toLowerCase() !== title.toLowerCase()) return raw;
  
  const notes = (n.notes || '').trim();
  if (notes) return notes;
  
  return 'Standard';
};

export const normalizeKey = (s) => (s || '')
  .toLowerCase()
  .replace(/[’']/g, "'")
  .replace(/[^a-z0-9]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

export const getSubActivityDisplay = (item) => {
  const n = getNormalizedItem(item);
  const isLinked = !!item.curriculum_activity_id;
  const raw = (n.rawActivity || '').trim();
  const title = (n.title || '').trim();
  
  if (isLinked && raw && title && raw.toLowerCase() !== title.toLowerCase()) return raw;
  
  const notes = (n.notes || '').trim();
  if (notes) return notes;
  
  return 'Standard';
};

export const groupWeekSessions = (sessions = []) => {
  const groups = {};
  sessions.forEach(s => {
    const area = (s.curriculum_areas?.name || s.area || 'General').trim() || 'General';
    const category = (s.curriculum_categories?.name || s.category || 'Uncategorized').trim() || 'Uncategorized';
    const activity = (s.curriculum_activities?.name || s.raw_activity || s.session_label || 'Session').trim() || 'Session';
    const teacherLine = (
      (s.teacher_notes || s.notes || '').trim() ||
      (s.session_label || '').trim() ||
      (s.raw_activity || '').trim() ||
      'Standard'
    );
    const type = getSessionType(s);

    if (!groups[area]) groups[area] = {};
    if (!groups[area][category]) groups[area][category] = {};
    if (!groups[area][category][activity]) {
      groups[area][category][activity] = { notes: new Map(), count: 0 };
    }
    groups[area][category][activity].count += 1;
    if (teacherLine) {
      if (!groups[area][category][activity].notes.has(teacherLine)) {
        groups[area][category][activity].notes.set(teacherLine, type);
      }
    }
  });
  return groups;
};

// --- COLORS ---
const clamp01 = (n) => Math.max(0, Math.min(1, n));

export const mixHex = (hexA, hexB = '#FFFFFF', t = 0.2) => {
  t = clamp01(t);
  const toRgb = (h) => {
    const x = (h || '').replace('#', '');
    const full = x.length === 3 ? x.split('').map(c => c + c).join('') : x;
    const n = parseInt(full || '000000', 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  };
  const a = toRgb(hexA);
  const b = toRgb(hexB);
  const r = Math.round(a.r + (b.r - a.r) * t);
  const g = Math.round(a.g + (b.g - a.g) * t);
  const bb = Math.round(a.b + (b.b - a.b) * t);
  const toHex = (v) => v.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(bb)}`;
};

// --- CACHE & DATA UTILS ---
export const CURR_CACHE = {
  activitiesById: new Map(),
  areasById: new Map(),
  categoriesById: new Map(),
};

export const primeCurrCache = ({ activities = [], areas = [], categories = [] } = {}) => {
  CURR_CACHE.activitiesById = new Map((activities || []).map(a => [String(a.id), a]));
  CURR_CACHE.areasById = new Map((areas || []).map(a => [String(a.id), a]));
  CURR_CACHE.categoriesById = new Map((categories || []).map(c => [String(c.id), c]));
};

export const enrichCurrRefs = (row) => {
  if (!row) return row;
  const act = row.curriculum_activities || CURR_CACHE.activitiesById.get(String(row.curriculum_activity_id ?? ''));
  const catId = row.curriculum_category_id ?? act?.curriculum_category_id ?? act?.category_id ?? act?.categoryId;
  const areaId = row.curriculum_area_id ?? act?.curriculum_area_id ?? act?.area_id ?? act?.areaId;
  const category = row.curriculum_categories || (catId != null ? CURR_CACHE.categoriesById.get(String(catId)) : null);
  const area = row.curriculum_areas || (areaId != null ? CURR_CACHE.areasById.get(String(areaId)) : null);

  return {
    ...row,
    curriculum_activities: act || row.curriculum_activities || null,
    curriculum_categories: category || row.curriculum_categories || null,
    curriculum_areas: area || row.curriculum_areas || null,
    curriculum_category_id: row.curriculum_category_id ?? (catId ?? null),
    curriculum_area_id: row.curriculum_area_id ?? (areaId ?? null),
  };
};

export async function fetchAllRows(buildPageQuery) {
  let from = 0;
  let all = [];
  while (true) {
    const { data, error } = await buildPageQuery(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const batch = data || [];
    all = all.concat(batch);
    if (batch.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return all;
}

// --- STYLES ---
export function inputStyle() {
  return {
    width: '100%',
    padding: '12px 16px',
    borderRadius: 0,
    border: '1px solid rgba(0,0,0,0.1)',
    background: '#fff',
    fontSize: 14,
    fontWeight: 500,
    color: THEME.text,
    boxSizing: 'border-box',
    outline: 'none',
    boxShadow: 'inset 2px 2px 5px rgba(0,0,0,0.03)'
  };
}

export function selectStyle() {
  return {
    ...inputStyle(),
    appearance: 'none',
    WebkitAppearance: 'none'
  };
}