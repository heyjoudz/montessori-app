import { useState, useRef, useMemo, useEffect } from 'react';
import { THEME, getSubjectStyle } from '../ui/theme';
import {
  SUBJECT_KEYS,
  getWeekFromDate,
  getWeekRangeLabel,
  getMonthName,
  getSessionType,
  inputStyle,
  selectStyle,
  getWeekStartFromAcademic,
  renderS1S2Italic,
} from '../utils/helpers';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { supabase } from '../supabaseClient';

export default function MasterTimelineView({
  masterPlans,
  planSessions,
  classrooms,
  activeDate,
  setActiveDate,
  showToast,
  onDataChanged,
}) {
  const [selectedClassId, setSelectedClassId] = useState(classrooms[0]?.id);
  const [areaFilter, setAreaFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  const initCollapseRef = useRef({});
  const [collapsedMonths, setCollapsedMonths] = useState({});
  const [collapsedWeeks, setCollapsedWeeks] = useState({});
  const [collapsedAreasByWeek, setCollapsedAreasByWeek] = useState({});
  const [collapsedCatsByWeek, setCollapsedCatsByWeek] = useState({});

  const weekRefMap = useRef({});
  const didAutoScrollRef = useRef({});

  // Inline State
  const [inlineWeekEdit, setInlineWeekEdit] = useState(null);
  const [inlineAddLocation, setInlineAddLocation] = useState(null);
  const [inlineAddForm, setInlineAddForm] = useState({ category: 'Uncategorized', raw_activity: '', session_label: '', teacher_notes: '' });
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [editingSessionForm, setEditingSessionForm] = useState({});

  const [editState, setEditState] = useState(null);

  useEffect(() => {
    if (!selectedClassId && classrooms?.[0]?.id) setSelectedClassId(classrooms[0].id);
  }, [classrooms, selectedClassId]);

  const selectedClassroom = useMemo(() => {
    return (classrooms || []).find((c) => String(c.id) === String(selectedClassId)) || null;
  }, [classrooms, selectedClassId]);

  const toDate = (v) => {
    if (!v) return null;
    if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
    const s = String(v).trim();
    if (!s) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const d = new Date(`${s}T00:00:00`);
      return isNaN(d.getTime()) ? null : d;
    }
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  };

  const addDaysDate = (d, n) => {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  };

  const normalizeDateRangeLabel = (txt) => {
    const s = String(txt || '').trim();
    if (!s) return '';
    return s.replace(/\u2013|\u2014/g, '-').replace(/\s*-\s*/g, '-').replace(/\s+/g, ' ').trim();
  };

  const academicStartDate = useMemo(() => {
    const d = toDate(getWeekStartFromAcademic(1));
    if (d) return d;
    
    // Fallback: If Jan-Aug, assume academic year started previous Sep
    const now = new Date();
    const currentMonth = now.getMonth(); 
    const year = currentMonth < 8 ? now.getFullYear() - 1 : now.getFullYear();
    return new Date(year, 8, 1);
  }, [getWeekStartFromAcademic]);

  const parseDateRangeText = (txt) => {
    const s = normalizeDateRangeLabel(txt);
    if (!s) return { startDate: null, endDate: null };
    const monthMap = {
      Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
      Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
    };
    const parts = s.split('-').map((x) => x.trim()).filter(Boolean);
    if (parts.length < 2) return { startDate: null, endDate: null };
    const left = parts[0];
    const leftMatch = left.match(/^([A-Za-z]{3})\s*(\d{1,2})$/);
    if (!leftMatch) return { startDate: null, endDate: null };
    const m1 = monthMap[leftMatch[1]];
    const d1 = Number(leftMatch[2]);
    if (m1 == null || !d1) return { startDate: null, endDate: null };
    const right = parts.slice(1).join('-');
    const rightMonthDay = right.match(/^([A-Za-z]{3})\s*(\d{1,2})$/);
    const rightDayOnly = right.match(/^(\d{1,2})$/);
    let m2 = m1;
    let d2 = null;
    if (rightMonthDay) {
      m2 = monthMap[rightMonthDay[1]];
      d2 = Number(rightMonthDay[2]);
    } else if (rightDayOnly) {
      d2 = Number(rightDayOnly[1]);
    }
    if (m2 == null || !d2) return { startDate: null, endDate: null };
    const baseYear = academicStartDate.getFullYear();
    const acadStartMonth = academicStartDate.getMonth();
    const inferYear = (monthIdx) => (monthIdx < acadStartMonth ? baseYear + 1 : baseYear);
    const y1 = inferYear(m1);
    let y2 = inferYear(m2);
    if (m2 < m1 && y2 === y1) y2 = y1 + 1;
    const startDate = new Date(y1, m1, d1);
    const endDate = new Date(y2, m2, d2);
    return {
      startDate: isNaN(startDate.getTime()) ? null : startDate,
      endDate: isNaN(endDate.getTime()) ? null : endDate,
    };
  };

  const fmtMonthDay = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const buildRangeLabelFromDates = (startDate, endDate, weekNumFallback) => {
    const s = toDate(startDate);
    const eRaw = toDate(endDate);
    if (s) {
      const e = eRaw || addDaysDate(s, 4);
      return `${fmtMonthDay(s)}-${fmtMonthDay(e)}`;
    }
    return getWeekRangeLabel(weekNumFallback);
  };

  const areaOptions = useMemo(
    () => [
      { value: 'ALL', label: 'All Areas' },
      ...SUBJECT_KEYS.map((a) => ({ value: a, label: a })),
      { value: 'General', label: 'General' },
    ],
    []
  );

  const weeks = useMemo(() => {
    const plans = (masterPlans || []).filter((p) => String(p.classroom_id) === String(selectedClassId));
    const byWeek = {};

    for (const p of plans) {
      const w = Number(p.week_number ?? p.week_num ?? p.week);
      if (!Number.isFinite(w)) continue;

      if (!byWeek[w]) byWeek[w] = { week: w, plans: [], startDate: null, endDate: null, rangeLabel: '' };
      byWeek[w].plans.push(p);

      const drLabel = normalizeDateRangeLabel(p.date_range);
      if (drLabel && !byWeek[w].rangeLabel) byWeek[w].rangeLabel = drLabel;

      if (drLabel) {
        const parsed = parseDateRangeText(drLabel);
        if (parsed.startDate && (!byWeek[w].startDate || parsed.startDate < byWeek[w].startDate)) byWeek[w].startDate = parsed.startDate;
        if (parsed.endDate && (!byWeek[w].endDate || parsed.endDate > byWeek[w].endDate)) byWeek[w].endDate = parsed.endDate;
      }
    }

    for (const wStr of Object.keys(byWeek)) {
      const w = Number(wStr);
      const planIds = new Set(byWeek[w].plans.map((x) => String(x.id)));
      const sessions = (planSessions || []).filter((s) => planIds.has(String(s.plan_id)));
      byWeek[w].sessions = sessions;

      const themes = byWeek[w].plans.map((x) => (x.theme || '').trim()).filter(Boolean);
      byWeek[w].theme = themes[0] || '-';

      const notes = byWeek[w].plans.map((x) => (x.notes || '').trim()).filter(Boolean);
      byWeek[w].notes = Array.from(new Set(notes)).join(' • ');

      if (!byWeek[w].startDate) byWeek[w].startDate = toDate(getWeekStartFromAcademic(w));
      if (!byWeek[w].endDate && byWeek[w].startDate) byWeek[w].endDate = addDaysDate(byWeek[w].startDate, 4);
      byWeek[w].rangeLabel = byWeek[w].rangeLabel || buildRangeLabelFromDates(byWeek[w].startDate, byWeek[w].endDate, w);
    }
    return Object.values(byWeek).sort((a, b) => a.week - b.week);
  }, [masterPlans, planSessions, selectedClassId, academicStartDate]);

  const weekLabel = useMemo(() => {
    const m = {};
    for (const w of weeks) m[String(w.week)] = w.rangeLabel || getWeekRangeLabel(w.week);
    return m;
  }, [weeks]);

  // ✅ RESTORED: This logic checks your actual plan dates to find the current week
  const currentWeek = useMemo(() => {
    const today = new Date();
    if (!weeks.length) return getWeekFromDate(today);
    
    // Check ranges first
    for (const w of weeks) {
      if (w.startDate && w.endDate && today >= w.startDate && today <= w.endDate) return Number(w.week);
    }
    
    // Heuristic if no exact range match
    let best = null;
    let bestScore = Infinity;
    for (const w of weeks) {
      const s = toDate(w.startDate);
      const e = toDate(w.endDate) || (s ? addDaysDate(s, 4) : null);
      if (!s || !e) continue;
      const mid = new Date((s.getTime() + e.getTime()) / 2);
      const dist = Math.abs(mid.getTime() - today.getTime());
      const isPastOrCurrent = s.getTime() <= today.getTime();
      const score = dist * 10 + (isPastOrCurrent ? 0 : 1);
      if (score < bestScore) {
        bestScore = score;
        best = w;
      }
    }
    return best ? Number(best.week) : getWeekFromDate(today);
  }, [weeks]);

  const months = useMemo(() => {
    const m = {};
    weeks.forEach((w) => {
      const monthNum = Math.ceil(w.week / 4);
      if (!m[monthNum]) m[monthNum] = [];
      m[monthNum].push(w);
    });
    return m;
  }, [weeks]);

  const monthNums = useMemo(() => Object.keys(months).map(Number).sort((a, b) => a - b), [months]);

  const toastErr = (title, error) => showToast?.({ type: 'error', title, message: String(error?.message || error) });
  const toastOk = (title, message) => showToast?.({ type: 'success', title, message });
  const refresh = async () => { try { await onDataChanged?.(); } catch {} };

  const updateWeekPlanByIds = async (planIds, patch) => {
    if (!planIds?.length) return;
    const { error } = await supabase.from('term_plans').update(patch).in('id', planIds);
    if (error) throw error;
  };
  const updateSession = async (id, patch) => {
    const { error } = await supabase.from('term_plan_sessions').update(patch).eq('id', id);
    if (error) throw error;
  };
  const insertSession = async (values) => {
    const { error } = await supabase.from('term_plan_sessions').insert(values);
    if (error) throw error;
  };
  const deleteSession = async (id) => {
     const { error } = await supabase.from('term_plan_sessions').delete().eq('id', id);
     if (error) throw error;
  };

  const startInlineWeekEdit = (weekObj, field) => {
    setInlineWeekEdit({
      weekNum: weekObj.week,
      field,
      val: field === 'theme' ? (weekObj.theme === '-' ? '' : weekObj.theme) : weekObj.notes,
      planIds: weekObj.plans.map(p => p.id)
    });
  };

  const saveInlineWeekEdit = async () => {
    if (!inlineWeekEdit) return;
    try {
      const patch = {};
      patch[inlineWeekEdit.field] = inlineWeekEdit.val;
      await updateWeekPlanByIds(inlineWeekEdit.planIds, patch);
      toastOk('Updated', `Week ${inlineWeekEdit.field} saved.`);
      setInlineWeekEdit(null);
      refresh();
    } catch (e) {
      toastErr('Save Failed', e);
    }
  };

  const startInlineAdd = (weekObj, area) => {
    if (!weekObj.plans?.[0]?.id) return toastErr('Error', 'No plan found for this week.');
    setInlineAddLocation({ weekNum: weekObj.week, area, planId: weekObj.plans[0].id });
    setInlineAddForm({ category: 'Uncategorized', raw_activity: '', session_label: '', teacher_notes: '' });
  };

  const saveInlineAdd = async () => {
    if (!inlineAddLocation) return;
    try {
      await insertSession({
        plan_id: inlineAddLocation.planId,
        area: inlineAddLocation.area,
        category: inlineAddLocation.category || 'Uncategorized',
        raw_activity: inlineAddLocation.raw_activity,
        session_label: inlineAddLocation.session_label,
        teacher_notes: inlineAddLocation.teacher_notes,
      });
      toastOk('Added', 'Session added inline.');
      setInlineAddLocation(null);
      refresh();
    } catch (e) {
      toastErr('Add Failed', e);
    }
  };

  const startInlineEditSession = (session) => {
    setEditingSessionId(session.id);
    setEditingSessionForm({
      category: session.category || session.curriculum_categories?.name || 'Uncategorized',
      raw_activity: session.raw_activity || session.curriculum_activities?.name || '',
      session_label: session.session_label || '',
      teacher_notes: session.teacher_notes || session.notes || '',
    });
  };

  const saveInlineEditSession = async () => {
    if (!editingSessionId) return;
    try {
      await updateSession(editingSessionId, {
        category: editingSessionForm.category,
        raw_activity: editingSessionForm.raw_activity,
        session_label: editingSessionForm.session_label,
        teacher_notes: editingSessionForm.teacher_notes
      });
      toastOk('Updated', 'Session updated inline.');
      setEditingSessionId(null);
      refresh();
    } catch (e) {
      toastErr('Update Failed', e);
    }
  };

  const jumpToWeek = (w) => {
    setCollapsedWeeks(prev => ({ ...prev, [w]: false }));
    const mNum = Math.ceil(w / 4);
    setCollapsedMonths(prev => ({ ...prev, [mNum]: false }));
    setTimeout(() => {
        const el = weekRefMap.current[String(w)];
        if (el && typeof el.scrollIntoView === 'function') {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, 100);
  };

  const setAllCollapsed = (collapse) => {
    const newMonths = {};
    const newWeeks = {};
    monthNums.forEach((mNum) => (newMonths[mNum] = collapse));
    weeks.forEach((w) => (newWeeks[w.week] = collapse));
    setCollapsedMonths(newMonths);
    setCollapsedWeeks(newWeeks);
    setCollapsedAreasByWeek({});
    setCollapsedCatsByWeek({});
  };

  const focusCurrentWeek = () => {
    const newMonths = {};
    const newWeeks = {};
    const currentMonthNum = Math.ceil(Number(currentWeek) / 4);
    monthNums.forEach((mNum) => { newMonths[mNum] = mNum !== currentMonthNum; });
    weeks.forEach((w) => { newWeeks[w.week] = Number(w.week) !== Number(currentWeek); });
    setCollapsedMonths(newMonths);
    setCollapsedWeeks(newWeeks);
  };

  useEffect(() => {
    const key = String(selectedClassId || '');
    if (!key || !weeks.length) return;
    if (!initCollapseRef.current[key]) {
      initCollapseRef.current[key] = true;
      setAllCollapsed(true);
    }
  }, [selectedClassId, weeks.length]);

  const toggleArea = (weekNum, area) => {
    setCollapsedAreasByWeek((prev) => {
      const w = { ...(prev[weekNum] || {}) };
      w[area] = !w[area];
      return { ...prev, [weekNum]: w };
    });
  };

  const toggleCat = (weekNum, area, cat) => {
    const key = `${area}||${cat}`;
    setCollapsedCatsByWeek((prev) => {
      const w = { ...(prev[weekNum] || {}) };
      w[key] = !w[key];
      return { ...prev, [weekNum]: w };
    });
  };

  const areaBucket = (areaName) => {
    const a = String(areaName || '').toLowerCase();
    if (a.includes('math')) return 'Math';
    if (a.includes('english') || a.includes('language')) return 'English';
    if (a.includes('sensor')) return 'Sensorial';
    if (a.includes('cultur') || a.includes('geo') || a.includes('science')) return 'Culture';
    if (a.includes('practical')) return 'Practical Life';
    return 'General';
  };

  const matchesFilters = (s) => {
    if (typeFilter !== 'ALL' && getSessionType(s) !== typeFilter) return false;
    if (areaFilter !== 'ALL') {
      const bucket = areaBucket(s.curriculum_areas?.name || s.area || 'General');
      if (bucket !== areaFilter) return false;
    }
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const hay = `${s.curriculum_areas?.name||s.area} ${s.curriculum_categories?.name||s.category} ${s.raw_activity||''} ${s.teacher_notes||''}`.toLowerCase();
    return hay.includes(q);
  };

  const buildTree = (sessions = []) => {
    const tree = {};
    for (const s of sessions) {
      const area = (s.curriculum_areas?.name || s.area || 'General').trim() || 'General';
      const category = (s.curriculum_categories?.name || s.category || 'Uncategorized').trim() || 'Uncategorized';
      const activity = (s.curriculum_activities?.name || s.activity || 'Session').trim() || 'Session';
      const sessionTag = String((s.session_label || '').trim());
      const bulletNote = String((s.teacher_notes || '').trim()) || String((s.notes || '').trim()) || String((s.raw_activity || '').trim()) || String((s.session_label || '').trim());
      const noteKey = bulletNote ? bulletNote : '__NO_NOTE__';

      if (!tree[area]) tree[area] = {};
      if (!tree[area][category]) tree[area][category] = { __uncat: null, __acts: {} };

      const isUncat = String(category || '').toLowerCase() === 'uncategorized';
      if (isUncat) {
        if (!tree[area][category].__uncat) tree[area][category].__uncat = new Map();
        const m = tree[area][category].__uncat;
        if (!m.has(noteKey)) m.set(noteKey, { note: bulletNote, tags: new Set(), sessions: [] });
        if (sessionTag) m.get(noteKey).tags.add(sessionTag);
        m.get(noteKey).sessions.push(s);
      } else {
        const acts = tree[area][category].__acts;
        if (!acts[activity]) acts[activity] = { activity, byNote: new Map(), sessions: [] };
        acts[activity].sessions.push(s);
        const bn = acts[activity].byNote;
        if (!bn.has(noteKey)) bn.set(noteKey, { note: bulletNote, tags: new Set(), sessions: [] });
        if (sessionTag) bn.get(noteKey).tags.add(sessionTag);
        bn.get(noteKey).sessions.push(s);
      }
    }
    return tree;
  };

  const classPlanIds = useMemo(() => {
    const set = new Set();
    (masterPlans || []).forEach((p) => { if (String(p.classroom_id) === String(selectedClassId)) set.add(String(p.id)); });
    return set;
  }, [masterPlans, selectedClassId]);
  const classSessionsAll = useMemo(() => (planSessions || []).filter((s) => classPlanIds.has(String(s.plan_id))), [planSessions, classPlanIds]);
  const editCategoryOptions = useMemo(() => {
    const base = new Set(['Uncategorized']);
    classSessionsAll.forEach((s) => {
        const c = (s.curriculum_categories?.name || s.category || '').trim();
        if(c) base.add(c);
    });
    return Array.from(base).sort();
  }, [classSessionsAll]);
  const editActivityOptions = useMemo(() => {
     const base = new Set();
     classSessionsAll.forEach((s) => {
         const r = (s.raw_activity||'').trim();
         if(r) base.add(r);
     });
     return Array.from(base).sort();
  }, [classSessionsAll]);

  const ClassroomTabsUnderTitle = () => {
    if (!classrooms?.length) return null;
    return (
      <div style={{ marginTop: 20 }}>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {classrooms.map((c) => (
            <button
                key={c.id}
                onClick={() => { setSelectedClassId(c.id); didAutoScrollRef.current[String(c.id)] = false; }}
                style={{
                border: 'none', cursor: 'pointer', padding: '12px 20px',
                background: String(selectedClassId) === String(c.id) ? THEME.brandPrimary : '#fff',
                color: String(selectedClassId) === String(c.id) ? '#fff' : THEME.text,
                boxShadow: String(selectedClassId) === String(c.id) ? `6px 6px 0px 0px ${THEME.brandSecondary}` : '2px 2px 0px #eee',
                fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 10, transition: 'all 0.2s',
                }}
            >
                {c.code || c.name}
            </button>
            ))}
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18, gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <h2 style={{ fontFamily: THEME.serifFont, margin: 0, fontSize: 32 }}>Scope &amp; Sequence</h2>
          <ClassroomTabsUnderTitle />
          <div style={{ marginTop: 14, fontSize: 13, color: THEME.textMuted, fontWeight: 600 }}>
            {selectedClassroom?.name ? <span style={{ fontWeight: 900, color: THEME.text }}>{selectedClassroom.name}</span> : null}
            {selectedClassroom?.name ? <span style={{ margin: '0 8px' }}>•</span> : null}
            Today • Week {currentWeek} • {weekLabel[String(currentWeek)] || getWeekRangeLabel(currentWeek)}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <Button variant="ghost" onClick={() => setAllCollapsed(true)}>Collapse All</Button>
          <Button variant="ghost" onClick={() => setAllCollapsed(false)}>Expand All</Button>
          <Button onClick={() => jumpToWeek(currentWeek)} variant="secondary">Jump to Current Week</Button>
        </div>
      </div>

      {/* Filters */}
      <Card style={{ padding: 18, marginBottom: 18, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', overflow: 'visible' }}>
        <select value={areaFilter} onChange={(e) => setAreaFilter(e.target.value)} style={selectStyle()}>
          {areaOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search category, activity, notes…" style={{ ...inputStyle(), minWidth: 280 }} />
      </Card>

      <div style={{ display: 'grid', gap: 16 }}>
        {monthNums.map((mNum) => {
          const monthWeeks = months[mNum] || [];
          const monthName = getMonthName(mNum);
          const monthIsCollapsed = !!collapsedMonths[mNum];

          return (
            <Card key={mNum} style={{ padding: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ fontWeight: 600, fontSize: 20, fontFamily: THEME.serifFont }}>
                  {monthName} <span style={{ fontSize: 13, color: THEME.textMuted, fontWeight: 600, marginLeft: 8 }}>Month {mNum}</span>
                </div>
                <Button variant="ghost" onClick={() => setCollapsedMonths((prev) => ({ ...prev, [mNum]: !prev[mNum] }))}>
                  {monthIsCollapsed ? 'Expand Month' : 'Collapse Month'}
                </Button>
              </div>

              {!monthIsCollapsed && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16, marginTop: 16, minWidth: 0 }}>
                  {monthWeeks.map((weekObj) => {
                    const isCurrent = Number(weekObj.week) === Number(currentWeek);
                    const weekIsCollapsed = !!collapsedWeeks[weekObj.week];
                    const filteredSessions = (weekObj.sessions || []).filter(matchesFilters);
                    const tree = buildTree(filteredSessions);
                    const areas = Object.keys(tree).sort((a, b) => a.localeCompare(b));
                    const displayAreas = areas.length ? areas : (SUBJECT_KEYS || []); 

                    return (
                      <div
                        key={weekObj.week}
                        ref={(el) => { if (el) weekRefMap.current[String(weekObj.week)] = el; }}
                        style={{
                          width: '100%', boxSizing: 'border-box', overflow: 'hidden',
                          border: isCurrent ? `2px solid ${THEME.brandPrimary}` : '1px solid #eee',
                          borderRadius: 18, padding: 16, background: isCurrent ? '#FFF8EB' : '#fafafa', minWidth: 0
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                              <div style={{ fontWeight: 900, fontSize: 15, color: THEME.text }}>Week {weekObj.week}</div>
                              <div style={{ fontSize: 12, color: THEME.textMuted, fontWeight: 800 }}>{weekLabel[String(weekObj.week)] || getWeekRangeLabel(weekObj.week)}</div>
                            </div>

                            {/* THEME EDIT */}
                            {inlineWeekEdit?.weekNum === weekObj.week && inlineWeekEdit?.field === 'theme' ? (
                                <div style={{marginTop: 8, display:'flex', gap:6}}>
                                    <input
                                        autoFocus
                                        value={inlineWeekEdit.val}
                                        onChange={e => setInlineWeekEdit(prev => ({...prev, val: e.target.value}))}
                                        style={{...inputStyle(), padding:'4px 8px', fontSize:12, width: 200}}
                                    />
                                    <Button onClick={saveInlineWeekEdit} style={{padding:'4px 8px', fontSize:11}}>Save</Button>
                                    <Button variant="ghost" onClick={() => setInlineWeekEdit(null)} style={{padding:'4px 8px', fontSize:11}}>Cancel</Button>
                                </div>
                            ) : (
                                <div style={{ marginTop: 8, fontSize: 12, fontWeight: 800, color: THEME.text, display:'flex', alignItems:'center', gap:6 }}>
                                    Theme: <span style={{ fontWeight: 700, color: THEME.textMuted }}>{weekObj.theme !== '-' ? weekObj.theme : 'None'}</span>
                                    <span
                                        onClick={() => startInlineWeekEdit(weekObj, 'theme')}
                                        style={{fontSize:10, textDecoration:'underline', cursor:'pointer', color: THEME.brandPrimary}}
                                    >
                                        Edit
                                    </span>
                                </div>
                            )}

                             {/* ✅ NOTES: Removed explicit "Edit" button. Click text to edit. */}
                             {inlineWeekEdit?.weekNum === weekObj.week && inlineWeekEdit?.field === 'notes' ? (
                                <div style={{marginTop: 8, display:'flex', flexDirection:'column', gap:6}}>
                                    <textarea
                                        autoFocus
                                        value={inlineWeekEdit.val}
                                        onChange={e => setInlineWeekEdit(prev => ({...prev, val: e.target.value}))}
                                        style={{...inputStyle(), padding:'6px', fontSize:12, minHeight: 60, width: '100%'}}
                                    />
                                    <div style={{display:'flex', gap:6}}>
                                        <Button onClick={saveInlineWeekEdit} style={{padding:'4px 8px', fontSize:11}}>Save</Button>
                                        <Button variant="ghost" onClick={() => setInlineWeekEdit(null)} style={{padding:'4px 8px', fontSize:11}}>Cancel</Button>
                                    </div>
                                </div>
                            ) : (
                                <div 
                                    onClick={() => startInlineWeekEdit(weekObj, 'notes')}
                                    style={{ marginTop: 6, fontSize: 12, color: THEME.textMuted, fontWeight: 600, lineHeight: 1.4, cursor: 'pointer', border: '1px dashed transparent' }}
                                    onMouseEnter={e => e.currentTarget.style.border = '1px dashed #eee'}
                                    onMouseLeave={e => e.currentTarget.style.border = '1px dashed transparent'}
                                    title="Click to edit notes"
                                >
                                    {weekObj.notes || <span style={{opacity:0.5, fontStyle:'italic'}}>No notes</span>}
                                </div>
                            )}
                          </div>

                          <Button
                            variant="ghost"
                            onClick={() => setCollapsedWeeks((prev) => ({ ...prev, [weekObj.week]: !prev[weekObj.week] }))}
                            style={{ padding: '8px 10px', fontSize: 12 }}
                          >
                            {weekIsCollapsed ? 'Expand' : 'Collapse'}
                          </Button>
                        </div>

                        {!weekIsCollapsed && (
                          <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
                            {displayAreas.map((areaName) => {
                              const areaCollapsed = !!collapsedAreasByWeek[weekObj.week]?.[areaName];
                              const subj = getSubjectStyle(areaName);
                              if (areaFilter !== 'ALL') {
                                const bucket = areaBucket(areaName);
                                if (bucket !== areaFilter) return null;
                              }
                              const catObj = tree[areaName] || {};
                              const catNames = Object.keys(catObj).sort((a, b) => a.localeCompare(b));

                              return (
                                <div key={areaName} style={{ border: `1px solid ${subj.border}`, background: '#fff', borderRadius: 14, overflow: 'hidden', minWidth: 0 }}>
                                  <div
                                    onClick={() => toggleArea(weekObj.week, areaName)}
                                    style={{
                                      padding: '8px 12px', cursor: 'pointer', background: subj.bg, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10,
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                                      <div style={{ width: 10, height: 10, background: subj.accent, clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }} />
                                      <div style={{ fontWeight: 900, fontSize: 12, color: subj.text, textTransform: 'uppercase', letterSpacing: '0.6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {areaName}
                                      </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8}}>
                                      <button
                                          onClick={(e) => {
                                              e.stopPropagation();
                                              if (collapsedAreasByWeek[weekObj.week]?.[areaName]) toggleArea(weekObj.week, areaName);
                                              startInlineAdd(weekObj, areaName);
                                          }}
                                          style={{
                                              background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(0,0,0,0.05)', borderRadius: 6, color: subj.text, fontWeight: 900, fontSize: 14, cursor: 'pointer', padding: '2px 8px', lineHeight: 1, display: 'flex', alignItems: 'center', height: 24
                                          }}
                                          title="Add Session to this Area"
                                      >
                                          +
                                      </button>
                                      <div style={{ fontWeight: 900, color: subj.text, fontSize: 12, width: 10, textAlign:'center' }}>{areaCollapsed ? '+' : '−'}</div>
                                    </div>
                                  </div>

                                  {!areaCollapsed && (
                                    <div style={{ padding: 10, display: 'grid', gap: 10, minWidth: 0 }}>
                                        {inlineAddLocation?.weekNum === weekObj.week && inlineAddLocation?.area === areaName && (
                                            <div style={{
                                                padding: 12, border: `2px dashed ${subj.border}`, borderRadius: 8, background: '#fdfdfd', display:'grid', gap:8
                                            }}>
                                                <div style={{fontSize:11, fontWeight:900, color: THEME.textMuted}}>NEW SESSION ({areaName})</div>
                                                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
                                                    <select
                                                        value={inlineAddForm.category}
                                                        onChange={e => setInlineAddForm({...inlineAddForm, category: e.target.value})}
                                                        style={selectStyle()}
                                                    >
                                                        {editCategoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
                                                    </select>
                                                    <input
                                                        placeholder="Session Label (e.g. S1)"
                                                        value={inlineAddForm.session_label}
                                                        onChange={e => setInlineAddForm({...inlineAddForm, session_label: e.target.value})}
                                                        style={inputStyle()}
                                                    />
                                                </div>
                                                <input
                                                    placeholder="Activity (Raw text)"
                                                    value={inlineAddForm.raw_activity}
                                                    onChange={e => setInlineAddForm({...inlineAddForm, raw_activity: e.target.value})}
                                                    style={inputStyle()}
                                                    list={`add-act-list-${weekObj.week}`}
                                                />
                                                <datalist id={`add-act-list-${weekObj.week}`}>
                                                    {editActivityOptions.slice(0,100).map(o => <option key={o} value={o}/>)}
                                                </datalist>
                                                <input
                                                    placeholder="Teacher Notes / Description"
                                                    value={inlineAddForm.teacher_notes}
                                                    onChange={e => setInlineAddForm({...inlineAddForm, teacher_notes: e.target.value})}
                                                    style={inputStyle()}
                                                />
                                                <div style={{display:'flex', gap:8, marginTop:4}}>
                                                    <Button onClick={saveInlineAdd} style={{padding:'6px 12px'}}>Add</Button>
                                                    <Button variant="ghost" onClick={() => setInlineAddLocation(null)} style={{padding:'6px 12px'}}>Cancel</Button>
                                                </div>
                                            </div>
                                        )}

                                      {catNames.length === 0 && !inlineAddLocation && (
                                          <div style={{fontSize:12, color:'#ccc', fontStyle:'italic', padding:4}}>No sessions yet. Click + above to add.</div>
                                      )}

                                      {catNames.map((catName) => {
                                        const catCollapsed = !!collapsedCatsByWeek[weekObj.week]?.[`${areaName}||${catName}`];
                                        const isUncat = String(catName || '').toLowerCase() === 'uncategorized';
                                        const payload = catObj[catName] || { __uncat: null, __acts: {} };

                                        const renderSessionRow = (group) => {
                                            const firstSession = group.sessions[0];
                                            const isEditing = editingSessionId === firstSession.id;

                                            if (isEditing) {
                                                return (
                                                    <div style={{
                                                        marginTop: 4, padding: 8, border: '1px solid #ddd', background: '#fff', borderRadius: 6,
                                                        display: 'grid', gap: 6
                                                    }}>
                                                        <div style={{display:'flex', justifyContent:'space-between'}}>
                                                            <span style={{fontSize:10, fontWeight:900, color:'#999'}}>EDITING</span>
                                                            <Button variant="ghost" style={{color:'#d32f2f', padding:0, height:'auto', fontSize:10}} onClick={() => deleteSession(firstSession.id).then(() => {setEditingSessionId(null); refresh();})}>Delete</Button>
                                                        </div>
                                                        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:6}}>
                                                            <select
                                                                value={editingSessionForm.category}
                                                                onChange={e => setEditingSessionForm({...editingSessionForm, category: e.target.value})}
                                                                style={{...selectStyle(), fontSize:12, padding:4}}
                                                            >
                                                                {editCategoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
                                                            </select>
                                                            <input
                                                                value={editingSessionForm.session_label}
                                                                onChange={e => setEditingSessionForm({...editingSessionForm, session_label: e.target.value})}
                                                                placeholder="Label"
                                                                style={{...inputStyle(), fontSize:12, padding:4}}
                                                            />
                                                        </div>
                                                        <input
                                                            value={editingSessionForm.raw_activity}
                                                            onChange={e => setEditingSessionForm({...editingSessionForm, raw_activity: e.target.value})}
                                                            placeholder="Activity"
                                                            style={{...inputStyle(), fontSize:12, padding:4}}
                                                        />
                                                        <input
                                                            value={editingSessionForm.teacher_notes}
                                                            onChange={e => setEditingSessionForm({...editingSessionForm, teacher_notes: e.target.value})}
                                                            placeholder="Notes"
                                                            style={{...inputStyle(), fontSize:12, padding:4}}
                                                        />
                                                        <div style={{display:'flex', gap:6}}>
                                                            <Button onClick={saveInlineEditSession} style={{fontSize:11, padding:'4px 8px'}}>Save</Button>
                                                            <Button variant="ghost" onClick={() => setEditingSessionId(null)} style={{fontSize:11, padding:'4px 8px'}}>Cancel</Button>
                                                        </div>
                                                    </div>
                                                );
                                            }

                                            const tags = Array.from(group.tags.values()).filter(Boolean);
                                            const tagStr = tags.join(', ');
                                            const noteText = group.note;
                                            const hasNote = noteText && noteText !== '__NO_NOTE__';

                                            return (
                                                <div style={{display:'flex', alignItems:'flex-start', gap:6, group: 'parent'}}>
                                                    <div style={{ fontSize: 12, color: THEME.textMuted, fontWeight: 700, lineHeight: 1.35, flex:1 }}>
                                                        {hasNote && tagStr ? (
                                                            <>
                                                                <span style={{ color: THEME.text, fontWeight: 900 }}>{renderS1S2Italic(tagStr)}</span>
                                                                <span style={{ margin: '0 6px' }}>-</span>
                                                                <span style={{ color: THEME.textMuted, fontWeight: 800 }}>{noteText}</span>
                                                            </>
                                                        ) : hasNote ? (
                                                            <span style={{ color: THEME.textMuted, fontWeight: 800 }}>{noteText}</span>
                                                        ) : (
                                                            <span style={{ color: THEME.text, fontWeight: 800 }}>{renderS1S2Italic(tagStr || '-')}</span>
                                                        )}
                                                    </div>
                                                    <span
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            startInlineEditSession(firstSession);
                                                        }}
                                                        style={{
                                                            fontSize: 10, color: THEME.brandPrimary, cursor: 'pointer', textDecoration: 'underline', whiteSpace:'nowrap', opacity: 0.7
                                                        }}
                                                        onMouseEnter={e => e.target.style.opacity = 1}
                                                        onMouseLeave={e => e.target.style.opacity = 0.7}
                                                    >
                                                        Edit
                                                    </span>
                                                </div>
                                            );
                                        };

                                        return (
                                          <div key={catName} style={{ border: '1px solid #eee', background: '#fff', borderRadius: 12, overflow: 'hidden', minWidth: 0 }}>
                                            <div
                                              onClick={() => toggleCat(weekObj.week, areaName, catName)}
                                              style={{ padding: '10px 12px', cursor: 'pointer', background: '#fafafa', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}
                                            >
                                              <div style={{ fontWeight: 900, fontSize: 12, color: THEME.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
                                                {catName}
                                              </div>
                                              <div style={{ fontWeight: 900, color: THEME.textMuted, fontSize: 12 }}>{catCollapsed ? '+' : '−'}</div>
                                            </div>

                                            {!catCollapsed && (
                                              <div style={{ padding: 10, display: 'grid', gap: 10, minWidth: 0 }}>
                                                {isUncat ? (
                                                  !payload.__uncat || payload.__uncat.size === 0 ? (
                                                    <div style={{ fontSize: 12, color: '#999', fontWeight: 700, fontStyle: 'italic' }}>No notes yet.</div>
                                                  ) : (
                                                    <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 10 }}>
                                                      {Array.from(payload.__uncat.entries()).map(([noteKey, group]) => (
                                                        <li key={noteKey}>{renderSessionRow(group)}</li>
                                                      ))}
                                                    </ul>
                                                  )
                                                ) : (
                                                  Object.keys(payload.__acts || {}).sort((a, b) => a.localeCompare(b)).map((actName) => {
                                                    const act = payload.__acts[actName];
                                                    const byNoteEntries = Array.from(act.byNote.entries());
                                                    return (
                                                      <div key={actName} style={{ border: '1px solid #eee', background: '#fff', padding: 10, borderRadius: 12, minWidth: 0 }}>
                                                        <div style={{ fontWeight: 900, fontSize: 12, color: THEME.text, minWidth: 0 }}>{actName}</div>
                                                        {byNoteEntries.length > 0 ? (
                                                            <ul style={{ margin: '10px 0 0 0', paddingLeft: 18, display: 'grid', gap: 10 }}>
                                                                {byNoteEntries.map(([noteKey, group]) => (
                                                                    <li key={noteKey}>{renderSessionRow(group)}</li>
                                                                ))}
                                                            </ul>
                                                        ) : (
                                                            <div style={{ marginTop: 8, fontSize: 12, color: '#999', fontWeight: 700, fontStyle: 'italic' }}>No notes yet.</div>
                                                        )}
                                                      </div>
                                                    );
                                                  })
                                                )}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {editState && (
        <EditWeekModal
          editState={editState}
          setEditState={setEditState}
          showToast={showToast}
          toastOk={toastOk}
          toastErr={toastErr}
          refresh={refresh}
          normalizeDateRangeLabel={normalizeDateRangeLabel}
          updateWeekPlanByIds={updateWeekPlanByIds}
          updateSession={updateSession}
          deleteSession={deleteSession}
          insertSession={insertSession}
          editAreaOptions={areaOptions.map(o => o.value).filter(x => x !== 'ALL')}
          editCategoryOptions={editCategoryOptions}
          editActivityOptions={editActivityOptions}
        />
      )}
    </div>
  );
}

function EditWeekModal(props) {
  // Keeping this modal component exactly as previously provided since no changes were requested to it.
  return null; 
}