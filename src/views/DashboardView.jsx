import { useEffect, useMemo, useState } from 'react';
import { THEME, getSubjectStyle } from '../ui/theme';
import { ACADEMIC_START, safeDate, dateISO, addDays, normalizeStatusCode } from '../utils/helpers';

import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import KanbanColumn from '../components/business/Kanban';

// -------------------- helpers --------------------

function toDate(v) {
  if (!v) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if (typeof v === 'number') {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  const s = String(v).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(`${s}T00:00:00`);
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function normalizeDateRangeLabel(txt) {
  const s = String(txt || '').trim();
  if (!s) return '';
  return s
    .replace(/\u2013|\u2014/g, '-') // en/em dash -> hyphen
    .replace(/\s*-\s*/g, ' - ')
    .replace(/\s+/g, ' ')
    .trim();
}

function softShadow() {
  return '0 10px 30px rgba(10, 53, 92, 0.06)';
}

function fmtMonthLabel(d) {
  try {
    const m = d.toLocaleString('en-US', { month: 'long' });
    return `${m} ${d.getFullYear()}`;
  } catch {
    return 'Month';
  }
}

function parseActiveDate(activeDate) {
  const d1 = toDate(activeDate);
  if (d1) return d1;
  try {
    const d2 = toDate(safeDate(activeDate));
    if (d2) return d2;
  } catch {}
  return new Date();
}

function monthBounds(dateObj) {
  const y = dateObj.getFullYear();
  const m = dateObj.getMonth();
  const start = new Date(y, m, 1);
  const end = new Date(y, m + 1, 1);
  return { y, m, start, end };
}

// Week must have at least 3 weekdays (Mon-Fri) in target month
function hasStrictOverlap(weekStart, monthStart, monthEnd) {
  const ws = toDate(weekStart);
  if (!ws) return false;
  let daysInMonth = 0;
  for (let i = 0; i < 5; i++) {
    const d = addDays(ws, i);
    if (d >= monthStart && d < monthEnd) daysInMonth++;
  }
  return daysInMonth >= 3;
}

function normalizeStatusSafe(raw) {
  const s = (raw ?? '').toString().trim();
  if (!s) return 'P';
  const u = s.toUpperCase();
  if (u === 'A') return 'A';
  if (u === 'P' || u === 'W' || u === 'M') return u;

  const n = s.toLowerCase().replace(/[_-]/g, ' ').trim();
  if (n.includes('aim')) return 'A';
  if (n.includes('practice')) return 'W';
  if (n.includes('master')) return 'M';
  if (n.includes('present')) return 'P';

  try {
    const z = normalizeStatusCode(raw);
    return z === 'A' ? 'A' : z;
  } catch {
    return 'P';
  }
}

function isArchivedStatus(raw) {
  const n = String(raw || '').toLowerCase();
  return n.includes('archiv');
}

// Parse "Dec 2 - 6", "Dec 29 - Jan 2", etc; infer year using academic rollover (Sep-Dec same year, Jan-Aug next year)
function parseTermPlanDateRange(dateRange, academicStartDate) {
  const label = normalizeDateRangeLabel(dateRange);
  if (!label) return null;

  const months = {
    jan: 0,
    january: 0,
    feb: 1,
    february: 1,
    mar: 2,
    march: 2,
    apr: 3,
    april: 3,
    may: 4,
    jun: 5,
    june: 5,
    jul: 6,
    july: 6,
    aug: 7,
    august: 7,
    sep: 8,
    sept: 8,
    september: 8,
    oct: 9,
    october: 9,
    nov: 10,
    november: 10,
    dec: 11,
    december: 11
  };

  const acad = toDate(academicStartDate);
  const acadYear = acad ? acad.getFullYear() : new Date().getFullYear();
  const acadMonth = acad ? acad.getMonth() : 8; // default Sep
  const inferYearForMonth = (mIdx) => (mIdx >= acadMonth ? acadYear : acadYear + 1);

  const re = /^([A-Za-z]{3,9})\s+(\d{1,2})(?:,\s*(\d{4}))?\s*-\s*(?:([A-Za-z]{3,9})\s+)?(\d{1,2})(?:,\s*(\d{4}))?$/;
  const m = label.match(re);
  if (!m) return null;

  const m1Name = String(m[1] || '').toLowerCase();
  const d1 = parseInt(m[2], 10);
  const y1Explicit = m[3] ? parseInt(m[3], 10) : null;

  const m2NameRaw = m[4] ? String(m[4]).toLowerCase() : null;
  const d2 = parseInt(m[5], 10);
  const y2Explicit = m[6] ? parseInt(m[6], 10) : null;

  const m1 = months[m1Name];
  if (m1 === undefined || !d1) return null;

  const m2 = m2NameRaw ? months[m2NameRaw] : m1;
  if (m2 === undefined || !d2) return null;

  const y1 = y1Explicit ?? inferYearForMonth(m1);
  let y2 = y2Explicit ?? inferYearForMonth(m2);

  const start = new Date(y1, m1, d1);
  let end = new Date(y2, m2, d2);

  if (end < start) {
    if (!y2Explicit) end = new Date(y2 + 1, m2, d2);
  }

  if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
  return { start, end, label };
}

function dedupeKey(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

// -------------------- Add modal --------------------

function AddActivityModal({
  open,
  onClose,
  statusDefault = 'P',
  classroom,
  classroomStudents,
  currMeta,
  activeDateISO,
  onQuickAdd,
  showToast,
  defaultDate = ''
}) {
  const [status, setStatus] = useState(statusDefault);
  const [date, setDate] = useState(defaultDate);
  const [areaId, setAreaId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [activityId, setActivityId] = useState('');
  const [activityText, setActivityText] = useState('');
  const [subNote, setSubNote] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);

  useEffect(() => {
    if (!open) return;
    setStatus(statusDefault);
    setDate(defaultDate);
    setAreaId('');
    setCategoryId('');
    setActivityId('');
    setActivityText('');
    setSubNote('');
    setStudentSearch('');
    setSelectedStudentIds([]);
  }, [open, statusDefault, defaultDate]);

  const areaOptions = useMemo(() => {
    const a = (currMeta?.areas || []).slice();
    return [{ value: '', label: 'Select…' }, ...a.map((x) => ({ value: String(x.id), label: x.name }))];
  }, [currMeta]);

  const categoryOptions = useMemo(() => {
    const all = (currMeta?.categories || []).slice();
    const filtered = areaId ? all.filter((c) => String(c.area_id) === String(areaId)) : all;
    return [{ value: '', label: '—' }, ...filtered.map((c) => ({ value: String(c.id), label: c.name }))];
  }, [currMeta, areaId]);

  const activityOptions = useMemo(() => {
    const all = (currMeta?.activities || []).slice();
    let filtered = all;
    if (categoryId) filtered = filtered.filter((a) => String(a.category_id) === String(categoryId));
    return [{ value: '', label: 'Type to search…' }, ...filtered.map((a) => ({ value: String(a.id), label: a.name }))];
  }, [currMeta, categoryId]);

  const filteredStudents = useMemo(() => {
    const q = (studentSearch || '').toLowerCase().trim();
    if (!q) return classroomStudents;
    return (classroomStudents || []).filter((s) =>
      `${s.first_name || ''} ${s.last_name || ''}`.toLowerCase().includes(q)
    );
  }, [classroomStudents, studentSearch]);

  const toggleStudent = (id) =>
    setSelectedStudentIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const selectAllFiltered = () =>
    setSelectedStudentIds((prev) => Array.from(new Set([...prev, ...filteredStudents.map((s) => s.id)])));
  const clearAll = () => setSelectedStudentIds([]);

  const save = async () => {
    if (!classroom?.id) return showToast?.({ type: 'error', title: 'Missing classroom', message: 'Select a classroom first.' });
    if (!selectedStudentIds.length) return showToast?.({ type: 'error', title: 'No students', message: 'Select at least one student.' });

    let pickedName = (activityText || '').trim();
    const picked = (currMeta?.activities || []).find((a) => String(a.id) === String(activityId));

    let catId = categoryId || null;
    let arId = areaId || null;
    let arLabel = '';

    if (picked) {
      pickedName = picked.name;
      const cat = (currMeta?.categories || []).find((c) => String(c.id) === String(picked.category_id));
      const area = cat ? (currMeta?.areas || []).find((ar) => String(ar.id) === String(cat.area_id)) : null;
      catId = picked.category_id;
      arId = area?.id || areaId;
      arLabel = area?.name || '';
    } else {
      const cat = (currMeta?.categories || []).find((c) => String(c.id) === String(categoryId));
      const area = cat ? (currMeta?.areas || []).find((ar) => String(ar.id) === String(cat.area_id)) : null;
      if (area) {
        arId = area.id;
        arLabel = area.name;
      }
    }

    if (!pickedName) return showToast?.({ type: 'error', title: 'Missing activity', message: 'Pick an activity or type one.' });

    const finalDate = date || activeDateISO || dateISO(new Date());
    const notes = (subNote || '').trim();

    try {
      await Promise.all(
        selectedStudentIds.map((student_id) =>
          onQuickAdd?.({
            student_id,
            status,
            date: finalDate,
            activity: pickedName,
            notes,
            raw_activity: notes,
            curriculum_activity_id: picked?.id || null,
            curriculum_category_id: catId,
            curriculum_area_id: arId,
            area: arLabel
          })
        )
      );
      showToast?.({ type: 'success', title: 'Added', message: `Added “${pickedName}” for ${selectedStudentIds.length} student(s).` });
      onClose?.();
    } catch (e) {
      showToast?.({ type: 'error', title: 'Error', message: e?.message || 'Failed to add.' });
    }
  };

  if (!open) return null;

  return (
    <Modal title="Add activity" onClose={onClose} width={900}>
      <div style={{ display: 'grid', gap: 16, maxHeight: '80vh', overflowY: 'auto', paddingRight: 4 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, color: THEME.textMuted, fontWeight: 600, marginBottom: 6 }}>Classroom</div>
            <div style={{ border: '1px solid #ddd', borderRadius: 12, padding: '10px 12px', background: '#fff', fontWeight: 600, color: THEME.text }}>
              {classroom?.name || '—'}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, color: THEME.textMuted, fontWeight: 600, marginBottom: 6 }}>Status</div>
            <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: 12, border: '1px solid #ddd' }}>
              <option value="P">To Present</option>
              <option value="W">Practicing</option>
              <option value="A">Next Month Aim</option>
              <option value="M">Mastered</option>
            </select>
          </div>

          <div>
            <div style={{ fontSize: 12, color: THEME.textMuted, fontWeight: 600, marginBottom: 6 }}>Date (optional)</div>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: 12, border: '1px solid #ddd' }} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '0.9fr 0.9fr 1.2fr', gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, color: THEME.textMuted, fontWeight: 600, marginBottom: 6 }}>Area</div>
            <select value={areaId} onChange={(e) => { setAreaId(e.target.value); setCategoryId(''); setActivityId(''); }} style={{ width: '100%', padding: '10px', borderRadius: 12, border: '1px solid #ddd' }}>
              {areaOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div>
            <div style={{ fontSize: 12, color: THEME.textMuted, fontWeight: 600, marginBottom: 6 }}>Category</div>
            <select value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setActivityId(''); }} style={{ width: '100%', padding: '10px', borderRadius: 12, border: '1px solid #ddd' }}>
              {categoryOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div>
            <div style={{ fontSize: 12, color: THEME.textMuted, fontWeight: 600, marginBottom: 6 }}>Activity</div>
            <div style={{ display: 'grid', gridTemplateColumns: '0.9fr 1.1fr', gap: 10 }}>
              <select value={activityId} onChange={(e) => { setActivityId(e.target.value); setActivityText(''); }} style={{ width: '100%', padding: '10px', borderRadius: 12, border: '1px solid #ddd' }}>
                {activityOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>

              <input value={activityText} onChange={(e) => { setActivityText(e.target.value); setActivityId(''); }} placeholder="Custom activity…" style={{ width: '100%', padding: '10px', borderRadius: 12, border: '1px solid #ddd' }} />
            </div>
          </div>
        </div>

        <div>
          <div style={{ fontSize: 12, color: THEME.textMuted, fontWeight: 600, marginBottom: 6 }}>Note / Sub-activity</div>
          <textarea value={subNote} onChange={(e) => setSubNote(e.target.value)} style={{ width: '100%', minHeight: 90, padding: '10px', borderRadius: 12, border: '1px solid #ddd', resize: 'vertical' }} />
        </div>

        <div style={{ border: '1px solid #ddd', borderRadius: 14, overflow: 'hidden', background: '#fff' }}>
          <div style={{ padding: '10px', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #eee' }}>
            <div style={{ fontWeight: 700 }}>Students ({selectedStudentIds.length})</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <Button variant="ghost" onClick={selectAllFiltered} style={{ padding: '4px 8px' }}>Select all</Button>
              <Button variant="ghost" onClick={clearAll} style={{ padding: '4px 8px' }}>Clear</Button>
            </div>
          </div>

          <div style={{ padding: 10, display: 'grid', gap: 10 }}>
            <input value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)} placeholder="Search student..." style={{ width: '100%', padding: '8px', borderRadius: 8, border: '1px solid #ddd' }} />
            <div style={{ maxHeight: 200, overflow: 'auto' }}>
              {filteredStudents.map((s) => (
                <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 8, cursor: 'pointer', background: selectedStudentIds.includes(s.id) ? '#eef' : '#fff' }}>
                  <input type="checkbox" checked={selectedStudentIds.includes(s.id)} onChange={() => toggleStudent(s.id)} />
                  <div style={{ fontWeight: 600 }}>{s.first_name} {s.last_name}</div>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save}>ADD</Button>
        </div>
      </div>
    </Modal>
  );
}

