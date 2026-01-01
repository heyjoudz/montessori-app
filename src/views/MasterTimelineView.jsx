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

// ✅ adjust path if needed
import { supabase } from '../supabaseClient';

export default function MasterTimelineView({
  masterPlans,
  planSessions,
  classrooms,
  activeDate, // kept for compatibility (but “current week” uses TODAY now)
  setActiveDate, // kept for compatibility
  showToast,
  onDataChanged, // optional parent refetch
}) {
  const [selectedClassId, setSelectedClassId] = useState(classrooms[0]?.id);
  const [areaFilter, setAreaFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  // collapse state
  const initCollapseRef = useRef({});
  const [collapsedMonths, setCollapsedMonths] = useState({});
  const [collapsedWeeks, setCollapsedWeeks] = useState({});
  const [collapsedAreasByWeek, setCollapsedAreasByWeek] = useState({});
  const [collapsedCatsByWeek, setCollapsedCatsByWeek] = useState({});

  const weekRefMap = useRef({});
  const didAutoScrollRef = useRef({}); // per classroom

  // ✅ single edit modal per week
  const [editState, setEditState] = useState(null);

  // keep selectedClassId valid when classrooms load/refresh
  useEffect(() => {
    if (!selectedClassId && classrooms?.[0]?.id) setSelectedClassId(classrooms[0].id);
  }, [classrooms, selectedClassId]);

  const selectedClassroom = useMemo(() => {
    return (classrooms || []).find((c) => String(c.id) === String(selectedClassId)) || null;
  }, [classrooms, selectedClassId]);

  // ---------- DATE HELPERS ----------
  const toDate = (v) => {
    if (!v) return null;
    if (v instanceof Date) return isNaN(v.getTime()) ? null : v;

    const s = String(v).trim();
    if (!s) return null;

    // treat YYYY-MM-DD as local midnight to avoid timezone off-by-one
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
    return s
      .replace(/\u2013|\u2014/g, '-') // en/em dash -> hyphen
      .replace(/\s*-\s*/g, '-') // remove spaces around hyphen
      .replace(/\s+/g, ' ')
      .trim();
  };

  // ✅ Academic anchor (used to infer the right YEAR for Jan/Feb ranges)
  const academicStartDate = useMemo(() => {
    const d = toDate(getWeekStartFromAcademic(1));
    return d || new Date(new Date().getFullYear(), 8, 1); // fallback: Sep 1 current year
  }, [getWeekStartFromAcademic]);

  // Parse "Sep 8-12" or "Sep 29-Oct 3" into start/end dates (year inferred from academic start)
  const parseDateRangeText = (txt) => {
    const s = normalizeDateRangeLabel(txt);
    if (!s) return { startDate: null, endDate: null };

    const monthMap = {
      Jan: 0,
      Feb: 1,
      Mar: 2,
      Apr: 3,
      May: 4,
      Jun: 5,
      Jul: 6,
      Aug: 7,
      Sep: 8,
      Oct: 9,
      Nov: 10,
      Dec: 11,
    };

    const parts = s.split('-').map((x) => x.trim()).filter(Boolean);
    if (parts.length < 2) return { startDate: null, endDate: null };

    const left = parts[0];
    const leftMatch = left.match(/^([A-Za-z]{3})\s*(\d{1,2})$/);
    if (!leftMatch) return { startDate: null, endDate: null };

    const m1 = monthMap[leftMatch[1]];
    const d1 = Number(leftMatch[2]);
    if (m1 == null || !d1) return { startDate: null, endDate: null };

    // right can be "12" OR "Oct 3"
    const right = parts.slice(1).join('-'); // handles "Sep 29-Oct 3"
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

    // ✅ infer year from academicStartDate (Sep..Dec => baseYear, Jan..Aug => baseYear+1)
    const baseYear = academicStartDate.getFullYear();
    const acadStartMonth = academicStartDate.getMonth();

    const inferYear = (monthIdx) => (monthIdx < acadStartMonth ? baseYear + 1 : baseYear);

    const y1 = inferYear(m1);
    let y2 = inferYear(m2);

    // extra safety for ranges like "Dec 29-Jan 2"
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

  // ---------- FILTER OPTIONS ----------
  const areaOptions = useMemo(
    () => [
      { value: 'ALL', label: 'All Areas' },
      ...SUBJECT_KEYS.map((a) => ({ value: a, label: a })),
      { value: 'General', label: 'General' },
    ],
    []
  );

  const typeOptions = useMemo(
    () => [
      { value: 'ALL', label: 'All Types' },
      { value: 'CURR', label: 'Curriculum' },
      { value: 'GENERAL', label: 'General' },
      { value: 'THEME', label: 'Themes' },
      { value: 'TRIP', label: 'Trips' },
      { value: 'ASSESSMENT', label: 'Assess/Eval/Progress' },
    ],
    []
  );

  // ---------- BUILD WEEKS ----------
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
      byWeek[w].theme = themes[0] || '—';

      const notes = byWeek[w].plans.map((x) => (x.notes || '').trim()).filter(Boolean);
      byWeek[w].notes = Array.from(new Set(notes)).join(' • ');

      // fallback dates if date_range wasn't parseable / present
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

  // ✅ Use TODAY to decide “current week” (so it won’t drift if activeDate is set elsewhere)
  const currentWeek = useMemo(() => {
    const today = new Date();
    if (!weeks.length) return getWeekFromDate(today);

    // 1) exact containment
    for (const w of weeks) {
      if (w.startDate && w.endDate && today >= w.startDate && today <= w.endDate) return Number(w.week);
    }

    // 2) fallback: nearest by mid-date (prefer past/current over future on ties)
    let best = null;
    let bestScore = Infinity;

    for (const w of weeks) {
      const s = toDate(w.startDate);
      const e = toDate(w.endDate) || (s ? addDaysDate(s, 4) : null);
      if (!s || !e) continue;

      const mid = new Date((s.getTime() + e.getTime()) / 2);
      const dist = Math.abs(mid.getTime() - today.getTime());

      const isPastOrCurrent = s.getTime() <= today.getTime();
      const score = dist * 10 + (isPastOrCurrent ? 0 : 1); // tiny bias toward past/current

      if (score < bestScore) {
        bestScore = score;
        best = w;
      }
    }

    return best ? Number(best.week) : getWeekFromDate(today);
  }, [weeks]);

  // ---------- MONTH GROUPING ----------
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

  // ---------- SCROLL / ACTIONS ----------
  const scrollToWeekSilent = (w) => {
    const el = weekRefMap.current[String(w)];
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const jumpToWeek = (w) => {
    const el = weekRefMap.current[String(w)];
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      showToast?.({ type: 'success', title: `Week ${w}`, message: 'Jumped to week.' });
    } else {
      showToast?.({ type: 'error', title: 'Not found', message: 'Could not locate that week in view.' });
    }
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
    monthNums.forEach((mNum) => {
      newMonths[mNum] = mNum !== currentMonthNum;
    });
    weeks.forEach((w) => {
      newWeeks[w.week] = Number(w.week) !== Number(currentWeek);
    });
    setCollapsedMonths(newMonths);
    setCollapsedWeeks(newWeeks);
    setCollapsedAreasByWeek({});
    setCollapsedCatsByWeek({});
  };

  // init focus + auto-scroll to current week
  useEffect(() => {
    const key = String(selectedClassId || '');
    if (!key) return;
    if (!weeks.length || !monthNums.length) return;

    if (!initCollapseRef.current[key]) {
      initCollapseRef.current[key] = true;
      focusCurrentWeek();
    }

    if (!didAutoScrollRef.current[key]) {
      didAutoScrollRef.current[key] = true;
      setTimeout(() => scrollToWeekSilent(currentWeek), 200);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClassId, weeks.length, monthNums.join(','), currentWeek]);

  // ---------- COLLAPSE TOGGLES ----------
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

  const matchesSearch = (s) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;

    const area = s.curriculum_areas?.name || s.area || 'General';
    const cat = s.curriculum_categories?.name || s.category || 'Uncategorized';
    const act = s.curriculum_activities?.name || s.raw_activity || s.session_label || '';
    const tnote = s.teacher_notes || s.notes || s.raw_activity || s.session_label || '';
    const hay = `${area} ${cat} ${act} ${tnote}`.toLowerCase();
    return hay.includes(q);
  };

  const matchesFilters = (s) => {
    if (typeFilter !== 'ALL' && getSessionType(s) !== typeFilter) return false;
    if (areaFilter !== 'ALL') {
      const bucket = areaBucket(s.curriculum_areas?.name || s.area || 'General');
      if (bucket !== areaFilter) return false;
    }
    return matchesSearch(s);
  };

  // ---------- SMART GROUPING ----------
  const buildTree = (sessions = []) => {
    const tree = {};

    for (const s of sessions) {
      const area = (s.curriculum_areas?.name || s.area || 'General').trim() || 'General';
      const category = (s.curriculum_categories?.name || s.category || 'Uncategorized').trim() || 'Uncategorized';

      const activity = (s.curriculum_activities?.name || s.activity || 'Session').trim() || 'Session';
      const sessionTag = String((s.session_label || '').trim());

      // ✅ bullet note: prefer teacher_notes, else notes, else raw_activity (your “Number 6 counting”), else session_label
      const bulletNote =
        String((s.teacher_notes || '').trim()) ||
        String((s.notes || '').trim()) ||
        String((s.raw_activity || '').trim()) ||
        String((s.session_label || '').trim());

      const noteKey = bulletNote ? bulletNote : '__NO_NOTE__';

      if (!tree[area]) tree[area] = {};
      if (!tree[area][category]) tree[area][category] = { __uncat: null, __acts: {} };

      const isUncat = String(category || '').toLowerCase() === 'uncategorized';

      // group by bulletNote
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

  // ---------- SELECT OPTIONS for EDITING ----------
  const classPlanIds = useMemo(() => {
    const set = new Set();
    (masterPlans || []).forEach((p) => {
      if (String(p.classroom_id) === String(selectedClassId)) set.add(String(p.id));
    });
    return set;
  }, [masterPlans, selectedClassId]);

  const classSessionsAll = useMemo(() => {
    return (planSessions || []).filter((s) => classPlanIds.has(String(s.plan_id)));
  }, [planSessions, classPlanIds]);

  const editAreaOptions = useMemo(() => {
    const base = new Set([...(SUBJECT_KEYS || []), 'General']);
    classSessionsAll.forEach((s) => {
      const a = (s.curriculum_areas?.name || s.area || '').trim();
      if (a) base.add(a);
    });
    return Array.from(base).sort((a, b) => a.localeCompare(b));
  }, [classSessionsAll]);

  const editCategoryOptions = useMemo(() => {
    const base = new Set(['Uncategorized']);
    classSessionsAll.forEach((s) => {
      const c = (s.curriculum_categories?.name || s.category || '').trim();
      if (c) base.add(c);
    });
    return Array.from(base).sort((a, b) => a.localeCompare(b));
  }, [classSessionsAll]);

  const editActivityOptions = useMemo(() => {
    const base = new Set();
    classSessionsAll.forEach((s) => {
      const fromCurr = (s.curriculum_activities?.name || '').trim();
      const fromRaw = (s.raw_activity || '').trim();
      if (fromCurr) base.add(fromCurr);
      if (fromRaw) base.add(fromRaw);
    });
    return Array.from(base).sort((a, b) => a.localeCompare(b));
  }, [classSessionsAll]);

  // ---------- DB ----------
  const toastErr = (title, error) => {
    const msg = String(error?.message || error || 'Unknown error');
    showToast?.({ type: 'error', title, message: msg });
  };

  const toastOk = (title, message) => {
    showToast?.({ type: 'success', title, message });
  };

  const refresh = async () => {
    try {
      await onDataChanged?.();
    } catch {
      // ignore
    }
  };

  const updateWeekPlanByIds = async (planIds, patch) => {
    if (!planIds?.length) return;
    const { error } = await supabase.from('term_plans').update(patch).in('id', planIds);
    if (error) throw error;
  };

  const updateSession = async (id, patch) => {
    const { error } = await supabase.from('term_plan_sessions').update(patch).eq('id', id);
    if (error) throw error;
  };

  const deleteSession = async (id) => {
    const { error } = await supabase.from('term_plan_sessions').delete().eq('id', id);
    if (error) throw error;
  };

  const insertSession = async (values) => {
    const { error } = await supabase.from('term_plan_sessions').insert(values);
    if (error) throw error;
  };

  // ---------- EDIT MODAL ----------
  const openEditWeek = (weekObj) => {
    const sessions = (weekObj.sessions || []).slice();
    const draftById = {};

    sessions.forEach((s) => {
      draftById[String(s.id)] = {
        area: s.area || s.curriculum_areas?.name || 'General',
        category: s.category || s.curriculum_categories?.name || 'Uncategorized',
        raw_activity: s.raw_activity || '',
        session_label: s.session_label || '',
        teacher_notes: s.teacher_notes || s.notes || '',
      };
    });

    setEditState({
      weekObj,
      weekDraft: {
        date_range: normalizeDateRangeLabel(weekObj.rangeLabel || ''),
        theme: weekObj.theme === '—' ? '' : weekObj.theme || '',
        notes: weekObj.notes || '',
      },
      sessions,
      draftById,
      addDraft: {
        plan_id: weekObj?.plans?.[0]?.id || '',
        area: '',
        category: 'Uncategorized',
        raw_activity: '',
        session_label: '',
        teacher_notes: '',
      },
    });
  };

  // ---------- Classroom tabs (same vibe as IndividualPlanner) ----------
  const ClassroomTabsUnderTitle = () => {
    if (!classrooms?.length) return null;

    return (
      <div style={{ display: 'flex', gap: 12, marginTop: 14, flexWrap: 'wrap' }}>
        {classrooms.map((c) => (
          <button
            key={c.id}
            onClick={() => {
              setSelectedClassId(c.id);
              didAutoScrollRef.current[String(c.id)] = false;
            }}
            style={{
              border: 'none',
              cursor: 'pointer',
              padding: '12px 20px',
              background: String(selectedClassId) === String(c.id) ? THEME.brandPrimary : '#fff',
              color: String(selectedClassId) === String(c.id) ? '#fff' : THEME.text,
              boxShadow:
                String(selectedClassId) === String(c.id)
                  ? `6px 6px 0px 0px ${THEME.brandSecondary}`
                  : '2px 2px 0px #eee',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              transition: 'all 0.2s',
            }}
          >
            {c.code || c.name}
          </button>
        ))}
      </div>
    );
  };

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: 18,
          gap: 12,
          flexWrap: 'wrap',
          alignItems: 'flex-end',
        }}
      >
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
          <Button variant="ghost" onClick={focusCurrentWeek}>Collapse Except Current Week</Button>
          <Button onClick={() => jumpToWeek(currentWeek)} variant="secondary">Jump to Week {currentWeek}</Button>
        </div>
      </div>

      {/* Filters */}
      <Card style={{ padding: 18, marginBottom: 18, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', overflow: 'visible' }}>
        <select value={areaFilter} onChange={(e) => setAreaFilter(e.target.value)} style={selectStyle()}>
          {areaOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search category, activity, notes…"
          style={{ ...inputStyle(), minWidth: 280 }}
        />
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
                  {monthName}{' '}
                  <span style={{ fontSize: 13, color: THEME.textMuted, fontWeight: 600, marginLeft: 8 }}>
                    Month {mNum}
                  </span>
                </div>

                <Button variant="ghost" onClick={() => setCollapsedMonths((prev) => ({ ...prev, [mNum]: !prev[mNum] }))}>
                  {monthIsCollapsed ? 'Expand Month' : 'Collapse Month'}
                </Button>
              </div>

              {!monthIsCollapsed && (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
                    gap: 16,
                    marginTop: 16,
                    minWidth: 0,
                  }}
                >
                  {monthWeeks.map((weekObj) => {
                    const isCurrent = Number(weekObj.week) === Number(currentWeek);
                    const weekIsCollapsed = !!collapsedWeeks[weekObj.week];

                    const filteredSessions = (weekObj.sessions || []).filter(matchesFilters);
                    const tree = buildTree(filteredSessions);
                    const areas = Object.keys(tree).sort((a, b) => a.localeCompare(b));

                    return (
                      <div
                        key={weekObj.week}
                        ref={(el) => {
                          if (el) weekRefMap.current[String(weekObj.week)] = el;
                        }}
                        style={{
                          width: '100%',
                          maxWidth: '100%',
                          boxSizing: 'border-box',
                          overflow: 'hidden',
                          border: isCurrent ? `2px solid ${THEME.brandPrimary}` : '1px solid #eee',
                          borderRadius: 18,
                          padding: 16,
                          background: isCurrent ? '#FFF8EB' : '#fafafa',
                          minWidth: 0,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                              <div style={{ fontWeight: 900, fontSize: 15, color: THEME.text }}>Week {weekObj.week}</div>
                              <div style={{ fontSize: 12, color: THEME.textMuted, fontWeight: 800 }}>
                                {weekLabel[String(weekObj.week)] || getWeekRangeLabel(weekObj.week)}
                              </div>
                            </div>

                            {!!weekObj.theme && weekObj.theme !== '—' && (
                              <div style={{ marginTop: 8, fontSize: 12, fontWeight: 800, color: THEME.text }}>
                                Theme:{' '}
                                <span style={{ fontWeight: 700, color: THEME.textMuted }}>{weekObj.theme}</span>
                              </div>
                            )}

                            {!!weekObj.notes && (
                              <div style={{ marginTop: 6, fontSize: 12, color: THEME.textMuted, fontWeight: 600, lineHeight: 1.4, overflowWrap: 'anywhere' }}>
                                {weekObj.notes}
                              </div>
                            )}

                            <div style={{ marginTop: 8 }}>
                              <Button variant="ghost" onClick={() => openEditWeek(weekObj)} style={{ paddingLeft: 0 }}>
                                Edit
                              </Button>
                            </div>
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
                            {areas.length === 0 && (
                              <div style={{ padding: 12, background: '#fff', border: '1px dashed #ddd', color: '#999', fontSize: 13, fontWeight: 600 }}>
                                No sessions (with current filters).
                              </div>
                            )}

                            {areas.map((areaName) => {
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
                                      padding: '10px 12px',
                                      cursor: 'pointer',
                                      background: subj.bg,
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      gap: 10,
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                                      <div style={{ width: 10, height: 10, background: subj.accent, clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }} />
                                      <div style={{ fontWeight: 900, fontSize: 12, color: subj.text, textTransform: 'uppercase', letterSpacing: '0.6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {areaName}
                                      </div>
                                    </div>
                                    <div style={{ fontWeight: 900, color: subj.text, fontSize: 12 }}>{areaCollapsed ? '+' : '−'}</div>
                                  </div>

                                  {!areaCollapsed && (
                                    <div style={{ padding: 10, display: 'grid', gap: 10, minWidth: 0 }}>
                                      {catNames.map((catName) => {
                                        const catCollapsed = !!collapsedCatsByWeek[weekObj.week]?.[`${areaName}||${catName}`];
                                        const isUncat = String(catName || '').toLowerCase() === 'uncategorized';
                                        const payload = catObj[catName] || { __uncat: null, __acts: {} };

                                        const formatBullet = (tags, noteKey, noteText) => {
                                          const tagList = (tags || []).filter(Boolean);
                                          const tag = tagList.length ? tagList.join(', ') : '';
                                          const hasNote = noteKey !== '__NO_NOTE__' && String(noteText || '').trim();

                                          // show: S1 — Number 6 concept, counting
                                          if (hasNote && tag) {
                                            return (
                                              <>
                                                <span style={{ color: THEME.text, fontWeight: 900 }}>{renderS1S2Italic(tag)}</span>
                                                <span style={{ margin: '0 6px' }}>—</span>
                                                <span style={{ color: THEME.textMuted, fontWeight: 800 }}>{noteText}</span>
                                              </>
                                            );
                                          }
                                          if (hasNote) return <span style={{ color: THEME.textMuted, fontWeight: 800 }}>{noteText}</span>;
                                          return <span style={{ color: THEME.text, fontWeight: 800 }}>{renderS1S2Italic(tag || '—')}</span>;
                                        };

                                        return (
                                          <div key={catName} style={{ border: '1px solid #eee', background: '#fff', borderRadius: 12, overflow: 'hidden', minWidth: 0 }}>
                                            <div
                                              onClick={() => toggleCat(weekObj.week, areaName, catName)}
                                              style={{
                                                padding: '10px 12px',
                                                cursor: 'pointer',
                                                background: '#fafafa',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                gap: 10,
                                              }}
                                            >
                                              <div style={{ fontWeight: 900, fontSize: 12, color: THEME.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
                                                {catName}
                                              </div>
                                              <div style={{ fontWeight: 900, color: THEME.textMuted, fontSize: 12 }}>{catCollapsed ? '+' : '−'}</div>
                                            </div>

                                            {!catCollapsed && (
                                              <div style={{ padding: 10, display: 'grid', gap: 10, minWidth: 0 }}>
                                                {/* Uncategorized: ONLY bullets */}
                                                {isUncat ? (
                                                  !payload.__uncat || payload.__uncat.size === 0 ? (
                                                    <div style={{ fontSize: 12, color: '#999', fontWeight: 700, fontStyle: 'italic' }}>
                                                      No notes yet.
                                                    </div>
                                                  ) : (
                                                    <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 10 }}>
                                                      {Array.from(payload.__uncat.entries()).map(([noteKey, group]) => {
                                                        const tags = Array.from(group.tags.values());
                                                        return (
                                                          <li key={noteKey} style={{ fontSize: 12, color: THEME.textMuted, fontWeight: 700, lineHeight: 1.35 }}>
                                                            {formatBullet(tags, noteKey, group.note)}
                                                          </li>
                                                        );
                                                      })}
                                                    </ul>
                                                  )
                                                ) : (
                                                  Object.keys(payload.__acts || {})
                                                    .sort((a, b) => a.localeCompare(b))
                                                    .map((actName) => {
                                                      const act = payload.__acts[actName];
                                                      const byNoteEntries = Array.from(act.byNote.entries());

                                                      return (
                                                        <div key={actName} style={{ border: '1px solid #eee', background: '#fff', padding: 10, borderRadius: 12, minWidth: 0 }}>
                                                          <div style={{ fontWeight: 900, fontSize: 12, color: THEME.text, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                            {actName}
                                                          </div>

                                                          {byNoteEntries.length > 0 ? (
                                                            <ul style={{ margin: '10px 0 0 0', paddingLeft: 18, display: 'grid', gap: 10 }}>
                                                              {byNoteEntries.map(([noteKey, group]) => {
                                                                const tags = Array.from(group.tags.values());
                                                                return (
                                                                  <li key={noteKey} style={{ fontSize: 12, color: THEME.textMuted, fontWeight: 700, lineHeight: 1.35 }}>
                                                                    {formatBullet(tags, noteKey, group.note)}
                                                                  </li>
                                                                );
                                                              })}
                                                            </ul>
                                                          ) : (
                                                            <div style={{ marginTop: 8, fontSize: 12, color: '#999', fontWeight: 700, fontStyle: 'italic' }}>
                                                              No notes yet.
                                                            </div>
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

      {/* Edit modal */}
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
          editAreaOptions={editAreaOptions}
          editCategoryOptions={editCategoryOptions}
          editActivityOptions={editActivityOptions}
        />
      )}
    </div>
  );
}

function EditWeekModal({
  editState,
  setEditState,
  showToast,
  toastOk,
  toastErr,
  refresh,
  normalizeDateRangeLabel,
  updateWeekPlanByIds,
  updateSession,
  deleteSession,
  insertSession,
  editAreaOptions,
  editCategoryOptions,
  editActivityOptions,
}) {
  const [saving, setSaving] = useState(false);

  const weekObj = editState.weekObj;
  const planIds = (weekObj?.plans || []).map((p) => p.id).filter(Boolean);

  const close = () => setEditState(null);

  const setWeekDraft = (patch) => setEditState((m) => ({ ...m, weekDraft: { ...m.weekDraft, ...patch } }));
  const setDraftById = (id, patch) =>
    setEditState((m) => ({
      ...m,
      draftById: { ...m.draftById, [String(id)]: { ...(m.draftById[String(id)] || {}), ...patch } },
    }));
  const setAddDraft = (patch) => setEditState((m) => ({ ...m, addDraft: { ...m.addDraft, ...patch } }));

  const saveWeekMeta = async () => {
    try {
      setSaving(true);
      await updateWeekPlanByIds(planIds, {
        date_range: normalizeDateRangeLabel(editState.weekDraft.date_range),
        theme: (editState.weekDraft.theme || '').trim() || null,
        notes: (editState.weekDraft.notes || '').trim() || null,
      });
      toastOk('Saved', 'Week updated.');
      await refresh();
    } catch (e) {
      toastErr('Save failed', e);
    } finally {
      setSaving(false);
    }
  };

  const saveAllSessions = async () => {
    try {
      setSaving(true);
      const sessions = editState.sessions || [];
      for (const s of sessions) {
        const id = s.id;
        const d = editState.draftById?.[String(id)] || {};
        await updateSession(id, {
          area: (d.area || '').trim() || null,
          category: (d.category || '').trim() || 'Uncategorized',
          raw_activity: (d.raw_activity || '').trim() || null, // shown as bullet
          session_label: (d.session_label || '').trim() || null,
          teacher_notes: (d.teacher_notes || '').trim() || null,
        });
      }
      toastOk('Saved', 'Sessions updated.');
      await refresh();
    } catch (e) {
      toastErr('Save failed', e);
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (id) => {
    if (!window.confirm('Delete this session?')) return;
    try {
      setSaving(true);
      await deleteSession(id);
      toastOk('Deleted', 'Session removed.');
      await refresh();
    } catch (e) {
      toastErr('Delete failed', e);
    } finally {
      setSaving(false);
    }
  };

  const onAdd = async () => {
    const d = editState.addDraft || {};
    if (!d.plan_id) return showToast?.({ type: 'error', title: 'Missing', message: 'Please choose a plan for this week.' });

    try {
      setSaving(true);
      await insertSession({
        plan_id: Number(d.plan_id),
        area: (d.area || '').trim() || null,
        category: (d.category || '').trim() || 'Uncategorized',
        raw_activity: (d.raw_activity || '').trim() || null,
        session_label: (d.session_label || '').trim() || null,
        teacher_notes: (d.teacher_notes || '').trim() || null,
      });
      toastOk('Added', 'Session created.');
      setAddDraft({ area: '', category: 'Uncategorized', raw_activity: '', session_label: '', teacher_notes: '' });
      await refresh();
    } catch (e) {
      toastErr('Add failed', e);
    } finally {
      setSaving(false);
    }
  };

  const ensureOption = (arr, v) => {
    const val = String(v || '').trim();
    if (!val) return arr;
    return arr.includes(val) ? arr : [val, ...arr];
  };

  // ✅ make modal fit any screen: max height + internal scrolling
  return (
    <div
      onClick={close}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.35)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: 10,
        zIndex: 9999,
        overflow: 'auto',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(980px, 96vw)',
          maxHeight: '92vh',
        }}
      >
        <Card
          style={{
            padding: 14,
            display: 'flex',
            flexDirection: 'column',
            maxHeight: '92vh',
            overflow: 'hidden',
          }}
        >
          {/* Header (sticky-ish) */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontWeight: 900, fontSize: 16, fontFamily: THEME.serifFont, color: THEME.text }}>
                Edit Week {weekObj?.week}
              </div>
              <div style={{ marginTop: 4, fontSize: 12, color: THEME.textMuted, fontWeight: 600 }}>
                Area &amp; Category = dropdown. Activity = select or free text.
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <Button variant="ghost" onClick={saveWeekMeta} disabled={saving}>Save Week</Button>
              <Button variant="secondary" onClick={saveAllSessions} disabled={saving}>Save Sessions</Button>
              <Button variant="ghost" onClick={close} disabled={saving}>Close</Button>
            </div>
          </div>

          {/* Week meta (compact) */}
          <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <input
              value={editState.weekDraft.date_range}
              onChange={(e) => setWeekDraft({ date_range: e.target.value })}
              placeholder="date_range (ex: Sep 8-12)"
              style={{ ...inputStyle(), padding: '10px 14px' }}
            />
            <input
              value={editState.weekDraft.theme}
              onChange={(e) => setWeekDraft({ theme: e.target.value })}
              placeholder="Theme"
              style={{ ...inputStyle(), padding: '10px 14px' }}
            />
            <textarea
              value={editState.weekDraft.notes}
              onChange={(e) => setWeekDraft({ notes: e.target.value })}
              placeholder="Week notes"
              style={{ ...inputStyle(), padding: '10px 14px', minHeight: 48, gridColumn: '1 / -1', resize: 'vertical' }}
            />
          </div>

          {/* Scrollable body */}
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden', flex: 1 }}>
            {/* Sessions */}
            <div style={{ borderTop: '1px solid #eee', paddingTop: 10, overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontWeight: 900, fontSize: 13, color: THEME.text }}>Sessions</div>

              <div style={{ marginTop: 10, overflow: 'auto', paddingRight: 6, display: 'grid', gap: 10 }}>
                {(editState.sessions || []).length === 0 && (
                  <div style={{ padding: 10, background: '#fafafa', border: '1px dashed #ddd', color: '#999', fontSize: 13, fontWeight: 600 }}>
                    No sessions yet.
                  </div>
                )}

                {(editState.sessions || []).map((s) => {
                  const id = String(s.id);
                  const d = editState.draftById?.[id] || {};

                  const areaOpts = ensureOption(editAreaOptions || [], d.area);
                  const catOpts = ensureOption(editCategoryOptions || [], d.category);

                  const listId = `activityList-${id}`;

                  return (
                    <div key={id} style={{ border: '1px solid #eee', borderRadius: 12, padding: 12, background: '#fff' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
                        <div style={{ fontWeight: 900, fontSize: 12, color: THEME.text }}>#{s.id}</div>
                        <button
                          onClick={() => onDelete(s.id)}
                          disabled={saving}
                          style={{
                            border: 'none',
                            background: 'transparent',
                            cursor: 'pointer',
                            fontWeight: 900,
                            color: '#b91c1c',
                            textDecoration: 'underline',
                            textUnderlineOffset: 3,
                          }}
                        >
                          Delete
                        </button>
                      </div>

                      <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        {/* Area dropdown */}
                        <select
                          value={d.area || ''}
                          onChange={(e) => setDraftById(id, { area: e.target.value })}
                          style={{ ...selectStyle(), padding: '10px 14px' }}
                        >
                          {areaOpts.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>

                        {/* Category dropdown */}
                        <select
                          value={d.category || 'Uncategorized'}
                          onChange={(e) => setDraftById(id, { category: e.target.value })}
                          style={{ ...selectStyle(), padding: '10px 14px' }}
                        >
                          {catOpts.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>

                        <input
                          value={d.session_label || ''}
                          onChange={(e) => setDraftById(id, { session_label: e.target.value })}
                          placeholder="Session label (S1 / S2)"
                          style={{ ...inputStyle(), padding: '10px 14px' }}
                        />

                        {/* Activity: select OR free text (datalist) */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <input
                            list={listId}
                            value={d.raw_activity || ''}
                            onChange={(e) => setDraftById(id, { raw_activity: e.target.value })}
                            placeholder="Activity (select or type) — shown as bullet"
                            style={{ ...inputStyle(), padding: '10px 14px' }}
                          />
                          <datalist id={listId}>
                            {(editActivityOptions || []).slice(0, 300).map((opt) => (
                              <option key={opt} value={opt} />
                            ))}
                          </datalist>
                        </div>

                        <textarea
                          value={d.teacher_notes || ''}
                          onChange={(e) => setDraftById(id, { teacher_notes: e.target.value })}
                          placeholder="Optional extra teacher notes"
                          style={{ ...inputStyle(), padding: '10px 14px', minHeight: 48, gridColumn: '1 / -1', resize: 'vertical' }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Add session */}
            <div style={{ borderTop: '1px solid #eee', paddingTop: 10 }}>
              <div style={{ fontWeight: 900, fontSize: 13, color: THEME.text }}>Add session</div>

              <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <select
                  value={editState.addDraft.plan_id || ''}
                  onChange={(e) => setAddDraft({ plan_id: e.target.value })}
                  style={{ ...selectStyle(), padding: '10px 14px' }}
                >
                  <option value="">Select plan</option>
                  {(weekObj?.plans || []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.subject || p.term_name || `Plan ${p.id}`}
                    </option>
                  ))}
                </select>

                <select
                  value={editState.addDraft.area || ''}
                  onChange={(e) => setAddDraft({ area: e.target.value })}
                  style={{ ...selectStyle(), padding: '10px 14px' }}
                >
                  <option value="">Area</option>
                  {(editAreaOptions || []).map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>

                <select
                  value={editState.addDraft.category || 'Uncategorized'}
                  onChange={(e) => setAddDraft({ category: e.target.value })}
                  style={{ ...selectStyle(), padding: '10px 14px' }}
                >
                  {(editCategoryOptions || ['Uncategorized']).map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>

                <input
                  value={editState.addDraft.session_label || ''}
                  onChange={(e) => setAddDraft({ session_label: e.target.value })}
                  placeholder="Session label (S1 / S2)"
                  style={{ ...inputStyle(), padding: '10px 14px' }}
                />

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, gridColumn: '1 / -1' }}>
                  <input
                    list="activityList-add"
                    value={editState.addDraft.raw_activity || ''}
                    onChange={(e) => setAddDraft({ raw_activity: e.target.value })}
                    placeholder="Activity (select or type) — shown as bullet"
                    style={{ ...inputStyle(), padding: '10px 14px' }}
                  />
                  <datalist id="activityList-add">
                    {(editActivityOptions || []).slice(0, 300).map((opt) => (
                      <option key={opt} value={opt} />
                    ))}
                  </datalist>
                </div>

                <textarea
                  value={editState.addDraft.teacher_notes || ''}
                  onChange={(e) => setAddDraft({ teacher_notes: e.target.value })}
                  placeholder="Optional extra teacher notes"
                  style={{ ...inputStyle(), padding: '10px 14px', minHeight: 48, gridColumn: '1 / -1', resize: 'vertical' }}
                />

                <div style={{ display: 'flex', justifyContent: 'flex-end', gridColumn: '1 / -1' }}>
                  <Button onClick={onAdd} disabled={saving}>Add</Button>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
