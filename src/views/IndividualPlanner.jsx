// src/views/IndividualPlanner.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { THEME, getSubjectStyle } from '../ui/theme';
import {
  SUBJECT_KEYS,
  getNormalizedItem,
  startOfWeekMonday,
  dateISO,
  addDays,
  getWeekFromDate,
  safeDate,
} from '../utils/helpers';

import Modal from '../components/ui/Modal';

import {
  Search,
  ChevronLeft,
  ChevronRight,
  Plus,
  CheckCircle2,
  CheckCircle,
  Clock,
  Star,
  Trash2,
  Eye,
  CalendarDays,
  LayoutGrid,
  Undo2,
  MessageSquare,
  Target,
  ChevronDown,
  AlertTriangle,
  Hexagon
} from 'lucide-react';

import { supabase } from '../supabaseClient';

/** ---------------------------
 * HELPERS & THEME MAPPING
 * --------------------------- */
const hexToRgb = (hex) => {
  const h = (hex || '').replace('#', '').trim();
  if (h.length === 3) return { r: parseInt(h[0] + h[0], 16), g: parseInt(h[1] + h[1], 16), b: parseInt(h[2] + h[2], 16) };
  if (h.length === 6) return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
  return { r: 0, g: 0, b: 0 };
};

const rgba = (hex, a = 1) => {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
};

const UI = {
  bg: '#FAF9F6',
  card: '#FFFFFF',
  text: '#4B5563',
  muted: '#6B7280',
  primary: '#233876',
  border: '#E5E7EB',
  accentYellow: '#F4C473',
  accentTeal: '#7BCEBE',
  accentPeach: '#F8B4A6',
  accentSlate: '#A2B5C6',
  success: '#5E9494',
  danger: '#ef4444',
};

const SQUARE_RADIUS = '0px';

function pad2(n) { return String(n).padStart(2, '0'); }

function toDateObj(v) {
  if (!v) return new Date();
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) {
    const d = new Date(`${v.slice(0, 10)}T00:00:00`);
    return isNaN(d.getTime()) ? new Date() : d;
  }
  const d = new Date(v);
  return isNaN(d.getTime()) ? new Date() : d;
}

function getItemDateObj(it) {
  const d =
    toDateObj(it?.planning_date) ||
    toDateObj(it?.date) ||
    (it?.year && it?.month ? new Date(Number(it.year), Number(it.month) - 1, Number(it.day || 1), 0, 0, 0) : null);
  return d && !isNaN(d.getTime()) ? d : null;
}

function monthKeyFromDate(d) { return d ? `${d.getFullYear()}-${pad2(d.getMonth() + 1)}` : null; }
function firstOfMonthISO(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-01`; }
function addMonths(dateObj, n) { const d = new Date(dateObj.getFullYear(), dateObj.getMonth(), 1, 0, 0, 0); d.setMonth(d.getMonth() + n); return d; }

function normStatus(raw) {
  const s = String(raw || '').trim().toUpperCase();
  if (s === 'P' || s === 'W' || s === 'M' || s === 'A' || s === 'S') return s;
  const n = s.toLowerCase().replace(/[_-]/g, ' ').trim();
  if (n.includes('practic')) return 'W';
  if (n.includes('master') || n.includes('done')) return 'M';
  if (n.includes('aim') || n.includes('next month')) return 'A';
  return 'P';
}

function clean(s) { return String(s || '').trim(); }
function iso10(v) { const s = String(v || '').slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : ''; }
function parseId(id) { return id && id !== 'CUSTOM' ? Number(id) : null; }
const normKey = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');

const isArchived = (p) => String(p?.entry_type || '').toLowerCase() === 'archived';

function getBusinessDayISO() {
  const d = new Date();
  const day = d.getDay();
  if (day === 6) d.setDate(d.getDate() + 2); 
  if (day === 0) d.setDate(d.getDate() + 1); 
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dNum = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dNum}`;
}

const parseBorder = (b) => b ? b.split(' ')[2] || b : UI.border;
const statusConfig = {
  P: { label: THEME.status.P.label || 'To Present', bg: THEME.status.P.bg, color: THEME.status.P.text, border: parseBorder(THEME.status.P.border) },
  W: { label: THEME.status.W.label || 'Practicing', bg: THEME.status.W.bg, color: THEME.status.W.text, border: parseBorder(THEME.status.W.border) },
  M: { label: THEME.status.M.label || 'Mastered', bg: THEME.status.M.bg, color: THEME.status.M.text, border: parseBorder(THEME.status.M.border) },
  A: { label: THEME.status.A.label || 'Aim', bg: THEME.status.A.bg, color: THEME.status.A.text, border: parseBorder(THEME.status.A.border) },
};

const DISPLAY_SUBJECTS = SUBJECT_KEYS.filter(s => s.toLowerCase() !== 'practical life');

/** ---------------------------
 * CUSTOM SEARCHABLE DROPDOWN
 * --------------------------- */
const SearchableSelect = ({ options, value, onChange, placeholder, allowCustom = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      const selected = options.find(o => String(o.id) === String(value));
      setSearch(selected ? selected.name : (value || ''));
    }
  }, [value, options, isOpen]);

  useEffect(() => {
    const handleClick = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsOpen(false);
        if (!allowCustom) {
          const selected = options.find(o => String(o.id) === String(value));
          setSearch(selected ? selected.name : '');
        } else if (search && search !== value) {
          onChange(search); 
        }
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [search, value, allowCustom, options, onChange]);

  const filtered = options.filter(o => o.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width: '100%' }}>
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          value={search}
          placeholder={placeholder}
          onFocus={() => setIsOpen(true)}
          onChange={(e) => {
            setSearch(e.target.value);
            setIsOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (filtered.length > 0) {
                onChange(filtered[0].id);
                setSearch(filtered[0].name);
              } else if (allowCustom && search.trim()) {
                onChange(search.trim());
              }
              setIsOpen(false);
            }
          }}
          style={{
            width: '100%', padding: '10px 32px 10px 12px', borderRadius: SQUARE_RADIUS,
            border: `1px solid ${isOpen ? UI.primary : UI.border}`, height: '38px',
            fontSize: 13, fontWeight: 400, outline: 'none', boxSizing: 'border-box',
            fontFamily: THEME.sansFont, color: UI.text, backgroundColor: '#fff',
            boxShadow: isOpen ? `0 0 0 2px ${rgba(UI.primary, 0.05)}` : 'none',
            transition: 'all 0.2s'
          }}
        />
        <ChevronDown size={14} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: UI.muted, pointerEvents: 'none' }} />
      </div>

      {isOpen && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, zIndex: 50,
          background: '#fff', border: `1px solid ${UI.border}`, borderRadius: SQUARE_RADIUS,
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05)', maxHeight: 220, overflowY: 'auto'
        }}>
          {filtered.length > 0 ? filtered.map(o => (
            <div
              key={o.id}
              onClick={() => {
                onChange(o.id);
                setSearch(o.name);
                setIsOpen(false);
              }}
              style={{ padding: '10px 12px', fontSize: 13, fontWeight: 400, cursor: 'pointer', fontFamily: THEME.sansFont, borderBottom: `1px solid #f3f4f6`, background: '#fff' }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
            >
              {o.name}
            </div>
          )) : (
            <div style={{ padding: '10px 12px', fontSize: 13, color: UI.muted, fontStyle: 'italic' }}>
              {allowCustom ? 'Press Enter to add custom name' : 'No matches found'}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/** ---------------------------
 * SHARED UI COMPONENTS
 * --------------------------- */
const ThemedCard = ({ children, style, className = '', onClick, accentColor = UI.border }) => (
  <div
    className={`mb-card ${className}`}
    onClick={onClick}
    style={{
      backgroundColor: UI.card,
      borderRadius: SQUARE_RADIUS,
      boxShadow: onClick ? '0 4px 6px rgba(0,0,0,0.05)' : '0 1px 3px rgba(0,0,0,0.02)',
      border: `1px solid ${UI.border}`,
      borderTop: `4px solid ${accentColor}`,
      overflow: 'visible',
      cursor: onClick ? 'pointer' : 'default',
      transition: 'box-shadow 150ms ease, transform 150ms ease',
      ...style,
    }}
  >
    {children}
  </div>
);

const SectionHeader = ({ icon: Icon, title, right }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 16, borderBottom: `1px solid ${UI.border}`, marginBottom: 20 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ padding: '6px', background: rgba(UI.primary, 0.04), borderRadius: SQUARE_RADIUS, color: UI.primary }}>
        <Icon size={18} strokeWidth={2} />
      </div>
      <div style={{ fontFamily: THEME.serifFont, fontSize: 18, fontWeight: 600, color: UI.primary }}>{title}</div>
    </div>
    {right}
  </div>
);

const Label = ({ children, style }) => (
  <div style={{ fontSize: 11, fontWeight: 600, color: UI.muted, textTransform: 'uppercase', letterSpacing: 0.5, fontFamily: THEME.sansFont, ...style }}>
    {children}
  </div>
);

const Field = ({ as = 'input', style, onFocus, onBlur, children, ...props }) => {
  const Comp = as;
  const isTextarea = as === 'textarea';
  return (
    <Comp
      {...props}
      style={{
        width: '100%', padding: '10px 12px', borderRadius: SQUARE_RADIUS, border: `1px solid ${UI.border}`,
        fontSize: 13, fontWeight: 400, outline: 'none', boxSizing: 'border-box', fontFamily: THEME.sansFont,
        color: UI.text, backgroundColor: '#fff', transition: 'all 0.2s ease', lineHeight: isTextarea ? '1.5' : 'normal',
        ...(as === 'select' ? { cursor: 'pointer', height: '38px' } : null), ...style,
      }}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = UI.primary;
        e.currentTarget.style.boxShadow = `0 0 0 2px ${rgba(UI.primary, 0.05)}`;
        onFocus?.(e);
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = UI.border;
        e.currentTarget.style.boxShadow = 'none';
        onBlur?.(e);
      }}
    >
      {children}
    </Comp>
  );
};

