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
  Search, ChevronLeft, ChevronRight, Plus, CheckCircle2, CheckCircle,
  Clock, Star, Trash2, Eye, CalendarDays, LayoutGrid, Undo2, MessageSquare,
  Target, ChevronDown, Flag, Circle, CircleDashed, LayoutDashboard, History,
  Filter, User, Lightbulb, Check, List, Columns
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
const rgba = (hex, a = 1) => { const { r, g, b } = hexToRgb(hex); return `rgba(${r}, ${g}, ${b}, ${a})`; };

const UI = {
  bg: '#FAF9F6', card: '#FFFFFF', text: '#4B5563', muted: '#6B7280',
  primary: '#233876', border: '#E5E7EB', accentYellow: '#F4C473',
  accentTeal: '#7BCEBE', accentPeach: '#F8B4A6', accentSlate: '#A2B5C6',
  success: '#5E9494', danger: '#ef4444',
};

const SQUARE_RADIUS = '0px';
const pad2 = (n) => String(n).padStart(2, '0');

const toDateObj = (v) => {
  if (!v) return new Date();
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) {
    const d = new Date(`${v.slice(0, 10)}T00:00:00`);
    return isNaN(d.getTime()) ? new Date() : d;
  }
  const d = new Date(v);
  return isNaN(d.getTime()) ? new Date() : d;
};

const getItemDateObj = (it) => {
  const d = toDateObj(it?.planning_date) || toDateObj(it?.date) || (it?.year && it?.month ? new Date(Number(it.year), Number(it.month) - 1, Number(it.day || 1), 0, 0, 0) : null);
  return d && !isNaN(d.getTime()) ? d : null;
};

const formatShortDate = (d) => {
  if (!d) return '';

  // If it's a plain YYYY-MM-DD, parse as LOCAL midnight (prevents timezone shift)
  if (typeof d === 'string') {
    const s = d.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const dtLocal = new Date(`${s}T00:00:00`);
      if (!Number.isNaN(dtLocal.getTime())) {
        return dtLocal.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }
    }
  }

  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return String(d);
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};
const normStatus = (raw) => {
  const s = String(raw || '').trim().toUpperCase();
  if (s === 'I' || s === 'P' || s === 'N') return s;
  const n = s.toLowerCase().replace(/[_-]/g, ' ').trim();
  if (n.includes('introduc')) return 'I';
  if (n.includes('practic')) return 'P';
  if (n.includes('review') || n.includes('need')) return 'N';
  return 'I';
};

const clean = (s) => String(s || '').trim();
const iso10 = (v) => { const s = String(v || '').slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : ''; };
const parseId = (id) => id && id !== 'CUSTOM' ? Number(id) : null;
const normKey = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');

const getBusinessDayISO = () => {
  const d = new Date();
  const day = d.getDay();
  if (day === 6) d.setDate(d.getDate() + 2); 
  if (day === 0) d.setDate(d.getDate() + 1); 
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const statusConfig = {
  I: { label: 'Introduced', bg: '#F0F7FF', color: '#1E88E5', border: '#1E88E5' },
  P: { label: 'Practiced', bg: '#FFF9ED', color: '#F5B041', border: '#F5B041' },
  N: { label: 'Needs Review', bg: '#FFF0F0', color: '#E53935', border: '#E53935' },
};

const getRawFirstTitle = (it) => clean(it?.raw_activity) || clean(it?.activity) || clean(getNormalizedItem(it || {})?.rawActivity) || clean(getNormalizedItem(it || {})?.title) || 'Untitled Activity';
const splitActivityNames = (value, fallback = 'Activity') => {
  const names = String(value || '')
    .split('•')
    .map((s) => s.trim())
    .filter(Boolean);
  return names.length ? names : [fallback];
};

const bucketToLabel = (b) => {
  const x = String(b || '').toUpperCase();
  if (x === 'INTRODUCED') return 'Introduced';
  if (x === 'PRACTICED') return 'Practiced';
  if (x === 'REWORK') return 'Needs Review';
  if (x === 'MASTERED') return 'Mastered';
  return x || '';
};

const extractPeersFromHtml = (html, studentFirstName) => {
  if (!html) return [];
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const peers = [...new Set(Array.from(doc.querySelectorAll('a.child-link')).map(a => a.textContent.trim()))]
      .filter(Boolean);

    const sName = (studentFirstName || '').toLowerCase();
    return peers.filter(p => {
      const pl = p.toLowerCase();
      return !sName || (pl !== sName && !pl.includes(sName));
    });
  } catch (e) {
    return [];
  }
};

const getObsDate = (item) => (
  iso10(item?.observation_date) ||
  iso10(item?.date) ||
  iso10(item?.observationDate) ||
  iso10(item?.created_at) ||
  ''
);
// ---------------------------
// TC EXTRACTION & CLEANING
// ---------------------------
const extractLessonName = (rec) => {
    const html = rec.html_content || '';
    if (html) {
        try {
            const doc = new DOMParser().parseFromString(html, 'text/html');
            const lessons = Array.from(doc.querySelectorAll('a.lesson-link')).map(a => a.textContent.trim());
            if (lessons.length > 0) return lessons.join(' • ');
        } catch(e) {}
    }
    if (rec.activity_name) return rec.activity_name;
    const textToSearch = rec.note || rec.text_content || html.replace(/<[^>]+>/g, '');
    const textMatch = textToSearch.match(/(?:practiced|introduced to|mastered|re-present|needs more|needs practice|review|worked with)\s+(.*?)(?:\.| and | but | worked | he | she |$)/i);
    return textMatch ? textMatch[1].trim() : 'General Activity';
};

const inferTcBucket = (text) => {
    const t = String(text || '').toLowerCase();
    if (t.includes('reintroduced') || t.includes('re-introduced') || t.includes('re-present') || t.includes('represent') || 
        t.includes('needs more') || t.includes('need practice') || t.includes('needs practice') || t.includes('rework') || t.includes('needs review')
    ) return 'REWORK';
    if (t.includes('practiced')) return 'PRACTICED';
    if (t.includes('mastered')) return 'MASTERED';
    return 'INTRODUCED';
};

