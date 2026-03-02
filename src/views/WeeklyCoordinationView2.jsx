// src/views/WeeklyCoordinationView.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';
import { THEME, getSubjectStyle } from '../ui/theme';
import {
  SUBJECT_KEYS,
  getWeekFromDate,
  getWeekRangeLabel,
  getWeekStartFromAcademic,
  dateISO,
} from '../utils/helpers';
import {
  Plus,
  Save,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Users,
  CheckCircle2,
  MessageSquare,
  BookOpen,
  Target,
  Search,
  ChevronDown,
  AlertTriangle,
  Hexagon,
  ListTodo,
  History,
  CalendarDays
} from 'lucide-react';

// ---------------------------
// THEME & UI HELPERS
// ---------------------------
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
  accentSlate: '#A2B5C6'
};

const SQUARE_RADIUS = '0px'; 
const DISPLAY_SUBJECTS = SUBJECT_KEYS.filter(s => s.toLowerCase() !== 'practical life');

// ---------------------------
// CUSTOM SEARCHABLE DROPDOWN
// ---------------------------
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
            width: '100%', padding: '8px 32px 8px 12px', height: '38px', borderRadius: SQUARE_RADIUS,
            border: `1px solid ${isOpen ? UI.primary : UI.border}`,
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

// ---------------------------
// UI PRIMITIVES
// ---------------------------
const ThemedCard = ({ children, style, accentColor = UI.border }) => (
  <div style={{ 
    backgroundColor: UI.card, 
    borderRadius: SQUARE_RADIUS, 
    boxShadow: '0 2px 4px rgba(0,0,0,0.02)', 
    border: `1px solid ${UI.border}`, 
    borderTop: `4px solid ${accentColor}`,
    overflow: 'visible', 
    ...style 
  }}>
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

const Field = ({ as = 'input', style, children, ...props }) => {
  const Comp = as;
  const isTextarea = as === 'textarea';
  return (
    <Comp
      {...props}
      style={{
        width: '100%', padding: '10px 12px', borderRadius: SQUARE_RADIUS, border: `1px solid ${UI.border}`,
        fontSize: 13, fontWeight: 400, outline: 'none', boxSizing: 'border-box', fontFamily: THEME.sansFont,
        color: UI.text, backgroundColor: '#fff', transition: 'all 0.2s ease', 
        lineHeight: isTextarea ? '1.5' : 'normal',
        minHeight: isTextarea ? '80px' : '38px',
        resize: isTextarea ? 'vertical' : 'none',
        ...(as === 'select' ? { cursor: 'pointer', height: '38px', padding: '8px 12px' } : null), 
        ...style,
      }}
      onFocus={(e) => { e.currentTarget.style.borderColor = UI.primary; e.currentTarget.style.boxShadow = `0 0 0 2px ${rgba(UI.primary, 0.05)}`; }}
      onBlur={(e) => { e.currentTarget.style.borderColor = UI.border; e.currentTarget.style.boxShadow = 'none'; }}
    >
      {children}
    </Comp>
  );
};

const Button = ({ variant = 'primary', children, style, ...props }) => {
  const base = { borderRadius: SQUARE_RADIUS, fontFamily: THEME.sansFont, fontWeight: 500, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '8px 16px', fontSize: 13, transition: 'all 150ms ease', border: '1px solid transparent', height: '38px' };
  const variants = {
    primary: { background: '#fff', color: UI.primary, border: `1px solid ${UI.border}`, boxShadow: '0 1px 2px rgba(0,0,0,0.02)' },
    solid: { background: UI.primary, color: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' },
  };
  return (
    <button {...props} style={{ ...base, ...(variants[variant] || variants.primary), ...style }}
      onMouseEnter={(e) => { if (variant === 'primary') e.currentTarget.style.background = '#f9fafb'; if (variant === 'solid') e.currentTarget.style.opacity = 0.9; }}
      onMouseLeave={(e) => { if (variant === 'primary') e.currentTarget.style.background = '#fff'; if (variant === 'solid') e.currentTarget.style.opacity = 1; }}
    >
      {children}
    </button>
  );
};

const StatusPill = ({ status, onClick, style }) => {
  const s = (status || 'PENDING').toUpperCase();
  const cfg = s === 'DONE' ? { bg: '#F0FDF4', text: '#166534', border: '#BBF7D0', label: 'Done' }
    : s === 'IN_PROGRESS' ? { bg: '#FFFBEB', text: '#92400E', border: '#FDE68A', label: 'In progress' }
    : { bg: '#F3F4F6', text: '#4B5563', border: '#D1D5DB', label: 'Pending' };

  return (
    <button
      onClick={onClick}
      style={{ border: `1px solid ${cfg.border}`, background: cfg.bg, color: cfg.text, borderRadius: SQUARE_RADIUS, padding: '6px 12px', fontWeight: 600, fontSize: 11, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 105, height: '38px', justifyContent: 'center', transition: 'all 0.2s', ...style }}
    >
      <CheckCircle2 size={14} strokeWidth={2.5} /> {cfg.label}
    </button>
  );
};

const cycleStatus = (s) => {
  const map = { PENDING: 'IN_PROGRESS', IN_PROGRESS: 'DONE', DONE: 'PENDING' };
  return map[(s || 'PENDING').toUpperCase()] || 'PENDING';
};

// ---------------------------
// DB TABLES
// ---------------------------
const T_MEETINGS = 'weekly_coordination_meetings';
const T_ACTIONS = 'coordination_action_plans';
const T_OBS = 'coordination_observations';
const T_SUBJECT_ENTRIES = 'weekly_coordination_subject_entries';

export default function WeeklyCoordinationView({ profile, showToast, selectedSchoolId, classrooms, students }) {
  // Changed default view to 'LOGS'
  const [activeView, setActiveView] = useState('LOGS'); 
  
  const getDynamicDate = () => {
    const d = new Date();
    if (d.getDay() === 6) d.setDate(d.getDate() + 2); 
    if (d.getDay() === 0) d.setDate(d.getDate() + 1); 
    return d;
  };
  const [activeWeek, setActiveWeek] = useState(() => getWeekFromDate(getDynamicDate()));

  const activeDateContext = useMemo(() => {
    const rawStart = new Date(getWeekStartFromAcademic(activeWeek));
    if (isNaN(rawStart.getTime())) return { month: 'Academic Term', label: getWeekRangeLabel(activeWeek) };
    
    const s = new Date(rawStart);
    if (s.getDay() === 0) {
      s.setDate(s.getDate() + 1);
    } else if (s.getDay() !== 1) {
      s.setDate(s.getDate() - s.getDay() + 1);
    }
    
    const e = new Date(s); 
    e.setDate(s.getDate() + 4); 

    return {
      month: s.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      label: `${s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${e.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    };
  }, [activeWeek]);

  const classOptions = useMemo(() => (classrooms || []).map(c => ({ id: c.id, name: c.name })), [classrooms]);
  const studentOptions = useMemo(() => {
    return (students || []).map(s => {
      const cls = (classrooms || []).find(c => c.id === s.classroom_id);
      return { id: s.id, name: `${s.first_name} ${s.last_name} (${cls?.name || 'No Class'})` };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [students, classrooms]);

  const [dbTeachers, setDbTeachers] = useState([]);
  const [customTeachers, setCustomTeachers] = useState([]); 
  
  useEffect(() => {
    let alive = true;
    async function loadPeople() {
      const { data } = profile?.customer_id ? await supabase.from('profiles').select('id, full_name, first_name, last_name, role').eq('customer_id', profile.customer_id) : await supabase.from('profiles').select('id, full_name, first_name, last_name, role');
      if (!alive || !data) return;
      setDbTeachers(data.filter((p) => ['teacher', 'coordinator', 'supervisor'].includes(p.role)).map((p) => ({
        id: p.id, name: p.full_name || `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Unnamed',
      })));
    }
    loadPeople();
    return () => { alive = false; };
  }, [profile?.customer_id]);

  const teacherOptions = useMemo(() => [...dbTeachers, ...customTeachers], [dbTeachers, customTeachers]);
  const handleCustomTeacher = (name) => {
    if (!name || !name.trim()) return null;
    const exists = teacherOptions.find(t => t.name.toLowerCase() === name.trim().toLowerCase());
    if (exists) return exists.id;
    const newTeacher = { id: name.trim(), name: name.trim() };
    setCustomTeachers(prev => [...prev, newTeacher]);
    return newTeacher.id;
  };

  // State
  const [meeting, setMeeting] = useState(null);
  const [meetingForm, setMeetingForm] = useState({ meeting_date: dateISO(new Date()), start_time: '', end_time: '', attendees: [], notes: '' });
  const [observations, setObservations] = useState([]);
  const [actions, setActions] = useState([]);
  const [subjectEntries, setSubjectEntries] = useState([]);
  
  // Aggregated State
  const [allSchoolMeetings, setAllSchoolMeetings] = useState([]);
  const [allSchoolActions, setAllSchoolActions] = useState([]);
  const [schemaWarn, setSchemaWarn] = useState(false);

  // Load Data
  const loadWeekData = async () => {
    if (!selectedSchoolId || !activeWeek) return;
    setSchemaWarn(false);
    try {
      const { data: mtgData, error: mErr } = await supabase.from(T_MEETINGS).select('*').eq('school_id', selectedSchoolId).eq('week_number', activeWeek).maybeSingle();
      if (mErr) {
        if (mErr.message.includes('school_id')) setSchemaWarn(true);
        throw mErr;
      }

      if (mtgData) {
        setMeeting(mtgData);
        setMeetingForm({ meeting_date: mtgData.meeting_date || dateISO(new Date()), start_time: mtgData.start_time || '', end_time: mtgData.end_time || '', attendees: mtgData.attendees || [], notes: mtgData.notes || '' });
        
        const [obsRes, actRes, subjRes] = await Promise.all([
          supabase.from(T_OBS).select('*').eq('meeting_id', mtgData.id).order('created_at'),
          supabase.from(T_ACTIONS).select('*').eq('meeting_id', mtgData.id).order('id'),
          supabase.from(T_SUBJECT_ENTRIES).select('*').eq('meeting_id', mtgData.id).order('id')
        ]);
        setObservations(obsRes.data || []);
        setActions(actRes.data || []);
        setSubjectEntries(subjRes.data || []);
      } else {
        setMeeting(null);
        setMeetingForm({ meeting_date: dateISO(new Date()), start_time: '', end_time: '', attendees: [], notes: '' });
        setObservations([]); setActions([]); setSubjectEntries([]);
      }
    } catch (e) { console.error(e); }
  };

  const loadAggregatedData = async () => {
    if (!selectedSchoolId) return;
    try {
      const { data: mtgs } = await supabase.from(T_MEETINGS).select('*').eq('school_id', selectedSchoolId).order('week_number', { ascending: false });
      setAllSchoolMeetings(mtgs || []);

      if (mtgs?.length > 0) {
        const { data: acts } = await supabase.from(T_ACTIONS).select('*').in('meeting_id', mtgs.map(m => m.id)).order('id', { ascending: false });
        setAllSchoolActions(acts || []);
      } else {
        setAllSchoolActions([]);
      }
    } catch (e) { console.error(e); }
  };

  useEffect(() => { loadWeekData(); }, [selectedSchoolId, activeWeek]);
  useEffect(() => { if (activeView !== 'PLANNING') loadAggregatedData(); }, [activeView, selectedSchoolId]);

  const saveMeeting = async () => {
    try {
      const payload = { 
        school_id: selectedSchoolId, 
        week_number: activeWeek, 
        meeting_date: meetingForm.meeting_date || dateISO(new Date()),
        start_time: meetingForm.start_time || null,
        end_time: meetingForm.end_time || null,
        attendees: meetingForm.attendees || [],
        notes: meetingForm.notes || '' 
      };
      
      if (meeting?.id) {
        await supabase.from(T_MEETINGS).update(payload).eq('id', meeting.id);
        showToast?.({ type: 'success', title: 'Saved', message: 'Meeting details saved.' });
      } else {
        const { data, error } = await supabase.from(T_MEETINGS).insert(payload).select().single();
        if (error) throw error;
        setMeeting(data);
        showToast?.({ type: 'success', title: 'Created', message: 'Coordination meeting started.' });
      }
      loadWeekData();
    } catch (e) { showToast?.({ type: 'error', title: 'Error', message: e.message }); }
  };

  const mutateTable = async (table, action, id, patch = null) => {
    try {
      if (action === 'insert') {
        const { data, error } = await supabase.from(table).insert(patch).select().single();
        if (error) throw error;
        if (table === T_OBS) setObservations(p => [...p, data]);
        if (table === T_SUBJECT_ENTRIES) setSubjectEntries(p => [...p, data]);
        if (table === T_ACTIONS) setActions(p => [...p, data]);
      }
      if (action === 'update') {
        const { error } = await supabase.from(table).update(patch).eq('id', id);
        if (error) throw error;
        if (table === T_OBS) setObservations(p => p.map(o => o.id === id ? { ...o, ...patch } : o));
        if (table === T_SUBJECT_ENTRIES) setSubjectEntries(p => p.map(o => o.id === id ? { ...o, ...patch } : o));
        if (table === T_ACTIONS) {
          setActions(p => p.map(o => o.id === id ? { ...o, ...patch } : o));
          setAllSchoolActions(p => p.map(o => o.id === id ? { ...o, ...patch } : o)); 
        }
      }
      if (action === 'delete') {
        const { error } = await supabase.from(table).delete().eq('id', id);
        if (error) throw error;
        if (table === T_OBS) setObservations(p => p.filter(o => o.id !== id));
        if (table === T_SUBJECT_ENTRIES) setSubjectEntries(p => p.filter(o => o.id !== id));
        if (table === T_ACTIONS) {
          setActions(p => p.filter(o => o.id !== id));
          setAllSchoolActions(p => p.filter(o => o.id !== id));
        }
      }
    } catch (e) {
      showToast?.({ type: 'error', title: 'Update Failed', message: e.message });
      loadWeekData(); 
    }
  };

  const actionCategories = ['Behavioral', 'General', ...DISPLAY_SUBJECTS];
  const pendingActions = allSchoolActions.filter(a => a.status !== 'DONE');
  const doneActions = allSchoolActions.filter(a => a.status === 'DONE');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - clamp(32px, 6vw, 100px))', width: '100%', background: UI.bg, fontFamily: THEME.sansFont, overflow: 'hidden' }}>
      
      {/* BEAUTIFIED HEADER */}
      <div style={{ flexShrink: 0, padding: '32px 0 24px 0', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
          <Hexagon size={42} fill={UI.accentYellow} color={UI.accentYellow} style={{ opacity: 0.95 }} />
        </div>
        <h1 style={{ color: UI.primary, fontSize: '30px', fontWeight: 600, margin: 0, fontFamily: THEME.serifFont, letterSpacing: '-0.5px' }}>
          {activeDateContext.month}
        </h1>

        {activeView === 'PLANNING' && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#fff', borderRadius: SQUARE_RADIUS, padding: '6px 16px', border: `1px solid ${UI.border}`, boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
              <button onClick={() => setActiveWeek(w => Math.max(1, w - 1))} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: UI.primary, padding: '4px' }}><ChevronLeft size={18} /></button>
              <span style={{ fontSize: 13, fontWeight: 600, color: UI.primary, minWidth: 200, textAlign: 'center' }}>
                Week {activeWeek} <span style={{ opacity: 0.6, fontWeight: 500, marginLeft: 4 }}>• {activeDateContext.label}</span>
              </span>
              <button onClick={() => setActiveWeek(w => Math.min(40, w + 1))} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: UI.primary, padding: '4px' }}><ChevronRight size={18} /></button>
            </div>
          </div>
        )}
      </div>

      {/* CONTENT FLOW */}
      <div style={{ flex: 1, padding: '0 24px 60px', overflowY: 'auto' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>

          {/* SUB-NAVIGATION TABS (Reordered: Logs -> Actions -> Planning) */}
          <div style={{ display: 'flex', gap: 8, borderBottom: `1px solid ${UI.border}`, paddingBottom: 16, marginBottom: 28 }}>
            <button 
              onClick={() => setActiveView('LOGS')}
              style={{ display: 'flex', alignItems: 'center', gap: 8, background: activeView === 'LOGS' ? UI.primary : 'transparent', color: activeView === 'LOGS' ? '#fff' : UI.muted, border: `1px solid ${activeView === 'LOGS' ? UI.primary : 'transparent'}`, padding: '8px 16px', borderRadius: SQUARE_RADIUS, fontSize: 13, fontWeight: activeView === 'LOGS' ? 600 : 500, cursor: 'pointer', transition: 'all 0.2s' }}
            >
              <History size={16} /> Meeting Logs
            </button>
            <button 
              onClick={() => setActiveView('ACTIONS')}
              style={{ display: 'flex', alignItems: 'center', gap: 8, background: activeView === 'ACTIONS' ? UI.primary : 'transparent', color: activeView === 'ACTIONS' ? '#fff' : UI.muted, border: `1px solid ${activeView === 'ACTIONS' ? UI.primary : 'transparent'}`, padding: '8px 16px', borderRadius: SQUARE_RADIUS, fontSize: 13, fontWeight: activeView === 'ACTIONS' ? 600 : 500, cursor: 'pointer', transition: 'all 0.2s' }}
            >
              <ListTodo size={16} /> Action Items Tracker
            </button>
<button 
  onClick={() => {
    setActiveView('PLANNING');
    setActiveWeek(getWeekFromDate(getDynamicDate())); // Resets to current week
  }}
  style={{ display: 'flex', alignItems: 'center', gap: 8, background: activeView === 'PLANNING' ? UI.primary : 'transparent', color: activeView === 'PLANNING' ? '#fff' : UI.muted, border: `1px solid ${activeView === 'PLANNING' ? UI.primary : 'transparent'}`, padding: '8px 16px', borderRadius: SQUARE_RADIUS, fontSize: 13, fontWeight: activeView === 'PLANNING' ? 600 : 500, cursor: 'pointer', transition: 'all 0.2s' }}
>
  <CalendarDays size={16} /> Add New Meeting
</button>
          </div>

          {/* WARNINGS */}
          {schemaWarn && (
            <ThemedCard style={{ padding: 16, background: '#fffbeb', border: '1px solid #fde68a', marginBottom: 24 }} accentColor={UI.accentYellow}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <AlertTriangle size={18} style={{ marginTop: 2, color: '#92400e' }} />
                <div>
                  <div style={{ fontWeight: 600, color: '#92400e' }}>Database Update Required</div>
                  <div style={{ marginTop: 4, fontSize: 13, color: '#92400e' }}>
                    To group classes, the <code>weekly_coordination_meetings</code> table needs <code>school_id</code> and <code>week_number</code> columns.
                  </div>
                </div>
              </div>
            </ThemedCard>
          )}

          {/* VIEW: MEETING LOGS */}
          {activeView === 'LOGS' && (
            <ThemedCard style={{ padding: 24 }} accentColor={UI.accentSlate}>
              <SectionHeader icon={History} title="Meeting Logs" />
              
              {allSchoolMeetings.length === 0 ? (
                <div style={{ fontSize: 13, color: UI.muted, fontStyle: 'italic', textAlign: 'center', padding: '24px 0' }}>No meetings found. Start planning to create logs!</div>
              ) : (
                <div style={{ display: 'grid', gap: 16 }}>
                  {allSchoolMeetings.map(m => {
                    const d = new Date(m.meeting_date);
                    const formattedDate = isNaN(d) ? m.meeting_date : d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
                    
                    return (
                      <div key={m.id} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 24, background: '#fff', padding: '16px 20px', borderRadius: SQUARE_RADIUS, border: `1px solid ${UI.border}`, boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                        <div style={{ textAlign: 'center', background: rgba(UI.primary, 0.04), padding: '12px 16px', borderRadius: SQUARE_RADIUS }}>
                          <div style={{ fontSize: 11, fontWeight: 500, color: UI.primary, textTransform: 'uppercase', letterSpacing: 0.5 }}>Week</div>
                          <div style={{ fontSize: 24, fontWeight: 700, color: UI.primary, lineHeight: 1.1 }}>{m.week_number}</div>
                        </div>
                        
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: UI.primary, marginBottom: 6 }}>{formattedDate}</div>
                          
                          <div style={{ fontSize: 13, color: UI.text, marginBottom: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 500, color: UI.muted }}>Attendees:</span>
                            {(m.attendees || []).map(a => teacherOptions.find(t => t.id === a)?.name || a).join(', ') || 'None listed'}
                          </div>

                          {m.notes && (
                            <div style={{ fontSize: 13, color: UI.text, fontStyle: 'italic', background: '#f9fafb', padding: '8px 12px', borderRadius: SQUARE_RADIUS, borderLeft: `3px solid ${UI.border}` }}>
                              {m.notes.length > 120 ? m.notes.substring(0, 120) + '...' : m.notes}
                            </div>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <Button variant="primary" onClick={() => { setActiveWeek(m.week_number); setActiveView('PLANNING'); }}>
                            View Details <ChevronRight size={14} />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ThemedCard>
          )}

          {/* VIEW: ACTION ITEMS TRACKER */}
          {activeView === 'ACTIONS' && (
            <div style={{ display: 'grid', gap: 24 }}>
              <ThemedCard style={{ padding: 24 }} accentColor={UI.accentTeal}>
                <SectionHeader icon={ListTodo} title="Pending Actions" />
                
                {pendingActions.length === 0 ? (
                  <div style={{ fontSize: 13, color: UI.muted, fontStyle: 'italic', textAlign: 'center', padding: '24px 0' }}>🎉 Great job! No pending action items.</div>
                ) : (
                  <div style={{ display: 'grid', gap: 12 }}>
                    {pendingActions.map((a) => {
                      const mtg = allSchoolMeetings.find(m => m.id === a.meeting_id);
                      return (
                        <div key={a.id} style={{ display: 'grid', gridTemplateColumns: '1fr 180px 160px 105px', gap: 16, alignItems: 'center', background: '#fff', padding: '14px 16px', borderRadius: SQUARE_RADIUS, border: `1px solid ${UI.border}` }}>
                          <div style={{ wordBreak: 'break-word' }}>
                            <div style={{ fontSize: 13, fontWeight: 500, color: UI.primary, marginBottom: 4, lineHeight: '1.4' }}>{a.description || 'Untitled Action'}</div>
                            <div style={{ fontSize: 12, color: UI.muted, display: 'flex', gap: 12, fontWeight: 400 }}>
                              <span>{a.subject || 'General'}</span>
                              {a.target_student_id && <span>• {studentOptions.find(s => s.id === a.target_student_id)?.name || 'Unknown Student'}</span>}
                              {mtg && <span>• Assigned Week {mtg.week_number}</span>}
                            </div>
                          </div>
                          
                          <div style={{ fontSize: 13, fontWeight: 400, color: UI.text }}>
                            {a.custom_assignee || teacherOptions.find(t => t.id === a.assigned_to)?.name || 'Unassigned'}
                          </div>

                          <div style={{ fontSize: 12, color: a.due_date ? UI.text : UI.muted, fontWeight: 400 }}>
                            {a.due_date ? `Due: ${a.due_date}` : 'No due date'}
                          </div>

                          <StatusPill status={a.status} onClick={() => mutateTable(T_ACTIONS, 'update', a.id, { status: cycleStatus(a.status) })} />
                        </div>
                      );
                    })}
                  </div>
                )}
              </ThemedCard>

              <ThemedCard style={{ padding: 24, opacity: 0.8 }} accentColor={UI.border}>
                <SectionHeader icon={CheckCircle2} title="Completed Actions" />
                
                {doneActions.length === 0 ? (
                  <div style={{ fontSize: 13, color: UI.muted, fontStyle: 'italic' }}>No completed items yet.</div>
                ) : (
                  <div style={{ display: 'grid', gap: 8 }}>
                    {doneActions.slice(0, 30).map((a) => (
                      <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f9fafb', padding: '10px 16px', borderRadius: SQUARE_RADIUS, border: `1px solid ${UI.border}` }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ textDecoration: 'line-through', fontSize: 13, fontWeight: 400, color: UI.muted }}>{a.description}</div>
                          <div style={{ fontSize: 11, color: UI.muted }}>({a.custom_assignee || teacherOptions.find(t => t.id === a.assigned_to)?.name || 'Unassigned'})</div>
                        </div>
                        <StatusPill status={a.status} onClick={() => mutateTable(T_ACTIONS, 'update', a.id, { status: cycleStatus(a.status) })} />
                      </div>
                    ))}
                  </div>
                )}
              </ThemedCard>
            </div>
          )}

          {/* VIEW: WEEKLY PLANNING */}
          {activeView === 'PLANNING' && (
            <div style={{ display: 'grid', gap: 28 }}>
              {/* 1. MEETING CONTEXT */}
              <ThemedCard style={{ padding: 24 }} accentColor={UI.accentTeal}>
                <SectionHeader 
                  icon={Users} 
                  title="Meeting Context" 
                  right={<Button variant="solid" onClick={saveMeeting}><Save size={16} /> {meeting?.id ? 'Save Context' : 'Start Coordination'}</Button>}
                />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                  <Field type="date" value={meetingForm.meeting_date} onChange={(e) => setMeetingForm(p => ({ ...p, meeting_date: e.target.value }))} />
                  <Field type="time" value={meetingForm.start_time || ''} onChange={(e) => setMeetingForm(p => ({ ...p, start_time: e.target.value }))} />
                  <Field type="time" value={meetingForm.end_time || ''} onChange={(e) => setMeetingForm(p => ({ ...p, end_time: e.target.value }))} />
                </div>
                
                <div style={{ marginTop: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: UI.muted, marginBottom: 8 }}>Attendees & Staff Present</div>
                  <SearchableSelect 
                    options={teacherOptions} 
                    allowCustom={true} 
                    placeholder="Search staff or type a custom name and press Enter..." 
                    value="" 
                    onChange={(val) => {
                      const finalId = handleCustomTeacher(val);
                      if (finalId) {
                        const current = new Set(meetingForm.attendees);
                        current.add(finalId);
                        setMeetingForm(p => ({ ...p, attendees: [...current] }));
                      }
                    }}
                  />
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                    {meetingForm.attendees.map((a, idx) => (
                      <span key={idx} style={{ background: '#f3f4f6', border: `1px solid ${UI.border}`, color: UI.primary, padding: '4px 12px', borderRadius: SQUARE_RADIUS, fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 }}>
                        {teacherOptions.find(t => t.id === a)?.name || a}
                        <Trash2 size={14} style={{ cursor: 'pointer', opacity: 0.5 }} onClick={() => setMeetingForm(p => ({...p, attendees: p.attendees.filter(x => x !== a)}))} />
                      </span>
                    ))}
                  </div>
                </div>

                <Field as="textarea" rows={3} style={{ marginTop: 20 }}
                  value={meetingForm.notes} onChange={(e) => setMeetingForm(p => ({ ...p, notes: e.target.value }))}
                  placeholder="General weekly notes, events, or school-wide alerts..."
                />
              </ThemedCard>

              {meeting?.id && (
                <>
                  {/* 2. OBSERVATIONS (Expanded Textareas) */}
                  <ThemedCard style={{ padding: 24 }} accentColor={UI.accentPeach}>
                    <SectionHeader 
                      icon={Search} 
                      title="Class Observations" 
                      right={<Button variant="primary" onClick={() => mutateTable(T_OBS, 'insert', null, { meeting_id: meeting.id, type: 'BEHAVIORAL', observation: '' })}><Plus size={14} /> Add Note</Button>}
                    />

                    <div style={{ display: 'grid', gap: 12 }}>
                      {observations.length === 0 ? (
                        <div style={{ fontSize: 13, color: UI.muted, fontStyle: 'italic', padding: '12px 0' }}>No static observations logged yet.</div>
                      ) : observations.map((o) => (
                        <div key={o.id} style={{ display: 'grid', gridTemplateColumns: '140px 240px 1fr auto', gap: 12, alignItems: 'flex-start', background: '#f9fafb', padding: '10px 14px', borderRadius: SQUARE_RADIUS, border: `1px solid ${UI.border}` }}>
                          <Field as="select" value={o.type || 'BEHAVIORAL'} onChange={(e) => mutateTable(T_OBS, 'update', o.id, { type: e.target.value })}>
                            <option value="BEHAVIORAL">Behavioral</option>
                            <option value="ACADEMIC">Academic</option>
                            <option value="SOCIAL">Social</option>
                          </Field>

                          <SearchableSelect 
                            options={studentOptions} 
                            value={o.student_id || ''} 
                            placeholder="Search Student..." 
                            onChange={(val) => mutateTable(T_OBS, 'update', o.id, { student_id: val })} 
                          />

                          <Field as="textarea" rows={3} value={o.observation || ''} onChange={(e) => mutateTable(T_OBS, 'update', o.id, { observation: e.target.value })} placeholder="What was observed?" />

                          <button onClick={() => mutateTable(T_OBS, 'delete', o.id)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px', borderRadius: SQUARE_RADIUS }}><Trash2 size={16} /></button>
                        </div>
                      ))}
                    </div>
                  </ThemedCard>

                  {/* 3. CURRICULUM FLOW (Expanded Textareas) */}
                  <ThemedCard style={{ padding: 24 }} accentColor={UI.accentYellow}>
                    <SectionHeader icon={BookOpen} title="Subjects Coordination" />
                    
                    <div style={{ display: 'grid', gap: 20 }}>
                      {DISPLAY_SUBJECTS.map((subject) => {
                        const entries = subjectEntries.filter(e => e.subject === subject);
                        
                        return (
                          <div key={subject} style={{ padding: '16px 20px', background: '#f9fafb', border: `1px solid ${UI.border}`, borderRadius: SQUARE_RADIUS }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: entries.length ? 16 : 0 }}>
                              <div style={{ fontSize: 15, fontWeight: 600, color: UI.primary }}>{subject}</div>
                              <Button variant="primary" style={{ padding: '4px 10px', fontSize: 12, height: '32px' }} onClick={() => mutateTable(T_SUBJECT_ENTRIES, 'insert', null, { meeting_id: meeting.id, subject, notes: '' })}><Plus size={14} /> Add Class Note</Button>
                            </div>

                            <div style={{ display: 'grid', gap: 10 }}>
                              {entries.map(e => (
                                <div key={e.id} style={{ display: 'grid', gridTemplateColumns: '180px 180px 1fr auto', gap: 12, alignItems: 'flex-start', background: '#fff', padding: '10px 14px', borderRadius: SQUARE_RADIUS, border: `1px solid ${UI.border}`, boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                                  
                                  <SearchableSelect 
                                    options={teacherOptions} allowCustom={true} placeholder="Teacher..." value={e.teacher_id || e.custom_teacher_name || ''}
                                    onChange={(val) => {
                                      const finalId = handleCustomTeacher(val);
                                      const isDB = dbTeachers.find(t => t.id === finalId);
                                      mutateTable(T_SUBJECT_ENTRIES, 'update', e.id, isDB ? { teacher_id: finalId, custom_teacher_name: null } : { teacher_id: null, custom_teacher_name: finalId });
                                    }}
                                  />

                                  <Field as="select" value={e.classroom_id || ''} onChange={(ev) => mutateTable(T_SUBJECT_ENTRIES, 'update', e.id, { classroom_id: ev.target.value || null })}>
                                    <option value="">Select Class...</option>
                                    {classOptions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                  </Field>

                                  <Field as="textarea" rows={3} value={e.notes || ''} onChange={(ev) => mutateTable(T_SUBJECT_ENTRIES, 'update', e.id, { notes: ev.target.value })} placeholder="Materials used, lessons given, group progress..." />
                                  
                                  <button onClick={() => mutateTable(T_SUBJECT_ENTRIES, 'delete', e.id)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#dc2626', padding: '8px' }}><Trash2 size={16} /></button>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </ThemedCard>

                  {/* 4. MASTER ACTION PLAN (Expanded Textareas) */}
                  <ThemedCard style={{ padding: 24 }} accentColor={UI.accentSlate}>
                    <SectionHeader 
                      icon={Target} 
                      title="Action Plan" 
                      right={<Button variant="solid" onClick={() => mutateTable(T_ACTIONS, 'insert', null, { meeting_id: meeting.id, status: 'PENDING', description: '', subject: 'General' })}><Plus size={14} /> Add Action Item</Button>}
                    />

                    <div style={{ display: 'grid', gap: 12 }}>
                      {actions.length === 0 ? (
                        <div style={{ fontSize: 13, color: UI.muted, fontStyle: 'italic', padding: '12px 0' }}>No action items assigned.</div>
                      ) : actions.map((a) => (
                        <div key={a.id} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 140px 140px 130px 105px auto', gap: 10, alignItems: 'flex-start', background: '#fff', padding: '10px 14px', borderRadius: SQUARE_RADIUS, border: `1px solid ${UI.border}`, boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                          
                          <Field as="select" value={a.subject || 'General'} onChange={(e) => mutateTable(T_ACTIONS, 'update', a.id, { subject: e.target.value })}>
                            {actionCategories.map(c => <option key={c} value={c}>{c}</option>)}
                          </Field>
                          
                          <Field as="textarea" rows={3} value={a.description || ''} onChange={(e) => mutateTable(T_ACTIONS, 'update', a.id, { description: e.target.value })} placeholder="Action required..." />
                          
                          <SearchableSelect 
                            options={studentOptions} value={a.target_student_id || ''} placeholder="Student (optional)" 
                            onChange={(val) => mutateTable(T_ACTIONS, 'update', a.id, { target_student_id: val })} 
                          />

                          <SearchableSelect 
                            options={teacherOptions} allowCustom={true} placeholder="Assignee..." value={a.assigned_to || a.custom_assignee || ''}
                            onChange={(val) => {
                              const finalId = handleCustomTeacher(val);
                              const isDB = dbTeachers.find(t => t.id === finalId);
                              mutateTable(T_ACTIONS, 'update', a.id, isDB ? { assigned_to: finalId, custom_assignee: null } : { assigned_to: null, custom_assignee: finalId });
                            }}
                          />

                          <Field type="date" value={a.due_date || ''} onChange={(e) => mutateTable(T_ACTIONS, 'update', a.id, { due_date: e.target.value || null })} />

                          <StatusPill status={a.status} onClick={() => mutateTable(T_ACTIONS, 'update', a.id, { status: cycleStatus(a.status) })} />

                          <button onClick={() => mutateTable(T_ACTIONS, 'delete', a.id)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#dc2626', display: 'flex', justifyContent: 'center', padding: '8px' }}><Trash2 size={16} /></button>
                        </div>
                      ))}
                    </div>
                  </ThemedCard>
                </>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}