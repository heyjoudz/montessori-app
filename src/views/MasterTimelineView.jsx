import React, { useState, useRef, useMemo, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { THEME, getSubjectStyle } from '../ui/theme'; 
import {
  SUBJECT_KEYS,
  getWeekFromDate,
  getWeekRangeLabel,
  getWeekStartFromAcademic,
} from '../utils/helpers';
import {
  Plus,
  Save,
  X,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  BookOpen,
  CalendarDays,
  LayoutGrid,
  Search,
  Eye,
  MoreHorizontal,
  Edit3,
  Trash2,
} from 'lucide-react';

// ---------- THEME HELPERS ----------
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

// Map Theme to UI constants for easy access
const UI = {
  bg: THEME.bg,
  card: THEME.cardBg,
  text: THEME.text,
  muted: THEME.textMuted,
  primary: THEME.brandPrimary,
  secondary: THEME.brandSecondary, 
  accent: THEME.brandAccent,       
  yellow: THEME.brandYellow,
  borderSoft: THEME.brandAccent,   
};

// ---------- UI COMPONENTS ----------
const ThemedCard = ({ children, style, className = '', onClick }) => (
  <div
    className={`mb-card ${className}`}
    onClick={onClick}
    style={{
      backgroundColor: UI.card,
      borderRadius: THEME.radius,
      boxShadow: THEME.cardShadow,
      border: `1px solid ${UI.accent}`,
      overflow: 'hidden',
      cursor: onClick ? 'pointer' : 'default',
      transition: 'box-shadow 150ms ease, transform 150ms ease',
      ...style,
    }}
  >
    {children}
  </div>
);

const Label = ({ children, style }) => (
  <div
    style={{
      fontSize: 10,
      fontWeight: 700,
      color: UI.muted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      fontFamily: THEME.sansFont,
      ...style,
    }}
  >
    {children}
  </div>
);

const Field = ({ as = 'input', style, onFocus, onBlur, children, ...props }) => {
  const Comp = as;
  return (
    <Comp
      {...props}
      style={{
        width: '100%',
        padding: '10px 14px', 
        borderRadius: THEME.radius,
        border: `1px solid ${UI.accent}`,
        fontSize: 13, 
        outline: 'none',
        boxSizing: 'border-box',
        fontFamily: THEME.sansFont,
        color: UI.text,
        backgroundColor: '#fff',
        transition: 'all 0.15s ease',
        ...(as === 'select' ? { cursor: 'pointer', appearance: 'none' } : null),
        ...style,
      }}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = UI.primary;
        e.currentTarget.style.boxShadow = `2px 2px 0px 0px ${UI.accent}`;
        onFocus?.(e);
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = UI.accent;
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
    borderRadius: THEME.radius,
    fontFamily: THEME.sansFont,
    fontWeight: 600,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '8px 16px', 
    fontSize: 12, 
    transition: 'transform 100ms ease, box-shadow 100ms ease',
    userSelect: 'none',
    whiteSpace: 'nowrap',
  };

  const variants = {
    primary: {
      background: '#fff',
      color: UI.primary,
      border: `1px solid ${UI.accent}`,
      boxShadow: `2px 2px 0px 0px ${UI.accent}`, 
    },
    solid: {
      background: UI.primary,
      color: '#fff',
      border: `1px solid ${UI.primary}`,
      boxShadow: `2px 2px 0px 0px ${UI.accent}`,
    },
    ghost: {
      background: 'transparent',
      color: UI.muted,
      border: `1px solid transparent`,
      boxShadow: 'none',
    },
  };

  return (
    <button
      {...props}
      style={{ ...base, ...(variants[variant] || variants.primary), ...style }}
      onMouseDown={(e) => {
        if (variant !== 'ghost') {
          e.currentTarget.style.transform = 'translate(1px, 1px)';
          e.currentTarget.style.boxShadow = `1px 1px 0px 0px ${UI.accent}`;
        }
      }}
      onMouseUp={(e) => {
        if (variant !== 'ghost') {
          e.currentTarget.style.transform = 'translate(0, 0)';
          e.currentTarget.style.boxShadow = variants[variant].boxShadow;
        }
      }}
      onMouseLeave={(e) => {
        if (variant !== 'ghost') {
          e.currentTarget.style.transform = 'translate(0, 0)';
          e.currentTarget.style.boxShadow = variants[variant].boxShadow;
        }
      }}
    >
      {children}
    </button>
  );
};

// MATCHES EXACT INDIVIDUAL PLANNER DESIGN
const ClassTab = ({ active, label, onClick }) => (
  <button
    onClick={onClick}
    style={{
      border: 'none',
      cursor: 'pointer',
      padding: '12px 20px',
      background: active ? UI.primary : '#fff',
      color: active ? '#fff' : UI.text,
      boxShadow: active ? `4px 4px 0px 0px ${UI.secondary}` : '2px 2px 0px #eee',
      fontWeight: 700,
      borderRadius: THEME.radius,
      transition: 'all 0.15s',
      fontFamily: THEME.sansFont,
      fontSize: 13,
    }}
  >
    {label}
  </button>
);

const ViewToggle = ({ active, icon: Icon, label, onClick }) => (
  <button
    onClick={onClick}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '6px 14px',
      borderRadius: 4, 
      border: active ? `1px solid ${UI.primary}` : `1px solid transparent`,
      background: active ? rgba(UI.primary, 0.08) : 'transparent',
      color: active ? UI.primary : UI.muted,
      fontSize: 12, 
      fontWeight: 600,
      cursor: 'pointer',
      transition: 'all 0.15s ease',
      fontFamily: THEME.sansFont,
      userSelect: 'none',
    }}
  >
    {Icon && <Icon size={14} color={active ? UI.primary : UI.muted} />}
    {label}
  </button>
);

