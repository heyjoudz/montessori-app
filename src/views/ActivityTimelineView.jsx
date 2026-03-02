// src/views/ActivityTimelineView.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';
import { THEME, getSubjectStyle } from '../ui/theme';
import { safeDate, getNormalizedItem } from '../utils/helpers';

import {
  LayoutList,
  ListTodo,
  BookOpen,
  Clock,
  AlertCircle,
  Search,
  X,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Check,
  User,
  Maximize2,
  Minimize2,
  Filter,
  Target,
  History,
  CalendarDays
} from 'lucide-react';

/**
 * =========================
 * Translations / Buckets
 * =========================
 */
const TRANSLATIONS = {
  'شكل الحرف المتصل': 'Cursive Letter Shape',
  'شكل الحرف المنفصل': 'Print Letter Shape',
  'بطاقات التهجئة': 'Spelling Cards',
  'بناء كلمة ثلاثية': 'Building 3-letter words',
  'بطاقات اللمس': 'Sandpaper Letters',
  ز: 'z', ح: 'h', ف: 'f', ع: 'a', ص: 's', ي: 'y', ش: 'sh',
  حفر: 'dig', صرف: 'spend', يد: 'hand',
};

const R = '0px'; 
const hexToRgb = (hex) => {
  const h = (hex || '').replace('#', '').trim();
  if (h.length === 3) return { r: parseInt(h[0] + h[0], 16), g: parseInt(h[1] + h[1], 16), b: parseInt(h[2] + h[2], 16) };
  if (h.length === 6) return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
  return { r: 0, g: 0, b: 0 };
};
const rgba = (hex, a = 1) => {
  if (!hex) return `rgba(0,0,0,${a})`;
  if (String(hex).startsWith('rgba')) return hex;
  if (!String(hex).startsWith('#')) return hex;
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
};

const UI = {
  bg: '#FAF9F6', card: '#FFFFFF', text: '#4B5563', muted: '#6B7280',
  primary: '#233876', secondary: '#FFC0B3', accent: '#BFD8D2',
  accentYellow: '#F4C473', border: '#E5E7EB', danger: '#ef4444',
};

/**
 * =========================
 * Generic helpers & Mapping
 * =========================
 */
const clean = (s) => String(s || '').trim();

// Bulletproof local date string generator (YYYY-MM-DD)
const toLocalISODate = (d) => {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '';
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
};

const getRawFirstTitle = (it) => 
  clean(it?.raw_activity) || 
  clean(it?.activity) || 
  clean(getNormalizedItem(it || {})?.rawActivity) || 
  clean(getNormalizedItem(it || {})?.title) || 
  'Untitled Activity';

const applyTranslations = (text) => {
  if (!text) return text;
  let out = String(text);
  Object.keys(TRANSLATIONS).forEach((k) => {
    out = out.replace(new RegExp(k, 'g'), TRANSLATIONS[k]);
  });
  return out;
};