const Button = ({ variant = 'primary', children, style, ...props }) => {
  const base = {
    borderRadius: SQUARE_RADIUS, fontFamily: THEME.sansFont, fontWeight: 500, cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '8px 16px',
    fontSize: 13, transition: 'all 100ms ease', userSelect: 'none', whiteSpace: 'nowrap', border: '1px solid transparent',
    height: '38px'
  };
  const variants = {
    primary: { background: '#fff', color: UI.primary, border: `1px solid ${UI.border}`, boxShadow: '0 1px 2px rgba(0,0,0,0.02)' },
    solid: { background: UI.primary, color: '#fff', border: `1px solid ${UI.primary}`, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' },
    ghost: { background: 'transparent', color: UI.muted, border: `1px solid transparent`, boxShadow: 'none' },
    danger: { background: '#fef2f2', color: UI.danger, border: '1px solid #fca5a5', boxShadow: 'none' },
  };
  const v = variants[variant] || variants.primary;

  return (
    <button
      {...props}
      style={{ ...base, ...v, ...style }}
      onMouseEnter={(e) => { if (variant === 'primary') e.currentTarget.style.background = '#f9fafb'; if (variant === 'solid') e.currentTarget.style.opacity = 0.9; }}
      onMouseLeave={(e) => { if (variant === 'primary') e.currentTarget.style.background = '#fff'; if (variant === 'solid') e.currentTarget.style.opacity = 1; }}
    >
      {children}
    </button>
  );
};

const ViewToggle = ({ active, icon: Icon, label, onClick }) => (
  <button
    onClick={onClick}
    style={{
      display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: SQUARE_RADIUS,
      border: `1px solid ${active ? UI.primary : 'transparent'}`,
      background: active ? UI.primary : 'transparent',
      color: active ? '#fff' : UI.muted,
      fontSize: 13, fontWeight: active ? 600 : 500, cursor: 'pointer', transition: 'all 0.15s ease',
      fontFamily: THEME.sansFont, userSelect: 'none', height: '36px'
    }}
  >
    {Icon && <Icon size={16} color={active ? '#fff' : UI.muted} />} {label}
  </button>
);

const ClassTab = ({ active, label, onClick }) => (
  <button
    onClick={onClick}
    style={{
      border: active ? `1px solid ${UI.primary}` : `1px solid ${UI.border}`,
      cursor: 'pointer', padding: '10px 20px', background: active ? UI.primary : '#fff',
      color: active ? '#fff' : UI.text, fontWeight: 600, borderRadius: SQUARE_RADIUS,
      transition: 'all 0.15s', fontFamily: THEME.sansFont, fontSize: 13,
    }}
  >
    {label}
  </button>
);

const SmallChip = ({ active, children, onClick, tone = 'default', title }) => {
  const tones = {
    default: { bg: '#fff', text: UI.primary, border: UI.border },
    present: { bg: statusConfig.P.bg, text: statusConfig.P.color, border: statusConfig.P.border },
    practice: { bg: statusConfig.W.bg, text: statusConfig.W.color, border: statusConfig.W.border },
    done: { bg: statusConfig.M.bg, text: statusConfig.M.color, border: statusConfig.M.border },
    aim: { bg: statusConfig.A.bg, text: statusConfig.A.color, border: statusConfig.A.border },
  };
  const t = tones[tone] || tones.default;
  
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        padding: '4px 10px', borderRadius: SQUARE_RADIUS, border: `1px solid ${active ? t.border : UI.border}`,
        background: active ? t.bg : '#fff', color: active ? t.text : UI.muted,
        fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: THEME.sansFont,
        transition: 'all 0.15s ease', whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  );
};

const StatusChips = ({ value, onSet, onRevert, compact = false }) => {
  const v = normStatus(value);
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', justifyContent: compact ? 'flex-end' : 'flex-start' }}>
      <SmallChip active={v === 'P'} tone="present" onClick={(e) => { e.stopPropagation(); onSet('P'); }} title="To Present">P</SmallChip>
      <SmallChip active={v === 'W'} tone="practice" onClick={(e) => { e.stopPropagation(); onSet('W'); }} title="Practicing">W</SmallChip>
      <SmallChip active={v === 'M'} tone="done" onClick={(e) => { e.stopPropagation(); onSet('M'); }} title="Mastered / Done">M</SmallChip>
      <SmallChip active={v === 'A'} tone="aim" onClick={(e) => { e.stopPropagation(); onSet('A'); }} title="Aim">A</SmallChip>

      {onRevert && (
        <button
          onClick={(e) => { e.stopPropagation(); onRevert(); }}
          style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#fca5a5', padding: '4px', marginLeft: 4, display: 'flex', alignItems: 'center' }}
          title="Return to Suggestions"
        >
          <Undo2 size={16} />
        </button>
      )}
    </div>
  );
};

const cycleActionStatus = (s) => {
  const map = { PENDING: 'IN_PROGRESS', IN_PROGRESS: 'DONE', DONE: 'PENDING' };
  return map[(s || 'PENDING').toUpperCase()] || 'PENDING';
};

const ActionStatusPill = ({ status, onClick, style }) => {
  const s = (status || 'PENDING').toUpperCase();
  const cfg = s === 'DONE' ? { bg: '#F0FDF4', text: '#166534', border: '#BBF7D0', label: 'Done' }
    : s === 'IN_PROGRESS' ? { bg: '#FFFBEB', text: '#92400E', border: '#FDE68A', label: 'In progress' }
    : { bg: '#F3F4F6', text: '#4B5563', border: '#D1D5DB', label: 'Pending' };

  return (
    <button
      onClick={onClick}
      style={{ border: `1px solid ${cfg.border}`, background: cfg.bg, color: cfg.text, borderRadius: SQUARE_RADIUS, padding: '4px 10px', fontWeight: 600, fontSize: 11, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 95, justifyContent: 'center', transition: 'all 0.2s', ...style }}
    >
      <CheckCircle2 size={14} strokeWidth={2.5} /> {cfg.label}
    </button>
  );
};


/** ---------------------------
 * CLEAN PLAN CARD
 * --------------------------- */
const PlanCard = ({ item, onEdit, onStatus, onRevert }) => {
  const norm = getNormalizedItem(item);
  
  // Prioritize raw_activity (specific teacher notes) over official activity (category)
  const specificName = clean(item.raw_activity) || clean(norm.rawActivity);
  const categoryName = clean(item.activity) || clean(norm.title);
  
  const title = specificName || categoryName || 'Untitled Activity';
  const subtitle = specificName && categoryName && specificName.toLowerCase() !== categoryName.toLowerCase() ? categoryName : null;

  const areaName = norm.area || item.area || 'General';
  const subjStyle = getSubjectStyle(areaName);

  return (
    <div
      onClick={() => onEdit?.(item)}
      style={{
        background: '#fff', borderRadius: SQUARE_RADIUS, border: `1px solid ${UI.border}`, borderLeft: `4px solid ${subjStyle.accent || UI.primary}`,
        padding: '16px', display: 'flex', flexDirection: 'column', gap: 12, cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.02)', transition: 'all 0.2s ease',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.05)')}
      onMouseLeave={(e) => (e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.02)')}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0, width: '100%' }}>
          {subtitle && (
            <div style={{ fontSize: 10, color: UI.muted, fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {subtitle}
            </div>
          )}
          <div style={{ fontSize: 13, fontWeight: 500, color: UI.text, lineHeight: 1.4, wordBreak: 'break-word' }}>
            {title}
          </div>
          {item.notes && (
            <div style={{ marginTop: 10, fontSize: 12, color: UI.muted, fontWeight: 400, lineHeight: 1.4, background: '#f8fafc', padding: '8px 10px', borderRadius: SQUARE_RADIUS, border: `1px solid ${UI.border}` }}>
              {String(item.notes).slice(0, 100)}{String(item.notes).length > 100 ? '…' : ''}
            </div>
          )}
        </div>
      </div>

      <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 4, borderTop: `1px solid ${UI.border}`, paddingTop: 12 }}>
        <div style={{ fontSize: 11, color: UI.muted, fontWeight: 500 }}>
          {iso10(item.planning_date) ? safeDate(iso10(item.planning_date)) : '—'}
        </div>
        <StatusChips value={item.status} onSet={onStatus} onRevert={onRevert} compact />
      </div>
    </div>
  );
};