const JumpChip = ({ active, children, onClick }) => (
  <button
    onClick={onClick}
    data-active={active} // Used for auto-scrolling
    style={{
      minWidth: 40,
      padding: '6px 0',
      borderRadius: THEME.radius,
      border: active ? `1px solid ${UI.primary}` : `1px solid ${UI.accent}`,
      background: active ? rgba(UI.primary, 0.05) : '#fff',
      color: active ? UI.primary : UI.primary,
      fontSize: 11,
      fontWeight: 600,
      cursor: 'pointer',
      flexShrink: 0,
      fontFamily: THEME.sansFont,
      transition: 'all 0.15s ease',
      userSelect: 'none',
      boxShadow: active ? `2px 2px 0px 0px ${UI.accent}` : 'none',
    }}
  >
    {children}
  </button>
);

const StatusChip = ({ status, onClick }) => {
  let styleConfig = { bg: '#f1f5f9', text: '#475569', border: '1px solid #e2e8f0' };
  let label = 'To Do';

  if (status === 'IN_PROGRESS') {
    styleConfig = { bg: '#fef3c7', text: '#92400e', border: '1px solid #fde68a' }; // Amber/Yellow
    label = 'In Progress';
  } else if (status === 'DONE') {
    styleConfig = { bg: '#dcfce7', text: '#166534', border: '1px solid #bbf7d0' }; // Green
    label = 'Done';
  } else if (status === 'LATE') {
    styleConfig = { bg: '#fee2e2', text: '#991b1b', border: '1px solid #fecaca' }; // Red
    label = 'Late';
  }

  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        padding: '6px 0',
        borderRadius: THEME.radius,
        background: styleConfig.bg,
        color: styleConfig.text,
        border: styleConfig.border,
        fontSize: 10, 
        fontWeight: 700,
        cursor: 'pointer',
        textAlign: 'center',
        fontFamily: THEME.sansFont,
        userSelect: 'none',
      }}
    >
      {label}
    </button>
  );
};

const IconPill = ({ icon: Icon, children, style }) => (
  <div
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '4px 12px',
      borderRadius: THEME.radius,
      background: '#fff',
      border: `1px solid ${UI.accent}`,
      color: UI.primary,
      fontSize: 11, 
      fontWeight: 600,
      fontFamily: THEME.sansFont,
      ...style,
    }}
  >
    {Icon ? <Icon size={12} color={UI.primary} /> : null}
    {children}
  </div>
);