const formatShortDateStr = (d) => {
  if (!d) return '';
  // Fix off-by-one by replacing hyphens if it's a string date
  const dt = typeof d === 'string' ? new Date(d.replace(/-/g, '/')) : new Date(d);
  if (Number.isNaN(dt.getTime())) return String(d);
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const formatStudentName = (s) => {
  if (!s) return 'Unknown';
  const first = s.first_name || '';
  const last = s.last_name || '';
  const initial = last ? `${last[0]}.` : '';
  const name = `${first} ${initial}`.trim();
  return name || 'Unknown';
};

const inferBucket = (text) => {
  const t = String(text || '').toLowerCase();
  if (t.includes('reintroduced') || t.includes('re-introduced') || t.includes('re-present') || t.includes('represent') || t.includes('need')) return 'REWORK';
  if (t.includes('practiced')) return 'PRACTICED';
  if (t.includes('mastered')) return 'MASTERED';
  return 'INTRODUCED';
};

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

const cleanNoteCoordinator = (note, studentsList, activityName) => {
    if (!note) return '';
    let customNote = note;

    studentsList.forEach(s => {
        if (s.name) {
            const first = s.name.split(' ')[0];
            customNote = customNote.replace(new RegExp(`\\b${first}\\b\\s*[A-Z]?\\.?`, 'ig'), '');
            customNote = customNote.replace(new RegExp(s.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig'), '');
        }
    });

    if (activityName) {
        customNote = customNote.replace(new RegExp(activityName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig'), '');
    }

    let meaningfulLeftover = customNote.replace(/\b(got|introduced|to|and|practiced|mastered|worked|with|re-?introduced|needs?|more|practice|review)\b/ig, '')
                                       .replace(/\sو\s/g, '') 
                                       .replace(/[.,،:;\s-]/g, '')
                                       .trim();

    if (meaningfulLeftover.length === 0) return '';

    customNote = customNote.replace(/\b(?:got\s+)?(?:re-?)?introduced\s+to\s*[.,،\s]*(?:and|و)?\s*[.,،\s]*/ig, '');
    customNote = customNote.replace(/\b(?:got\s+)?(?:re-?)?introduced\s*[.,،\s]*(?:and|و)?\s*[.,،\s]*/ig, '');
    customNote = customNote.replace(/\bpracticed\s*[.,،\s]*(?:and|و)?\s*[.,،\s]*/ig, '');
    customNote = customNote.replace(/\bmastered\s*[.,،\s]*(?:and|و)?\s*[.,،\s]*/ig, '');
    customNote = customNote.replace(/^(?:[\s.,،:;]|and|و)+/ig, '').trim();
    customNote = customNote.replace(/(?:[\s.,،:;]|and|و)+$/ig, '').trim();

    if (customNote.length > 0) return customNote.charAt(0).toUpperCase() + customNote.slice(1);
    return '';
};

/**
 * =========================
 * SHARED UI COMPONENTS
 * =========================
 */
const ThemedCard = ({ children, style, className = '', onClick }) => (
  <div className={`ss-card ${className}`} onClick={onClick} style={{ backgroundColor: UI.card, borderRadius: R, border: `1px solid ${UI.border}`, boxShadow: '0 1px 3px rgba(0,0,0,0.02)', overflow: 'hidden', cursor: onClick ? 'pointer' : 'default', ...style }}>
    {children}
  </div>
);

const SectionHeader = ({ icon: Icon, title, right, style }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 16, borderBottom: `1px solid ${UI.border}`, marginBottom: 20, ...style }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ padding: '6px', background: rgba(UI.primary, 0.04), borderRadius: R, color: UI.primary }}><Icon size={18} strokeWidth={2} /></div>
      <div style={{ fontFamily: THEME.serifFont, fontSize: 18, fontWeight: 600, color: UI.primary }}>{title}</div>
    </div>
    {right}
  </div>
);

const Label = ({ children, style }) => (<div style={{ fontSize: 11, fontWeight: 600, color: UI.muted, textTransform: 'uppercase', letterSpacing: 0.5, fontFamily: THEME.sansFont, ...style }}>{children}</div>);

const Field = ({ as = 'input', style, onFocus, onBlur, children, ...props }) => {
  const Comp = as;
  return (
    <Comp {...props} style={{ width: '100%', padding: '8px 12px', borderRadius: R, border: `1px solid ${UI.border}`, fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: THEME.sansFont, color: UI.text, backgroundColor: '#fff', transition: 'all 0.15s ease', ...(as === 'select' ? { cursor: 'pointer', appearance: 'none' } : null), ...style }}
      onFocus={(e) => { e.currentTarget.style.borderColor = UI.primary; e.currentTarget.style.boxShadow = `0 0 0 2px ${rgba(UI.primary, 0.05)}`; onFocus?.(e); }}
      onBlur={(e) => { e.currentTarget.style.borderColor = UI.border; e.currentTarget.style.boxShadow = 'none'; onBlur?.(e); }}
    >
      {children}
    </Comp>
  );
};

const Button = ({ variant = 'primary', children, style, ...props }) => {
  const base = { borderRadius: R, fontFamily: THEME.sansFont, fontWeight: 500, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '8px 16px', fontSize: 13, transition: 'transform 100ms ease, box-shadow 100ms ease', userSelect: 'none', whiteSpace: 'nowrap', border: '1px solid transparent', background: 'transparent', height: '38px' };
  const variants = {
    primary: { background: '#fff', color: UI.primary, border: `1px solid ${UI.border}`, boxShadow: '0 1px 2px rgba(0,0,0,0.02)' },
    solid: { background: UI.primary, color: '#fff', border: `1px solid ${UI.primary}`, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' },
    ghost: { background: 'transparent', color: UI.muted, border: `1px solid transparent`, boxShadow: 'none' },
  };
  return (
    <button {...props} style={{ ...base, ...(variants[variant] || variants.primary), ...style }}
      onMouseDown={(e) => { if (variant !== 'ghost') e.currentTarget.style.transform = 'translate(1px, 1px)'; }}
      onMouseUp={(e) => { if (variant !== 'ghost') e.currentTarget.style.transform = 'translate(0, 0)'; }}
      onMouseLeave={(e) => { if (variant !== 'ghost') e.currentTarget.style.transform = 'translate(0, 0)'; }}
    >
      {children}
    </button>
  );
};

const ClassTab = ({ active, label, onClick }) => (
  <button onClick={onClick} style={{ border: active ? `1px solid ${UI.primary}` : `1px solid ${UI.border}`, cursor: 'pointer', padding: '10px 20px', background: active ? UI.primary : '#fff', color: active ? '#fff' : UI.text, fontWeight: 600, borderRadius: R, transition: 'all 0.15s', fontFamily: THEME.sansFont, fontSize: 13 }}>
    {label}
  </button>
);

const ViewTab = ({ active, icon: Icon, label, onClick }) => (
  <button onClick={onClick} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: R, border: active ? `1px solid ${UI.primary}` : `1px solid transparent`, background: active ? rgba(UI.primary, 0.05) : 'transparent', color: active ? UI.primary : UI.muted, fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s ease', fontFamily: THEME.sansFont, userSelect: 'none' }}>
    {Icon ? <Icon size={14} color={active ? UI.primary : UI.muted} /> : null} {label}
  </button>
);

const StatCard = ({ title, count, icon: Icon, color }) => (
    <div style={{ background: '#fff', borderRadius: R, padding: '16px 20px', border: `1px solid ${UI.border}`, borderLeft: `4px solid ${color}`, display: 'flex', alignItems: 'center', gap: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
        <div style={{ background: rgba(color, 0.1), padding: 12, borderRadius: '50%' }}>
            <Icon size={20} color={color} />
        </div>
        <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: UI.muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>{title}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: UI.text, marginTop: 4 }}>{count}</div>
        </div>
    </div>
);

/**
 * =========================
 * Student search
 * =========================
 */
function StudentSearch({ students, value, onChangeValue, onPickTcId, selectedTcId, onClear }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    const onDoc = (e) => { if (!wrapRef.current) return; if (!wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const matches = useMemo(() => {
    const q = (value || '').trim().toLowerCase();
    if (!q) return students.slice(0, 10);
    return students.filter((s) => { const name = `${s.first_name || ''} ${s.last_name || ''}`.trim().toLowerCase(); return name.includes(q); }).slice(0, 10);
  }, [students, value]);

  return (
    <div ref={wrapRef} style={{ position: 'relative', flex: 1, minWidth: 240 }}>
      <div style={{ position: 'relative' }}>
        <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: UI.muted }} />
        <Field value={value} onChange={(e) => { onChangeValue(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} placeholder="Search student…" style={{ paddingLeft: 36, height: 38 }} />
        {(selectedTcId || value) && (
          <button onClick={() => { onClear(); setOpen(false); }} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', cursor: 'pointer', padding: 4, color: UI.muted }} title="Clear">
            <X size={14} />
          </button>
        )}
      </div>

      {open && matches.length > 0 && (
        <div style={{ position: 'absolute', top: 40, left: 0, right: 0, background: '#fff', border: `1px solid ${UI.border}`, borderRadius: R, boxShadow: '0 4px 16px rgba(22,58,95,0.08)', maxHeight: 260, overflowY: 'auto', zIndex: 50 }}>
          {matches.map((s) => {
            const name = `${s.first_name || ''} ${s.last_name || ''}`.trim();
            const isActive = String(s.tc_id) === String(selectedTcId || '');
            return (
              <div key={s.id} onClick={() => { onPickTcId(String(s.tc_id)); onChangeValue(name); setOpen(false); }} style={{ padding: '10px 12px', cursor: 'pointer', fontSize: 13, color: UI.text, background: isActive ? rgba(UI.primary, 0.05) : '#fff', borderBottom: `1px solid ${UI.border}`, fontWeight: 500 }}>
                {name || `Student ${s.id}`}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * =========================
 * Tree Component for Matrix
 * =========================
 */
const StatusCountBadge = ({ status, count }) => {
  const config = {
    'INTRODUCED': { bg: '#EFF6FF', color: '#1E88E5', label: 'I', border: '#BFDBFE' },
    'PRACTICED': { bg: '#FFFBEB', color: '#F5B041', label: 'P', border: '#FEF08A' },
    'MASTERED': { bg: '#F8FAFC', color: '#233876', label: 'M', border: '#E2E8F0' },
    'REWORK': { bg: '#FEF2F2', color: '#E53935', label: 'R', border: '#FECACA' }
  };
  const c = config[status];
  if (!c || !count) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', background: c.bg, color: c.color, padding: '2px 6px', borderRadius: 4, fontSize: 11, fontWeight: 700, border: `1px solid ${c.border}` }} title={status}>
      <span style={{ marginRight: 4, opacity: 0.8, fontSize: 10 }}>{c.label}</span> {count}
    </div>
  );
};

const TreeItem = ({ label, level = 0, children, statusMap, visibleClassrooms, globalExpanded }) => {
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
          display: 'flex', alignItems: 'center', gap: 10, padding: '6px 12px', cursor: hasChildren ? 'pointer' : 'default',
          borderRadius: 4, transition: 'background 0.2s', backgroundColor: level === 0 && isExpanded ? rgba(UI.primary, 0.03) : 'transparent',
          borderBottom: level === 0 ? `1px solid ${UI.border}` : 'none'
        }}
        onMouseEnter={(e) => hasChildren && (e.currentTarget.style.backgroundColor = rgba(UI.primary, 0.05))}
        onMouseLeave={(e) => hasChildren && (e.currentTarget.style.backgroundColor = level === 0 && isExpanded ? rgba(UI.primary, 0.03) : 'transparent')}
      >
        <div style={{ width: 20, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
          {hasChildren ? (isExpanded ? <ChevronDown size={14} color={UI.muted} /> : <ChevronRight size={14} color={UI.muted} />) : (<div style={{ width: 4, height: 4, borderRadius: '50%', background: UI.border }} />)}
        </div>
        
        <span style={{ flex: 1, fontSize: level === 0 ? 14 : 13, fontWeight: level === 0 ? 700 : (hasChildren ? 600 : 400), color: level === 0 ? UI.primary : UI.text, textTransform: level === 0 ? 'uppercase' : 'none' }}>
          {label}
        </span>

        {/* Dynamic Columns for Classrooms Status */}
        {!hasChildren && statusMap && (
            <div style={{ display: 'flex' }}>
                {visibleClassrooms.map((c, i) => {
                    const stats = statusMap[String(c.id)] || { I: 0, P: 0, M: 0, R: 0 };
                    const total = stats.I + stats.P + stats.M + stats.R;
                    return (
                        <div key={c.id} style={{ width: 100, display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 4, borderLeft: `1px solid ${UI.border}`, padding: '2px 8px' }}>
                            {total === 0 ? <span style={{ color: UI.border, fontSize: 12 }}>-</span> : (
                                <>
                                    <StatusCountBadge status="INTRODUCED" count={stats.I} />
                                    <StatusCountBadge status="PRACTICED" count={stats.P} />
                                    <StatusCountBadge status="MASTERED" count={stats.M} />
                                    <StatusCountBadge status="REWORK" count={stats.R} />
                                </>
                            )}
                        </div>
                    );
                })}
            </div>
        )}
      </div>
      {isExpanded && hasChildren && (<div style={{ borderLeft: `1px solid ${UI.border}`, marginLeft: 21, marginTop: 2, marginBottom: 8 }}>{children}</div>)}
    </div>
  );
};


/**
 * =========================
 * Main View
 * =========================
 */
export default function ActivityTimelineView() {
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState(null);
  const [resolvedIds, setResolvedIds] = useState(new Set());

  const [activeTab, setActiveTab] = useState('TIMELINE'); 
  const [isTranslating, setIsTranslating] = useState(false);

  // Timeframe and Date filtering
  const [timeFrame, setTimeFrame] = useState('14_DAYS'); // 'MONTH', '14_DAYS', 'DAY'
  const [activeDate, setActiveDate] = useState(new Date());

  // Data
  const [fullMatrixData, setFullMatrixData] = useState([]); 
  const [studentsByTcId, setStudentsByTcId] = useState({});
  const [studentsList, setStudentsList] = useState([]);
  const [classrooms, setClassrooms] = useState([]);

  // Shared Filters
  const [filterClassroomId, setFilterClassroomId] = useState('ALL');
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudentTcId, setSelectedStudentTcId] = useState(null);
  const [catActQuery, setCatActQuery] = useState('');
  const [filterArea, setFilterArea] = useState('ALL');
  const [filterCategory, setFilterCategory] = useState('ALL');
  
  // Tab States
  const [expandAll, setExpandAll] = useState(false);
  const [hideCompleted, setHideCompleted] = useState(false); 
  const [matrixCatActQuery, setMatrixCatActQuery] = useState('');

  const translate = (s) => (isTranslating ? applyTranslations(s) : s);

  const clearAllFilters = () => {
    setStudentSearch('');
    setSelectedStudentTcId(null);
    setCatActQuery('');
    setFilterArea('ALL');
    setFilterCategory('ALL');
    setMatrixCatActQuery('');
  };

  const toggleCompletePending = async (itemId) => {
    const isResolved = resolvedIds.has(itemId);
    
    // Optimistic Update
    setResolvedIds(prev => {
        const next = new Set(prev);
        if (isResolved) next.delete(itemId);
        else next.add(itemId);
        return next;
    });

    try {
      if (!isResolved) {
        await supabase.from('resolved_suggestions').insert([{ suggestion_id: itemId }]);
      } else {
        await supabase.from('resolved_suggestions').delete().eq('suggestion_id', itemId);
      }
    } catch (e) {
      console.error("Error updating resolution status:", e);
      // Revert on fail
      setResolvedIds(prev => {
          const next = new Set(prev);
          if (isResolved) next.add(itemId);
          else next.delete(itemId);
          return next;
      });
    }
  };

  // Load Data
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setLoadErr(null);

      try {
        // Students
        const { data: students, error: stuErr } = await supabase
          .from('students')
          .select('id, tc_id, first_name, last_name, classroom_id');
        if (stuErr) throw stuErr;

        const studentMap = {};
        (students || []).forEach((s) => {
          if (s.tc_id != null) studentMap[String(s.tc_id)] = s;
        });

        const studentsSorted = (students || [])
          .filter((s) => s.tc_id != null)
          .sort((a, b) => {
            const an = `${a.first_name || ''} ${a.last_name || ''}`.trim().toLowerCase();
            const bn = `${b.first_name || ''} ${b.last_name || ''}`.trim().toLowerCase();
            return an.localeCompare(bn);
          });

        setStudentsByTcId(studentMap);
        setStudentsList(studentsSorted);

        // Classrooms
        const { data: clsData, error: clsErr } = await supabase
          .from('classrooms')
          .select('id, name')
          .order('name', { ascending: true });
        
        if (!clsErr && Array.isArray(clsData)) {
            setClassrooms(clsData.filter(c => !c.name.toUpperCase().includes('KG TEST')));
        }

        // Fetch everything to enable fast local date toggling
        const matrixRes = await supabase
            .from('vw_tc_observations_enriched')
            .select('*')
            .order('observation_date', { ascending: false })
            .limit(100000); 

        if (matrixRes.data) {
            const rawMatrixRes = await supabase.from('vw_tc_observations_expanded').select('tc_observation_id, html_content, text_content').limit(100000);
            const rawMatrixMap = new Map();
            if (rawMatrixRes.data) {
                rawMatrixRes.data.forEach(r => { if(r.tc_observation_id) rawMatrixMap.set(String(r.tc_observation_id), r); });
            }

            const procMatrix = [];
            matrixRes.data.forEach(tc => {
                const raw = rawMatrixMap.get(String(tc.tc_observation_id || tc.id)) || {};
                const actName = extractLessonName({ html_content: raw.html_content, text_content: raw.text_content, activity_name: tc.activity_name });
                
                const names = actName ? actName.split('•').map(s => s.trim()).filter(Boolean) : [tc.activity_name || 'Activity'];
                names.forEach(name => {
                    procMatrix.push({
                        ...tc,
                        activity_name: name,
                        bucket: tc.bucket || inferBucket(tc.note || raw.text_content),
                        raw_html: raw.html_content,
                        raw_text: raw.text_content
                    });
                });
            });
            setFullMatrixData(procMatrix);
        }

        // Resolved IDs
        const { data: resData } = await supabase.from('resolved_suggestions').select('suggestion_id');
        if (resData) setResolvedIds(new Set(resData.map(r => r.suggestion_id)));

      } catch (e) {
        setLoadErr(e?.message || 'Failed to load data.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Filter helpers
  const studentsForSearch = useMemo(() => {
    if (filterClassroomId === 'ALL') return studentsList;
    return studentsList.filter((s) => String(s.classroom_id || '') === String(filterClassroomId));
  }, [studentsList, filterClassroomId]);

  const filterStudentRefs = (childTcIds) => {
    let stus = (Array.isArray(childTcIds) ? childTcIds : []).map((tc) => {
      const s = studentsByTcId[String(tc)];
      return { key: String(tc), tc_id: String(tc), classroom_id: s?.classroom_id ?? null, name: s ? formatStudentName(s) : `Child ${tc}` };
    }) || [];

    if (filterClassroomId !== 'ALL') stus = stus.filter((s) => String(s.classroom_id || '') === String(filterClassroomId));
    if (selectedStudentTcId) stus = stus.filter((s) => String(s.tc_id) === String(selectedStudentTcId));
    return stus.sort((a, b) => a.name.localeCompare(b.name));
  };


  /**
   * =========================
   * String-Based Date Filtering Logic
   * =========================
   */
  const dateFilteredData = useMemo(() => {
      let startD = new Date(activeDate);
      let endD = new Date(activeDate);
      
      if (timeFrame === 'DAY') {
          // Both are same day
      } else if (timeFrame === '14_DAYS') {
          startD.setDate(startD.getDate() - 13);
      } else { // MONTH
          startD.setDate(1);
          endD.setMonth(endD.getMonth() + 1);
          endD.setDate(0); // Last day
      }

      const startStr = toLocalISODate(startD);
      const endStr = toLocalISODate(endD);

      return fullMatrixData.filter(r => {
          if (!r.observation_date) return false;
          // observation_date comes in as YYYY-MM-DD from supabase view
          const obsStr = String(r.observation_date).slice(0, 10);
          return obsStr >= startStr && obsStr <= endStr;
      });
  }, [fullMatrixData, activeDate, timeFrame]);

  const activeDataSource = activeTab === 'TIMELINE' ? dateFilteredData : fullMatrixData;
  const uniqueAreas = useMemo(() => [...new Set(activeDataSource.map(r => translate(r.area_name || 'General')))].sort(), [activeDataSource, isTranslating]);
  const uniqueCategories = useMemo(() => [...new Set(activeDataSource.filter(r => filterArea === 'ALL' || translate(r.area_name || 'General') === filterArea).map(r => translate(r.category_name || 'Uncategorized')))].sort(), [activeDataSource, filterArea, isTranslating]);

  /**
   * =========================
   * Kanban Data (Timeline Tab)
   * =========================
   */
  const kanbanItems = useMemo(() => {
      const q = catActQuery.trim().toLowerCase();
      
      const filtered = dateFilteredData.filter(r => {
          const areaName = translate(r.area_name || 'General');
          const categoryName = translate(r.category_name || 'Uncategorized');
          const activityName = translate(r.activity_name || 'Untitled Activity');
          
          if (filterArea !== 'ALL' && areaName !== filterArea) return false;
          if (filterCategory !== 'ALL' && categoryName !== filterCategory) return false;
          if (q && !categoryName.toLowerCase().includes(q) && !activityName.toLowerCase().includes(q) && !areaName.toLowerCase().includes(q)) return false;
          
          const stus = filterStudentRefs(r.child_tc_ids || [r.child_tc_id]);
          if (!stus || stus.length === 0) return false;
          
          return true;
      });

      // Group strictly by Area -> Category -> Activity
      const activityMap = new Map();

      filtered.forEach(r => {
          const areaName = translate(r.area_name || 'General');
          const categoryName = translate(r.category_name || 'Uncategorized');
          const activityName = translate(r.activity_name || 'Untitled Activity');
          const bucket = r.bucket;

          const key = `${bucket}||${areaName}||${categoryName}||${activityName}`;
          
          if (!activityMap.has(key)) {
              activityMap.set(key, {
                  id: key,
                  area_name: areaName,
                  category_name: categoryName,
                  activity_name: activityName,
                  bucket: bucket,
                  studentsMap: new Map() // tc_id -> maxDate
              });
          }

          const stus = filterStudentRefs(r.child_tc_ids || [r.child_tc_id]);
          const actGroup = activityMap.get(key);
          
          stus.forEach(s => {
              const currentMax = actGroup.studentsMap.get(s.tc_id)?.date;
              if (!currentMax || String(r.observation_date).slice(0, 10) > String(currentMax).slice(0, 10)) {
                  actGroup.studentsMap.set(s.tc_id, { name: s.name, date: r.observation_date, tc_id: s.tc_id });
              }
          });
      });

      return Array.from(activityMap.values()).map(ag => ({
          ...ag,
          studentsList: Array.from(ag.studentsMap.values()).sort((a,b) => String(b.date).localeCompare(String(a.date)))
      }));
      
  }, [dateFilteredData, filterClassroomId, selectedStudentTcId, filterArea, filterCategory, catActQuery, isTranslating, studentsByTcId]);

  const cols = {
    I: kanbanItems.filter(t => t.bucket === 'INTRODUCED'),
    P: kanbanItems.filter(t => t.bucket === 'PRACTICED'),
    N: kanbanItems.filter(t => t.bucket === 'REWORK')
  };

  /**
   * =========================
   * Follow-up Data (Action Items Tab)
   * =========================
   */
  const combinedFollowUps = useMemo(() => {
      const q = catActQuery.trim().toLowerCase();
      const list = [];
      const obsMap = new Map(); // Prevent duplicate lessons for same observation
      
      (fullMatrixData || []).forEach(r => {
          const obsId = String(r.tc_observation_id || r.id);
          const bucket = r.bucket;
          const noteLower = String(r.note || '').toLowerCase();
          
          if (bucket === 'REWORK' || noteLower.includes('need practice') || noteLower.includes('needs practice')) {
              if (!obsMap.has(obsId)) {
                  const stus = filterStudentRefs(r.child_tc_ids || [r.child_tc_id]);
                  if (!stus || stus.length === 0) return;

                  const areaName = translate(r.area_name || 'General');
                  const categoryName = translate(r.category_name || 'Uncategorized');
                  const activityName = translate(r.activity_name || 'Untitled Activity');

                  if (filterArea !== 'ALL' && areaName !== filterArea) return;
                  if (filterCategory !== 'ALL' && categoryName !== filterCategory) return;
                  if (q && !categoryName.toLowerCase().includes(q) && !activityName.toLowerCase().includes(q) && !areaName.toLowerCase().includes(q)) return;
                  
                  let peersList = [];
                  if (r.raw_html) {
                      const doc = new DOMParser().parseFromString(r.raw_html, 'text/html');
                      peersList = [...new Set(Array.from(doc.querySelectorAll('a.child-link')).map(a => a.textContent.trim()))];
                  }

                  const cleanedNote = cleanNoteCoordinator(r.note, peersList.map(name => ({name})), activityName);

                  obsMap.set(obsId, {
                      id: `tc-${obsId}`,
                      isAuto: true,
                      done: resolvedIds.has(`tc-${obsId}`),
                      area: areaName,
                      subject: categoryName || areaName || 'General',
                      detail: activityName || 'Review Required',
                      note: cleanedNote,
                      date: r.observation_date,
                      studentsList: stus
                  });
              } else {
                  // Append activity name if multiple activities are tagged to same follow-up observation
                  const existing = obsMap.get(obsId);
                  const actName = translate(r.activity_name);
                  if (actName && !existing.detail.includes(actName)) {
                      existing.detail += ` • ${actName}`;
                  }
                  
                  // Append any new students
                  const newStus = filterStudentRefs(r.child_tc_ids || [r.child_tc_id]);
                  newStus.forEach(ns => {
                      if (!existing.studentsList.some(es => es.tc_id === ns.tc_id)) {
                          existing.studentsList.push(ns);
                      }
                  });
              }
          }
      });
      
      return Array.from(obsMap.values()).sort((a,b) => String(b.date).localeCompare(String(a.date)));
  }, [fullMatrixData, filterClassroomId, selectedStudentTcId, catActQuery, filterArea, filterCategory, isTranslating, studentsByTcId, resolvedIds]); 

  const pendingByArea = useMemo(() => {
      const grouped = combinedFollowUps.reduce((acc, item) => {
          if (!acc[item.area]) acc[item.area] = [];
          acc[item.area].push(item);
          return acc;
      }, {});
      return Object.keys(grouped).sort().map(area => ({
          areaName: area,
          items: grouped[area]
      }));
  }, [combinedFollowUps]);

  /**
   * =========================
   * Overview Stats (Action Items)
   * =========================
   */
  const overviewStats = useMemo(() => {
      const today = new Date();
      const todayStr = toLocalISODate(today);

      const startOfWeek = new Date(today);
      const day = startOfWeek.getDay();
      const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1); // Monday start
      startOfWeek.setDate(diff);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(endOfWeek.getDate() + 6);

      const startWeekStr = toLocalISODate(startOfWeek);
      const endWeekStr = toLocalISODate(endOfWeek);

      let todayCount = 0;
      let weekCount = 0;

      fullMatrixData.forEach(r => {
          const obsStr = r.observation_date ? String(r.observation_date).slice(0, 10) : '';
          if (!obsStr) return;
          
          if (obsStr === todayStr) todayCount++;
          if (obsStr >= startWeekStr && obsStr <= endWeekStr) weekCount++;
      });

      const totalPending = combinedFollowUps.filter(f => !f.done).length;

      return { todayCount, weekCount, totalPending };
  }, [fullMatrixData, combinedFollowUps]);

  // Handle Date Navigation
  const handlePrevDate = () => {
    const d = new Date(activeDate);
    if (timeFrame === 'DAY') d.setDate(d.getDate() - 1);
    else if (timeFrame === '14_DAYS') d.setDate(d.getDate() - 14);
    else { d.setDate(1); d.setMonth(d.getMonth() - 1); }
    setActiveDate(d);
  };

  const handleNextDate = () => {
    const d = new Date(activeDate);
    if (timeFrame === 'DAY') d.setDate(d.getDate() + 1);
    else if (timeFrame === '14_DAYS') d.setDate(d.getDate() + 14);
    else { d.setDate(1); d.setMonth(d.getMonth() + 1); }
    setActiveDate(d);
  };

  let dateLabel = '';
  if (timeFrame === 'DAY') {
    dateLabel = formatShortDateStr(toLocalISODate(activeDate));
  } else if (timeFrame === '14_DAYS') {
    const startD = new Date(activeDate);
    startD.setDate(startD.getDate() - 13);
    dateLabel = `${formatShortDateStr(toLocalISODate(startD))} - ${formatShortDateStr(toLocalISODate(activeDate))}`;
  } else {
    dateLabel = activeDate.toLocaleString('default', { month: 'long', year: 'numeric' });
  }

  /**
   * =========================
   * Render Helpers
   * =========================
   */
  const KanbanColumn = ({ title, color, count, items, forceExpandAll }) => {
    const [expandedAreas, setExpandedAreas] = useState({});

    useEffect(() => {
        const newExpanded = {};
        items.forEach(item => newExpanded[item.area_name || 'General'] = true);
        if (forceExpandAll) setExpandedAreas(newExpanded);
        else setExpandedAreas({});
    }, [forceExpandAll, items]);

    const toggleArea = (areaName) => setExpandedAreas(prev => ({ ...prev, [areaName]: !prev[areaName] }));

    const grouped = items.reduce((acc, item) => {
        const area = item.area_name || 'General';
        const cat = item.category_name || 'General';
        if (!acc[area]) acc[area] = {};
        if (!acc[area][cat]) acc[area][cat] = [];
        acc[area][cat].push(item);
        return acc;
    }, {});

    return (
      <div style={{ background: '#F8FAFC', borderRadius: R, border: `1px solid ${UI.border}`, borderTop: `4px solid ${color}`, overflow: 'hidden', minWidth: 320, flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${UI.border}`, background: '#FFFFFF' }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: UI.primary, letterSpacing: 0.5 }}>{title}</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#fff', background: color, padding: '2px 8px', borderRadius: 4 }}>{count}</div>
        </div>
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 20, maxHeight: 'calc(100vh - 360px)', overflowY: 'auto' }}>
          {items.length === 0 && <div style={{ textAlign: 'center', color: UI.muted, fontSize: 13, padding: 20 }}>Empty</div>}
          
          {Object.entries(grouped).sort((a, b) => a[0].localeCompare(b[0])).map(([areaName, cats]) => {
              const subjStyle = getSubjectStyle(areaName);
              const isExpanded = expandedAreas[areaName];
              
              return (
                  <div key={areaName} style={{ display: 'flex', flexDirection: 'column', gap: isExpanded ? 12 : 0 }}>
                      <div onClick={() => toggleArea(areaName)} style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: isExpanded ? `2px solid ${rgba(subjStyle.accent, 0.3)}` : `1px solid ${UI.border}`, paddingBottom: 6, cursor: 'pointer', userSelect: 'none' }}>
                          {isExpanded ? <ChevronDown size={14} color={UI.primary} /> : <ChevronRight size={14} color={UI.primary} />}
                          <div style={{ width: 10, height: 10, background: subjStyle.accent, borderRadius: 2 }} />
                          <span style={{ fontSize: 12, fontWeight: 700, color: UI.primary, textTransform: 'uppercase', letterSpacing: 0.5 }}>{areaName}</span>
                      </div>
                      
                      {isExpanded && Object.entries(cats).sort((a, b) => a[0].localeCompare(b[0])).map(([catName, areaItems]) => (
                          <div key={catName} style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                              {catName !== 'General' && (<div style={{ fontSize: 11, fontWeight: 600, color: UI.muted, paddingLeft: 22 }}>{catName}</div>)}
                              
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 12 }}>
                                  {areaItems.map(item => (
                                      <div key={item.id} style={{ background: '#fff', borderRadius: R, border: `1px solid ${UI.border}`, borderLeft: `3px solid ${subjStyle.accent}`, padding: '12px', display: 'flex', flexDirection: 'column', gap: 8, boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                                          <div style={{ fontSize: 13, fontWeight: 600, color: UI.text, lineHeight: 1.3 }}>{item.activity_name}</div>
                                          
                                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                              {item.studentsList.map(s => (
                                                  <div key={s.tc_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '4px 8px', borderRadius: 4, border: `1px solid ${UI.border}` }}>
                                                      <div style={{ fontSize: 11, fontWeight: 600, color: UI.primary, display: 'flex', alignItems: 'center', gap: 6 }}><User size={12}/> {s.name}</div>
                                                      <div style={{ fontSize: 10, color: UI.muted }}>{formatShortDateStr(s.date)}</div>
                                                  </div>
                                              ))}
                                          </div>
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

  /**
   * =========================
   * Render
   * =========================
   */
  return (
    <div style={{ background: UI.bg, fontFamily: THEME.sansFont, minHeight: '100vh', paddingBottom: 60 }}>
      <style>{`
        .ss-hide-scroll::-webkit-scrollbar { display: none; }
      `}</style>

      {/* Classroom tabs - STICKY */}
      <div style={{ 
        position: 'sticky', 
        top: 0, 
        zIndex: 100, 
        background: UI.bg, 
        padding: '16px 24px 12px',
        borderBottom: `1px solid ${rgba(UI.border, 0.5)}`
      }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <ClassTab
            active={filterClassroomId === 'ALL'}
            label="All Classrooms"
            onClick={() => {
              setFilterClassroomId('ALL');
              setSelectedStudentTcId(null);
              setStudentSearch('');
            }}
          />
          {(classrooms || []).map((c) => (
            <ClassTab
              key={c.id}
              active={String(filterClassroomId) === String(c.id)}
              label={c.name}
              onClick={() => {
                setFilterClassroomId(String(c.id));
                setSelectedStudentTcId(null);
                setStudentSearch('');
              }}
            />
          ))}
        </div>
      </div>

      {/* Header Info */}
      <div style={{ padding: '0 24px 20px' }}>
        <ThemedCard style={{ padding: '16px 20px', overflow: 'visible' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontFamily: THEME.serifFont, fontSize: 20, fontWeight: 700, color: UI.primary, lineHeight: 1.1, display: 'flex', alignItems: 'center', gap: 12 }}>
                Coordinator Dashboard 
                {loading && <div style={{ fontSize: 12, fontWeight: 500, color: UI.accentYellow, fontFamily: THEME.sansFont }}>Syncing Data...</div>}
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                <ViewTab active={activeTab === 'TIMELINE'} icon={LayoutList} label="Activity Timeline" onClick={() => setActiveTab('TIMELINE')} />
                <ViewTab active={activeTab === 'PENDING'} icon={ListTodo} label="Action Items" onClick={() => setActiveTab('PENDING')} />
                
                {activeTab === 'TIMELINE' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', padding: '4px', borderRadius: R, border: `1px solid ${UI.border}`, marginLeft: 16 }}>
                        <select value={timeFrame} onChange={e => setTimeFrame(e.target.value)} style={{ border: 'none', outline: 'none', background: 'transparent', fontWeight: 700, color: UI.primary, padding: '0 8px', cursor: 'pointer', fontSize: 13 }}>
                            <option value="DAY">Day</option>
                            <option value="14_DAYS">14 Days</option>
                            <option value="MONTH">Month</option>
                        </select>
                        <div style={{ width: 1, height: 16, background: UI.border }} />
                        <button onClick={handlePrevDate} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: UI.primary, padding: 4 }}><ChevronLeft size={16}/></button>
                        <span style={{ fontSize: 13, fontWeight: 700, color: UI.primary, userSelect: 'none', minWidth: 140, textAlign: 'center' }}>
                            {dateLabel}
                        </span>
                        <button onClick={handleNextDate} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: UI.primary, padding: 4 }}><ChevronRight size={16}/></button>
                        <div style={{ width: 1, height: 20, background: UI.border, margin: '0 4px' }} />
                        <button onClick={() => setActiveDate(new Date())} style={{ fontSize: 11, fontWeight: 600, color: UI.muted, background: 'transparent', border: 'none', cursor: 'pointer', padding: '0 6px' }}>Today</button>
                    </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end', flex: 1, minWidth: 320 }}>
              <div style={{ minWidth: 240 }}>
                <Label>Student Search</Label>
                <div style={{ marginTop: 6 }}>
                  <StudentSearch
                    students={studentsForSearch}
                    value={studentSearch}
                    onChangeValue={setStudentSearch}
                    selectedTcId={selectedStudentTcId}
                    onPickTcId={setSelectedStudentTcId}
                    onClear={() => {
                      setSelectedStudentTcId(null);
                      setStudentSearch('');
                    }}
                  />
                </div>
              </div>

              <div style={{ minWidth: 240 }}>
                <Label>Lesson Search</Label>
                <div style={{ marginTop: 6, position: 'relative' }}>
                  <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: UI.muted }} />
                  <Field 
                    value={activeTab === 'MATRIX' ? matrixCatActQuery : catActQuery} 
                    onChange={(e) => activeTab === 'MATRIX' ? setMatrixCatActQuery(e.target.value) : setCatActQuery(e.target.value)} 
                    placeholder="Filter activity name…" 
                    style={{ paddingLeft: 36, height: 38 }} 
                  />
                  {(activeTab === 'MATRIX' ? matrixCatActQuery : catActQuery) && (
                    <button
                      onClick={() => activeTab === 'MATRIX' ? setMatrixCatActQuery('') : setCatActQuery('')}
                      style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', cursor: 'pointer', padding: 4, color: UI.muted }}
                      title="Clear"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                <Button variant="ghost" onClick={clearAllFilters} style={{ height: 38 }}>
                  Clear filters
                </Button>
              </div>
            </div>
          </div>
        </ThemedCard>
      </div>

      {/* Main Content */}
      <div style={{ padding: '0 24px 30px' }}>
        
        {/* SHARED FILTER BAR */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', background: '#fff', padding: '12px 20px', border: `1px solid ${UI.border}`, borderRadius: R, marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: UI.muted, fontSize: 13, fontWeight: 600 }}><Filter size={14}/> Filters:</div>
            <Field as="select" value={filterArea} onChange={e => { setFilterArea(e.target.value); setFilterCategory('ALL'); }} style={{ width: 180, height: 32, fontSize: 12, padding: '4px 8px' }}>
              <option value="ALL">All Areas</option>
              {uniqueAreas.map(a => <option key={a} value={a}>{a}</option>)}
            </Field>
            <Field as="select" value={filterCategory} onChange={e => setFilterCategory(e.target.value)} style={{ width: 180, height: 32, fontSize: 12, padding: '4px 8px' }}>
              <option value="ALL">All Categories</option>
              {uniqueCategories.map(c => <option key={c} value={c}>{c}</option>)}
            </Field>
            
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
              {activeTab === 'TIMELINE' && (
                  <Button variant="ghost" onClick={() => setExpandAll(!expandAll)} style={{ height: 32, fontSize: 12, border: `1px solid ${UI.border}` }}>
                     {expandAll ? <Minimize2 size={12}/> : <Maximize2 size={12}/>}
                     {expandAll ? 'Collapse All' : 'Expand All'}
                  </Button>
              )}
              {activeTab === 'PENDING' && (
                  <Button variant="ghost" onClick={() => setHideCompleted(!hideCompleted)} style={{ height: 32, fontSize: 12, border: `1px solid ${UI.border}` }}>
                      {hideCompleted ? 'Show resolved' : 'Hide resolved'}
                  </Button>
              )}
            </div>
        </div>

        {/* TIMELINE TAB */}
        {activeTab === 'TIMELINE' && (
          <div style={{ display: 'flex', gap: 20, overflowX: 'auto', paddingBottom: 10 }}>
            <KanbanColumn title="Introduced" color="#1E88E5" count={cols.I.length} items={cols.I} forceExpandAll={expandAll} />
            <KanbanColumn title="Practiced" color="#F5B041" count={cols.P.length} items={cols.P} forceExpandAll={expandAll} />
            <KanbanColumn title="Needs Review" color="#E53935" count={cols.N.length} items={cols.N} forceExpandAll={expandAll} />
          </div>
        )}

        {/* FOLLOW-UP ITEMS TAB */}
        {activeTab === 'PENDING' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            
            {/* Action Items Overview */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
                <StatCard title="Today's Activity" count={overviewStats.todayCount} icon={Clock} color={UI.primary} />
                <StatCard title="This Week's Activity" count={overviewStats.weekCount} icon={CalendarDays} color={UI.primary} />
                <StatCard title="Total Pending Actions" count={overviewStats.totalPending} icon={AlertCircle} color={UI.danger} />
            </div>

            <ThemedCard style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '24px 24px 16px' }}>
                    <SectionHeader icon={Target} title="Action Items Listing" />
                </div>
                
                {hideCompleted && combinedFollowUps.filter(f => !f.done).length === 0 ? (<div style={{ padding: '0 24px 32px', fontSize: 13, color: UI.muted, fontStyle: 'italic' }}>No action items found matching criteria.</div>) : (
                  <div style={{ display: 'flex', flexDirection: 'column', paddingBottom: 16, paddingLeft: 24, paddingRight: 24, gap: 32 }}>
                     {pendingByArea.map((grp) => {
                         const ss = getSubjectStyle(grp.areaName);
                         const rowsVisible = grp.items.map(it => {
                             const isDone = resolvedIds.has(it.id); 
                             if (hideCompleted && isDone) return null;
                             return { ...it, _done: isDone };
                         }).filter(Boolean);

                         if (rowsVisible.length === 0) return null;

                         return (
                             <div key={grp.areaName} style={{ display: 'flex', flexDirection: 'column' }}>
                                 <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                                     <div style={{ width: 12, height: 12, borderRadius: 2, background: ss.accent || UI.primary }} />
                                     <div style={{ fontSize: 14, fontWeight: 700, color: UI.primary, textTransform: 'uppercase', letterSpacing: 0.5 }}>{grp.areaName}</div>
                                     <div style={{ flex: 1, height: 1, background: rgba(UI.border, 0.8) }} />
                                 </div>

                                 <div className="ss-hide-scroll" style={{ overflowX: 'auto', border: `1px solid ${UI.border}`, borderRadius: R }}>
                                     <div style={{ minWidth: 900, display: 'grid', gridTemplateColumns: '50px minmax(250px,2fr) minmax(300px,2fr) 100px', gap: 16, padding: '10px 16px', background: '#f8fafc', borderBottom: `1px solid ${UI.border}` }}>
                                         <Label>Done</Label><Label>Activity Detail</Label><Label>Students & Classrooms</Label><Label>Date Logged</Label>
                                     </div>
                                     {rowsVisible.map((it, idx) => {
                                         return (
                                             <div key={`${it.id}-${idx}`} style={{ display: 'grid', gridTemplateColumns: '50px minmax(250px,2fr) minmax(300px,2fr) 100px', gap: 16, alignItems: 'center', background: '#fff', padding: '14px 16px', borderBottom: idx === rowsVisible.length - 1 ? 'none' : `1px solid ${UI.border}`, opacity: it._done ? 0.6 : 1, transition: 'opacity 0.2s' }}>
                                                 <div style={{ display: 'flex', alignItems: 'center' }}>
                                                     <button onClick={() => toggleCompletePending(it.id)} style={{ width: 22, height: 22, borderRadius: 4, cursor: 'pointer', border: `1.5px solid ${it._done ? rgba(UI.primary, 0.6) : rgba(UI.primary, 0.3)}`, background: it._done ? rgba(UI.primary, 0.1) : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
                                                         {it._done ? <Check size={14} color={UI.primary} strokeWidth={3} /> : null}
                                                     </button>
                                                 </div>
                                                 <div>
                                                     <div style={{ fontSize: 13, fontWeight: 600, color: UI.text, textDecoration: it._done ? 'line-through' : 'none' }}>{it.detail}</div>
                                                     {it.note && <div style={{ marginTop: 6, fontSize: 11, fontWeight: 500, color: UI.muted, fontStyle: 'italic', lineHeight: 1.3 }}>"{it.note}"</div>}
                                                 </div>
                                                 <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                                   {it.studentsList.map(s => {
                                                       const className = classrooms.find(c => String(c.id) === String(s.classroom_id))?.name || 'Unknown Class';
                                                       return (
                                                          <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', borderRadius: 4, border: `1px solid ${UI.border}`, background: '#f8fafc' }}>
                                                              <User size={12} color={UI.primary}/>
                                                              <span style={{ fontSize: 11, fontWeight: 600, color: UI.text }}>{s.name}</span>
                                                              <span style={{ fontSize: 10, color: UI.muted, background: '#e2e8f0', padding: '1px 4px', borderRadius: 2 }}>{className}</span>
                                                          </div>
                                                       )
                                                   })}
                                                 </div>
                                                 <div style={{ fontSize: 11, fontWeight: 500, color: UI.muted }}>{it.date ? formatShortDateStr(it.date) : '—'}</div>
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
          </div>
        )}

      </div>
    </div>
  );
}