// Aggressive, Centralized Note Cleaning Function
export const cleanObservationNote = (student, tc, raw, preserveEntities = false) => {
  const htmlContent = raw?.html_content || '';
  let textContent = raw?.text_content || tc?.note || '';
  
  let customNote = tc?.note || textContent; 
  if (htmlContent) {
      const doc = new DOMParser().parseFromString(htmlContent, 'text/html');
      customNote = doc.body.textContent || '';
  }

  // Quick kill for garbage DB artifacts like "Practiced , , , and"
  let checkBoilerplate = customNote.replace(/\b(got|introduced|to|and|practiced|mastered|worked|with|re-?introduced|needs?|more|practice|review)\b/ig, '')
                                   .replace(/\sو\s/g, '')
                                   .replace(/[.,،:;\s-]/g, '')
                                   .trim();
  if (checkBoilerplate.length === 0) return '';
  
  let peers = [];
  let lessonNames = [];
  
  if (htmlContent) {
      const doc = new DOMParser().parseFromString(htmlContent, 'text/html');
      const childLinks = Array.from(doc.querySelectorAll('a.child-link')).map(a => a.textContent.trim());
      peers = [...new Set(childLinks)];
      lessonNames = Array.from(doc.querySelectorAll('a.lesson-link')).map(a => a.textContent.trim());
  }

  const actName = extractLessonName({html_content: htmlContent, text_content: textContent, activity_name: tc?.activity_name});
  if (actName) {
      actName.split('•').forEach(a => {
          const cleanA = a.trim();
          if (cleanA && !lessonNames.includes(cleanA)) lessonNames.push(cleanA);
      });
  }
  
  // If preserveEntities is TRUE, we KEEP the student name, peers, and lesson names in the text
  if (!preserveEntities) {
      peers.forEach(p => {
          if (p) customNote = customNote.replace(new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig'), '');
      });
      
      if (student?.first_name) {
          const sf = student.first_name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          customNote = customNote.replace(new RegExp(`\\b${sf}\\b\\s*[A-Z]?\\.?`, 'ig'), '');
      }

      lessonNames.forEach(ln => {
          if (ln) customNote = customNote.replace(new RegExp(ln.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig'), '');
      });
  }

  // Clean up stranded boilerplate artifacts (like "Introduced to " without a subject)
  customNote = customNote.replace(/\b(?:got\s+)?(?:re-?)?introduced\s+to\s*[.,،\s]*(?:and|و)?\s*[.,،\s]*/ig, '');
  customNote = customNote.replace(/\b(?:got\s+)?(?:re-?)?introduced\s*[.,،\s]*(?:and|و)?\s*[.,،\s]*/ig, '');
  customNote = customNote.replace(/\bpracticed\s*[.,،\s]*(?:and|و)?\s*[.,،\s]*/ig, '');
  customNote = customNote.replace(/\bmastered\s*[.,،\s]*(?:and|و)?\s*[.,،\s]*/ig, '');

  // Sweep leading/trailing punctuation and isolated conjunctions
  customNote = customNote.replace(/^(?:[\s.,،:;]|and|و)+/ig, '').trim();
  customNote = customNote.replace(/(?:[\s.,،:;]|and|و)+$/ig, '').trim();
  
  if (customNote.length > 0) return customNote.charAt(0).toUpperCase() + customNote.slice(1);
  return '';
};

const StatusBadge = ({ status }) => {
    if (!status) return null;
    const s = String(status).toLowerCase();
    let bgColor = '#f1f5f9'; let color = '#475569';
    if (s.includes('introduc') || s === 'i') { bgColor = '#dbeafe'; color = '#1e40af'; }
    else if (s.includes('practic') || s === 'p') { bgColor = '#fef08a'; color = '#854d0e'; }
    else if (s.includes('master') || s === 'm') { bgColor = '#dcfce7'; color = '#166534'; }
    else if (s.includes('review') || s.includes('rework') || s === 'n') { bgColor = '#fee2e2'; color = '#991b1b'; }
    return (
        <span style={{ backgroundColor: bgColor, color: color, padding: '3px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: '800', display: 'inline-block', textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>{status}</span>
    );
};

const ProgressMarker = ({ status }) => {
  const colors = { MASTERED: '#233876', PRACTICED: '#1E88E5', INTRODUCED: '#E3F2FD', REWORK: '#ef4444', PLANNED: 'transparent' };
  const isFull = status === 'MASTERED' || status === 'PRACTICED' || status === 'REWORK';
  return (
    <div style={{
      width: 20, height: 20, borderRadius: '50%',
      border: `2px solid ${status === 'PLANNED' ? '#E5E7EB' : (status === 'INTRODUCED' ? '#1E88E5' : colors[status])}`,
      backgroundColor: isFull ? colors[status] : (status === 'INTRODUCED' ? colors[status] : 'transparent'),
      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: '900',
      color: isFull ? '#fff' : (status === 'INTRODUCED' ? '#1E88E5' : '#D1D5DB'), flexShrink: 0, 
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', boxShadow: isFull ? '0 2px 4px rgba(0,0,0,0.1)' : 'none'
    }}>
      {status === 'PRACTICED' && 'P'}
      {status === 'INTRODUCED' && 'I'}
      {status === 'REWORK' && '!'}
    </div>
  );
};

/** ---------------------------
 * SHARED UI COMPONENTS
 * --------------------------- */
const ThemedCard = ({ children, style, className = '', onClick, accentColor = UI.border }) => (
  <div className={`mb-card ${className}`} onClick={onClick} style={{ backgroundColor: UI.card, borderRadius: SQUARE_RADIUS, boxShadow: onClick ? '0 4px 6px rgba(0,0,0,0.05)' : '0 1px 3px rgba(0,0,0,0.02)', border: `1px solid ${UI.border}`, borderTop: `4px solid ${accentColor}`, overflow: 'visible', cursor: onClick ? 'pointer' : 'default', transition: 'box-shadow 150ms ease, transform 150ms ease', ...style }}>{children}</div>
);

const SectionHeader = ({ icon: Icon, title, right, style }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 16, borderBottom: `1px solid ${UI.border}`, marginBottom: 20, ...style }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ padding: '6px', background: rgba(UI.primary, 0.04), borderRadius: SQUARE_RADIUS, color: UI.primary }}><Icon size={18} strokeWidth={2} /></div>
      <div style={{ fontFamily: THEME.serifFont, fontSize: 18, fontWeight: 600, color: UI.primary }}>{title}</div>
    </div>
    {right}
  </div>
);

const Label = ({ children, style }) => (<div style={{ fontSize: 11, fontWeight: 600, color: UI.muted, textTransform: 'uppercase', letterSpacing: 0.5, fontFamily: THEME.sansFont, ...style }}>{children}</div>);

const Field = ({ as = 'input', style, onFocus, onBlur, children, ...props }) => {
  const Comp = as;
  const isTextarea = as === 'textarea';
  return (
    <Comp {...props} style={{ width: '100%', padding: '10px 12px', borderRadius: SQUARE_RADIUS, border: `1px solid ${UI.border}`, fontSize: 13, fontWeight: 400, outline: 'none', boxSizing: 'border-box', fontFamily: THEME.sansFont, color: UI.text, backgroundColor: '#fff', transition: 'all 0.2s ease', lineHeight: isTextarea ? '1.5' : 'normal', ...(as === 'select' ? { cursor: 'pointer', height: '38px' } : null), ...style }}
      onFocus={(e) => { e.currentTarget.style.borderColor = UI.primary; e.currentTarget.style.boxShadow = `0 0 0 2px ${rgba(UI.primary, 0.05)}`; onFocus?.(e); }}
      onBlur={(e) => { e.currentTarget.style.borderColor = UI.border; e.currentTarget.style.boxShadow = 'none'; onBlur?.(e); }}
    >
      {children}
    </Comp>
  );
};

const Button = ({ variant = 'primary', children, style, ...props }) => {
  const base = { borderRadius: SQUARE_RADIUS, fontFamily: THEME.sansFont, fontWeight: 500, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '8px 16px', fontSize: 13, transition: 'all 100ms ease', userSelect: 'none', whiteSpace: 'nowrap', border: '1px solid transparent', height: '38px' };
  const variants = {
    primary: { background: '#fff', color: UI.primary, border: `1px solid ${UI.border}`, boxShadow: '0 1px 2px rgba(0,0,0,0.02)' },
    solid: { background: UI.primary, color: '#fff', border: `1px solid ${UI.primary}`, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' },
    ghost: { background: 'transparent', color: UI.muted, border: `1px solid transparent`, boxShadow: 'none' },
    danger: { background: '#fef2f2', color: UI.danger, border: '1px solid #fca5a5', boxShadow: 'none' },
  };
  const v = variants[variant] || variants.primary;
  return (
    <button {...props} style={{ ...base, ...v, ...style }} onMouseEnter={(e) => { if (variant === 'primary') e.currentTarget.style.background = '#f9fafb'; if (variant === 'solid') e.currentTarget.style.opacity = 0.9; }} onMouseLeave={(e) => { if (variant === 'primary') e.currentTarget.style.background = '#fff'; if (variant === 'solid') e.currentTarget.style.opacity = 1; }}>
      {children}
    </button>
  );
};

const ViewToggle = ({ active, icon: Icon, label, onClick }) => (
  <button onClick={onClick} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: SQUARE_RADIUS, border: `1px solid ${active ? UI.primary : 'transparent'}`, background: active ? UI.primary : 'transparent', color: active ? '#fff' : UI.muted, fontSize: 13, fontWeight: active ? 600 : 500, cursor: 'pointer', transition: 'all 0.15s ease', fontFamily: THEME.sansFont, userSelect: 'none', height: '36px' }}>
    {Icon && <Icon size={16} color={active ? '#fff' : UI.muted} />} {label}
  </button>
);

const ClassTab = ({ active, label, onClick }) => (
  <button onClick={onClick} style={{ border: active ? `1px solid ${UI.primary}` : `1px solid ${UI.border}`, cursor: 'pointer', padding: '10px 20px', background: active ? UI.primary : '#fff', color: active ? '#fff' : UI.text, fontWeight: 600, borderRadius: SQUARE_RADIUS, transition: 'all 0.15s', fontFamily: THEME.sansFont, fontSize: 13 }}>
    {label}
  </button>
);

/** ---------------------------
 * MODALS 
 * --------------------------- */
const AddActivityModal = ({ open, onClose, onSubmit, classrooms = [], students = [], curriculum = [], curriculumAreas = [], curriculumCategories = [], defaults = {}, showToast }) => {
  return null; 
};

const AddObservationModal = ({ open, onClose, onSubmit }) => {
  const [type, setType] = useState('academic'); const [date, setDate] = useState(dateISO(new Date())); const [observation, setObservation] = useState('');
  if (!open) return null;
  return (
    <Modal title="New Observation" onClose={onClose} width={500}>
      <div style={{ display: 'grid', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div><Label>Type</Label><Field as="select" value={type} onChange={e => setType(e.target.value)}><option value="academic">Academic</option><option value="behavioral">Behavioral</option><option value="social">Social</option><option value="general">General</option></Field></div>
            <div><Label>Date</Label><Field type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
        </div>
        <div><Label>Observation Details</Label><Field as="textarea" rows={4} value={observation} onChange={e => setObservation(e.target.value)} placeholder="What did you observe?" /></div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="solid" onClick={() => { onSubmit({ type, observation, date }); onClose(); setObservation(''); }}>Save</Button></div>
      </div>
    </Modal>
  );
};

const AddActionModal = ({ open, onClose, onSubmit }) => {
  const [subject, setSubject] = useState('General'); const [date, setDate] = useState(dateISO(new Date())); const [description, setDescription] = useState('');
  if (!open) return null;
  return (
    <Modal title="New Action Item" onClose={onClose} width={500}>
      <div style={{ display: 'grid', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div><Label>Subject Area</Label><Field value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g. Math, Language" /></div>
            <div><Label>Action Date</Label><Field type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
        </div>
        <div><Label>Action Description</Label><Field as="textarea" rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="What needs to be done?" /></div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="solid" onClick={() => { onSubmit({ subject, description, assignee: 'Unassigned', date }); onClose(); setDescription(''); }}>Save</Button></div>
      </div>
    </Modal>
  );
};

/** ---------------------------
 * TAB 1: DASHBOARD
 * --------------------------- */
const DashboardPanel = ({ student, studentPlans, showToast, resolvedIds, setResolvedIds, updatePlanItemFields, activeDateObj, timeFrame }) => {
  const [actions, setActions] = useState([]); 
  const [tcData, setTcData] = useState([]);
  const [tcDataRaw, setTcDataRaw] = useState([]);
  const [manualObservationsDashboard, setManualObservationsDashboard] = useState([]);
  const [weakestSkills, setWeakestSkills] = useState([]); 
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [hideCompleted, setHideCompleted] = useState(false);

  useEffect(() => {
    const loadDashboardData = async () => {
      if (!student?.id) return;
      try {
        const actPromise = supabase.from('coordination_action_plans').select('*').eq('target_student_id', student.id).order('id', { ascending: false });
        const assessPromise = supabase.from('student_assessments').select('id').eq('student_id', student.id);
        const obsPromise = supabase.from('coordination_observations').select('*').eq('student_id', student.id).order('date', { ascending: false }).limit(30);
        
        let tcPromise = Promise.resolve({ data: [] });
        let tcRawPromise = Promise.resolve({ data: [] });
        
        if (student.tc_id) {
          tcPromise = supabase.from('vw_tc_observations_enriched').select('*').eq('child_tc_id', student.tc_id).order('observation_date', { ascending: false }).limit(100);
          tcRawPromise = supabase.from('vw_tc_observations_expanded').select('tc_observation_id, html_content, text_content').eq('child_tc_id', student.tc_id).order('observation_date', { ascending: false }).limit(100);
        }

        const [actRes, assessRes, obsRes, tcRes, tcRawRes] = await Promise.all([actPromise, assessPromise, obsPromise, tcPromise, tcRawPromise]);
        
        setActions(actRes.data || []);
        setManualObservationsDashboard(obsRes.data || []);
        setTcData(tcRes?.data || []);
        setTcDataRaw(tcRawRes?.data || []);

        if (assessRes.data?.length > 0) {
           const { data: scores } = await supabase.from('student_assessment_scores').select('skill_id, score_raw').in('assessment_id', assessRes.data.map(a => a.id));
           if (scores?.length > 0) {
               const skillLowestMap = new Map();
               scores.forEach(s => { 
                   const val = parseFloat(String(s.score_raw).replace('%', '').trim()); 
                   if (!isNaN(val)) {
                       const current = skillLowestMap.get(s.skill_id);
                       if (current === undefined || val < current) skillLowestMap.set(s.skill_id, val);
                   } 
               });
               const weakestIds = Array.from(skillLowestMap.entries()).filter(([id, val]) => val < 40).sort((a, b) => a[1] - b[1]).slice(0, 3); 
               if (weakestIds.length > 0) { 
                   const { data: skillData } = await supabase.from('assessment_skills').select('id, name').in('id', weakestIds.map(w => w[0])); 
                   if (skillData) {
                       setWeakestSkills(weakestIds.map(([id, score]) => {
                           const sd = skillData.find(d => String(d.id) === String(id));
                           return { name: sd ? sd.name : 'Unknown Skill', score };
                       })); 
                   }
               } else setWeakestSkills([]);
           }
        }
      } catch (err) { console.error(err); }
    };
    loadDashboardData();
  }, [student?.id]);

  const combinedFollowUps = useMemo(() => {
    const list = [];
    (studentPlans || []).filter(p => normStatus(p.status) === 'N').forEach(p => {
        const uid = `plan-${p.id}`;
        list.push({ id: uid, isAuto: true, done: resolvedIds.has(uid), subject: getNormalizedItem(p).area || p.area || 'General', detail: getRawFirstTitle(p), note: 'Needs review (Auto via Plan)', date: p.planning_date || p.date || p.created_at });
    });
    actions.forEach(a => {
        list.push({ id: `db-${a.id}`, isAuto: false, done: a.status === 'DONE', subject: a.subject || 'General', detail: a.description || 'Action Item', note: '', date: a.date || a.created_at });
    });

    const rawMap = new Map();
    tcDataRaw.forEach(r => { if (r.tc_observation_id) rawMap.set(String(r.tc_observation_id), r); });

    const tcFollowMap = new Map();
    tcData.forEach(tc => {
        const obsId = tc.tc_observation_id || tc.id;
        const uniqueId = `tc-${obsId}`;

        if (tcFollowMap.has(uniqueId)) return;

        const raw = rawMap.get(String(obsId)) || {};
        const actName = extractLessonName({html_content: raw.html_content, text_content: raw.text_content, activity_name: tc.activity_name});
        let readableText = cleanObservationNote(student, tc, raw, true) || tc.note || '';
        
        const bucket = tc.bucket || inferTcBucket(readableText || tc.note);
        const noteLower = (tc.note || '').toLowerCase();
        
        if (bucket === 'REWORK' || noteLower.includes('need practice') || noteLower.includes('needs practice')) {
            tcFollowMap.set(uniqueId, { 
                id: uniqueId, isAuto: true, done: resolvedIds.has(uniqueId), 
                subject: tc.area_name || 'General', 
                detail: actName || 'Review Required', 
                note: readableText, date: tc.observation_date || tc.date 
            });
        }
    });

    list.push(...Array.from(tcFollowMap.values()));
    return list.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [studentPlans, actions, tcData, tcDataRaw, resolvedIds, student]);

  // Group Follow-Ups by Area
  const groupedFollowUps = useMemo(() => {
      const groups = {};
      (hideCompleted ? combinedFollowUps.filter(f => !f.done) : combinedFollowUps).forEach(it => {
          const area = it.subject || 'General';
          if (!groups[area]) groups[area] = [];
          groups[area].push(it);
      });
      return groups;
  }, [combinedFollowUps, hideCompleted]);

// ✅ TODAY SUMMARY (Introduced + Practiced), grouped by Area → Category → Activity
const todayTcSummary = useMemo(() => {
  const todayISO = dateISO(new Date()); // "today" in real time

  const rawMap = new Map();
  tcDataRaw.forEach(r => { if (r.tc_observation_id) rawMap.set(String(r.tc_observation_id), r); });

  const onlyToday = (tcData || []).filter(tc => iso10(tc.observation_date) === todayISO);

  const addTo = (root, tc) => {
    const obsId = String(tc.tc_observation_id || tc.id);
    const raw = rawMap.get(obsId) || {};

    const bucket = tc.bucket || inferTcBucket(tc.note || raw.text_content);
    if (bucket !== 'INTRODUCED' && bucket !== 'PRACTICED') return; // only these two for overview

    const area = tc.area_name || 'General';
    const cat = tc.category_name || 'General';
    const actName = extractLessonName({
      html_content: raw.html_content,
      text_content: raw.text_content,
      activity_name: tc.activity_name
    }) || 'Activity';

    const cleaned = cleanObservationNote(student, tc, raw); // keep it short/clean

    if (!root[bucket]) root[bucket] = {};
    if (!root[bucket][area]) root[bucket][area] = {};
    if (!root[bucket][area][cat]) root[bucket][area][cat] = {};
    if (!root[bucket][area][cat][actName]) root[bucket][area][cat][actName] = [];

    if (cleaned) root[bucket][area][cat][actName].push(cleaned);
  };

  const grouped = {};
  onlyToday.forEach(tc => addTo(grouped, tc));

  return grouped; // shape: { INTRODUCED: { Area: { Cat: { Activity: [notes] }}} , PRACTICED: ... }
}, [tcData, tcDataRaw, student]);

const otherTeacherNotes = useMemo(() => {
  const isOther = (m) => {
    const flag = String(m?.status || m?.type || '').trim().toLowerCase();
    return flag === 'other';
  };

  return (manualObservationsDashboard || [])
    .filter(isOther)
    .sort((a, b) => new Date(b.date || b.created_at).getTime() - new Date(a.date || a.created_at).getTime())
    .slice(0, 12);
}, [manualObservationsDashboard]);
  const toggleActionStatus = async (item) => {
    const isDoneNow = item.done; 
    
    // Optimistic Save with Guaranteed Database Resolution
    if (item.id.startsWith('db-')) {
        const realId = item.id.replace('db-', '');
        const nextStatus = isDoneNow ? 'PENDING' : 'DONE';
        setActions(prev => prev.map(a => String(a.id) === realId ? { ...a, status: nextStatus } : a)); 
        try { 
            const { error } = await supabase.from('coordination_action_plans').update({ status: nextStatus }).eq('id', realId); 
            if (error) throw error;
            showToast?.({ type: 'success', message: 'Status updated.' });
        } catch (e) { 
            setActions(prev => prev.map(a => String(a.id) === realId ? { ...a, status: isDoneNow ? 'DONE' : 'PENDING' } : a)); 
            showToast?.({ type: 'error', message: 'Failed to update.' }); 
        }
    } else {
        setResolvedIds(prev => {
            const next = new Set(prev);
            if (isDoneNow) next.delete(item.id);
            else next.add(item.id);
            return next;
        });

        try {
            if (!isDoneNow) {
                await supabase.from('resolved_suggestions').delete().eq('suggestion_id', item.id);
                const { error } = await supabase.from('resolved_suggestions').insert({ suggestion_id: item.id, student_id: student.id });
                if (error) throw error;
                
                if (item.id.startsWith('plan-')) {
                    await updatePlanItemFields(item.id.replace('plan-', ''), { status: 'P' }, { callParent: false, toastOnError: false });
                }
            } else {
                const { error } = await supabase.from('resolved_suggestions').delete().eq('suggestion_id', item.id);
                if (error) throw error;
            }
            showToast?.({ type: 'success', message: 'Resolution saved.' });
        } catch (e) {
            setResolvedIds(prev => {
                const next = new Set(prev);
                if (isDoneNow) next.add(item.id);
                else next.delete(item.id);
                return next;
            });
            showToast?.({ type: 'error', message: 'Failed to save status.' });
        }
    }
  };

  const handleAddAction = async (payload) => {
    try { 
      const { data, error } = await supabase.from('coordination_action_plans').insert([{ target_student_id: student.id, subject: payload.subject, description: payload.description, custom_assignee: 'Unassigned', status: 'PENDING', date: payload.date || null }]).select(); 
      if (error) throw error; 
      if (data?.length) setActions(prev => [data[0], ...prev]); 
      showToast?.({ type: 'success', message: 'Action plan created.' }); 
    } catch (err) { showToast?.({ type: 'error', message: err.message || 'Failed to create action' }); }
  };

  return (
    <div style={{ display: 'grid', gap: 24, paddingTop: 10 }}>
      <AddActionModal open={actionModalOpen} onClose={() => setActionModalOpen(false)} onSubmit={handleAddAction} />
      
      {/* ROW 1: Focus & Recent Substantial Observations */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>
          {/* 1. FOCUS & INSIGHTS */}
          <ThemedCard style={{ padding: 24 }} accentColor={UI.primary}>
            <SectionHeader icon={Star} title="Student Focus & Insights" />
            {weakestSkills.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {weakestSkills.map((skill, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: 16, alignItems: 'center', background: '#FEF9C3', padding: '16px 20px', borderRadius: SQUARE_RADIUS, border: '1px solid #FDE047' }}>
                            <Target color="#CA8A04" size={28} />
                            <div>
                                <div style={{ fontSize: 12, color: '#854D0E', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Recommended Focus Area</div>
                                <div style={{ fontSize: 14, color: '#854D0E', marginTop: 4 }}>Based on recent assessments, consider re-presenting or focusing on: <strong style={{fontSize: 16}}>{skill.name}</strong> ({skill.score}%)</div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (<div style={{ fontSize: 13, color: UI.muted, fontStyle: 'italic' }}>No specific focus areas identified below 40% from recent assessments.</div>)}
          </ThemedCard>

{/* 2A. TODAY OVERVIEW */}
<ThemedCard style={{ padding: 24 }} accentColor={UI.accentPeach}>
  <SectionHeader icon={MessageSquare} title="Today Overview" />

  {(!todayTcSummary?.INTRODUCED && !todayTcSummary?.PRACTICED) ? (
    <div style={{ fontSize: 13, color: UI.muted, fontStyle: 'italic' }}>
      No “Introduced” or “Practiced” items found for today.
    </div>
  ) : (
    <div style={{ display: 'grid', gap: 16 }}>
      {['INTRODUCED', 'PRACTICED'].map((bucket) => {
        const label = bucket === 'INTRODUCED' ? 'got Introduced to' : 'Practiced';
        const badgeColor = bucket === 'INTRODUCED' ? '#1E88E5' : '#F5B041';
        const block = todayTcSummary?.[bucket];
        const studentName = student?.first_name || 'Student';

        if (!block || Object.keys(block).length === 0) return null;

        return (
          <div key={bucket} style={{ border: `1px solid ${UI.border}`, background: '#fff', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ padding: '10px 12px', borderBottom: `1px solid ${UI.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ fontSize: 12, color: UI.muted }}>
                  Today, <span style={{ fontWeight: 700, color: UI.text }}>{studentName}</span> {label.toLowerCase()} :
                </div>
              </div>

              <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: badgeColor, padding: '2px 8px', borderRadius: 4 }}>
                {Object.keys(block).length}
              </div>
            </div>

            <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 280, overflowY: 'auto' }} className="mb-hide-scroll">
              {Object.entries(block).sort((a,b) => a[0].localeCompare(b[0])).map(([area, cats]) => {
                const subjStyle = getSubjectStyle(area);

                return (
                  <div key={area} style={{ borderLeft: `4px solid ${subjStyle.accent}`, paddingLeft: 10 }}>
                    {/* AREA HEADER w/ colored dot */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '6px 8px',
                      borderRadius: 4,
                      background: rgba(subjStyle.accent, 0.08),
                      border: `1px solid ${rgba(subjStyle.accent, 0.18)}`
                    }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: subjStyle.accent }} />
                      <div style={{ fontSize: 11, fontWeight: 800, color: UI.primary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        {area}
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8, paddingLeft: 6 }}>
                      {Object.entries(cats).sort((a,b) => a[0].localeCompare(b[0])).map(([cat, acts]) => (
                        <div key={cat}>
                          {cat !== 'General' && (
                            <div style={{ fontSize: 11, color: UI.muted, fontWeight: 700, marginBottom: 6 }}>
                              {cat}
                            </div>
                          )}

                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {Object.entries(acts).sort((a,b) => a[0].localeCompare(b[0])).map(([act, notes]) => (
                              <div key={act} style={{
                                background: '#fff',
                                border: `1px solid ${UI.border}`,
                                padding: '10px 12px',
                                borderRadius: 4
                              }}>
                                <div style={{ fontSize: 13, fontWeight: 500, color: UI.text}}>
                                  {act}
                                </div>

                                {notes?.length > 0 && (
                                  <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    {notes.slice(0, 2).map((n, idx) => (
                                      <div key={idx} style={{ fontSize: 12, color: UI.muted, fontStyle: 'italic', lineHeight: 1.4 }}>
                                        “{n}”
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  )}
</ThemedCard>

{/* 2B. TEACHER NOTES (OTHER) — separate card below */}

      </div>

      {/* 3. FOLLOW-UP ITEMS (Grouped by Area) */}
      <ThemedCard style={{ padding: 0, overflow: 'hidden' }} accentColor={UI.accentTeal}>
        <div style={{ padding: '24px 24px 16px' }}>
            <SectionHeader icon={Target} title="Follow-up Items" right={
                <div style={{ display: 'flex', gap: 10 }}>
                    <Button variant="ghost" onClick={() => setHideCompleted(!hideCompleted)} style={{ height: 32, fontSize: 12, border: `1px solid ${UI.border}` }}>{hideCompleted ? 'Show completed' : 'Hide completed'}</Button>
                    <Button variant="solid" onClick={() => setActionModalOpen(true)} style={{ height: 32, fontSize: 12 }}><Plus size={14} /> Add Item</Button>
                </div>
            } />
        </div>
        
        {Object.keys(groupedFollowUps).length === 0 || (hideCompleted && combinedFollowUps.filter(f => !f.done).length === 0) ? (<div style={{ padding: '0 24px 32px', fontSize: 13, color: UI.muted, fontStyle: 'italic' }}>No follow-up items found.</div>) : (
          <div style={{ display: 'flex', flexDirection: 'column', paddingBottom: 16 }}>
             <div style={{ minWidth: 800, display: 'grid', gridTemplateColumns: '40px minmax(200px,1fr) 100px 140px', gap: 16, padding: '10px 24px', background: '#f8fafc', borderTop: `1px solid ${UI.border}`, borderBottom: `1px solid ${UI.border}` }}>
                <Label>Done</Label><Label>Activity Detail</Label><Label>Date Logged</Label>
             </div>
             {Object.entries(groupedFollowUps).sort((a,b) => a[0].localeCompare(b[0])).map(([area, items]) => {
                const style = getSubjectStyle(area);
                return (
                 <div key={area} style={{ display: 'flex', flexDirection: 'column' }}>
                     <div style={{ padding: '10px 24px', background: rgba(style.accent, 0.05), borderBottom: `1px solid ${UI.border}`, fontSize: 11, fontWeight: 800, color: UI.primary, textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 8 }}>
                         <div style={{ width: 8, height: 8, borderRadius: '50%', background: style.accent }} />
                         {area}
                     </div>
                     {items.map((it, idx) => (
                        <div key={`${it.id}-${idx}`} style={{ display: 'grid', gridTemplateColumns: '40px minmax(200px,1fr) 100px 140px', gap: 16, alignItems: 'center', background: '#fff', padding: '14px 24px', borderBottom: `1px solid ${UI.border}`, opacity: it.done ? 0.6 : 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                <button onClick={() => toggleActionStatus(it)} style={{ width: 22, height: 22, borderRadius: 4, cursor: 'pointer', border: `1.5px solid ${it.done ? rgba(UI.primary, 0.6) : rgba(UI.primary, 0.3)}`, background: it.done ? rgba(UI.primary, 0.1) : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {it.done ? <Check size={14} color={UI.primary} strokeWidth={3} /> : null}
                                </button>
                            </div>
                            <div>
                                <div style={{ fontSize: 13, fontWeight: 500, color: UI.text, textDecoration: it.done ? 'line-through' : 'none' }}>{it.detail}</div>
                                {it.note && <div style={{ marginTop: 6, fontSize: 11, fontWeight: 400, color: UI.muted, fontStyle: 'italic', lineHeight: 1.3 }}>{it.note}</div>}
                            </div>
                            <div style={{ fontSize: 11, fontWeight: 400, color: UI.muted }}>{it.date ? formatShortDate(it.date) : '—'}</div>
                        </div>
                     ))}
                 </div>
                );
             })}
          </div>
        )}
      </ThemedCard>

    </div>
  );
};
/** ---------------------------
 * TAB 2: ACTIVITY LOG (Kanban + List Toggle)
 * --------------------------- */
const ActivityLogPanel = ({ student, studentPlans, activeDateObj, timeFrame, showToast }) => {
  const [viewMode, setViewMode] = useState('BOARD'); // 'BOARD' or 'LIST'
  const [tcData, setTcData] = useState([]);
  const [tcDataRaw, setTcDataRaw] = useState([]);
  const [manualObservations, setManualObservations] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const [filterArea, setFilterArea] = useState('ALL');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  
  const [obsModalOpen, setObsModalOpen] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!student?.id) return;
      setLoading(true);
      try {
        let start, end;
        if (timeFrame === 'WEEK') {
          const mon = startOfWeekMonday(activeDateObj);
          start = dateISO(mon);
          end = dateISO(addDays(mon, 6));
        } else {
          start = `${activeDateObj.getFullYear()}-${pad2(activeDateObj.getMonth() + 1)}-01`;
          const lastDay = new Date(activeDateObj.getFullYear(), activeDateObj.getMonth() + 1, 0);
          end = dateISO(lastDay);
        }

        const obsPromise = supabase.from('coordination_observations')
          .select('*').eq('student_id', student.id).gte('date', start).lte('date', end).order('date', { ascending: false });

        let tcPromise = Promise.resolve({ data: [] });
        let tcRawPromise = Promise.resolve({ data: [] });

        if (student.tc_id) {
          tcPromise = supabase.from('vw_tc_observations_enriched')
            .select('*').eq('child_tc_id', student.tc_id).gte('observation_date', start).lte('observation_date', end).order('observation_date', { ascending: false });
          tcRawPromise = supabase.from('vw_tc_observations_expanded')
            .select('tc_observation_id, html_content, text_content').eq('child_tc_id', student.tc_id).gte('observation_date', start).lte('observation_date', end);
        }

        const [obsRes, tcRes, tcRawRes] = await Promise.all([obsPromise, tcPromise, tcRawPromise]);
        
        setManualObservations(obsRes.data || []);
        setTcData(tcRes?.data || []);
        setTcDataRaw(tcRawRes?.data || []);

      } catch (err) {
        console.error(err);
        showToast?.({ type: 'error', message: 'Failed to load activity log.' });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [student?.id, activeDateObj, timeFrame]);

  const { processedTc } = useMemo(() => {
  const rawMap = new Map();
  tcDataRaw.forEach(r => { if (r.tc_observation_id) rawMap.set(String(r.tc_observation_id), r); });

  const pTc = [];
  const pMap = new Map();

  tcData.forEach(tc => {
    const id = tc.tc_observation_id || tc.id;
    if (pMap.has(id)) return;

    const raw = rawMap.get(String(id)) || {};
    const cleanedNote = cleanObservationNote(student, tc, raw);
    const actName = extractLessonName({
      html_content: raw.html_content,
      text_content: raw.text_content,
      activity_name: tc.activity_name
    });
    const bucket = tc.bucket || inferTcBucket(tc.note || raw.text_content);
    const names = splitActivityNames(actName, tc.activity_name || 'Activity');

    names.forEach((name, index) => {
      const entryKey = `${id}-${index}-${name}`;
      const item = {
        ...tc,
        id: entryKey,
        _entry_key: entryKey,
        tc_observation_id: id,
        activity_name: name,
        cleanedNote,
        bucket,
        _raw_html: raw.html_content || '',
      };

      pTc.push(item);
    });

    pMap.set(id, true);
  });

  return { processedTc: pTc };
}, [tcData, tcDataRaw, student]);

  const uniqueAreas = useMemo(
  () => [...new Set(processedTc.map(t => t.area_name).filter(Boolean))].sort(),
  [processedTc]
);

const uniqueCategories = useMemo(
  () => [...new Set(
      processedTc
        .filter(t => filterArea === 'ALL' || t.area_name === filterArea)
        .map(t => t.category_name)
        .filter(Boolean)
    )].sort(),
  [processedTc, filterArea]
);

  const filteredTc = processedTc.filter(tc => {
    if (filterArea !== 'ALL' && tc.area_name !== filterArea) return false;
    if (filterCategory !== 'ALL' && tc.category_name !== filterCategory) return false;
    if (filterStatus !== 'ALL') {
        const b = tc.bucket || 'INTRODUCED';
        if (filterStatus === 'I' && b !== 'INTRODUCED') return false;
        if (filterStatus === 'P' && b !== 'PRACTICED') return false;
        if (filterStatus === 'N' && b !== 'REWORK' && !String(tc.note).toLowerCase().includes('need')) return false;
    }
    return true;
  });

  const filteredList = filteredTc;

const KanbanColumn = ({ title, color, count, items }) => {
  const grouped = useMemo(() => {
    return items.reduce((acc, item) => {
      const area = item.area_name || 'General';
      const cat = item.category_name || 'General';
      if (!acc[area]) acc[area] = {};
      if (!acc[area][cat]) acc[area][cat] = [];
      acc[area][cat].push(item);
      return acc;
    }, {});
  }, [items]);

  const [expandedAreas, setExpandedAreas] = useState({});

  // ✅ Expand all areas by default (but don't fight the user after they toggle)
  useEffect(() => {
    const areaNames = Object.keys(grouped || {});
    if (areaNames.length === 0) return;

    setExpandedAreas(prev => {
      // If user already has any keys set, keep them (don’t override)
      const hasAnyUserChoice = prev && Object.keys(prev).length > 0;
      if (hasAnyUserChoice) return prev;

      // Otherwise expand all by default
      const next = {};
      areaNames.forEach(a => { next[a] = true; });
      return next;
    });
  }, [grouped]);

  const toggleArea = (areaName) =>
    setExpandedAreas(prev => ({ ...prev, [areaName]: !prev[areaName] }));

  return (
    <div style={{ background: '#F8FAFC', borderRadius: SQUARE_RADIUS, border: `1px solid ${UI.border}`, borderTop: `4px solid ${color}`, overflow: 'hidden', minWidth: 320, flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${UI.border}`, background: '#FFFFFF' }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: UI.primary, letterSpacing: 0.5 }}>{title}</div>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#fff', background: color, padding: '2px 8px', borderRadius: SQUARE_RADIUS }}>{count}</div>
      </div>

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 20, maxHeight: 'calc(100vh - 360px)', overflowY: 'auto' }}>
        {items.length === 0 && <div style={{ textAlign: 'center', color: UI.muted, fontSize: 13, padding: 20 }}>Empty</div>}

        {Object.entries(grouped).sort((a, b) => a[0].localeCompare(b[0])).map(([areaName, cats]) => {
          const subjStyle = getSubjectStyle(areaName);
          const isExpanded = expandedAreas[areaName] !== false; // default true unless explicitly set false

          return (
            <div key={areaName} style={{ display: 'flex', flexDirection: 'column', gap: isExpanded ? 12 : 0 }}>
              <div
                onClick={() => toggleArea(areaName)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  borderBottom: isExpanded ? `2px solid ${rgba(subjStyle.accent, 0.3)}` : `1px solid ${UI.border}`,
                  paddingBottom: 6, cursor: 'pointer', userSelect: 'none'
                }}
              >
                {isExpanded ? <ChevronDown size={14} color={UI.primary} /> : <ChevronRight size={14} color={UI.primary} />}
                <div style={{ width: 10, height: 10, background: subjStyle.accent, borderRadius: 2 }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: UI.primary, textTransform: 'uppercase', letterSpacing: 0.5 }}>{areaName}</span>
              </div>

              {isExpanded && Object.entries(cats).sort((a, b) => a[0].localeCompare(b[0])).map(([catName, areaItems]) => (
                <div key={catName} style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                  {catName !== 'General' && (<div style={{ fontSize: 11, fontWeight: 600, color: UI.muted, paddingLeft: 22 }}>{catName}</div>)}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 12 }}>
                    {areaItems.map(item => (
                      <div key={item._entry_key || item.id} style={{ background: '#fff', borderRadius: SQUARE_RADIUS, border: `1px solid ${UI.border}`, borderLeft: `3px solid ${subjStyle.accent}`, padding: '12px', display: 'flex', flexDirection: 'column', gap: 6, boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: UI.text, lineHeight: 1.3 }}>{item.activity_name || 'Activity'}</div>
<div style={{ fontSize: 10, color: UI.muted, fontWeight: 600, whiteSpace: 'nowrap' }}>
  {formatShortDate(getObsDate(item))}
</div>                        </div>
                        {item.cleanedNote && (
                          <div style={{ fontSize: 11, color: UI.muted, lineHeight: 1.4, fontStyle: 'italic', borderTop: `1px dashed ${UI.border}`, paddingTop: 6, marginTop: 2 }}>
                            "{item.cleanedNote}"
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
};

  const handleAddObservation = async (payload) => {
    try { 
      const { data, error } = await supabase.from('coordination_observations').insert([{ student_id: student.id, type: payload.type, observation: payload.observation, date: payload.date || null }]).select(); 
      if (error) throw error; 
      if (data?.length) setManualObservations(prev => [data[0], ...prev]); 
      showToast?.({ type: 'success', message: 'Observation added.' }); 
    } catch (err) { showToast?.({ type: 'error', message: err.message || 'Failed to add observation' }); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingTop: 10 }}>
      <AddObservationModal open={obsModalOpen} onClose={() => setObsModalOpen(false)} onSubmit={handleAddObservation} />
      
      {/* Top Filter & View Controls */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', background: '#fff', padding: '16px 20px', border: `1px solid ${UI.border}`, borderRadius: SQUARE_RADIUS }}>
        
        <div style={{ display: 'flex', background: '#f8fafc', padding: 4, borderRadius: SQUARE_RADIUS, border: `1px solid ${UI.border}` }}>
          <ViewToggle active={viewMode === 'BOARD'} icon={LayoutGrid} label="Board View" onClick={() => setViewMode('BOARD')} />
          <ViewToggle active={viewMode === 'LIST'} icon={List} label="List View" onClick={() => setViewMode('LIST')} />
        </div>

        <div style={{ width: 1, height: 24, background: UI.border, margin: '0 8px' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: UI.muted, fontSize: 13, fontWeight: 600 }}>
            <Filter size={14}/> Filters:
        </div>
        
        <Field as="select" value={filterArea} onChange={e => { setFilterArea(e.target.value); setFilterCategory('ALL'); }} style={{ width: 160, height: 36, fontSize: 12 }}>
          <option value="ALL">All Areas</option>
          {uniqueAreas.map(a => <option key={a} value={a}>{a}</option>)}
        </Field>
        
        <Field as="select" value={filterCategory} onChange={e => setFilterCategory(e.target.value)} style={{ width: 160, height: 36, fontSize: 12 }}>
          <option value="ALL">All Categories</option>
          {uniqueCategories.map(c => <option key={c} value={c}>{c}</option>)}
        </Field>

        <Field as="select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ width: 160, height: 36, fontSize: 12 }}>
          <option value="ALL">All Statuses</option>
          <option value="I">Introduced</option>
          <option value="P">Practiced</option>
          <option value="N">Needs Review</option>
        </Field>

        <div style={{ marginLeft: 'auto' }}>
            <Button variant="solid" onClick={() => setObsModalOpen(true)} style={{ height: 36, fontSize: 12 }}><Plus size={14} /> Add Observation</Button>
        </div>
      </div>

      {/* Conditional Rendering of Views */}
      {viewMode === 'BOARD' ? (
        <div style={{ display: 'flex', gap: 20, overflowX: 'auto', paddingBottom: 10 }}>
          <KanbanColumn title="Introduced" color="#1E88E5" count={filteredTc.filter(t => t.bucket === 'INTRODUCED').length} items={filteredTc.filter(t => t.bucket === 'INTRODUCED')} />
          <KanbanColumn title="Practiced" color="#F5B041" count={filteredTc.filter(t => t.bucket === 'PRACTICED').length} items={filteredTc.filter(t => t.bucket === 'PRACTICED')} />
          <KanbanColumn title="Needs Review" color="#E53935" count={filteredTc.filter(t => t.bucket === 'REWORK' || String(t.note).toLowerCase().includes('need')).length} items={filteredTc.filter(t => t.bucket === 'REWORK' || String(t.note).toLowerCase().includes('need'))} />
        </div>
      ) : (
        <ThemedCard style={{ padding: 0, overflow: 'hidden' }}>
          {filteredList.length === 0 ? (<div style={{ padding: '40px', fontSize: 13, color: UI.muted, fontStyle: 'italic', textAlign: 'center' }}>No activity logs found for this timeframe/filter.</div>) : (
            <div style={{ display: 'grid' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '85px 120px 130px 100px 140px 1fr', gap: 16, padding: '10px 24px', background: '#f8fafc', borderBottom: `1px solid ${UI.border}`, fontSize: 11, fontWeight: 700, color: UI.muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  <div>Date</div><div>Area</div><div>Category</div><div>Status</div><div>With</div><div>Observation Details</div>
              </div>
              {filteredList.map((o) => {
  const peersList = extractPeersFromHtml(o._raw_html, student?.first_name);

  return (
    <div
      key={String(o._entry_key || o.tc_observation_id || o.id)}
      style={{
        display: 'grid',
        gridTemplateColumns: '85px 120px 130px 100px 140px 1fr',
        gap: 16,
        alignItems: 'flex-start',
        background: '#fff',
        padding: '16px 24px',
        borderBottom: `1px solid ${UI.border}`
      }}
    >
      {/* DATE = observation_date */}
      <div style={{ fontSize: 12, color: UI.muted, fontWeight: 500 }}>
        {safeDate(o.observation_date)}
      </div>

      {/* AREA/CATEGORY from TC */}
      <div style={{ fontSize: 12, fontWeight: 600, color: UI.primary, textTransform: 'uppercase' }}>
        {o.area_name || '—'}
      </div>

      <div style={{ fontSize: 12, color: UI.text }}>
        {o.category_name || '—'}
      </div>

      {/* STATUS from bucket */}
      <div>
        <StatusBadge status={bucketToLabel(o.bucket)} />
      </div>

      {/* WITH from HTML */}
      <div style={{ fontSize: 11, color: UI.muted, lineHeight: 1.4 }}>
        {peersList.length > 0 ? peersList.join(', ') : ''}
      </div>

      {/* DETAILS from activity_name + cleanedNote */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {o.activity_name && (
          <div style={{ fontSize: 13, fontWeight: 600, color: UI.text }}>
            {o.activity_name}
          </div>
        )}

        <div style={{ fontSize: 13, color: UI.text, lineHeight: '1.5' }}>
          {o.cleanedNote ? (
            o.cleanedNote
          ) : (
            <span style={{ color: UI.muted, fontStyle: 'italic' }}></span>
          )}
        </div>
      </div>
    </div>
  );
})}
            </div>
          )}
        </ThemedCard>
      )}
    </div>
  );
};

/** ---------------------------
 * TAB 3: CURRICULUM MATRIX (Tree View)
 * --------------------------- */
const TreeItem = ({ label, level = 0, children, status, date, globalExpanded }) => {
  const [isExpanded, setIsExpanded] = useState(level === 0);
  const hasChildren = React.Children.count(children) > 0;

  useEffect(() => {
    if (globalExpanded !== null) setIsExpanded(globalExpanded);
  }, [globalExpanded]);

  return (
    <div style={{ marginLeft: level > 0 ? 20 : 0 }}>
      <div 
        onClick={() => hasChildren && setIsExpanded(!isExpanded)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 12px', cursor: hasChildren ? 'pointer' : 'default',
          borderRadius: 4, transition: 'background 0.2s', backgroundColor: level === 0 && isExpanded ? rgba(UI.primary, 0.03) : 'transparent',
          borderBottom: level === 0 ? `1px solid ${UI.border}` : 'none'
        }}
        onMouseEnter={(e) => hasChildren && (e.currentTarget.style.backgroundColor = rgba(UI.primary, 0.05))}
        onMouseLeave={(e) => hasChildren && (e.currentTarget.style.backgroundColor = level === 0 && isExpanded ? rgba(UI.primary, 0.03) : 'transparent')}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 20, display: 'flex', justifyContent: 'center' }}>
            {hasChildren ? (isExpanded ? <ChevronDown size={14} color={UI.muted} /> : <ChevronRight size={14} color={UI.muted} />) : (<div style={{ width: 4, height: 4, borderRadius: '50%', background: UI.border }} />)}
          </div>
          {!hasChildren && status && <ProgressMarker status={status} />}
          <span style={{ fontSize: level === 0 ? 14 : 13, fontWeight: level === 0 ? 700 : (hasChildren ? 600 : 400), color: level === 0 ? UI.primary : UI.text, textTransform: level === 0 ? 'uppercase' : 'none' }}>
            {label}
          </span>
        </div>
        
        {/* Render Date for items without children */}
        {!hasChildren && date && (
          <span style={{ fontSize: 11, color: UI.muted, fontWeight: 500 }}>
            {formatShortDate(date)}
          </span>
        )}
      </div>
      {isExpanded && hasChildren && (<div style={{ borderLeft: `1px solid ${UI.border}`, marginLeft: 21, marginTop: 2, marginBottom: 8 }}>{children}</div>)}
    </div>
  );
};

const ProgressMatrix = ({ student, showToast }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [search, setSearch] = useState('');
  const [filterArea, setFilterArea] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL'); 
  const [globalExpanded, setGlobalExpanded] = useState(null); 

  useEffect(() => {
    const fetchFullHistory = async () => {
      if (!student?.tc_id) return;
      setLoading(true);
      try {
        const [resEnriched, resRaw] = await Promise.all([
          supabase.from('vw_tc_observations_enriched').select('*').eq('child_tc_id', student.tc_id).order('observation_date', { ascending: true }),
          supabase.from('vw_tc_observations_expanded').select('tc_observation_id, html_content, text_content').eq('child_tc_id', student.tc_id)
        ]);
        if (resEnriched.error) throw resEnriched.error;
        if (resRaw.error) throw resRaw.error;

        const rawMap = new Map();
        (resRaw.data || []).forEach(r => { if (r.tc_observation_id) rawMap.set(String(r.tc_observation_id), r); });

        const processed = [];
        (resEnriched.data || []).forEach(tc => {
          const id = tc.tc_observation_id || tc.id;
          const raw = rawMap.get(String(id)) || {};
          const actName = extractLessonName({ html_content: raw.html_content, text_content: raw.text_content, activity_name: tc.activity_name });
          
          const names = actName ? actName.split('•').map(s => s.trim()).filter(Boolean) : [tc.activity_name || 'Activity'];
          names.forEach(name => {
            processed.push({ ...tc, activity_name: name, bucket: tc.bucket || inferTcBucket(tc.note || raw.text_content) });
          });
        });
        setData(processed);
      } catch (err) {
        console.error(err);
        showToast?.({ type: 'error', message: 'Failed to load historical progress.' });
      } finally {
        setLoading(false);
      }
    };
    fetchFullHistory();
  }, [student?.tc_id, showToast]);

  const uniqueAreas = useMemo(() => [...new Set(data.map(d => d.area_name).filter(Boolean))].sort(), [data]);

  const filteredTreeData = useMemo(() => {
    const latestStatusMap = {};
    data.forEach(item => {
      const area = item.area_name || 'General';
      const cat = item.category_name || 'General';
      const lesson = item.activity_name || 'Activity';
      if (!latestStatusMap[area]) latestStatusMap[area] = {};
      if (!latestStatusMap[area][cat]) latestStatusMap[area][cat] = {};
      
      // Store object with date alongside status
      latestStatusMap[area][cat][lesson] = {
          status: item.bucket || 'INTRODUCED',
          date: item.observation_date || item.date
      };
    });

    const root = {};
    const q = search.toLowerCase().trim();

    Object.entries(latestStatusMap).forEach(([area, cats]) => {
      Object.entries(cats).forEach(([cat, lessons]) => {
        Object.entries(lessons).forEach(([lesson, dataObj]) => {
          const matchesSearch = lesson.toLowerCase().includes(q) || cat.toLowerCase().includes(q) || area.toLowerCase().includes(q);
          const matchesArea = filterArea === 'ALL' || area === filterArea;
          const matchesStatus = filterStatus === 'ALL' || dataObj.status === filterStatus;
          
          if (matchesSearch && matchesArea && matchesStatus) {
            if (!root[area]) root[area] = {};
            if (!root[area][cat]) root[area][cat] = {};
            root[area][cat][lesson] = dataObj; // Assign the object
          }
        });
      });
    });

    return root;
  }, [data, search, filterArea, filterStatus]);

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: UI.muted }}>Loading...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingTop: 10 }}>
      <ThemedCard style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 250 }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: UI.muted }} />
            <Field value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter lessons or categories..." style={{ paddingLeft: 36, height: 38 }} />
          </div>
          <Field as="select" value={filterArea} onChange={e => setFilterArea(e.target.value)} style={{ width: 160 }}>
            <option value="ALL">All Areas</option>{uniqueAreas.map(a => <option key={a} value={a}>{a}</option>)}
          </Field>
          
          {/* Status Pills */}
          <div style={{ display: 'flex', gap: 6, background: '#f8fafc', padding: 4, borderRadius: 8, border: `1px solid ${UI.border}` }}>
            {[
              { id: 'ALL', label: 'All Statuses' },
              { id: 'INTRODUCED', label: 'Introduced' },
              { id: 'PRACTICED', label: 'Practiced' },
              { id: 'MASTERED', label: 'Mastered' },
              { id: 'REWORK', label: 'Needs Review' }
            ].map(s => (
              <button
                key={s.id}
                onClick={() => setFilterStatus(s.id)}
                style={{
                  padding: '6px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  border: 'none', transition: 'all 0.15s',
                  background: filterStatus === s.id ? UI.primary : 'transparent',
                  color: filterStatus === s.id ? '#fff' : UI.muted
                }}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div style={{ borderLeft: `1px solid ${UI.border}`, height: 24, margin: '0 8px' }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="ghost" onClick={() => setGlobalExpanded(true)} style={{ height: 32, fontSize: 11 }}>Expand All</Button>
            <Button variant="ghost" onClick={() => setGlobalExpanded(false)} style={{ height: 32, fontSize: 11 }}>Collapse All</Button>
          </div>
        </div>
      </ThemedCard>

      <div style={{ display: 'flex', gap: 16, padding: '0 8px', flexWrap: 'wrap' }}>
        {['INTRODUCED', 'PRACTICED', 'MASTERED', 'REWORK'].map(s => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: UI.muted, fontWeight: 600 }}>
            <ProgressMarker status={s} /> {s === 'REWORK' ? 'NEEDS REVIEW' : s}
          </div>
        ))}
      </div>

      <ThemedCard style={{ padding: '12px 0' }}>
        {Object.entries(filteredTreeData).length === 0 ? (<div style={{ padding: 40, textAlign: 'center', color: UI.muted, fontSize: 13, fontStyle: 'italic' }}>No lessons match your current filters.</div>) : (
          Object.entries(filteredTreeData).map(([area, categories]) => (
            <TreeItem key={area} label={area} level={0} globalExpanded={globalExpanded}>
              {Object.entries(categories).map(([cat, lessons]) => (
                <TreeItem key={cat} label={cat} level={1} globalExpanded={globalExpanded}>
                  {Object.entries(lessons).map(([lesson, statusObj]) => (
                    <TreeItem key={lesson} label={lesson} level={2} status={statusObj.status} date={statusObj.date} globalExpanded={globalExpanded} />
                  ))}
                </TreeItem>
              ))}
            </TreeItem>
          ))
        )}
      </ThemedCard>
    </div>
  );
};

/** ---------------------------
 * TAB 4: ASSESSMENTS 
 * --------------------------- */
const isSpecialToken = (v) => ['x', 'na', 'n/a', 'absent'].includes(String(v ?? '').trim().toLowerCase());
const normalizeScore = (raw) => { if (!raw || isSpecialToken(raw)) return null; const n = parseFloat(String(raw).replace(/%/g, '').trim()); return Number.isFinite(n) ? n : null; };
const formatScoreDisplay = (raw) => { if (!raw) return '-'; const s = String(raw).trim(); if (isSpecialToken(s) || s.toUpperCase() === 'X') return 'X'; const n = normalizeScore(raw); return n === null ? '-' : String(Number.isInteger(n) ? n : Math.round(n)); };
const getScoreStyle = (raw) => { const s = String(raw ?? '').trim(); if (s && (isSpecialToken(s) || s.toUpperCase() === 'X')) return { color: UI.muted, fontWeight: 500, fontStyle: 'italic' }; const v = normalizeScore(raw); if (v === null) return { color: UI.muted }; if (v >= 80) return { color: '#2E7D32', fontWeight: 600 }; if (v >= 50) return { color: '#F57F17', fontWeight: 600 }; return { color: '#D32F2F', fontWeight: 600 }; };

const ScoreCell = ({ scoreRec }) => {
  const raw = scoreRec?.score_raw;
  const hasValue = raw !== null && raw !== undefined && String(raw).trim() !== '';
  return (
    <div style={{ padding: '12px 8px', height: '100%', minHeight: 64, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: hasValue ? 'flex-start' : 'center', background: '#fff', borderRight: `1px solid ${UI.border}` }}>
      {hasValue ? (<><div style={{ fontSize: 16, marginBottom: 2, ...getScoreStyle(raw) }}>{formatScoreDisplay(raw)}</div>{scoreRec?.comment && <div style={{ background: '#FFF9C4', border: `1px solid #FBC02D`, color: '#333', fontSize: 11, lineHeight: 1.3, padding: '4px 8px', marginTop: 4, width: 'fit-content', maxWidth: 140, minWidth: 40, borderRadius: SQUARE_RADIUS, textAlign: 'center' }}>{scoreRec.comment}</div>}</>) : <div style={{ color: UI.border, fontSize: 20 }}>-</div>}
    </div>
  );
};

const InsightsPanel = ({ areas = [] }) => {
  const analyzed = useMemo(() => {
    const mastered = []; const progressing = []; let lowestSkill = null; let lowestScore = 101;
    (areas || []).forEach((area) => {
      if (area.overallAverage !== null) { if (area.overallAverage >= 80) mastered.push(area.name); else progressing.push(area.name); }
      (area.groups || []).forEach((grp) => { if (grp.rowAverage !== null && grp.rowAverage < 60 && grp.rowAverage < lowestScore) { lowestScore = grp.rowAverage; lowestSkill = grp.name; } });
    });
    return { mastered, progressing, lowestSkill };
  }, [areas]);
  if (!analyzed.mastered.length && !analyzed.progressing.length) return null;
  return (
    <div style={{ marginBottom: 24, padding: 20, background: '#fff', borderRadius: SQUARE_RADIUS, border: `1px solid ${UI.border}`, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 20 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#2E7D32', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}><CheckCircle size={14} /> Mastery Observed</div><div style={{ fontSize: 13, color: UI.text }}>{analyzed.mastered.length > 0 ? analyzed.mastered.join(', ') : 'Working towards mastery.'}</div></div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#F57F17', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}><Clock size={14} /> Currently Practicing</div><div style={{ fontSize: 13, color: UI.text }}>{analyzed.progressing.length > 0 ? analyzed.progressing.join(', ') : 'Consistent performance.'}</div></div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderLeft: `1px solid ${UI.border}`, paddingLeft: 20 }}><div style={{ display: 'flex', alignItems: 'center', gap: 8, color: UI.primary, fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}><Star size={14} /> Recommended Focus</div><div style={{ fontSize: 13, color: UI.text }}>{analyzed.lowestSkill ? <>Consider re-presenting: <strong>{analyzed.lowestSkill}</strong>.</> : 'Continue progression.'}</div></div>
    </div>
  );
};

const AssessmentPanel = ({ profile, student, classroomId, showToast }) => {
  const [loading, setLoading] = useState(false); const [templates, setTemplates] = useState([]); const [assessmentMap, setAssessmentMap] = useState({}); const [skills, setSkills] = useState([]); const [domains, setDomains] = useState([]); const [areas, setAreas] = useState([]); const [allScores, setAllScores] = useState([]); const [filterArea, setFilterArea] = useState('ALL'); const [filterTemplate, setFilterTemplate] = useState('ALL'); const [expandedAreas, setExpandedAreas] = useState({});

  const refresh = async () => {
    if (!student?.id) return;
    setLoading(true);
    try {
      const { data: tmplData } = await supabase.from('assessment_templates').select('*').order('default_date', { ascending: true });
      const relevantTemplates = (tmplData || []).filter((t) => (t.classroom_ids || []).map(String).includes(String(classroomId || student.classroom_id)));
      setTemplates(relevantTemplates);
      const { data: assessData } = await supabase.from('student_assessments').select('*').eq('student_id', student.id);
      const aMap = {}; (assessData || []).forEach((a) => { if (a.template_id) aMap[a.template_id] = a; }); setAssessmentMap(aMap);
      const { data: domainData } = await supabase.from('assessment_domains').select('*'); setDomains(domainData || []);
      const { data: skillData } = await supabase.from('assessment_skills').select('id, name, area_id, domain_id, sort_order').order('sort_order'); setSkills(skillData || []);
      const { data: areaData } = await supabase.from('curriculum_areas').select('id, name').order('name'); setAreas(areaData || []);
      if (assessData?.length > 0) {
        const { data: scoreData } = await supabase.from('student_assessment_scores').select('id, assessment_id, skill_id, score_raw, comment, created_at, classroom_id').in('assessment_id', assessData.map(a => a.id)); setAllScores(scoreData || []);
      } else setAllScores([]);
    } catch (e) { showToast?.({ type: 'error', message: 'Failed to load data.' }); } finally { setLoading(false); }
  };
  useEffect(() => { refresh(); }, [student?.id, classroomId]);

  const scoreIndex = useMemo(() => {
    const m = new Map();
    const newer = (a, b) => { const ta = a?.created_at ? new Date(a.created_at).getTime() : 0; const tb = b?.created_at ? new Date(b.created_at).getTime() : 0; return ta !== tb ? ta > tb : Number(a?.id || 0) > Number(b?.id || 0); };
    for (const s of allScores || []) { const key = `${String(s.assessment_id)}|${String(s.skill_id)}`; const cur = m.get(key); if (!cur || newer(s, cur)) m.set(key, s); }
    return m;
  }, [allScores]);

  const skillTemplateMap = useMemo(() => { const map = {}; const domById = new Map((domains || []).map((d) => [String(d.id), d])); (skills || []).forEach((s) => { const dom = domById.get(String(s.domain_id)); if (dom) map[s.id] = dom.template_id; }); return map; }, [skills, domains]);
  const visibleTemplates = useMemo(() => filterTemplate === 'ALL' ? templates : templates.filter((t) => String(t.id) === String(filterTemplate)), [templates, filterTemplate]);

  const processedData = useMemo(() => {
    if (!visibleTemplates.length || !skills.length) return { areas: [] };
    const areaById = new Map((areas || []).map((a) => [String(a.id), a]));
    const visibleTemplateIds = new Set(visibleTemplates.map((t) => String(t.id)));
    const bucket = new Map();
    const ensureArea = (areaId) => { const key = String(areaId); if (!bucket.has(key)) bucket.set(key, { id: key, name: areaById.get(key)?.name || 'General', groupsMap: new Map() }); return bucket.get(key); };
    for (const sk of skills) {
      const tId = String(skillTemplateMap[sk.id] ?? ''); if (!tId || !visibleTemplateIds.has(tId)) continue;
      const areaId = sk.area_id ? String(sk.area_id) : 'uncategorized'; const areaObj = ensureArea(areaId); const gKey = `${areaId}::${normKey(sk.name)}`;
      if (!areaObj.groupsMap.has(gKey)) areaObj.groupsMap.set(gKey, { key: gKey, name: String(sk.name || '').trim() || 'Untitled Skill', areaId, sortOrder: Number.isFinite(sk.sort_order) ? sk.sort_order : 999999, skillIdsByTemplate: {}, cells: {}, rowAverage: null, delta: null });
      const grp = areaObj.groupsMap.get(gKey); grp.sortOrder = Math.min(grp.sortOrder, Number.isFinite(sk.sort_order) ? sk.sort_order : 999999);
      if (!grp.skillIdsByTemplate[tId]) grp.skillIdsByTemplate[tId] = []; grp.skillIdsByTemplate[tId].push(String(sk.id));
    }
    const pickBestRecord = (assessmentId, skillIds) => {
      if (!assessmentId || !skillIds?.length) return null;
      let best = null;
      const rankOf = (rec) => { if (!rec) return 0; const s = String(rec.score_raw ?? '').trim(); if (normalizeScore(rec.score_raw) !== null) return 4; if (s && (s.toUpperCase() === 'X' || isSpecialToken(s))) return 3; if (rec.comment) return 2; return 1; };
      const newer = (a, b) => { const ta = a?.created_at ? new Date(a.created_at).getTime() : 0; const tb = b?.created_at ? new Date(b.created_at).getTime() : 0; return ta !== tb ? ta > tb : Number(a?.id || 0) > Number(b?.id || 0); };
      for (const sid of skillIds) { const rec = scoreIndex.get(`${String(assessmentId)}|${String(sid)}`); if (!rec) continue; const r = rankOf(rec); if (!best || r > best.rank || (r === best.rank && newer(rec, best.rec))) best = { rec, rank: r }; }
      return best?.rec || null;
    };
    let areaList = Array.from(bucket.values()).map((a) => {
      const groups = Array.from(a.groupsMap.values()).filter((grp) => { let hasData = false; visibleTemplates.forEach((tmpl) => { const ass = assessmentMap[tmpl.id]; const bestRec = ass ? pickBestRecord(ass.id, grp.skillIdsByTemplate[String(tmpl.id)] || []) : null; if (bestRec && (bestRec.score_raw || bestRec.comment)) hasData = true; }); return hasData; }).sort((x, y) => x.sortOrder - y.sortOrder);
      return { id: a.id, name: a.name, groups };
    }).filter((a) => a.groups.length > 0);
    if (filterArea !== 'ALL') areaList = areaList.filter((a) => String(a.id) === String(filterArea));
    for (const area of areaList) {
      let areaAvgSum = 0; let areaAvgCnt = 0; area.averages = {}; area.overallAverage = null;
      for (const grp of area.groups) {
        let sum = 0; let cnt = 0;
        visibleTemplates.forEach((tmpl) => {
          const tId = String(tmpl.id); const ass = assessmentMap[tmpl.id]; const bestRec = ass ? pickBestRecord(ass.id, grp.skillIdsByTemplate[tId] || []) : null; const numVal = bestRec ? normalizeScore(bestRec.score_raw) : null;
          if (numVal !== null) { sum += numVal; cnt += 1; } grp.cells[tId] = { templateId: tId, assessmentId: ass?.id || null, record: bestRec, numVal };
        });
        grp.rowAverage = cnt > 0 ? Math.round(sum / cnt) : null;
        if (visibleTemplates.length >= 2) { const a0 = grp.cells[String(visibleTemplates[0].id)]?.numVal ?? null; const b0 = grp.cells[String(visibleTemplates[visibleTemplates.length - 1].id)]?.numVal ?? null; grp.delta = a0 !== null && b0 !== null ? Math.round(b0 - a0) : null; } else grp.delta = null;
      }
      visibleTemplates.forEach((tmpl) => {
        const tId = String(tmpl.id); let ts = 0; let tc = 0;
        area.groups.forEach((grp) => { const v = grp.cells[tId]?.numVal ?? null; if (v !== null) { ts += v; tc += 1; } });
        if (tc > 0) { const avg = Math.round(ts / tc); area.averages[tId] = avg; areaAvgSum += avg; areaAvgCnt += 1; } else area.averages[tId] = null;
      });
      area.overallAverage = areaAvgCnt > 0 ? Math.round(areaAvgSum / areaAvgCnt) : null;
    }
    return { areas: areaList };
  }, [visibleTemplates, skills, areas, filterArea, skillTemplateMap, assessmentMap, scoreIndex]);

  return (
    <div style={{ fontFamily: THEME.sansFont, color: UI.text, paddingTop: 10 }}>
      <ThemedCard style={{ padding: '16px 20px', marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <h1 style={{ fontFamily: THEME.serifFont, fontSize: 20, margin: 0, color: UI.primary }}>Progress Report</h1>
          <div style={{ display: 'flex', gap: 12 }}>
            <Field as="select" value={filterArea} onChange={(e) => setFilterArea(e.target.value)} style={{ width: 160, height: '38px', padding: '8px 12px' }}><option value="ALL">All Areas</option>{areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Field>
            <Field as="select" value={filterTemplate} onChange={(e) => setFilterTemplate(e.target.value)} style={{ width: 180, height: '38px', padding: '8px 12px' }}><option value="ALL">All Assessments</option>{templates.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}</Field>
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
                {visibleTemplates.map((tmpl) => <th key={tmpl.id} style={{ padding: 12, minWidth: 140, textAlign: 'center', borderLeft: `1px solid ${UI.border}` }}><div style={{ fontWeight: 600, color: UI.text, fontSize: 13 }}>{tmpl.title}</div><div style={{ fontSize: 10, fontWeight: 500, color: UI.muted, marginTop: 4 }}>{tmpl.default_date || 'No Date'}</div></th>)}
                <th style={{ padding: 12, minWidth: 100, textAlign: 'center', background: '#fafafa', borderLeft: `1px solid ${UI.border}` }}><div style={{ fontWeight: 600, color: UI.text, fontSize: 10 }}>AVG</div></th>
              </tr>
            </thead>
            <tbody>
              {processedData.areas.map((area) => {
                const isExpanded = !!expandedAreas[area.id];
                return (
                  <React.Fragment key={area.id}>
                    <tr onClick={() => setExpandedAreas((prev) => ({ ...prev, [area.id]: !prev[area.id] }))} style={{ background: '#fcfcfc', cursor: 'pointer', borderBottom: `1px solid ${UI.border}` }}>
                      <td style={{ padding: '12px 20px', fontWeight: 600, color: UI.primary, fontSize: 12, display: 'flex', alignItems: 'center', gap: 10 }}>{isExpanded ? <ChevronRight size={14} style={{ transform: 'rotate(90deg)' }} /> : <ChevronRight size={14} />} {String(area.name || 'GENERAL').toUpperCase()}</td>
                      {visibleTemplates.map((tmpl) => <td key={tmpl.id} style={{ textAlign: 'center', fontSize: 13, borderLeft: `1px solid ${UI.border}` }}><div style={getScoreStyle(area.averages?.[String(tmpl.id)] ?? null)}>{formatScoreDisplay(area.averages?.[String(tmpl.id)] ?? null)}</div></td>)}
                      <td style={{ textAlign: 'center', fontWeight: 600, color: UI.text, background: '#fafafa', borderLeft: `1px solid ${UI.border}` }}>{formatScoreDisplay(area.overallAverage)}</td>
                    </tr>
                    {isExpanded && area.groups.map((grp) => (
                      <tr key={grp.key} style={{ borderBottom: `1px solid ${UI.border}` }}>
                        <td style={{ padding: '12px 20px', color: UI.muted, verticalAlign: 'middle', fontWeight: 500, paddingLeft: 46 }}>{grp.name}</td>
                        {visibleTemplates.map((tmpl) => <td key={`${tmpl.id}-${grp.key}`} style={{ padding: 0, verticalAlign: 'top', borderLeft: `1px solid ${UI.border}` }}><ScoreCell scoreRec={grp.cells[String(tmpl.id)]?.record || null} /></td>)}
                        <td style={{ textAlign: 'center', background: '#fafafa', borderLeft: `1px solid ${UI.border}`, fontWeight: 600, padding: '0 10px' }}><div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 64 }}><div style={{ ...getScoreStyle(grp.rowAverage), fontSize: 13 }}>{formatScoreDisplay(grp.rowAverage)}</div>{grp.delta !== null && (<div style={{ marginTop: 4, fontSize: 10, fontWeight: 600, color: grp.delta >= 0 ? '#2E7D32' : '#D32F2F' }}>{grp.delta >= 0 ? `+${grp.delta}` : `${grp.delta}`}</div>)}</div></td>
                      </tr>
                    ))}
                  </React.Fragment>
                );
              })}
              {processedData.areas.length === 0 && (<tr><td colSpan={10} style={{ padding: 40, textAlign: 'center', color: UI.muted, fontSize: 13 }}>{loading ? 'Loading...' : 'No data found for this filter.'}</td></tr>)}
            </tbody>
          </table>
        </div>
      </ThemedCard>
    </div>
  );
};

/** ---------------------------
 * STUDENT SELECTION UI
 * --------------------------- */
const HexAvatar = ({ letter, size = 66, fontSize = 22 }) => (
  <div style={{ width: size, height: size, background: '#c8ddd7', clipPath: 'polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: UI.primary, fontWeight: 800, fontSize, margin: '0 auto' }}>{letter || '?'}</div>
);

const StudentTile = ({ student, onClick }) => (
  <div onClick={onClick} style={{ background: '#fff', border: `1px solid ${UI.border}`, borderRadius: SQUARE_RADIUS, padding: 24, cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s ease', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }} onMouseEnter={(e) => { e.currentTarget.style.transform = 'translate(-1px, -1px)'; e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.05)'; e.currentTarget.style.borderColor = UI.primary; }} onMouseLeave={(e) => { e.currentTarget.style.transform = 'translate(0)'; e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.02)'; e.currentTarget.style.borderColor = UI.border; }}>
    <div style={{ marginBottom: 16 }}><HexAvatar letter={(student.first_name || '?')[0]} /></div>
    <div style={{ fontWeight: 600, fontSize: 16, color: UI.primary }}>{student.first_name} {student.last_name}</div>
  </div>
);

/** ---------------------------
 * MAIN PARENT COMPONENT
 * --------------------------- */
const IndividualPlanner = ({ profile, forcedStudentId, students, planItems, masterPlans, planSessions, classrooms, activeDate, setActiveDate, onQuickAdd, onUpdateItem, onMoveItemToDate, onDeleteItem, curriculum, showToast, curriculumAreas, curriculumCategories, onClearTarget }) => {
  const [selectedId, setSelectedId] = useState(forcedStudentId || null);
  const [filterClass, setFilterClass] = useState(classrooms?.[0]?.id);
  const [boardTimeFrame, setBoardTimeFrame] = useState('MONTH');
  
  const [tab, setTab] = useState('DASHBOARD');
  
  const [addOpen, setAddOpen] = useState(false);
  const [searchStudent, setSearchStudent] = useState('');
  const [localStudentPlans, setLocalStudentPlans] = useState([]);
  const [deletedIds, setDeletedIds] = useState(() => new Set());
  const [resolvedIds, setResolvedIds] = useState(new Set());
  const deletedIdsSet = deletedIds;

  const businessISO = getBusinessDayISO();
  const [boardDate, setBoardDate] = useState(toDateObj(activeDate || businessISO));

  const pendingUpdates = useRef(new Set());

  useEffect(() => {
    const fetchPersistentState = async () => {
      const { data } = await supabase.from('resolved_suggestions').select('suggestion_id');
      if (data) setResolvedIds(new Set(data.map(r => r.suggestion_id)));
    };
    fetchPersistentState();
  }, []);

  useEffect(() => { if (forcedStudentId) setSelectedId(forcedStudentId); }, [forcedStudentId]);

  const isParentLocked = !!forcedStudentId;
  const student = useMemo(() => (students || []).find((s) => String(s.id) === String(selectedId)), [students, selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    const fromProps = (planItems || []).filter((p) => String(p.student_id) === String(selectedId)).filter((p) => !deletedIdsSet.has(String(p.id)));
    setLocalStudentPlans((prev) => {
        const idMap = new Map();
        fromProps.forEach(p => {
            if (!pendingUpdates.current.has(String(p.id))) idMap.set(String(p.id), p);
            else { const local = prev.find(x => String(x.id) === String(p.id)); if (local) idMap.set(String(p.id), local); }
        });
        prev.forEach(p => {
           if (String(p.id).startsWith('temp-')) {
               const pKey = normKey(getRawFirstTitle(p));
               if (!fromProps.some(f => normKey(getRawFirstTitle(f)) === pKey)) idMap.set(String(p.id), p);
           }
        });
        return Array.from(idMap.values());
    });
  }, [planItems, selectedId, deletedIdsSet]);

  const buildDateParts = (pd) => {
    const v = iso10(pd); if (!v) return { planning_date: null, year: null, month: null, day: null };
    return { planning_date: v, year: Number(v.slice(0, 4)), month: Number(v.slice(5, 7)), day: Number(v.slice(8, 10)) };
  };

  const updatePlanItemFields = async (id, fields, { toastOnError = true, callParent = true } = {}) => {
    const prev = localStudentPlans;
    setLocalStudentPlans((cur) => cur.map((x) => (String(x.id) === String(id) ? { ...x, ...fields } : x)));
    try {
      if (String(id).startsWith('temp-')) return;
      pendingUpdates.current.add(String(id));
      const cleanFields = { ...fields }; Object.keys(cleanFields).forEach(k => cleanFields[k] === undefined && delete cleanFields[k]);
      const { error } = await supabase.from('plan_items').update(cleanFields).eq('id', id); if (error) throw error;
      if (callParent) await onUpdateItem?.({ id, ...cleanFields });
      setTimeout(() => pendingUpdates.current.delete(String(id)), 3000);
    } catch (e) {
      console.error(e); pendingUpdates.current.delete(String(id)); setLocalStudentPlans(prev);
      if (toastOnError) showToast?.({ type: 'error', message: e?.message || 'Update failed.' });
    }
  };

  const optimisticCreateItem = async (payload) => {
    const tempId = `temp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const pd = iso10(payload.planning_date || payload.date || boardDate) || boardDate;
    const temp = {
      id: tempId, student_id: Number(payload.student_id), classroom_id: student?.classroom_id ?? null, teacher_id: profile?.id ?? null,
      area: payload.area || 'General', activity: payload.activity || null, raw_activity: payload.raw_activity || null, notes: payload.notes || null, status: payload.status || 'I',
      step_progress: 'NOT_STARTED', ...buildDateParts(pd), created_at: new Date().toISOString(), entry_type: payload.entry_type || 'mixed',
      curriculum_area_id: payload.curriculum_area_id ?? null, curriculum_category_id: payload.curriculum_category_id ?? null, curriculum_activity_id: payload.curriculum_activity_id ?? null,
    };
    const prev = localStudentPlans; if (String(payload.student_id) === String(student?.id)) setLocalStudentPlans((cur) => [temp, ...cur]);
    try { await onQuickAdd?.({ ...payload, planning_date: pd }); } catch (e) { setLocalStudentPlans(prev); showToast?.({ type: 'error', message: 'Add failed.' }); throw e; }
  };

  if (!selectedId) {
    const filteredStudents = (students || []).filter((s) => { const q = (searchStudent || '').trim().toLowerCase(); if (q) return `${s.first_name || ''} ${s.last_name || ''}`.toLowerCase().includes(q); return String(s.classroom_id) === String(filterClass); });
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: UI.bg, fontFamily: THEME.sansFont, overflow: 'hidden' }}>
        <style>{`.mb-card:hover { box-shadow: ${THEME.cardShadowHover} !important; transform: translate(-1px, -1px); } .mb-hide-scroll::-webkit-scrollbar { display: none; }`}</style>
        <div style={{ flexShrink: 0, padding: '24px 28px 16px' }}>
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>{(classrooms || []).map((c) => (<ClassTab key={c.id} active={String(filterClass) === String(c.id)} label={c.name} onClick={() => setFilterClass(c.id)} />))}</div>
          <ThemedCard style={{ padding: '20px 24px', border: `1px solid ${UI.border}`, marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', flexWrap: 'wrap', gap: 20 }}>
              <div style={{ position: 'relative', width: '100%', maxWidth: 500 }}><Search size={18} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: UI.muted }} /><Field value={searchStudent} onChange={(e) => setSearchStudent(e.target.value)} placeholder="Search for a student..." style={{ paddingLeft: 46, fontSize: 15, padding: '14px 16px 14px 46px', height: '48px' }} /></div>
            </div>
          </ThemedCard>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 28px 40px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 24 }}>
            {filteredStudents.map((s) => (<StudentTile key={s.id} student={s} onClick={() => { setSelectedId(s.id); setSearchStudent(''); }} />))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', height: 'calc(100vh - clamp(32px, 6vw, 100px))', fontFamily: THEME.sansFont, background: UI.bg, overflow: 'hidden' }}>
      <style>{`.mb-card:hover { box-shadow: ${THEME.cardShadowHover} !important; transform: translate(-1px, -1px); } .mb-hide-scroll::-webkit-scrollbar { display: none; }`}</style>
      
      {/* Header Profile */}
      <div style={{ flexShrink: 0, padding: '16px 28px', background: '#fff', borderBottom: `1px solid ${UI.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          {!isParentLocked && (<button onClick={() => { setSelectedId(null); onClearTarget?.(); }} style={{ border: 'none', background: '#F8FAFC', cursor: 'pointer', color: UI.muted, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: '50%', padding: 0 }} title="Back to Class"><ChevronLeft size={20} /></button>)}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <HexAvatar letter={(student?.first_name || '?')[0]} size={56} fontSize={24} />
            <div style={{ fontFamily: THEME.serifFont, fontSize: 26, fontWeight: 700, color: UI.primary, lineHeight: 1.1 }}>{student?.first_name} <span style={{ color: UI.accentPeach }}>{student?.last_name}</span></div>
          </div>
        </div>
      </div>

      {/* Tabs & Navigation Header */}
      <div style={{ flexShrink: 0, padding: '16px 28px', background: UI.bg, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', background: '#fff', padding: 6, borderRadius: SQUARE_RADIUS, border: `1px solid ${UI.border}` }}>
          <ViewToggle active={tab === 'DASHBOARD'} icon={LayoutDashboard} label="Dashboard" onClick={() => setTab('DASHBOARD')} />
          <ViewToggle active={tab === 'ACTIVITY'} icon={List} label="Activity Log" onClick={() => setTab('ACTIVITY')} />
          <ViewToggle active={tab === 'MATRIX'} icon={History} label="Curriculum Matrix" onClick={() => setTab('MATRIX')} />
          <ViewToggle active={tab === 'ASSESS'} icon={CheckCircle} label="Assessments" onClick={() => setTab('ASSESS')} />
        </div>
        
        {(tab === 'DASHBOARD' || tab === 'ACTIVITY') && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', padding: '4px', borderRadius: SQUARE_RADIUS, border: `1px solid ${UI.border}` }}>
                <select value={boardTimeFrame} onChange={e => setBoardTimeFrame(e.target.value)} style={{ border: 'none', outline: 'none', background: 'transparent', fontWeight: 700, color: UI.primary, padding: '0 8px', cursor: 'pointer', fontSize: 13 }}>
                    <option value="MONTH">Month</option>
                    <option value="WEEK">Week</option>
                </select>
                <div style={{ width: 1, height: 16, background: UI.border }} />
                <button onClick={() => {
                    if (boardTimeFrame === 'WEEK') {
                        setBoardDate(addDays(boardDate, -7));
                    } else {
                        const d = new Date(boardDate);
                        d.setDate(1);
                        d.setMonth(d.getMonth() - 1);
                        setBoardDate(d);
                    }
                }} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: UI.primary, padding: 4 }}><ChevronLeft size={16}/></button>
                <span style={{ fontSize: 13, fontWeight: 700, color: UI.primary, userSelect: 'none', minWidth: 130, textAlign: 'center' }}>
                    {boardTimeFrame === 'WEEK' ? `Week of ${formatShortDate(startOfWeekMonday(boardDate))}` : boardDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                </span>
                <button onClick={() => {
                    if (boardTimeFrame === 'WEEK') {
                        setBoardDate(addDays(boardDate, 7));
                    } else {
                        const d = new Date(boardDate);
                        d.setDate(1); 
                        d.setMonth(d.getMonth() + 1);
                        setBoardDate(d);
                    }
                }} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: UI.primary, padding: 4 }}><ChevronRight size={16}/></button>
                <div style={{ width: 1, height: 20, background: UI.border, margin: '0 4px' }} />
                <button onClick={() => setBoardDate(toDateObj(getBusinessDayISO()))} style={{ fontSize: 11, fontWeight: 600, color: UI.muted, background: 'transparent', border: 'none', cursor: 'pointer', padding: '0 6px' }}>Today</button>
            </div>
        )}
      </div>

      <div style={{ flex: 1, minHeight: 0, padding: '0 28px 40px', overflowY: 'auto', overflowX: 'hidden' }}>
        <div style={{ maxWidth: 1600, margin: '0 auto' }}>
          {tab === 'DASHBOARD' && <DashboardPanel student={student} studentPlans={localStudentPlans} showToast={showToast} resolvedIds={resolvedIds} setResolvedIds={setResolvedIds} updatePlanItemFields={updatePlanItemFields} masterPlans={masterPlans} planSessions={planSessions} activeDateObj={boardDate} timeFrame={boardTimeFrame} />}
          {tab === 'ACTIVITY' && <ActivityLogPanel student={student} studentPlans={localStudentPlans} activeDateObj={boardDate} timeFrame={boardTimeFrame} showToast={showToast} />}
          {tab === 'MATRIX' && <ProgressMatrix student={student} showToast={showToast} />}
          {tab === 'ASSESS' && <AssessmentPanel profile={profile} student={student} classroomId={student?.classroom_id} showToast={showToast} />}
        </div>
      </div>

      <AddActivityModal open={addOpen} onClose={() => setAddOpen(false)} onSubmit={optimisticCreateItem} classrooms={classrooms} students={students} curriculum={curriculum} curriculumAreas={curriculumAreas} curriculumCategories={curriculumCategories} defaults={{ preSelectedStudentId: student?.id, activeDateISO: businessISO }} showToast={showToast} />
    </div>
  );
};

export default IndividualPlanner;