// --- MAIN COMPONENT ---
export default function MasterTimelineView({
  masterPlans,
  planSessions,
  classrooms,
  selectedClassId: propClassId,
  showToast,
  onDataChanged,
}) {
  const [selectedClassId, setSelectedClassId] = useState(propClassId || classrooms?.[0]?.id);
  const [areaFilter, setAreaFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState('WEEK');

  const [collapsedWeeks, setCollapsedWeeks] = useState({});
  const [collapsedMonths, setCollapsedMonths] = useState({});

  // Local state for instant (optimistic) updates across sessions
  const [localSessions, setLocalSessions] = useState([]);

  const weekRefMap = useRef({});
  const weekNavRef = useRef(null);

  const [inlineWeekEdit, setInlineWeekEdit] = useState(null);
  const [inlineAddLocation, setInlineAddLocation] = useState(null);
  const [inlineAddForm, setInlineAddForm] = useState({ category: 'Uncategorized', raw_activity: '', teacher_notes: '' });
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [editingSessionForm, setEditingSessionForm] = useState({});

  // Real-time dynamic date generation handling weekends
  const getDynamicDate = () => {
    const d = new Date();
    const day = d.getDay();
    if (day === 6) d.setDate(d.getDate() + 2); // Sat jumps to Mon
    if (day === 0) d.setDate(d.getDate() + 1); // Sun jumps to Mon
    return d;
  };

  const [currentDate, setCurrentDate] = useState(getDynamicDate());

  // Navigation states for active views
  const [activeWeek, setActiveWeek] = useState(1);
  const [activeMonth, setActiveMonth] = useState('');

  // Keep date live and real time
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDate(getDynamicDate());
    }, 60000); 
    return () => clearInterval(timer);
  }, []);

  // Initialize navigation states based on real-time date on mount
  useEffect(() => {
    setActiveWeek(getWeekFromDate(currentDate));
    setActiveMonth(currentDate.toLocaleString('default', { month: 'long', year: 'numeric' }));
  }, []); // Only run once on mount

  // Scroll horizontal timeline nav directly to the active week automatically 
  useEffect(() => {
    if (weekNavRef.current) {
      const activeChip = weekNavRef.current.querySelector('[data-active="true"]');
      if (activeChip) {
        activeChip.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [activeWeek, viewMode]);

  useEffect(() => {
    if (propClassId && String(propClassId) !== String(selectedClassId)) setSelectedClassId(propClassId);
  }, [propClassId]);

  useEffect(() => {
    if (!selectedClassId && classrooms?.[0]?.id) setSelectedClassId(classrooms[0].id);
  }, [classrooms, selectedClassId]);

  useEffect(() => {
    setLocalSessions(planSessions || []);
  }, [planSessions]);

  const toDate = (v) => {
    if (!v) return null;
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  };

  const addDaysDate = (d, n) => {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  };

  const currentRealWeek = useMemo(() => getWeekFromDate(currentDate), [currentDate]);

  const weeks = useMemo(() => {
    const plans = (masterPlans || []).filter((p) => String(p.classroom_id) === String(selectedClassId));
    const byWeek = {};

    for (const p of plans) {
      const w = Number(p.week_number ?? p.week_num ?? p.week);
      if (!Number.isFinite(w)) continue;
      
      if (!byWeek[w]) byWeek[w] = { week: w, plans: [], startDate: null, dbDateRange: null };
      
      byWeek[w].plans.push(p);

      // CAPTURE DATE RANGE FROM DB
      if (p.date_range && !byWeek[w].dbDateRange) {
        byWeek[w].dbDateRange = p.date_range;
      }

      if (!byWeek[w].startDate) byWeek[w].startDate = toDate(getWeekStartFromAcademic(w));
    }

    for (const wStr of Object.keys(byWeek)) {
      const w = Number(wStr);
      const planIds = new Set(byWeek[w].plans.map((x) => String(x.id)));

      const sessions = (localSessions || [])
        .filter((s) => planIds.has(String(s.plan_id)))
        .map((s) => {
          let progressData = s.progress_data || {};
          if (Object.keys(progressData).length === 0 && typeof s.status === 'string' && s.status.startsWith('{')) {
            try {
              progressData = JSON.parse(s.status);
            } catch (e) {}
          }
          return { ...s, progressData, rawStatus: s.status };
        });

      byWeek[w].sessions = sessions;
      const themes = byWeek[w].plans.map((x) => (x.theme || '').trim()).filter(Boolean);
      byWeek[w].theme = themes[0] || '—';
      
      const s = byWeek[w].startDate;
      const e = s ? addDaysDate(s, 4) : null;
      
      // PRIORITIZE DATABASE DATE RANGE over the calculation
      if (byWeek[w].dbDateRange) {
        byWeek[w].rangeLabel = byWeek[w].dbDateRange;
      } else {
        byWeek[w].rangeLabel = s
          ? `${s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${e.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })}`
          : getWeekRangeLabel(w);
      }
      
      byWeek[w].monthKey = s ? s.toLocaleString('default', { month: 'long', year: 'numeric' }) : 'Unscheduled';
    }

    return Object.values(byWeek).sort((a, b) => a.week - b.week);
  }, [masterPlans, localSessions, selectedClassId]);

  const uniqueMonths = useMemo(() => [...new Set(weeks.map((w) => w.monthKey))], [weeks]);

  const displayedWeeks = useMemo(() => {
    if (viewMode === 'YEAR') return weeks;
    if (viewMode === 'MONTH') return weeks.filter((w) => w.monthKey === activeMonth);
    const current = weeks.find((w) => w.week === activeWeek);
    return current ? [current] : [];
  }, [weeks, viewMode, activeWeek, activeMonth]);

  const monthsData = useMemo(() => {
    const groups = {};
    displayedWeeks.forEach((w) => {
      if (!groups[w.monthKey]) groups[w.monthKey] = [];
      groups[w.monthKey].push(w);
    });
    return groups;
  });

  const refresh = async () => {
    try {
      await onDataChanged?.();
    } catch {}
  };

  const cycleStatus = (current) => {
    const map = { TODO: 'IN_PROGRESS', IN_PROGRESS: 'DONE', DONE: 'LATE', LATE: 'TODO' };
    return map[current || 'TODO'] || 'IN_PROGRESS';
  };

  const handleStatusChange = async (session, teacherName) => {
    const currentVal = session.progressData?.[teacherName] || 'TODO';
    const nextVal = cycleStatus(currentVal);
    const updatedProgress = { ...session.progressData, [teacherName]: nextVal };

    setLocalSessions((prev) =>
      prev.map((s) => (s.id === session.id ? { ...s, progress_data: updatedProgress } : s))
    );

    try {
      await supabase.from('term_plan_sessions').update({ progress_data: updatedProgress }).eq('id', session.id);
      refresh();
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveNewSession = async () => {
    if (!inlineAddLocation) return;
    const tempId = `temp-${Date.now()}`;
    const newSessionData = {
      id: tempId,
      plan_id: inlineAddLocation.planId,
      area: inlineAddLocation.area,
      raw_activity: inlineAddForm.raw_activity,
      teacher_notes: inlineAddForm.teacher_notes,
      category: inlineAddForm.category || 'Uncategorized',
      status: 'TODO',
      progress_data: {},
    };

    setLocalSessions((prev) => [...prev, newSessionData]);
    setInlineAddLocation(null);
    setInlineAddForm({ category: 'Uncategorized', raw_activity: '', teacher_notes: '' });

    const { data, error } = await supabase
      .from('term_plan_sessions')
      .insert({
        plan_id: newSessionData.plan_id,
        area: newSessionData.area,
        raw_activity: newSessionData.raw_activity,
        teacher_notes: newSessionData.teacher_notes,
        category: newSessionData.category,
        status: newSessionData.status,
        progress_data: newSessionData.progress_data,
      })
      .select();

    if (!error && data && data.length > 0) {
      setLocalSessions((prev) => prev.map((s) => (s.id === tempId ? data[0] : s)));
      refresh();
    }
  };

  // New Delete Handler
  const handleDeleteSession = async (sessionId) => {
    if (!window.confirm('Are you sure you want to delete this activity?')) return;

    // Instantly remove from local view
    setLocalSessions((prev) => prev.filter((s) => s.id !== sessionId));

    try {
      await supabase.from('term_plan_sessions').delete().eq('id', sessionId);
      refresh();
    } catch (e) {
      console.error('Failed to delete session:', e);
    }
  };

  const updateWeekPlanByIds = async (planIds, patch) => {
    await supabase.from('term_plans').update(patch).in('id', planIds);
  };

  const matchesFilters = (s) => {
    const q = search.toLowerCase();
    const txt = `${s.area} ${s.category} ${s.raw_activity} ${s.teacher_notes}`.toLowerCase();
    if (areaFilter !== 'ALL' && s.area !== areaFilter && s.curriculum_areas?.name !== areaFilter) return false;
    return !q || txt.includes(q);
  };

  const buildTree = (sessions) => {
    const tree = {};
    sessions.forEach((s) => {
      const area = s.curriculum_areas?.name || s.area || 'General';
      const cat = s.curriculum_categories?.name || s.category || 'Uncategorized';
      if (!tree[area]) tree[area] = {};
      if (!tree[area][cat]) tree[area][cat] = [];
      tree[area][cat].push(s);
    });
    return tree;
  };

  const jumpToWeek = (weekNum) => {
    setActiveWeek(weekNum);
    if (viewMode === 'YEAR') {
      setTimeout(() => {
        weekRefMap.current[weekNum]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    } else {
      setViewMode('WEEK');
    }
  };

  const handlePrev = () => {
    if (viewMode === 'WEEK') setActiveWeek((w) => Math.max(1, w - 1));
    if (viewMode === 'MONTH') {
      const idx = uniqueMonths.indexOf(activeMonth);
      if (idx > 0) setActiveMonth(uniqueMonths[idx - 1]);
    }
  };

  const handleNext = () => {
    if (viewMode === 'WEEK') setActiveWeek((w) => Math.min(weeks.length || 40, w + 1));
    if (viewMode === 'MONTH') {
      const idx = uniqueMonths.indexOf(activeMonth);
      if (idx >= 0 && idx < uniqueMonths.length - 1) setActiveMonth(uniqueMonths[idx + 1]);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - clamp(32px, 6vw, 100px))',
        width: '100%',
        background: UI.bg,
        fontFamily: THEME.sansFont,
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      <style>{`
        .mb-card:hover { box-shadow: ${THEME.cardShadowHover} !important; transform: translate(-1px, -1px); }
        .mb-hide-scroll::-webkit-scrollbar { display: none; }
      `}</style>

      {/* STICKY HEADER */}
      <div
        style={{
          flexShrink: 0,
          background: UI.bg,
          padding: '20px 24px 12px', 
        }}
      >
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          {classrooms?.map((c) => (
            <ClassTab key={c.id} active={String(selectedClassId) === String(c.id)} label={c.name} onClick={() => setSelectedClassId(c.id)} />
          ))}
        </div>

        <ThemedCard style={{ padding: '14px 16px', border: `1px solid ${UI.accent}` }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 20,
            }}
          >
            <div>
              <div style={{ fontFamily: THEME.serifFont, fontSize: 20, fontWeight: 700, color: UI.primary, lineHeight: 1.1 }}>
                Scope & Sequence
              </div>
              
              {/* View Modes + Quick Nav Arrows */}
              <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <ViewToggle active={viewMode === 'WEEK'} icon={Eye} label="Week" onClick={() => setViewMode('WEEK')} />
                <ViewToggle active={viewMode === 'MONTH'} icon={CalendarDays} label="Month" onClick={() => setViewMode('MONTH')} />
                <ViewToggle active={viewMode === 'YEAR'} icon={LayoutGrid} label="Year" onClick={() => setViewMode('YEAR')} />
                
                {(viewMode === 'WEEK' || viewMode === 'MONTH') && (
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 4, 
                    marginLeft: 12, 
                    background: rgba(UI.primary, 0.05), 
                    borderRadius: THEME.radius, 
                    padding: '2px 4px' 
                  }}>
                    <button onClick={handlePrev} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 4, color: UI.primary, display: 'flex' }} title="Previous">
                      <ChevronLeft size={16} />
                    </button>
                    <span style={{ fontSize: 12, fontWeight: 700, color: UI.primary, minWidth: 80, textAlign: 'center', userSelect: 'none' }}>
                      {viewMode === 'WEEK' ? `Week ${activeWeek}` : activeMonth.split(' ')[0]}
                    </span>
                    <button onClick={handleNext} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 4, color: UI.primary, display: 'flex' }} title="Next">
                      <ChevronRight size={16} />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                gap: 16,
                alignItems: 'center',
                justifyContent: 'flex-end',
                flex: 1,
                flexWrap: 'wrap',
                minWidth: 260,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Label>Jump To</Label>
                <div
                  className="mb-hide-scroll"
                  style={{
                    display: 'flex',
                    gap: 6,
                    overflowX: 'auto',
                    maxWidth: 280,
                    scrollbarWidth: 'none',
                    padding: '4px 0',
                  }}
                  ref={weekNavRef}
                >
                  {weeks.map((w) => (
                    <JumpChip key={w.week} active={w.week === activeWeek} onClick={() => jumpToWeek(w.week)}>
                      W{w.week}
                    </JumpChip>
                  ))}
                </div>
              </div>

              <div style={{ width: 1, height: 28, background: UI.accent }} />

              <div style={{ position: 'relative', width: 220 }}>
                <Search
                  size={14}
                  style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: UI.muted }}
                />
                <Field value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search activities..." style={{ paddingLeft: 34 }} />
              </div>

              <div style={{ position: 'relative', minWidth: 160 }}>
                <Field as="select" value={areaFilter} onChange={(e) => setAreaFilter(e.target.value)} style={{ paddingRight: 30 }}>
                  <option value="ALL">All Areas</option>
                  {SUBJECT_KEYS.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </Field>
                <div
                  style={{
                    position: 'absolute',
                    right: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    pointerEvents: 'none',
                    color: UI.primary,
                  }}
                >
                  <ChevronDown size={14} />
                </div>
              </div>
            </div>
          </div>
        </ThemedCard>
      </div>

      {/* SCROLLABLE CONTENT */}
      <div style={{ flex: 1, minHeight: 0, padding: '12px 24px 40px', overflowY: 'auto', overflowX: 'hidden' }}>
        <div style={{ maxWidth: 1600, margin: '0 auto' }}>
          {displayedWeeks.length === 0 && (
            <div style={{ padding: '60px 20px', textAlign: 'center' }}>
              <BookOpen size={40} strokeWidth={1.5} style={{ marginBottom: 16, opacity: 0.2, color: UI.primary }} />
              <div style={{ fontFamily: THEME.serifFont, fontSize: 18, fontWeight: 700, color: UI.primary }}>No schedule found</div>
              <div style={{ marginTop: 8, fontSize: 13, color: UI.muted }}>Try switching to “Year” to see all weeks.</div>
              <Button variant="solid" onClick={() => setViewMode('YEAR')} style={{ marginTop: 20 }}>
                View Full Year
              </Button>
            </div>
          )}

          {Object.entries(monthsData).map(([monthName, monthWeeks]) => {
            // Months are automatically collapsed by default ONLY when on Year View
            const isMonthCollapsed = collapsedMonths[monthName] ?? (viewMode === 'YEAR');

            return (
              <div key={monthName} style={{ marginBottom: 28 }}>
                {(viewMode === 'YEAR' || displayedWeeks.length > 1) && (
                  <div
                    onClick={() => setCollapsedMonths((prev) => ({ ...prev, [monthName]: !(prev[monthName] ?? (viewMode === 'YEAR')) }))}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      cursor: 'pointer',
                      userSelect: 'none',
                      margin: '16px 0 12px',
                      padding: '8px 0',
                    }}
                  >
                    {isMonthCollapsed ? <ChevronRight size={18} color={UI.primary} /> : <ChevronDown size={18} color={UI.primary} />}
                    <div style={{ fontFamily: THEME.serifFont, fontSize: 18, fontWeight: 700, color: UI.primary }}>{monthName}</div>
                    <IconPill style={{ marginLeft: 6 }}>{monthWeeks.length} weeks</IconPill>
                    <div style={{ flex: 1, height: 1, background: UI.accent, marginLeft: 16 }} />
                  </div>
                )}

                {!isMonthCollapsed && (
                  <div>
                    {monthWeeks.map((weekObj) => {
                      const isRealCurrent = weekObj.week === currentRealWeek;
                      const isCollapsed = collapsedWeeks[weekObj.week];
                      const filteredSessions = (weekObj.sessions || []).filter(matchesFilters);
                      const tree = buildTree(filteredSessions);
                      const hasSessions = filteredSessions.length > 0;
                      const TEACHERS = ['Mrs. Yasmine', 'Mrs. Nour', 'Mrs. Lynn', 'Mrs. Eman'];

                      return (
                        <div key={weekObj.week} ref={(el) => (weekRefMap.current[weekObj.week] = el)} style={{ scrollMarginTop: 180, marginBottom: 24, paddingRight: 8, paddingBottom: 8 }}>
                          <ThemedCard style={{ padding: 0 }}>
                            {/* Week Header */}
                            <div
                              style={{
                                padding: '16px 20px',
                                background: isRealCurrent ? rgba(UI.yellow, 0.1) : '#fff',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                gap: 16,
                                flexWrap: 'wrap',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 260 }}>
                                <div
                                  style={{
                                    minWidth: 46,
                                    height: 46,
                                    borderRadius: THEME.radius,
                                    background: isRealCurrent ? UI.yellow : rgba(UI.accent, 0.2),
                                    border: `2px solid ${isRealCurrent ? UI.yellow : UI.accent}`,
                                    color: UI.primary,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                  }}
                                >
                                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.5 }}>WK</span>
                                  <span style={{ fontSize: 15, fontWeight: 800 }}>{weekObj.week}</span>
                                </div>

                                <div style={{ minWidth: 0 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                                    <span style={{ fontSize: 15, fontWeight: 700, color: UI.primary }}>{weekObj.rangeLabel}</span>
                                    {isRealCurrent && (
                                      <span
                                        style={{
                                          background: UI.yellow,
                                          color: UI.primary,
                                          fontSize: 10,
                                          fontWeight: 700,
                                          padding: '4px 10px',
                                          borderRadius: THEME.radius,
                                        }}
                                      >
                                        Current
                                      </span>
                                    )}
                                  </div>

                                  <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8, color: UI.muted, fontSize: 13, fontWeight: 500 }}>
                                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 500 }}>
                                      {weekObj.theme === '—' ? 'No Theme' : weekObj.theme}
                                    </span>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setInlineWeekEdit({
                                          weekNum: weekObj.week,
                                          field: 'theme',
                                          val: weekObj.theme,
                                          planIds: weekObj.plans.map((p) => p.id),
                                        });
                                      }}
                                      style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: UI.primary, padding: 4 }}
                                      title="Edit theme"
                                    >
                                      <Edit3 size={12} />
                                    </button>
                                  </div>
                                </div>
                              </div>

                              <Button
                                variant="ghost"
                                onClick={() => setCollapsedWeeks((prev) => ({ ...prev, [weekObj.week]: !prev[weekObj.week] }))}
                                style={{ border: `1px solid ${UI.accent}`, padding: '6px 12px' }}
                              >
                                {isCollapsed ? 'Expand' : 'Collapse'}
                              </Button>
                            </div>

                            {!isCollapsed && (
                              <div style={{ padding: '0 20px 20px', background: '#fff' }}>
                                <div style={{ height: 1, background: UI.accent, marginBottom: 16 }} />

                                {inlineWeekEdit?.weekNum === weekObj.week && (
                                  <div
                                    style={{
                                      marginBottom: 16,
                                      padding: 12,
                                      background: rgba(UI.yellow, 0.2),
                                      border: `1px solid ${UI.yellow}`,
                                      borderRadius: THEME.radius,
                                      display: 'flex',
                                      gap: 10,
                                      alignItems: 'center',
                                      flexWrap: 'wrap',
                                    }}
                                  >
                                    <Field
                                      autoFocus
                                      value={inlineWeekEdit.val}
                                      onChange={(e) => setInlineWeekEdit({ ...inlineWeekEdit, val: e.target.value })}
                                      style={{ flex: 1, minWidth: 260 }}
                                    />
                                    <Button
                                      variant="solid"
                                      onClick={() => {
                                        updateWeekPlanByIds(inlineWeekEdit.planIds, { theme: inlineWeekEdit.val });
                                        setInlineWeekEdit(null);
                                        refresh();
                                      }}
                                    >
                                      <Save size={14} /> Save
                                    </Button>
                                    <Button variant="primary" onClick={() => setInlineWeekEdit(null)}>
                                      Cancel
                                    </Button>
                                  </div>
                                )}

                                {!hasSessions && !inlineAddLocation && (
                                  <div
                                    style={{
                                      textAlign: 'center',
                                      padding: 30,
                                      borderRadius: THEME.radius,
                                      border: `2px dashed ${UI.accent}`,
                                      background: '#fafafa',
                                    }}
                                  >
                                    <div style={{ fontSize: 13, color: UI.primary, fontWeight: 600, marginBottom: 12 }}>No activities planned for this week.</div>
                                    <Button onClick={() => setInlineAddLocation({ weekNum: weekObj.week, area: 'PracticalLife', planId: weekObj.plans[0]?.id })}>
                                      <Plus size={14} /> Add First Activity
                                    </Button>
                                  </div>
                                )}

                                {Object.keys(tree).sort().map((area) => {
                                  const subjectStyle = getSubjectStyle(area);

                                  return (
                                    <div key={area} style={{ marginTop: 20, marginBottom: 28 }}>
                                      {/* Subject Header Area */}
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                                        <div style={{ width: 14, height: 14, borderRadius: '2px', background: subjectStyle.accent, border: `1px solid ${subjectStyle.border}` }} />
                                        <div style={{ fontSize: 13, fontWeight: 700, color: UI.primary, textTransform: 'uppercase', letterSpacing: 1 }}>
                                          {area}
                                        </div>
                                        <div style={{ flex: 1, height: 1, background: UI.accent }} />
                                        <Button
                                          variant="ghost"
                                          style={{ color: UI.primary, border: `1px solid ${UI.accent}`, fontSize: 11, padding: '4px 10px' }}
                                          onClick={() => setInlineAddLocation({ weekNum: weekObj.week, area: area, planId: weekObj.plans[0]?.id })}
                                        >
                                          <Plus size={12} /> Add Activity
                                        </Button>
                                      </div>

                                      {inlineAddLocation?.weekNum === weekObj.week && inlineAddLocation?.area === area && (
                                        <div
                                          style={{
                                            marginBottom: 16,
                                            padding: 16,
                                            borderRadius: THEME.radius,
                                            background: subjectStyle.bg,
                                            border: `1px solid ${subjectStyle.border}`,
                                          }}
                                        >
                                          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                                            <div style={{ flex: 1, display: 'grid', gap: 10, minWidth: 280 }}>
                                              <Field
                                                autoFocus
                                                placeholder="Activity name..."
                                                value={inlineAddForm.raw_activity}
                                                onChange={(e) => setInlineAddForm({ ...inlineAddForm, raw_activity: e.target.value })}
                                              />
                                              <Field
                                                placeholder="Teacher notes..."
                                                value={inlineAddForm.teacher_notes}
                                                onChange={(e) => setInlineAddForm({ ...inlineAddForm, teacher_notes: e.target.value })}
                                              />
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 120 }}>
                                              <Button variant="solid" onClick={handleSaveNewSession}>
                                                <Save size={14} /> Save
                                              </Button>
                                              <Button variant="primary" onClick={() => setInlineAddLocation(null)}>
                                                Cancel
                                              </Button>
                                            </div>
                                          </div>
                                        </div>
                                      )}

                                      {/* Data Grid */}
                                      <div style={{ overflowX: 'auto', paddingBottom: 6 }}>
                                        <div
                                          style={{
                                            minWidth: 860,
                                            display: 'grid',
                                            gridTemplateColumns: `minmax(320px, 3fr) repeat(${TEACHERS.length}, 100px) minmax(260px, 1fr)`,
                                          }}
                                        >
                                          {/* Header Row */}
                                          <div style={{ padding: '6px 12px' }}>
                                            <Label>Activity Detail</Label>
                                          </div>
                                          {TEACHERS.map((t) => (
                                            <div key={t} style={{ padding: '6px 6px', textAlign: 'center' }}>
                                              <Label>{t.split(' ')[1]}</Label>
                                            </div>
                                          ))}
                                          <div style={{ padding: '6px 12px' }}>
                                            <Label>Notes</Label>
                                          </div>

                                          {/* Data Rows */}
                                          {Object.keys(tree[area]).map((cat) =>
                                            tree[area][cat].map((session, i) => (
                                              <React.Fragment key={session.id}>
                                                <div
                                                  style={{
                                                    gridColumn: '1 / -1',
                                                    height: 1,
                                                    background: UI.accent,
                                                    opacity: 0.5,
                                                    margin: '2px 0',
                                                  }}
                                                />
                                                <div style={{ padding: '12px 12px', display: 'flex', alignItems: 'center' }}>
                                                  {editingSessionId === session.id ? (
                                                    <Field
                                                      autoFocus
                                                      value={editingSessionForm.raw_activity}
                                                      onChange={(e) => setEditingSessionForm({ ...editingSessionForm, raw_activity: e.target.value })}
                                                    />
                                                  ) : (
                                                    <div style={{ fontSize: 13, fontWeight: 600, color: UI.primary }}>
                                                      {session.raw_activity || 'Untitled'}
                                                    </div>
                                                  )}
                                                </div>

                                                {TEACHERS.map((teacher) => {
                                                  const st = session.progressData?.[teacher] || 'TODO';
                                                  return (
                                                    <div key={teacher} style={{ padding: '12px 6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                      <StatusChip status={st} onClick={() => handleStatusChange(session, teacher)} />
                                                    </div>
                                                  );
                                                })}

                                                <div style={{ padding: '12px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                                                  {editingSessionId === session.id ? (
                                                    <div style={{ display: 'flex', gap: 10, width: '100%' }}>
                                                      <Field
                                                        value={editingSessionForm.teacher_notes}
                                                        onChange={(e) => setEditingSessionForm({ ...editingSessionForm, teacher_notes: e.target.value })}
                                                      />
                                                      <Button
                                                        variant="solid"
                                                        onClick={async () => {
                                                          const patch = { ...editingSessionForm };
                                                          setLocalSessions((prev) =>
                                                            prev.map((s) => (s.id === session.id ? { ...s, ...patch } : s))
                                                          );
                                                          setEditingSessionId(null);

                                                          await supabase.from('term_plan_sessions').update(patch).eq('id', session.id);
                                                          refresh();
                                                        }}
                                                        style={{ padding: '8px' }}
                                                      >
                                                        <Save size={14} />
                                                      </Button>
                                                      {/* Delete Button ONLY visible in edit mode */}
                                                      <Button
                                                        variant="ghost"
                                                        onClick={() => handleDeleteSession(session.id)}
                                                        style={{
                                                          padding: '8px',
                                                          color: '#ef4444', 
                                                          border: '1px solid #fca5a5',
                                                          background: '#fef2f2'
                                                        }}
                                                        title="Delete"
                                                      >
                                                        <Trash2 size={14} />
                                                      </Button>
                                                    </div>
                                                  ) : (
                                                    <>
                                                      <span style={{ fontSize: 12, color: UI.muted, lineHeight: 1.4, fontWeight: 500 }}>
                                                        {session.teacher_notes || ''}
                                                      </span>
                                                      <div style={{ display: 'flex', gap: 6 }}>
                                                        <button
                                                          onClick={() => {
                                                            setEditingSessionId(session.id);
                                                            setEditingSessionForm({
                                                              raw_activity: session.raw_activity || '',
                                                              teacher_notes: session.teacher_notes || '',
                                                            });
                                                          }}
                                                          style={{
                                                            border: `1px solid ${UI.accent}`,
                                                            background: '#fff',
                                                            cursor: 'pointer',
                                                            color: UI.primary,
                                                            padding: 6,
                                                            borderRadius: THEME.radius,
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            flexShrink: 0,
                                                            transition: 'all 0.15s',
                                                          }}
                                                          title="Edit"
                                                        >
                                                          <MoreHorizontal size={14} />
                                                        </button>
                                                        {/* The delete button is NO LONGER here, moving to edit mode */}
                                                      </div>
                                                    </>
                                                  )}
                                                </div>
                                              </React.Fragment>
                                            ))
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </ThemedCard>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}