// -------------------- main --------------------

export default function DashboardView({
  planItems,
  students,
  classrooms,
  activeDate,
  setActiveDate,
  onUpdateItem,
  onDeleteItem,
  onMoveItemToDate,
  curriculum,
  masterPlans,
  planSessions,
  showToast,
  onQuickAdd,
  curriculumAreas,
  curriculumCategories
}) {
  const [selectedClassId, setSelectedClassId] = useState(classrooms?.[0]?.id || null);
  const [areaFilter, setAreaFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  // Suggestions collapse by default
  const [suggestAreaOpenMap, setSuggestAreaOpenMap] = useState({ __ALL__: true });

  // Kanban expand/collapse all
  const [kanbanExpandAction, setKanbanExpandAction] = useState(null);

  // Add modal
  const [addOpen, setAddOpen] = useState(false);
  const [addStatusDefault, setAddStatusDefault] = useState('P');
  const [addDefaultDate, setAddDefaultDate] = useState('');

  useEffect(() => {
    if (!selectedClassId && classrooms?.[0]?.id) setSelectedClassId(classrooms[0].id);
  }, [classrooms, selectedClassId]);

  const activeD = useMemo(() => parseActiveDate(activeDate), [activeDate]);
  const { y: year, m: monthIdx, start: monthStart, end: monthEnd } = useMemo(() => monthBounds(activeD), [activeD]);
  const monthLabel = useMemo(() => fmtMonthLabel(activeD), [activeD]);

  const selectedClassroom = useMemo(() => classrooms.find((c) => String(c.id) === String(selectedClassId)), [classrooms, selectedClassId]);
  const classroomStudents = useMemo(() => (students || []).filter((s) => String(s.classroom_id) === String(selectedClassId)), [students, selectedClassId]);

  // Curriculum meta for dropdowns
  const currMeta = useMemo(() => {
    let areas = (curriculumAreas || []).slice();
    let categories = (curriculumCategories || []).slice();

    if (areas.length === 0 || categories.length === 0) {
      const areaMap = new Map();
      const catMap = new Map();
      (curriculum || []).forEach((item) => {
        const aId = item.curriculum_area_id || item.area_id;
        const aName = item.area || item.curriculum_area_name;
        if (aId && !areaMap.has(String(aId))) areaMap.set(String(aId), { id: aId, name: aName || 'Area' });

        const cId = item.curriculum_category_id || item.category_id;
        const cName = item.category || item.curriculum_category_name;
        if (cId && !catMap.has(String(cId))) catMap.set(String(cId), { id: cId, name: cName || 'Category', area_id: aId });
      });
      if (areas.length === 0) areas = Array.from(areaMap.values());
      if (categories.length === 0) categories = Array.from(catMap.values());
    }

    const acts = (curriculum || []).map((a) => ({
      id: a.id,
      name: a.name || a.activity || 'Untitled',
      category_id: a.curriculum_category_id || a.category_id,
      area_id: a.curriculum_area_id || a.area_id
    }));

    return { areas, categories, activities: acts };
  }, [curriculum, curriculumAreas, curriculumCategories]);

  const allClassItems = useMemo(
    () => (planItems || []).filter((i) => String(i.classroom_id) === String(selectedClassId)),
    [planItems, selectedClassId]
  );

  // Current month items (any status except Archived)
  const baseMonthItems = useMemo(() => {
    return allClassItems.filter((i) => {
      if (isArchivedStatus(i.status)) return false;
      if (typeof i.year === 'number' && typeof i.month === 'number') return i.year === year && i.month - 1 === monthIdx;

      const d = toDate(i.planning_date) || toDate(safeDate(i.planning_date));
      if (!d) return false;
      return d >= monthStart && d < monthEnd;
    });
  }, [allClassItems, year, monthIdx, monthStart, monthEnd]);

  // Next month Aim items (status A) in next month window
  const aimItems = useMemo(() => {
    const nextMonth = new Date(year, monthIdx + 1, 1);
    const { start: nmStart, end: nmEnd } = monthBounds(nextMonth);

    return allClassItems.filter((i) => {
      if (isArchivedStatus(i.status)) return false;
      if (normalizeStatusSafe(i.status) !== 'A') return false;

      if (typeof i.year === 'number' && typeof i.month === 'number') {
        return i.year === nextMonth.getFullYear() && i.month - 1 === nextMonth.getMonth();
      }

      const d = toDate(i.planning_date) || toDate(safeDate(i.planning_date));
      if (!d) return false;
      return d >= nmStart && d < nmEnd;
    });
  }, [allClassItems, year, monthIdx]);

  const nextMonthLabel = useMemo(() => fmtMonthLabel(new Date(year, monthIdx + 1, 1)), [year, monthIdx]);

  const filterItems = (items) => {
    const q = (search || '').toLowerCase().trim();

    return (items || []).filter((i) => {
      if (areaFilter !== 'ALL') {
        const a = (i.curriculum_area_name || i.area || '').toString();
        if (a !== areaFilter) return false;
      }
      if (!q) return true;

      const stu = (students || []).find((s) => String(s.id) === String(i.student_id));
      const stuName = stu ? `${stu.first_name} ${stu.last_name}`.toLowerCase() : '';
      const hay = [i.activity, i.raw_activity, i.notes, i.curriculum_area_name, i.curriculum_category_name, i.area, stuName].join(' ').toLowerCase();
      return hay.includes(q);
    });
  };

  const filteredMonthItems = useMemo(() => filterItems(baseMonthItems), [baseMonthItems, search, areaFilter, students]);
  const filteredAimItems = useMemo(() => filterItems(aimItems), [aimItems, search, areaFilter, students]);

  const areaOptions = useMemo(() => {
    const set = new Set();
    [...baseMonthItems, ...aimItems].forEach((i) => {
      const a = (i.curriculum_area_name || i.area || '').trim();
      if (a) set.add(a);
    });
    return ['ALL', ...Array.from(set).sort()];
  }, [baseMonthItems, aimItems]);

  const academicStartDate = useMemo(() => {
    const d = toDate(ACADEMIC_START);
    if (d) return d;
    const now = new Date();
    const y = now.getMonth() < 8 ? now.getFullYear() - 1 : now.getFullYear();
    return new Date(y, 8, 1);
  }, []);

  // suggestions: keep strict month filtering (no Jan weeks in Dec)
  const suggestedWeeks = useMemo(() => {
    if (!selectedClassId) return [];

    const plans = (masterPlans || []).filter((tp) => String(tp.classroom_id) === String(selectedClassId));

    const calculatedPlans = plans
      .map((tp) => {
        const wn = parseInt(tp.week_number || 0, 10);
        if (!wn) return null;

        const parsed = parseTermPlanDateRange(tp.date_range, academicStartDate);

        let weekStart = parsed?.start || null;
        let weekEnd = parsed?.end || null;
        let rangeLabel = parsed?.label || normalizeDateRangeLabel(tp.date_range);

        if (!weekStart) {
          weekStart = addDays(academicStartDate, (wn - 1) * 7);
          weekEnd = addDays(weekStart, 4);
          rangeLabel = `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
        } else {
          if (!weekEnd) weekEnd = addDays(weekStart, 4);
          if (!rangeLabel) {
            rangeLabel = `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
          }
        }

        return { ...tp, weekNumber: wn, weekStart, weekEnd, rangeLabel };
      })
      .filter(Boolean);

    const monthPlans = calculatedPlans
      .filter((tp) => hasStrictOverlap(tp.weekStart, monthStart, monthEnd))
      .sort((a, b) => a.weekNumber - b.weekNumber);

    const sessMap = new Map();
    (planSessions || []).forEach((s) => {
      const id = String(s.term_plan_id || s.plan_id || s.master_plan_id || s.parent_id);
      if (!id) return;
      if (!sessMap.has(id)) sessMap.set(id, []);
      sessMap.get(id).push(s);
    });

    const weekMap = new Map();

    monthPlans.forEach((tp) => {
      const k = String(tp.weekNumber);
      if (!weekMap.has(k)) weekMap.set(k, { weekNumber: tp.weekNumber, rangeLabel: tp.rangeLabel, bySubject: new Map() });

      const buck = weekMap.get(k);
      const subj = (tp.subject || 'General').toString();
      if (!buck.bySubject.has(subj)) buck.bySubject.set(subj, new Map());

      const rawSess = sessMap.get(String(tp.id)) || [];
      const clean = rawSess.filter((x) => String(x.session_type || '').toUpperCase() !== 'ADMIN');

      const catMap = buck.bySubject.get(subj);
      clean.forEach((s) => {
        const c = s.category || s.curriculum_categories?.name || 'Uncategorized';
        if (!catMap.has(c)) catMap.set(c, []);
        catMap.get(c).push(s);
      });
    });

    return Array.from(weekMap.values())
      .sort((a, b) => a.weekNumber - b.weekNumber)
      .map((w) => ({
        ...w,
        subjects: Array.from(w.bySubject.entries())
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([subj, cm]) => ({
            subject: subj,
            categories: Array.from(cm.entries())
              .sort((a, b) => a[0].localeCompare(b[0]))
              .map(([cat, sess]) => ({
                category: cat,
                sessions: sess.sort((a, b) => String(a.session_label || '').localeCompare(String(b.session_label || '')))
              }))
          }))
      }));
  }, [masterPlans, planSessions, selectedClassId, monthStart, monthEnd, academicStartDate]);

  // Month → Area → Category → BULLETS (no weeks shown)
  const suggestedByArea = useMemo(() => {
    const areaMap = new Map();

    (suggestedWeeks || []).forEach((w) => {
      (w.subjects || []).forEach((s) => {
        const subject = (s.subject || 'General').toString();
        if (!areaMap.has(subject)) areaMap.set(subject, { subject, total: 0, categories: new Map() });

        const a = areaMap.get(subject);
        (s.categories || []).forEach((c) => {
          const cat = (c.category || 'Uncategorized').toString();
          if (!a.categories.has(cat)) a.categories.set(cat, { category: cat, bullets: [], __seen: new Set() });

          const bucket = a.categories.get(cat);
          (c.sessions || []).forEach((sess) => {
            const txt = (sess.raw_activity || sess.activity || 'Untitled').toString().trim();
            if (!txt) return;

            const lbl = (sess.session_label || '').toString().trim();
            const key = dedupeKey(`${txt}__${lbl}`);
            if (bucket.__seen.has(key)) return;
            bucket.__seen.add(key);

            bucket.bullets.push({ text: txt, label: lbl });
            a.total += 1;
          });
        });
      });
    });

    const out = Array.from(areaMap.values())
      .map((a) => {
        const cats = Array.from(a.categories.values())
          .map((x) => ({ category: x.category, bullets: x.bullets }))
          .filter((x) => x.bullets.length > 0)
          .sort((x, y) => x.category.localeCompare(y.category));

        cats.forEach((c) => c.bullets.sort((p, q) => p.text.localeCompare(q.text)));

        return { subject: a.subject, total: a.total, categories: cats };
      })
      .filter((a) => a.total > 0)
      .sort((a, b) => a.subject.localeCompare(b.subject));

    return out;
  }, [suggestedWeeks]);

  const goMonth = (d) => setActiveDate(dateISO(new Date(year, monthIdx + d, 1)));

  const openAdd = (s, dateStr = '') => {
    setAddStatusDefault(s);
    setAddDefaultDate(dateStr);
    setAddOpen(true);
  };

  const isAreaOpen = (subject) => {
    const k = String(subject || '');
    if (suggestAreaOpenMap[k] !== undefined) return !!suggestAreaOpenMap[k];
    if (suggestAreaOpenMap.__ALL__ !== undefined) return !!suggestAreaOpenMap.__ALL__;
    return false; // default collapsed
  };

  const toggleArea = (subject) => {
    const k = String(subject || '');
    setSuggestAreaOpenMap((p) => ({ ...p, [k]: !isAreaOpen(subject) }));
  };

  // Expand/Collapse ALL applies to BOTH sections: Suggestions + Kanban
  const handleExpandAll = () => {
    setSuggestAreaOpenMap({ __ALL__: true });
    setKanbanExpandAction({ type: 'EXPAND', ts: Date.now() });
  };

  const handleCollapseAll = () => {
    setSuggestAreaOpenMap({ __ALL__: false });
    setKanbanExpandAction({ type: 'COLLAPSE', ts: Date.now() });
  };

  const nextMonthFirstDate = dateISO(new Date(year, monthIdx + 1, 1));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <AddActivityModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        statusDefault={addStatusDefault}
        defaultDate={addDefaultDate}
        classroom={selectedClassroom}
        classroomStudents={classroomStudents}
        currMeta={currMeta}
        activeDateISO={dateISO(activeD)}
        onQuickAdd={onQuickAdd}
        showToast={showToast}
      />

      <div style={{ background: '#fff', border: '1px solid rgba(10,53,92,0.08)', borderRadius: 20, padding: 16, boxShadow: softShadow() }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 14 }}>
          <div style={{ display: 'grid', gap: 14 }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {classrooms.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedClassId(c.id)}
                  style={{
                    border: 'none',
                    cursor: 'pointer',
                    padding: '12px 20px',
                    background: String(c.id) === String(selectedClassId) ? THEME.brandPrimary : '#fff',
                    color: String(c.id) === String(selectedClassId) ? '#fff' : THEME.text,
                    boxShadow: String(c.id) === String(selectedClassId) ? `6px 6px 0px 0px ${THEME.brandSecondary}` : '2px 2px 0px #eee',
                    fontWeight: 800,
                    borderRadius: 0
                  }}
                >
                  {c.name}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              {/* UPDATED SEARCH INPUT STYLE */}
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search activity, note, or student…"
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  borderRadius: 6,
                  border: '1px solid #eee',
                  background: '#fff',
                  fontSize: 13,
                  color: THEME.text,
                  outline: 'none'
                }}
              />
              {/* UPDATED SELECT DROPDOWN STYLE */}
              <select
                value={areaFilter}
                onChange={(e) => setAreaFilter(e.target.value)}
                style={{
                  padding: '10px 36px 10px 12px',
                  borderRadius: 6,
                  border: '1px solid #eee',
                  background: '#fff',
                  fontSize: 13,
                  color: THEME.text,
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                {areaOptions.map((a) => (
                  <option key={a} value={a}>
                    {a === 'ALL' ? 'All Areas' : a}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Button variant="ghost" onClick={() => goMonth(-1)}>←</Button>
            <div style={{ fontWeight: 900 }}>{monthLabel}</div>
            <Button variant="ghost" onClick={() => goMonth(1)}>→</Button>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
          <Button variant="ghost" onClick={handleExpandAll}>Expand All</Button>
          <Button variant="ghost" onClick={handleCollapseAll}>Collapse All</Button>
        </div>
      </div>

      {/* Suggestions: Horizontal Cards per Area */}
      <Card style={{ padding: 18, overflow: 'visible' }}>
        <div style={{ fontWeight: 900, marginBottom: 14 }}>Suggested from Scope & Sequence - {monthLabel}</div>

        {!suggestedByArea.length ? (
          <div style={{ color: '#999', fontSize: 13, fontWeight: 600 }}>No suggestions.</div>
        ) : (
          <div
            style={{
              display: 'flex',
              gap: 16,
              flexWrap: 'nowrap',
              overflowX: 'auto',
              WebkitOverflowScrolling: 'touch',
              alignItems: 'flex-start',
              marginLeft: -18,
              marginRight: -18,
              paddingLeft: 18,
              paddingRight: 18,
              paddingBottom: 40,
              marginBottom: -20,
              position: 'relative',
              zIndex: 10
            }}
          >
            {suggestedByArea.map((area) => {
              const subjStyle = getSubjectStyle ? getSubjectStyle(area.subject) : { border: '#ccc', bg: '#fafafa', text: '#000' };
              const open = isAreaOpen(area.subject);

              return (
                <div
                  key={area.subject}
                  style={{
                    flex: '0 0 300px', // Fixed width
                    minWidth: 300,
                    border: '1px solid #eee',
                    borderTop: `4px solid ${subjStyle.border}`,
                    boxShadow: `4px 4px 0px 0px ${subjStyle.border}40`,
                    borderRadius: 4,
                    background: '#fff',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column'
                  }}
                >
                  {/* Header */}
                  <div
                    onClick={() => toggleArea(area.subject)}
                    style={{
                      cursor: 'pointer',
                      padding: '12px 14px',
                      background: '#fff',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderBottom: open ? `1px solid #f0f0f0` : 'none'
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <div style={{ fontWeight: 800, color: subjStyle.text, fontSize: 13, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                        {area.subject}
                      </div>
                      <div style={{ fontSize: 11, color: THEME.textMuted, fontWeight: 700 }}>
                        {area.total} item(s)
                      </div>
                    </div>

                    <div style={{ fontSize: 14, fontWeight: 900, color: THEME.textMuted }}>
                      {open ? '−' : '+'}
                    </div>
                  </div>

                  {/* Body */}
                  {open && (
                    <div style={{ padding: 12, background: '#fff' }}>
                      <div
                        style={{
                          maxHeight: 400,
                          overflowY: 'auto',
                          paddingRight: 4,
                          display: 'grid',
                          gap: 12
                        }}
                      >
                        {area.categories.map((c) => (
                          <div key={c.category} style={{ border: '1px solid #f0f0f0', borderRadius: 4, padding: 12, background: '#fff', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                            {c.category !== 'Uncategorized' && (
                              <div style={{ fontSize: 12, fontWeight: 800, color: THEME.text, marginBottom: 8 }}>
                                {c.category}
                              </div>
                            )}

                            <ul style={{ margin: 0, paddingLeft: 18, color: THEME.text, fontSize: 12, fontWeight: 500, display: 'grid', gap: 6 }}>
                              {c.bullets.map((b, idx) => (
                                <li key={`${c.category}-${idx}`} style={{ lineHeight: 1.4 }}>
                                  <div style={{ display: 'inline' }}>
                                    {b.text}
                                    {b.label ? (
                                      <span
                                        style={{
                                          marginLeft: 6,
                                          fontSize: 10,
                                          fontWeight: 700,
                                          color: THEME.textMuted,
                                          background: '#f1f3f5',
                                          border: '1px solid #e9ecef',
                                          padding: '2px 6px',
                                          borderRadius: 4,
                                          display: 'inline-block',
                                          verticalAlign: 'middle'
                                        }}
                                      >
                                        {b.label}
                                      </span>
                                    ) : null}
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
        <KanbanColumn
          status="W"
          items={filteredMonthItems.filter((i) => normalizeStatusSafe(i.status) === 'W')}
          students={students}
          classrooms={classrooms}
          selectedClassroomId={selectedClassId}
          currMeta={currMeta}
          classroomStudents={classroomStudents}
          defaultDateISO={dateISO(activeD)}
          onEditItem={onUpdateItem}
          onDeleteItem={onDeleteItem}
          onQuickAdd={() => openAdd('W')}
          onCreateItem={onQuickAdd}
          expandAction={kanbanExpandAction}
          showToast={showToast}
        />

        <KanbanColumn
          status="P"
          items={filteredMonthItems.filter((i) => normalizeStatusSafe(i.status) === 'P')}
          students={students}
          classrooms={classrooms}
          selectedClassroomId={selectedClassId}
          currMeta={currMeta}
          classroomStudents={classroomStudents}
          defaultDateISO={dateISO(activeD)}
          onEditItem={onUpdateItem}
          onDeleteItem={onDeleteItem}
          onQuickAdd={() => openAdd('P')}
          onCreateItem={onQuickAdd}
          expandAction={kanbanExpandAction}
          showToast={showToast}
        />

        <KanbanColumn
          status="A"
          columnLabelOverride={`Aim for ${nextMonthLabel}`}
          items={filteredAimItems}
          students={students}
          classrooms={classrooms}
          selectedClassroomId={selectedClassId}
          currMeta={currMeta}
          classroomStudents={classroomStudents}
          defaultDateISO={nextMonthFirstDate}
          onEditItem={onUpdateItem}
          onDeleteItem={onDeleteItem}
          onQuickAdd={() => openAdd('A', nextMonthFirstDate)}
          onCreateItem={onQuickAdd}
          expandAction={kanbanExpandAction}
          showToast={showToast}
        />
      </div>
    </div>
  );
}