/** ---------------------------
 * SCOPE CARD (UNPLANNED/SUGGESTIONS ONLY)
 * --------------------------- */
const ScopeCard = ({ session, onCreateOrUpdate }) => {
  const areaName = session?.curriculum_areas?.name || session.area || 'General';
  const subjStyle = getSubjectStyle(areaName);

  // Prioritize raw_activity (specific teacher notes) over official activity (category)
  const specificName = clean(session?.raw_activity) || clean(session?.session_label) || clean(session?.teacher_notes);
  const categoryName = clean(session?.curriculum_activities?.name) || clean(session?.activity);
  
  const title = specificName || categoryName || 'Untitled Activity';
  const subtitle = specificName && categoryName && specificName.toLowerCase() !== categoryName.toLowerCase() ? categoryName : null;

  return (
    <div
      style={{
        background: session.is_this_week ? '#FFFCF8' : '#fff', borderRadius: SQUARE_RADIUS,
        border: `1px solid ${session.is_this_week ? rgba(UI.accentYellow, 0.6) : UI.border}`, borderLeft: `4px solid ${subjStyle.accent || UI.primary}`,
        padding: '16px', display: 'flex', flexDirection: 'column', gap: 12, boxShadow: '0 1px 2px rgba(0,0,0,0.02)', transition: 'all 0.2s ease',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0, width: '100%' }}>
          {session.is_this_week && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: rgba(UI.accentYellow, 0.15), color: '#9A6D1F', border: `1px solid ${rgba(UI.accentYellow, 0.4)}`, padding: '4px 8px', borderRadius: SQUARE_RADIUS, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', marginBottom: 10 }}>
              <Star size={12} fill={UI.accentYellow} color={UI.accentYellow} /> Suggested This Week
            </div>
          )}
          {subtitle && (
            <div style={{ fontSize: 10, color: UI.muted, fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {subtitle}
            </div>
          )}
          <div style={{ fontSize: 13, fontWeight: 500, color: UI.text, lineHeight: 1.4, wordBreak: 'break-word' }}>
            {title}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginTop: 4, borderTop: `1px solid ${session.is_this_week ? rgba(UI.accentYellow, 0.3) : UI.border}`, paddingTop: 12 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <SmallChip tone="present" onClick={() => onCreateOrUpdate('P')} title="Add as To Present">P</SmallChip>
          <SmallChip tone="practice" onClick={() => onCreateOrUpdate('W')} title="Add as Practicing">W</SmallChip>
          <SmallChip tone="done" onClick={() => onCreateOrUpdate('M')} title="Add as Done">M</SmallChip>
          <SmallChip tone="aim" onClick={() => onCreateOrUpdate('A')} title="Add as Aim">A</SmallChip>
        </div>
      </div>
    </div>
  );
};

/** ---------------------------
 * ADD & EDIT MODALS
 * --------------------------- */
function AddActivityModal({ open, onClose, onSubmit, classrooms = [], students = [], curriculum = [], curriculumAreas = [], curriculumCategories = [], defaults = {}, showToast }) {
  const [classroomId, setClassroomId] = useState(defaults.classroom_id ?? classrooms?.[0]?.id ?? '');
  const [status, setStatus] = useState(defaults.status ?? 'P');
  const [date, setDate] = useState(defaults.date ?? '');
  const [areaId, setAreaId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [activityId, setActivityId] = useState('');
  const [customActivityName, setCustomActivityName] = useState('');
  const [subActivity, setSubActivity] = useState(defaults.raw_activity ?? '');
  const [teacherNote, setTeacherNote] = useState(defaults.teacher_note ?? defaults.notes ?? '');
  const [studentSearch, setStudentSearch] = useState('');
  const [selected, setSelected] = useState(() => new Set());

  useEffect(() => {
    if (!open) return;
    setClassroomId(defaults.classroom_id ?? classrooms?.[0]?.id ?? '');
    setStatus(defaults.status ?? 'P');
    setDate(defaults.date ?? '');
    setAreaId('');
    setCategoryId('');
    setActivityId('');
    setCustomActivityName('');
    setSubActivity(defaults.raw_activity ?? '');
    setTeacherNote(defaults.teacher_note ?? defaults.notes ?? '');
    setStudentSearch('');
    const s = new Set();
    if (defaults.preSelectedStudentId) s.add(String(defaults.preSelectedStudentId));
    setSelected(s);
  }, [open, defaults, classrooms]);

  const activeAreas = useMemo(() => curriculumAreas.slice().sort((a, b) => a.name.localeCompare(b.name)), [curriculumAreas]);
  const activeCategories = useMemo(() => {
    if (!areaId) return [];
    return curriculumCategories.filter((c) => String(c.area_id) === String(areaId)).sort((a, b) => a.name.localeCompare(b.name));
  }, [areaId, curriculumCategories]);
  const activeActivities = useMemo(() => {
    if (!categoryId) return [];
    return curriculum
      .filter((a) => String(a.curriculum_category_id || a.category_id) === String(categoryId))
      .map((a) => ({ id: a.id, name: a.name || a.activity }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [categoryId, curriculum]);

  const filteredStudents = useMemo(() => {
    const q = clean(studentSearch).toLowerCase();
    const classFiltered = (students || []).filter((s) => String(s.classroom_id) === String(classroomId));
    if (!q) return classFiltered;
    return classFiltered.filter((s) => `${s.first_name || ''} ${s.last_name || ''}`.trim().toLowerCase().includes(q));
  }, [students, studentSearch, classroomId]);

  const toggleStudent = (id) => setSelected((prev) => {
    const n = new Set(prev);
    const k = String(id);
    n.has(k) ? n.delete(k) : n.add(k);
    return n;
  });
  const selectAll = () => setSelected(new Set((filteredStudents || []).map((s) => String(s.id))));
  const clearAll = () => setSelected(new Set());

  const doSubmit = async () => {
    if (!classroomId) return showToast?.('Please choose a classroom', 'error');
    if (!activityId && !customActivityName) return showToast?.('Please choose or type an activity', 'error');
    if (selected.size === 0) return showToast?.('Please select at least one student', 'error');

    try {
      const actObj = activeActivities.find((a) => String(a.id) === String(activityId));
      const catObj = activeCategories.find((c) => String(c.id) === String(categoryId));
      const areaObj = activeAreas.find((a) => String(a.id) === String(areaId));
      const finalName = actObj ? actObj.name : customActivityName;
      const entryType = actObj ? 'curriculum' : 'mixed';

      await Promise.all(
        Array.from(selected).map((student_id) => onSubmit?.({
          student_id,
          status,
          date: date || defaults.activeDateISO || dateISO(new Date()),
          activity: finalName,
          notes: clean(teacherNote),
          raw_activity: clean(subActivity),
          area: areaObj?.name || 'General',
          category: catObj?.name || null,
          curriculum_activity_id: parseId(actObj?.id),
          curriculum_category_id: parseId(catObj?.id),
          curriculum_area_id: parseId(areaObj?.id),
          entry_type: entryType,
        }))
      );

      showToast?.({ type: 'success', title: 'Added', message: `Added “${finalName}” for ${selected.size} student(s).` });
      onClose?.();
    } catch (e) {
      showToast?.({ type: 'error', title: 'Error', message: e?.message || 'Failed to add.' });
    }
  };

  if (!open) return null;

  return (
    <Modal title="Add Activity" onClose={onClose} width={880}>
      <div style={{ display: 'grid', gap: 18, maxHeight: '80vh', overflowY: 'auto', padding: '4px 8px 16px 4px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
          <div><Label>Classroom</Label><Field as="select" value={classroomId} onChange={(e) => setClassroomId(e.target.value)}>{classrooms.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}</Field></div>
          <div><Label>Status</Label><Field as="select" value={status} onChange={(e) => setStatus(e.target.value)}>{Object.keys(statusConfig).map((k) => (<option key={k} value={k}>{statusConfig[k].label}</option>))}</Field></div>
          <div><Label>Date (optional)</Label><Field type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.5fr', gap: 14 }}>
          <div><Label>Area</Label><Field as="select" value={areaId} onChange={(e) => { setAreaId(e.target.value); setCategoryId(''); setActivityId(''); }}><option value="">Select Area...</option>{activeAreas.map((o) => (<option key={o.id} value={o.id}>{o.name}</option>))}</Field></div>
          <div><Label>Category</Label><Field as="select" value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setActivityId(''); }} disabled={!areaId}><option value="">{areaId ? 'Select Category...' : 'Select Area First'}</option>{activeCategories.map((o) => (<option key={o.id} value={o.id}>{o.name}</option>))}</Field></div>
          <div><Label>Activity</Label><Field as="select" value={activityId} onChange={(e) => setActivityId(e.target.value)} disabled={!categoryId}><option value="">{categoryId ? 'Select Activity...' : 'Select Category First'}</option>{activeActivities.map((o) => (<option key={o.id} value={o.id}>{o.name}</option>))} <option value="CUSTOM">+ Custom (Type below)</option></Field></div>
        </div>

        {activityId === 'CUSTOM' && <div><Label>Custom Activity Name</Label><Field value={customActivityName} onChange={(e) => setCustomActivityName(e.target.value)} placeholder="Type new activity name..." autoFocus /></div>}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <Label>Sub-activity (Teacher Bullet)</Label>
            <textarea value={subActivity} onChange={(e) => setSubActivity(e.target.value)} placeholder="Ex: • c,a,n,r,m,t memory game"
              style={{ width: '100%', minHeight: 86, padding: '10px 14px', borderRadius: SQUARE_RADIUS, border: `1px solid ${UI.border}`, resize: 'vertical', fontFamily: THEME.sansFont, fontSize: 13, outline: 'none', background: '#fff', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <Label>Teacher Notes</Label>
            <textarea value={teacherNote} onChange={(e) => setTeacherNote(e.target.value)} placeholder="Review notes or specific instructions..."
              style={{ width: '100%', minHeight: 86, padding: '10px 14px', borderRadius: SQUARE_RADIUS, border: `1px solid ${UI.border}`, resize: 'vertical', fontFamily: THEME.sansFont, fontSize: 13, outline: 'none', background: '#fff', boxSizing: 'border-box' }}
            />
          </div>
        </div>

        <div style={{ border: `1px solid ${UI.border}`, borderRadius: SQUARE_RADIUS, overflow: 'hidden', background: '#fff' }}>
          <div style={{ padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${UI.border}`, background: '#f8fafc' }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: UI.primary }}>Students ({selected.size})</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={selectAll} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: UI.primary, fontWeight: 500, fontSize: 12 }}>Select all</button>
              <button onClick={clearAll} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: UI.muted, fontWeight: 500, fontSize: 12 }}>Clear</button>
            </div>
          </div>

          <div style={{ padding: 16, display: 'grid', gap: 12 }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: UI.muted }} />
              <Field value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)} placeholder="Search student..." style={{ paddingLeft: 34 }} />
            </div>

            <div style={{ maxHeight: 220, overflowY: 'auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {filteredStudents.map((s) => {
                const isSelected = selected.has(String(s.id));
                return (
                  <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', cursor: 'pointer', background: isSelected ? rgba(UI.primary, 0.05) : '#fff', border: `1px solid ${isSelected ? UI.primary : UI.border}`, borderRadius: SQUARE_RADIUS, transition: 'all 0.15s' }}>
                    <input type="checkbox" checked={isSelected} onChange={() => toggleStudent(s.id)} style={{ accentColor: UI.primary }} />
                    <div style={{ fontWeight: 500, fontSize: 13, color: isSelected ? UI.primary : UI.text }}>{s.first_name} {s.last_name}</div>
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="solid" onClick={doSubmit}><Plus size={14} /> Add Activity</Button>
        </div>
      </div>
    </Modal>
  );
}

function EditActivityModal({ item, curriculum = [], curriculumAreas = [], curriculumCategories = [], onSave, onDelete, onClose }) {
  const [status, setStatus] = useState('P');
  const [planningDate, setPlanningDate] = useState('');
  const [areaId, setAreaId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [activityId, setActivityId] = useState('');
  const [customActivityName, setCustomActivityName] = useState('');
  const [rawActivity, setRawActivity] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!item) return;
    setStatus(item.status || 'P');
    setPlanningDate(iso10(item.planning_date || item.date || ''));
    setRawActivity(clean(item?.raw_activity));
    setNotes(clean(item?.notes));

    const itemAreaId = item?.curriculum_area_id || '';
    const itemCatId = item?.curriculum_category_id || '';
    const itemActId = item?.curriculum_activity_id || '';

    setAreaId(String(itemAreaId));
    setCategoryId(String(itemCatId));
    if (itemActId) {
      setActivityId(String(itemActId));
    } else {
      setActivityId('CUSTOM');
      setCustomActivityName(item.activity || item.title || '');
    }
  }, [item]);

  const activeAreas = useMemo(() => curriculumAreas.slice().sort((a, b) => a.name.localeCompare(b.name)), [curriculumAreas]);
  const activeCategories = useMemo(() => { if (!areaId) return []; return curriculumCategories.filter((c) => String(c.area_id) === String(areaId)).sort((a, b) => a.name.localeCompare(b.name)); }, [areaId, curriculumCategories]);
  const activeActivities = useMemo(() => { if (!categoryId) return []; return curriculum.filter((a) => String(a.curriculum_category_id || a.category_id) === String(categoryId)).map((a) => ({ id: a.id, name: a.name || a.activity })).sort((a, b) => a.name.localeCompare(b.name)); }, [categoryId, curriculum]);

  const handleSave = async () => {
    if (!item) return;
    const pd = planningDate ? planningDate : null;
    const actObj = activeActivities.find((a) => String(a.id) === String(activityId));
    const catObj = activeCategories.find((c) => String(c.id) === String(categoryId));
    const areaObj = activeAreas.find((a) => String(a.id) === String(areaId));
    const finalName = actObj ? actObj.name : customActivityName;

    const entryType = actObj ? 'curriculum' : 'mixed';

    const updatePayload = {
      ...item,
      status,
      planning_date: pd,
      activity: finalName || null,
      raw_activity: clean(rawActivity) || null,
      notes: clean(notes) || null,
      category: catObj?.name || null,
      curriculum_activity_id: parseId(actObj?.id),
      curriculum_area_id: parseId(areaObj?.id),
      curriculum_category_id: parseId(catObj?.id),
      entry_type: entryType,
    };

    if (pd) {
      updatePayload.year = Number(pd.slice(0, 4));
      updatePayload.month = Number(pd.slice(5, 7));
      updatePayload.day = Number(pd.slice(8, 10));
    }
    await onSave?.(updatePayload);
    onClose?.();
  };

  if (!item) return null;

  return (
    <Modal title="Edit Activity" onClose={onClose} width={820}>
      <div style={{ display: 'grid', gap: 14, padding: '4px 8px 16px 4px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div><Label>Status</Label><Field as="select" value={status} onChange={(e) => setStatus(e.target.value)}>{Object.keys(statusConfig).map((k) => (<option key={k} value={k}>{statusConfig[k].label}</option>))}</Field></div>
          <div><Label>Date (optional)</Label><Field type="date" value={planningDate} onChange={(e) => setPlanningDate(e.target.value)} /></div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.5fr', gap: 14 }}>
          <div><Label>Area</Label><Field as="select" value={areaId} onChange={(e) => { setAreaId(e.target.value); setCategoryId(''); setActivityId(''); }}><option value="">Select Area...</option>{activeAreas.map((o) => (<option key={o.id} value={o.id}>{o.name}</option>))}</Field></div>
          <div><Label>Category</Label><Field as="select" value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setActivityId(''); }} disabled={!areaId}><option value="">{areaId ? 'Select Category...' : 'Select Area First'}</option>{activeCategories.map((o) => (<option key={o.id} value={o.id}>{o.name}</option>))}</Field></div>
          <div><Label>Activity</Label><Field as="select" value={activityId} onChange={(e) => setActivityId(e.target.value)} disabled={!categoryId}><option value="">{categoryId ? 'Select Activity...' : 'Select Category First'}</option>{activeActivities.map((o) => (<option key={o.id} value={o.id}>{o.name}</option>))} <option value="CUSTOM">+ Custom (Type below)</option></Field></div>
        </div>

        {activityId === 'CUSTOM' && <div><Label>Custom Activity Name</Label><Field value={customActivityName} onChange={(e) => setCustomActivityName(e.target.value)} placeholder="Type new activity name..." autoFocus /></div>}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <Label>Sub-activity</Label>
            <textarea value={rawActivity} onChange={(e) => setRawActivity(e.target.value)} rows={4}
              style={{ width: '100%', minHeight: 90, padding: '10px 14px', borderRadius: SQUARE_RADIUS, border: `1px solid ${UI.border}`, resize: 'vertical', fontFamily: THEME.sansFont, fontSize: 13, outline: 'none', background: '#fff', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <Label>Teacher Notes</Label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4}
              style={{ width: '100%', minHeight: 90, padding: '10px 14px', borderRadius: SQUARE_RADIUS, border: `1px solid ${UI.border}`, resize: 'vertical', fontFamily: THEME.sansFont, fontSize: 13, outline: 'none', background: '#fff', boxSizing: 'border-box' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
          <Button variant="danger" onClick={() => onDelete?.(item.id)} title="Delete"><Trash2 size={14} /> Delete</Button>
          <div style={{ display: 'flex', gap: 10 }}>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button variant="solid" onClick={handleSave}><CheckCircle size={14} /> Save Changes</Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

/** ---------------------------
 * FULL ASSESSMENT PANEL
 * --------------------------- */
const isSpecialToken = (v) => {
  const s = String(v ?? '').trim().toLowerCase();
  return s === 'x' || s === 'na' || s === 'n/a' || s === 'absent';
};
const normalizeScore = (raw) => {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (isSpecialToken(s)) return null;
  const cleanVal = s.replace(/%/g, '').trim();
  const num = parseFloat(cleanVal);
  return Number.isFinite(num) ? num : null;
};
const formatScoreDisplay = (raw) => {
  if (raw === null || raw === undefined) return '-';
  const s = String(raw).trim();
  if (!s) return '-';
  if (isSpecialToken(s) || s.toUpperCase() === 'X') return 'X';
  const n = normalizeScore(raw);
  if (n === null) return '-';
  const shown = Number.isInteger(n) ? n : Math.round(n);
  return String(shown);
};
const getScoreStyle = (rawVal) => {
  const s = String(rawVal ?? '').trim();
  if (s && (isSpecialToken(s) || s.toUpperCase() === 'X')) return { color: UI.muted, fontWeight: 500, fontStyle: 'italic' };
  const val = normalizeScore(rawVal);
  if (val === null) return { color: UI.muted };
  if (val >= 80) return { color: '#2E7D32', fontWeight: 600 };
  if (val >= 50) return { color: '#F57F17', fontWeight: 600 };
  return { color: '#D32F2F', fontWeight: 600 };
};
const ScoreCell = ({ scoreRec }) => {
  const raw = scoreRec?.score_raw;
  const hasValue = raw !== null && raw !== undefined && String(raw).trim() !== '';
  const scoreStyle = getScoreStyle(raw);
  const comment = scoreRec?.comment ? scoreRec.comment : '';

  return (
    <div style={{ padding: '12px 8px', height: '100%', minHeight: 64, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: hasValue ? 'flex-start' : 'center', background: '#fff', borderRight: `1px solid ${UI.border}` }}>
      {hasValue ? (
        <>
          <div style={{ fontSize: 16, marginBottom: 2, ...scoreStyle }}>{formatScoreDisplay(raw)}</div>
          {comment && (
            <div style={{ background: '#FFF9C4', border: `1px solid #FBC02D`, color: '#333', fontSize: 11, lineHeight: 1.3, padding: '4px 8px', marginTop: 4, width: 'fit-content', maxWidth: 140, minWidth: 40, borderRadius: SQUARE_RADIUS, textAlign: 'center' }}>
              {comment}
            </div>
          )}
        </>
      ) : (
        <div style={{ color: UI.border, fontSize: 20 }}>-</div>
      )}
    </div>
  );
};

const InsightsPanel = ({ areas }) => {
  const analyzed = useMemo(() => {
    const mastered = [];
    const progressing = [];
    let lowestSkill = null;
    let lowestScore = 101;

    areas.forEach((area) => {
      if (area.overallAverage !== null) {
        if (area.overallAverage >= 80) mastered.push(area.name);
        else if (area.overallAverage < 80) progressing.push(area.name);
      }
      area.groups.forEach((grp) => {
        if (grp.rowAverage !== null && grp.rowAverage < 60 && grp.rowAverage < lowestScore) {
          lowestScore = grp.rowAverage;
          lowestSkill = grp.name;
        }
      });
    });

    return { mastered, progressing, lowestSkill };
  }, [areas]);

  if (!analyzed.mastered.length && !analyzed.progressing.length) return null;

  return (
    <div style={{ marginBottom: 24, padding: 20, background: '#fff', borderRadius: SQUARE_RADIUS, border: `1px solid ${UI.border}`, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 20 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#2E7D32', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}><CheckCircle size={14} /> Mastery Observed</div>
        <div style={{ fontSize: 13, color: UI.text }}>{analyzed.mastered.length > 0 ? analyzed.mastered.join(', ') : 'Working towards mastery.'}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#F57F17', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}><Clock size={14} /> Currently Practicing</div>
        <div style={{ fontSize: 13, color: UI.text }}>{analyzed.progressing.length > 0 ? analyzed.progressing.join(', ') : 'Consistent performance.'}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderLeft: `1px solid ${UI.border}`, paddingLeft: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: UI.primary, fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}><Star size={14} /> Recommended Focus</div>
        <div style={{ fontSize: 13, color: UI.text }}>{analyzed.lowestSkill ? <>Consider re-presenting: <strong>{analyzed.lowestSkill}</strong>.</> : 'Continue progression.'}</div>
      </div>
    </div>
  );
};

function AssessmentPanel({ profile, student, classroomId, showToast }) {
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [assessmentMap, setAssessmentMap] = useState({});
  const [skills, setSkills] = useState([]);
  const [domains, setDomains] = useState([]);
  const [areas, setAreas] = useState([]);
  const [allScores, setAllScores] = useState([]);
  const [filterArea, setFilterArea] = useState('ALL');
  const [filterTemplate, setFilterTemplate] = useState('ALL');
  const [expandedAreas, setExpandedAreas] = useState({});

  const refresh = async () => {
    if (!student?.id) return;
    setLoading(true);
    try {
      const { data: tmplData } = await supabase.from('assessment_templates').select('*').order('default_date', { ascending: true });
      const relevantTemplates = (tmplData || []).filter((t) => (t.classroom_ids || []).map(String).includes(String(classroomId || student.classroom_id)));
      setTemplates(relevantTemplates);

      const { data: assessData } = await supabase.from('student_assessments').select('*').eq('student_id', student.id);
      const aMap = {};
      (assessData || []).forEach((a) => { if (a.template_id) aMap[a.template_id] = a; });
      setAssessmentMap(aMap);

      const { data: domainData } = await supabase.from('assessment_domains').select('*');
      setDomains(domainData || []);

      const { data: skillData } = await supabase.from('assessment_skills').select('id, name, area_id, domain_id, sort_order').order('sort_order');
      setSkills(skillData || []);

      const { data: areaData } = await supabase.from('curriculum_areas').select('id, name').order('name');
      setAreas(areaData || []);

      if (assessData?.length > 0) {
        const ids = assessData.map((a) => a.id);
        const { data: scoreData } = await supabase.from('student_assessment_scores').select('id, assessment_id, skill_id, score_raw, comment, created_at, classroom_id').in('assessment_id', ids);
        setAllScores(scoreData || []);
      } else {
        setAllScores([]);
      }
    } catch (e) {
      console.error(e);
      showToast?.({ type: 'error', message: 'Failed to load data.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, [student?.id, classroomId]);

  const scoreIndex = useMemo(() => {
    const m = new Map();
    const newer = (a, b) => {
      const ta = a?.created_at ? new Date(a.created_at).getTime() : 0;
      const tb = b?.created_at ? new Date(b.created_at).getTime() : 0;
      return ta !== tb ? ta > tb : Number(a?.id || 0) > Number(b?.id || 0);
    };
    for (const s of allScores || []) {
      const key = `${String(s.assessment_id)}|${String(s.skill_id)}`;
      const cur = m.get(key);
      if (!cur || newer(s, cur)) m.set(key, s);
    }
    return m;
  }, [allScores]);

  const skillTemplateMap = useMemo(() => {
    const map = {};
    const domById = new Map((domains || []).map((d) => [String(d.id), d]));
    (skills || []).forEach((s) => {
      const dom = domById.get(String(s.domain_id));
      if (dom) map[s.id] = dom.template_id;
    });
    return map;
  }, [skills, domains]);

  const visibleTemplates = useMemo(() => {
    if (filterTemplate === 'ALL') return templates;
    return templates.filter((t) => String(t.id) === String(filterTemplate));
  }, [templates, filterTemplate]);

  const processedData = useMemo(() => {
    if (!visibleTemplates.length || !skills.length) return { areas: [] };

    const areaById = new Map((areas || []).map((a) => [String(a.id), a]));
    const getAreaName = (id) => areaById.get(String(id))?.name || 'General';
    const visibleTemplateIds = new Set(visibleTemplates.map((t) => String(t.id)));
    const bucket = new Map();

    const ensureArea = (areaId) => {
      const key = String(areaId);
      if (!bucket.has(key)) bucket.set(key, { id: key, name: getAreaName(key), groupsMap: new Map() });
      return bucket.get(key);
    };

    for (const sk of skills) {
      const tId = String(skillTemplateMap[sk.id] ?? '');
      if (!tId || !visibleTemplateIds.has(tId)) continue;

      const areaId = sk.area_id ? String(sk.area_id) : 'uncategorized';
      const areaObj = ensureArea(areaId);
      const gKey = `${areaId}::${normKey(sk.name)}`;

      if (!areaObj.groupsMap.has(gKey)) {
        areaObj.groupsMap.set(gKey, {
          key: gKey,
          name: String(sk.name || '').trim() || 'Untitled Skill',
          areaId,
          sortOrder: Number.isFinite(sk.sort_order) ? sk.sort_order : 999999,
          skillIdsByTemplate: {},
          cells: {},
          rowAverage: null,
          delta: null,
        });
      }

      const grp = areaObj.groupsMap.get(gKey);
      grp.sortOrder = Math.min(grp.sortOrder, Number.isFinite(sk.sort_order) ? sk.sort_order : 999999);
      if (!grp.skillIdsByTemplate[tId]) grp.skillIdsByTemplate[tId] = [];
      grp.skillIdsByTemplate[tId].push(String(sk.id));
    }

    const pickBestRecord = (assessmentId, skillIds, scoreIndex) => {
      if (!assessmentId || !skillIds?.length) return null;
      let best = null;

      const rankOf = (rec) => {
        if (!rec) return 0;
        const raw = rec.score_raw;
        const s = String(raw ?? '').trim();
        if (normalizeScore(raw) !== null) return 4;
        if (s && (s.toUpperCase() === 'X' || isSpecialToken(s))) return 3;
        if (rec.comment) return 2;
        return 1;
      };

      const newer = (a, b) => {
        const ta = a?.created_at ? new Date(a.created_at).getTime() : 0;
        const tb = b?.created_at ? new Date(b.created_at).getTime() : 0;
        return ta !== tb ? ta > tb : Number(a?.id || 0) > Number(b?.id || 0);
      };

      for (const sid of skillIds) {
        const rec = scoreIndex.get(`${String(assessmentId)}|${String(sid)}`);
        if (!rec) continue;
        const r = rankOf(rec);
        if (!best || r > best.rank || (r === best.rank && newer(rec, best.rec))) best = { rec, rank: r };
      }

      return best?.rec || null;
    };

    let areaList = Array.from(bucket.values())
      .map((a) => {
        const groups = Array.from(a.groupsMap.values())
          .filter((grp) => {
            let hasData = false;
            visibleTemplates.forEach((tmpl) => {
              const tId = String(tmpl.id);
              const ass = assessmentMap[tmpl.id];
              const bestRec = ass ? pickBestRecord(ass.id, grp.skillIdsByTemplate[tId] || [], scoreIndex) : null;
              if (bestRec && (bestRec.score_raw || bestRec.comment)) hasData = true;
            });
            return hasData;
          })
          .sort((x, y) => x.sortOrder - y.sortOrder);
        return { id: a.id, name: a.name, groups };
      })
      .filter((a) => a.groups.length > 0);

    if (filterArea !== 'ALL') areaList = areaList.filter((a) => String(a.id) === String(filterArea));

    for (const area of areaList) {
      for (const grp of area.groups) {
        let sum = 0; let cnt = 0;
        visibleTemplates.forEach((tmpl) => {
          const tId = String(tmpl.id);
          const ass = assessmentMap[tmpl.id];
          const bestRec = ass ? pickBestRecord(ass.id, grp.skillIdsByTemplate[tId] || [], scoreIndex) : null;
          const numVal = bestRec ? normalizeScore(bestRec.score_raw) : null;
          if (numVal !== null) { sum += numVal; cnt += 1; }
          grp.cells[tId] = { templateId: tId, assessmentId: ass?.id || null, record: bestRec, numVal };
        });
        grp.rowAverage = cnt > 0 ? Math.round(sum / cnt) : null;
        if (visibleTemplates.length >= 2) {
          const a0 = grp.cells[String(visibleTemplates[0].id)]?.numVal ?? null;
          const b0 = grp.cells[String(visibleTemplates[visibleTemplates.length - 1].id)]?.numVal ?? null;
          grp.delta = a0 !== null && b0 !== null ? Math.round(b0 - a0) : null;
        } else grp.delta = null;
      }

      area.averages = {};
      area.overallAverage = null;
      let areaAvgSum = 0;
      let areaAvgCnt = 0;

      visibleTemplates.forEach((tmpl) => {
        const tId = String(tmpl.id);
        let ts = 0; let tc = 0;
        area.groups.forEach((grp) => {
          const v = grp.cells[tId]?.numVal ?? null;
          if (v !== null) { ts += v; tc += 1; }
        });
        if (tc > 0) {
          const avg = Math.round(ts / tc);
          area.averages[tId] = avg;
          areaAvgSum += avg;
          areaAvgCnt += 1;
        } else area.averages[tId] = null;
      });

      area.overallAverage = areaAvgCnt > 0 ? Math.round(areaAvgSum / areaAvgCnt) : null;
    }

    return { areas: areaList };
  }, [visibleTemplates, skills, areas, filterArea, skillTemplateMap, assessmentMap, scoreIndex]);

  const toggleArea = (areaId) => setExpandedAreas((prev) => ({ ...prev, [areaId]: !prev[areaId] }));

  return (
    <div style={{ fontFamily: THEME.sansFont, color: UI.text }}>
      <ThemedCard style={{ padding: '16px 20px', marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <h1 style={{ fontFamily: THEME.serifFont, fontSize: 20, margin: 0, color: UI.primary }}>Progress Report</h1>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <Field as="select" value={filterArea} onChange={(e) => setFilterArea(e.target.value)} style={{ width: 160, height: '38px', padding: '8px 12px' }}>
              <option value="ALL">All Areas</option>
              {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Field>
            <Field as="select" value={filterTemplate} onChange={(e) => setFilterTemplate(e.target.value)} style={{ width: 180, height: '38px', padding: '8px 12px' }}>
              <option value="ALL">All Assessments</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </Field>
          </div>
        </div>
      </ThemedCard>

      <InsightsPanel areas={processedData.areas} />

      <ThemedCard style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${UI.border}`, background: '#f8fafc' }}>
                <th style={{ textAlign: 'left', padding: '12px 20px', color: UI.muted, width: 250, textTransform: 'uppercase', fontSize: 10, letterSpacing: 0.5, fontWeight: 600 }}>Skill / Criteria</th>
                {visibleTemplates.map((tmpl) => (
                  <th key={tmpl.id} style={{ padding: 12, minWidth: 140, textAlign: 'center', borderLeft: `1px solid ${UI.border}` }}>
                    <div style={{ fontWeight: 600, color: UI.text, fontSize: 13 }}>{tmpl.title}</div>
                    <div style={{ fontSize: 10, fontWeight: 500, color: UI.muted, marginTop: 4 }}>{tmpl.default_date || 'No Date'}</div>
                  </th>
                ))}
                <th style={{ padding: 12, minWidth: 100, textAlign: 'center', background: '#fafafa', borderLeft: `1px solid ${UI.border}` }}>
                  <div style={{ fontWeight: 600, color: UI.text, fontSize: 10 }}>AVG</div>
                </th>
              </tr>
            </thead>
            <tbody>
              {processedData.areas.map((area) => {
                const isExpanded = !!expandedAreas[area.id];
                return (
                  <React.Fragment key={area.id}>
                    <tr onClick={() => toggleArea(area.id)} style={{ background: '#fcfcfc', cursor: 'pointer', borderBottom: `1px solid ${UI.border}` }}>
                      <td style={{ padding: '12px 20px', fontWeight: 600, color: UI.primary, fontSize: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                        {isExpanded ? <ChevronRight size={14} style={{ transform: 'rotate(90deg)' }} /> : <ChevronRight size={14} />} {String(area.name || 'GENERAL').toUpperCase()}
                      </td>
                      {visibleTemplates.map((tmpl) => (
                        <td key={tmpl.id} style={{ textAlign: 'center', fontSize: 13, borderLeft: `1px solid ${UI.border}` }}>
                          <div style={getScoreStyle(area.averages?.[String(tmpl.id)] ?? null)}>{formatScoreDisplay(area.averages?.[String(tmpl.id)] ?? null)}</div>
                        </td>
                      ))}
                      <td style={{ textAlign: 'center', fontWeight: 600, color: UI.text, background: '#fafafa', borderLeft: `1px solid ${UI.border}` }}>
                        {formatScoreDisplay(area.overallAverage)}
                      </td>
                    </tr>

                    {isExpanded && area.groups.map((grp) => (
                      <tr key={grp.key} style={{ borderBottom: `1px solid ${UI.border}` }}>
                        <td style={{ padding: '12px 20px', color: UI.muted, verticalAlign: 'middle', fontWeight: 500, paddingLeft: 46 }}>{grp.name}</td>
                        {visibleTemplates.map((tmpl) => (
                          <td key={`${tmpl.id}-${grp.key}`} style={{ padding: 0, verticalAlign: 'top', borderLeft: `1px solid ${UI.border}` }}>
                            <ScoreCell scoreRec={grp.cells[String(tmpl.id)]?.record || null} />
                          </td>
                        ))}
                        <td style={{ textAlign: 'center', background: '#fafafa', borderLeft: `1px solid ${UI.border}`, fontWeight: 600, padding: '0 10px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 64 }}>
                            <div style={{ ...getScoreStyle(grp.rowAverage), fontSize: 13 }}>{formatScoreDisplay(grp.rowAverage)}</div>
                            {grp.delta !== null && (
                              <div style={{ marginTop: 4, fontSize: 10, fontWeight: 600, color: grp.delta >= 0 ? '#2E7D32' : '#D32F2F' }}>
                                {grp.delta >= 0 ? `+${grp.delta}` : `${grp.delta}`}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                );
              })}

              {processedData.areas.length === 0 && (
                <tr>
                  <td colSpan={10} style={{ padding: 40, textAlign: 'center', color: UI.muted, fontSize: 13 }}>
                    {loading ? 'Loading...' : 'No data found for this filter.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </ThemedCard>
    </div>
  );
}

/** ---------------------------
 * STUDENT SELECT GRID
 * --------------------------- */
const HexAvatar = ({ letter, size = 66, fontSize = 22 }) => (
  <div
    style={{
      width: size,
      height: size,
      background: '#c8ddd7',
      clipPath: 'polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: UI.primary,
      fontWeight: 800,
      fontSize,
      margin: '0 auto',
    }}
  >
    {letter || '?'}
  </div>
);

const StudentTile = ({ student, onClick }) => (
  <div
    onClick={onClick}
    style={{
      background: '#fff',
      border: `1px solid ${UI.border}`,
      borderRadius: SQUARE_RADIUS,
      padding: 24,
      cursor: 'pointer',
      textAlign: 'center',
      transition: 'all 0.2s ease',
      boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.transform = 'translate(-1px, -1px)';
      e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.05)';
      e.currentTarget.style.borderColor = UI.primary;
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.transform = 'translate(0)';
      e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.02)';
      e.currentTarget.style.borderColor = UI.border;
    }}
  >
    <div style={{ marginBottom: 16 }}><HexAvatar letter={(student.first_name || '?')[0]} /></div>
    <div style={{ fontWeight: 600, fontSize: 16, color: UI.primary }}>
      {student.first_name} {student.last_name}
    </div>
  </div>
);

/** ---------------------------
 * MAIN COMPONENT
 * --------------------------- */
const IndividualPlanner = ({
  profile, forcedStudentId, students, planItems, masterPlans, planSessions,
  classrooms, activeDate, setActiveDate, onQuickAdd, onUpdateItem,
  onMoveItemToDate, onDeleteItem, curriculum, showToast, curriculumAreas, curriculumCategories,
}) => {
  const [selectedId, setSelectedId] = useState(forcedStudentId || null);
  const [filterClass, setFilterClass] = useState(classrooms?.[0]?.id);
  const [boardFilterArea, setBoardFilterArea] = useState('ALL');
  const [tab, setTab] = useState('MONTH');
  const [editingItem, setEditingItem] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [searchStudent, setSearchStudent] = useState('');
  const [localStudentPlans, setLocalStudentPlans] = useState([]);

  const todayISO = dateISO(new Date());

  useEffect(() => { if (!activeDate) setActiveDate(todayISO); }, [activeDate, setActiveDate, todayISO]);
  useEffect(() => { if (forcedStudentId) setSelectedId(forcedStudentId); }, [forcedStudentId]);

  const isParentLocked = !!forcedStudentId;
  const student = useMemo(() => (students || []).find((s) => String(s.id) === String(selectedId)), [students, selectedId]);
  const selectedClassroom = useMemo(() => (classrooms || []).find((c) => String(c.id) === String(student?.classroom_id)), [classrooms, student]);

  useEffect(() => {
    if (!selectedId) return;
    const fromProps = (planItems || []).filter((p) => String(p.student_id) === String(selectedId));
    setLocalStudentPlans(fromProps);
  }, [planItems, selectedId]);

  const activeDateObj = toDateObj(activeDate || todayISO);

  const optimisticUpdateItem = async (patch) => {
    const prev = localStudentPlans;
    setLocalStudentPlans((cur) => cur.map((x) => (String(x.id) === String(patch.id) ? { ...x, ...patch } : x)));
    try { 
      const { error } = await supabase.from('student_plan_items').update({
        status: patch.status,
        planning_date: patch.planning_date,
        year: patch.year, month: patch.month, day: patch.day,
        activity: patch.activity,
        raw_activity: patch.raw_activity,
        notes: patch.notes,
        entry_type: patch.entry_type
      }).eq('id', patch.id);
      if (error) throw error;
      
      await onUpdateItem?.(patch); 
    }
    catch (e) { setLocalStudentPlans(prev); showToast?.({ type: 'error', message: 'Update failed.' }); throw e; }
  };

  const optimisticMoveItemToDate = async (payload, isoDate) => {
    const it = localStudentPlans.find((p) => String(p.id) === String(payload?.id)); if (!it) return;
    const prev = localStudentPlans;
    const pd = iso10(isoDate);
    const patch = { ...it, planning_date: pd, year: pd ? Number(pd.slice(0, 4)) : it.year, month: pd ? Number(pd.slice(5, 7)) : it.month, day: pd ? Number(pd.slice(8, 10)) : it.day };
    setLocalStudentPlans((cur) => cur.map((x) => (String(x.id) === String(it.id) ? patch : x)));
    try { 
      await supabase.from('student_plan_items').update({
        planning_date: patch.planning_date, year: patch.year, month: patch.month, day: patch.day
      }).eq('id', patch.id);
      await onMoveItemToDate?.(payload, isoDate); 
    }
    catch (e) { setLocalStudentPlans(prev); showToast?.({ type: 'error', message: 'Move failed.' }); throw e; }
  };

  const optimisticCreateItem = async (payload) => {
    const tempId = `temp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const pd = iso10(payload.date || payload.planning_date || todayISO) || todayISO;
    const temp = {
      id: tempId,
      student_id: Number(payload.student_id),
      classroom_id: student?.classroom_id ?? null,
      teacher_id: profile?.id ?? null,
      area: payload.area || 'General',
      activity: payload.activity || null,
      raw_activity: payload.raw_activity || null,
      notes: payload.notes || null,
      status: payload.status || 'P',
      planning_date: pd,
      year: Number(pd.slice(0, 4)),
      month: Number(pd.slice(5, 7)),
      day: Number(pd.slice(8, 10)),
      created_at: new Date().toISOString(),
      entry_type: payload.entry_type || 'mixed',
      curriculum_area_id: payload.curriculum_area_id ?? null,
      curriculum_category_id: payload.curriculum_category_id ?? null,
      curriculum_activity_id: payload.curriculum_activity_id ?? null,
    };
    const prev = localStudentPlans;
    if (String(payload.student_id) === String(student?.id)) setLocalStudentPlans((cur) => [temp, ...cur]);
    try { await onQuickAdd?.(payload); }
    catch (e) { setLocalStudentPlans(prev); showToast?.({ type: 'error', message: 'Add failed.' }); throw e; }
  };

  const updateStatusWithDateRule = async (id, status, targetDateISO, extraPatch = {}) => {
    const it = localStudentPlans.find((p) => String(p.id) === String(id)); if (!it) return;
    const pd = iso10(targetDateISO) || iso10(it.planning_date) || todayISO;
    
    const norm = getNormalizedItem(it);
    const specificName = clean(it.raw_activity) || clean(norm.rawActivity);
    const categoryName = clean(it.activity) || clean(norm.title);
    const bestTitle = specificName || categoryName || 'Untitled Activity';

    await optimisticUpdateItem({ 
      ...it, 
      status, 
      planning_date: pd, 
      year: Number(pd.slice(0, 4)), 
      month: Number(pd.slice(5, 7)), 
      day: Number(pd.slice(8, 10)),
      activity: bestTitle,
      raw_activity: specificName, 
      ...extraPatch
    });
  };

  const createFromScopeSession = async (session, status, targetDateISO) => {
    const areaName = session?.curriculum_areas?.name || session.area || 'General';
    
    const raw = clean(session?.raw_activity) || clean(session?.session_label) || clean(session?.teacher_notes);
    const official = clean(session?.curriculum_activities?.name) || clean(session?.activity) || 'Activity';

    await optimisticCreateItem({
      student_id: student.id,
      status,
      date: targetDateISO,
      activity: official, 
      raw_activity: raw, 
      notes: session.teacher_notes || null,
      area: areaName,
      curriculum_activity_id: parseId(session.curriculum_activity_id),
      curriculum_area_id: parseId(session.curriculum_area_id),
      curriculum_category_id: parseId(session.curriculum_category_id),
      entry_type: session.curriculum_activity_id ? 'curriculum' : 'mixed',
    });
  };

  const archiveToUnplanned = async (planItem) => {
    if (!planItem?.id) return;
    if (!window.confirm('Return this activity to Suggestions?')) return;

    try {
      if (String(planItem.id).startsWith('temp-')) {
        setLocalStudentPlans(cur => cur.filter(x => x.id !== planItem.id));
        return;
      }

      // Soft archive avoids all Database Date constraint errors
      const patch = { entry_type: 'archived' };
      const { error } = await supabase.from('student_plan_items').update(patch).eq('id', planItem.id);
      if (error) throw error;
      
      const updatedItem = { ...planItem, entry_type: 'archived' };
      setLocalStudentPlans(cur => cur.map(x => String(x.id) === String(planItem.id) ? updatedItem : x));
      await onUpdateItem?.(updatedItem);
      
      showToast?.({ type: 'success', message: 'Returned to Suggestions.' });
    } catch (e) {
      console.error(e);
      showToast?.({ type: 'error', message: e.message || 'Failed to move back to unplanned.' });
    }
  };

  // --------------------------
  // STUDENT SELECTION SCREEN
  // --------------------------
  if (!selectedId) {
    const filteredStudents = (students || []).filter((s) => {
      const q = (searchStudent || '').trim().toLowerCase();
      if (q) return `${s.first_name || ''} ${s.last_name || ''}`.toLowerCase().includes(q);
      return String(s.classroom_id) === String(filterClass);
    });

    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: UI.bg, fontFamily: THEME.sansFont, overflow: 'hidden' }}>
        <style>{`
          .mb-card:hover { box-shadow: ${THEME.cardShadowHover} !important; transform: translate(-1px, -1px); }
          .mb-hide-scroll::-webkit-scrollbar { display: none; }
        `}</style>

        <div style={{ flexShrink: 0, padding: '24px 28px 16px' }}>
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            {(classrooms || []).map((c) => (
              <ClassTab key={c.id} active={String(filterClass) === String(c.id)} label={c.name} onClick={() => setFilterClass(c.id)} />
            ))}
          </div>

          <ThemedCard style={{ padding: '20px 24px', border: `1px solid ${UI.border}`, marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', flexWrap: 'wrap', gap: 20 }}>
              <div style={{ position: 'relative', width: '100%', maxWidth: 500 }}>
                <Search size={18} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: UI.muted }} />
                <Field 
                  value={searchStudent} 
                  onChange={(e) => setSearchStudent(e.target.value)} 
                  placeholder="Search for a student..." 
                  style={{ paddingLeft: 46, fontSize: 15, padding: '14px 16px 14px 46px', height: '48px' }} 
                />
              </div>
            </div>
          </ThemedCard>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 28px 40px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 24 }}>
            {filteredStudents.map((s) => (
              <StudentTile key={s.id} student={s} onClick={() => { setSelectedId(s.id); setSearchStudent(''); }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // --------------------------
  // SELECTED STUDENT VIEW
  // --------------------------
  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', height: 'calc(100vh - clamp(32px, 6vw, 100px))', fontFamily: THEME.sansFont, background: UI.bg, overflow: 'hidden' }}>
      <style>{`
        .mb-card:hover { box-shadow: ${THEME.cardShadowHover} !important; transform: translate(-1px, -1px); }
        .mb-hide-scroll::-webkit-scrollbar { display: none; }
      `}</style>

      <AddActivityModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSubmit={optimisticCreateItem}
        classroom={selectedClassroom}
        classrooms={classrooms}
        students={students}
        curriculum={curriculum}
        curriculumAreas={curriculumAreas}
        curriculumCategories={curriculumCategories}
        defaults={{ preSelectedStudentId: student?.id, activeDateISO: dateISO(activeDateObj) }}
        showToast={showToast}
      />

      {/* LEFT-ALIGNED STUDENT PROFILE HEADER */}
      <div style={{ flexShrink: 0, padding: '16px 28px', background: '#fff', borderBottom: `1px solid ${UI.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          {!isParentLocked && (
            <button
              onClick={() => setSelectedId(null)}
              style={{ border: 'none', background: '#F8FAFC', cursor: 'pointer', color: UI.muted, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: '50%', padding: 0 }}
              title="Back to Class"
            >
              <ChevronLeft size={20} />
            </button>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <HexAvatar letter={(student?.first_name || '?')[0]} size={56} fontSize={24} />
            <div style={{ fontFamily: THEME.serifFont, fontSize: 26, fontWeight: 700, color: UI.primary, lineHeight: 1.1 }}>
              {student?.first_name} <span style={{ color: UI.accentPeach }}>{student?.last_name}</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant="solid" onClick={() => setAddOpen(true)}>
            <Plus size={14} /> New Activity
          </Button>
        </div>
      </div>

      {/* NAVIGATION TABS & GLOBAL BOARD FILTER */}
      <div style={{ flexShrink: 0, padding: '16px 28px', background: UI.bg, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', background: '#fff', padding: 6, borderRadius: SQUARE_RADIUS, border: `1px solid ${UI.border}` }}>
          <ViewToggle active={tab === 'MONTH'} icon={CalendarDays} label="Monthly Board" onClick={() => setTab('MONTH')} />
          <ViewToggle active={tab === 'WEEK'} icon={Eye} label="Weekly Plan" onClick={() => setTab('WEEK')} />
          <ViewToggle active={tab === 'ASSESS'} icon={LayoutGrid} label="Assessments" onClick={() => setTab('ASSESS')} />
          <ViewToggle active={tab === 'COORD'} icon={MessageSquare} label="Coordination" onClick={() => setTab('COORD')} />
        </div>

        {(tab === 'WEEK' || tab === 'MONTH') && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#fff', padding: '6px 10px', borderRadius: SQUARE_RADIUS, border: `1px solid ${UI.border}` }}>
              <button onClick={() => setActiveDate(tab === 'WEEK' ? dateISO(addDays(activeDateObj, -7)) : firstOfMonthISO(addMonths(activeDateObj, -1)))} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 6, color: UI.primary, display: 'flex' }}><ChevronLeft size={16} /></button>
              <span style={{ fontSize: 13, fontWeight: 600, color: UI.primary, minWidth: 80, textAlign: 'center', userSelect: 'none' }}>
                {tab === 'WEEK' ? `Week ${getWeekFromDate(activeDateObj)}` : activeDateObj.toLocaleString('default', { month: 'long' })}
              </span>
              <button onClick={() => setActiveDate(tab === 'WEEK' ? dateISO(addDays(activeDateObj, 7)) : firstOfMonthISO(addMonths(activeDateObj, 1)))} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 6, color: UI.primary, display: 'flex' }}><ChevronRight size={16} /></button>
              <div style={{ width: 1, height: 20, background: UI.border, margin: '0 8px' }} />
              <Button variant="ghost" onClick={() => setActiveDate(getBusinessDayISO())} style={{ padding: '6px 12px', fontSize: 12 }}>
                Jump to Current
              </Button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', background: '#fff', borderRadius: SQUARE_RADIUS, border: `1px solid ${UI.border}` }}>
              <Field 
                as="select" 
                value={boardFilterArea} 
                onChange={(e) => setBoardFilterArea(e.target.value)} 
                style={{ width: 180, border: 'none', background: 'transparent', fontWeight: 500, padding: '8px 12px', color: UI.primary, height: '38px' }}
              >
                <option value="ALL">All Areas</option>
                {(curriculumAreas || []).map((a) => <option key={a.id} value={a.name}>{a.name}</option>)}
              </Field>
            </div>
          </>
        )}
      </div>

      {/* SCROLLABLE CONTENT */}
      <div style={{ flex: 1, minHeight: 0, padding: '0 28px 40px', overflowY: 'auto', overflowX: 'hidden' }}>
        <div style={{ maxWidth: 1600, margin: '0 auto' }}>
          {tab === 'MONTH' && (
            <MonthlyBoard
              student={student}
              studentPlans={localStudentPlans}
              masterPlans={masterPlans}
              planSessions={planSessions}
              activeDateObj={activeDateObj}
              onCreateFromScope={createFromScopeSession}
              onUpdatePlanItemStatus={updateStatusWithDateRule}
              setEditingItem={setEditingItem}
              onArchivePlanItem={archiveToUnplanned}
              boardFilterArea={boardFilterArea}
            />
          )}

          {tab === 'WEEK' && (
            <WeeklyCalendar
              studentPlans={localStudentPlans}
              activeDateObj={activeDateObj}
              onMoveItemToDate={optimisticMoveItemToDate}
              setEditingItem={setEditingItem}
              onArchiveItem={archiveToUnplanned}
              boardFilterArea={boardFilterArea}
            />
          )}

          {tab === 'ASSESS' && <AssessmentPanel profile={profile} student={student} classroomId={student?.classroom_id} showToast={showToast} />}
          {tab === 'COORD' && <CoordinationPanel student={student} showToast={showToast} />}
        </div>
      </div>

      {editingItem && (
        <EditActivityModal
          item={editingItem}
          curriculum={curriculum}
          curriculumAreas={curriculumAreas}
          curriculumCategories={curriculumCategories}
          onSave={optimisticUpdateItem}
          onDelete={onDeleteItem}
          onClose={() => setEditingItem(null)}
        />
      )}
    </div>
  );
};

export default IndividualPlanner;