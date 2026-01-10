import { useState, useEffect, useMemo } from 'react';
import { THEME, getSubjectStyle } from '../ui/theme';
import {
  getNormalizedItem,
  startOfWeekMonday,
  dateISO,
  addDays,
  getWeekFromDate,
  safeDate,
  inputStyle,
  normalizeStatusCode
} from '../utils/helpers';

import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import KanbanColumn from '../components/business/Kanban';
import EditActivityModal from '../components/business/EditActivityModal';
import AssessmentPanel from '../components/business/AssessmentPanel';

/** ---------------------------
 * HELPERS
 * --------------------------- */
function pad2(n) {
  return String(n).padStart(2, '0');
}
function toDateObj(v) {
  if (!v) return null;
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) {
    const s = v.slice(0, 10);
    const d = new Date(`${s}T00:00:00`);
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}
function getItemDateObj(it) {
  const d =
    toDateObj(it?.planning_date) ||
    toDateObj(it?.date) ||
    (it?.year && it?.month
      ? new Date(Number(it.year), Number(it.month) - 1, Number(it.day || 1), 0, 0, 0)
      : null);
  return d && !isNaN(d.getTime()) ? d : null;
}
function monthKeyFromDate(d) {
  if (!d) return null;
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}
function firstOfMonthISO(d) {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  return `${y}-${pad2(m)}-01`;
}
function addMonths(dateObj, n) {
  const d = new Date(dateObj.getFullYear(), dateObj.getMonth(), 1, 0, 0, 0);
  d.setMonth(d.getMonth() + n);
  return d;
}
function monthLabel(dateObj) {
  try {
    return dateObj.toLocaleString(undefined, { month: 'long', year: 'numeric' });
  } catch {
    return `${dateObj.getFullYear()}-${pad2(dateObj.getMonth() + 1)}`;
  }
}
function normStatus(raw) {
  const s = String(raw || '').trim();
  if (!s) return 'P';
  const u = s.toUpperCase();
  if (u === 'P' || u === 'W' || u === 'M' || u === 'A') return u;

  const n = s.toLowerCase().replace(/[_-]/g, ' ').trim();
  if (n.includes('practic')) return 'W';
  if (n.includes('present')) return 'P';
  if (n.includes('master')) return 'M';
  if (n.includes('aim') || n.includes('next month')) return 'A';
  return 'P';
}

/** ---------------------------
 * ADD ACTIVITY MODAL
 * --------------------------- */
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
  defaultDate = '',
  preSelectedStudentId = null
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
    setSelectedStudentIds(preSelectedStudentId ? [preSelectedStudentId] : []);
  }, [open, statusDefault, defaultDate, preSelectedStudentId]);

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

/** ---------------------------
 * MAIN COMPONENT
 * --------------------------- */
export default function IndividualPlanner({
  profile,
  forcedStudentId,
  students,
  planItems,
  masterPlans,
  planSessions,
  classrooms,
  activeDate,
  setActiveDate,
  onQuickAdd,
  onUpdateItem,
  onMoveItemToDate,
  onDeleteItem,
  curriculum,
  showToast,
  curriculumAreas,
  curriculumCategories
}) {
  const [selectedId, setSelectedId] = useState(forcedStudentId || null);
  const [filterClass, setFilterClass] = useState(classrooms[0]?.id);
  const [tab, setTab] = useState('KANBAN');
  const [editingItem, setEditingItem] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [areaFilter, setAreaFilter] = useState('ALL');
  const [catFilter, setCatFilter] = useState('ALL');

  // --- CRITICAL FIX: Default to EXPAND to prevent hidden items ---
  const [expandAction, setExpandAction] = useState({ type: 'EXPAND', ts: Date.now() });

  // Add modal state
  const [addOpen, setAddOpen] = useState(false);
  const [addStatusDefault, setAddStatusDefault] = useState('P');
  const [addDefaultDate, setAddDefaultDate] = useState('');

  useEffect(() => {
    if (forcedStudentId) setSelectedId(forcedStudentId);
  }, [forcedStudentId]);

  // --- FORCE EXPAND WHEN TAB OR STUDENT CHANGES ---
  useEffect(() => {
    if (tab === 'KANBAN' && selectedId) {
       const t = setTimeout(() => {
         setExpandAction({ type: 'EXPAND', ts: Date.now() });
       }, 50);
       return () => clearTimeout(t);
    }
  }, [tab, selectedId]);

  const isParentLocked = !!forcedStudentId;

  const student = useMemo(
    () => students.find((s) => String(s.id) === String(selectedId)),
    [students, selectedId]
  );

  const selectedClassroom = useMemo(
    () => classrooms.find((c) => String(c.id) === String(student?.classroom_id)),
    [classrooms, student]
  );

  const classroomStudents = useMemo(
    () => (students || []).filter((s) => String(s.classroom_id) === String(student?.classroom_id)),
    [students, student]
  );

  // --- Curriculum Meta Logic ---
  const currMeta = useMemo(() => {
    let areas = (curriculumAreas || []).slice();
    let categories = (curriculumCategories || []).slice();

    // Fill data if not provided via props directly
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

  // --- Filter Options ---
  const areaFilterOptions = useMemo(() => {
    return ['ALL', ...currMeta.areas.map(a => a.name).sort()];
  }, [currMeta]);

  const catFilterOptions = useMemo(() => {
    let cats = currMeta.categories;
    if (areaFilter !== 'ALL') {
      const ar = currMeta.areas.find(a => a.name === areaFilter);
      if (ar) cats = cats.filter(c => String(c.area_id) === String(ar.id));
    }
    return ['ALL', ...cats.map(c => c.name).sort()];
  }, [currMeta, areaFilter]);

  const editAreaOptions = useMemo(() => currMeta.areas.map(a => a.name).sort(), [currMeta]);
  const editCategoryOptions = useMemo(() => currMeta.categories.map(c => c.name).sort(), [currMeta]);

  const allStudentPlans = useMemo(() => {
    if (!selectedId) return [];
    return (planItems || []).filter((p) => String(p.student_id) === String(selectedId));
  }, [planItems, selectedId]);

  const planById = useMemo(() => {
    const m = new Map();
    allStudentPlans.forEach((p) => m.set(String(p.id), p));
    return m;
  }, [allStudentPlans]);

  const activeDateObj = useMemo(() => toDateObj(activeDate) || new Date(), [activeDate]);
  const currentMonthKey = useMemo(() => monthKeyFromDate(activeDateObj), [activeDateObj]);
  const nextMonthObj = useMemo(() => addMonths(activeDateObj, 1), [activeDateObj]);
  const nextMonthKey = useMemo(() => monthKeyFromDate(nextMonthObj), [nextMonthObj]);
  const currentMonthFirstISO = useMemo(() => firstOfMonthISO(activeDateObj), [activeDateObj]);
  const nextMonthFirstISO = useMemo(() => firstOfMonthISO(nextMonthObj), [nextMonthObj]);

  const inMonthKey = useMemo(() => {
    return (it, key) => monthKeyFromDate(getItemDateObj(it)) === key;
  }, []);

  const matchesFilters = useMemo(() => {
    const q = (search || '').trim().toLowerCase();
    return (it) => {
      const n = getNormalizedItem(it);
      const itemArea = n.area || (it.curriculum_areas?.name || '').trim();
      const itemCat = (it.curriculum_categories?.name || it.category || 'Uncategorized').trim();

      if (areaFilter !== 'ALL' && itemArea !== areaFilter) return false;
      if (catFilter !== 'ALL' && itemCat !== catFilter) return false;

      if (!q) return true;
      const fields = [
        n.title, n.rawActivity, n.notes,
        it.activity, it.raw_activity, it.notes, it.session_label,
        itemArea, itemCat
      ].filter(Boolean).map((x) => String(x).toLowerCase());
      return fields.some((f) => f.includes(q));
    };
  }, [search, areaFilter, catFilter]);

  const columnItems = useMemo(() => {
    const currMonth = allStudentPlans.filter((it) => inMonthKey(it, currentMonthKey));
    const nextMonth = allStudentPlans.filter((it) => inMonthKey(it, nextMonthKey));

    return {
      P: currMonth.filter((it) => normStatus(it.status) === 'P').filter(matchesFilters),
      W: currMonth.filter((it) => normStatus(it.status) === 'W').filter(matchesFilters),
      A: nextMonth.filter((it) => normStatus(it.status) === 'A').filter(matchesFilters)
    };
  }, [allStudentPlans, currentMonthKey, nextMonthKey, inMonthKey, matchesFilters]);

  const topStats = useMemo(() => {
    const p = columnItems.P.length;
    const w = columnItems.W.length;
    const a = columnItems.A.length;
    const total = p + w + a;
    return { p, w, a, total };
  }, [columnItems]);

  const openAdd = (status, dateStr = '') => {
    setAddStatusDefault(status);
    setAddDefaultDate(dateStr);
    setAddOpen(true);
  };

  const onMoveItemStatus = async (itemId, newStatusRaw) => {
    const it = planById.get(String(itemId));
    if (!it) return;

    const newStatus = normStatus(newStatusRaw);
    try {
      const targetDate = newStatus === 'A' ? nextMonthFirstISO : (activeDate || dateISO(new Date()));
      const updatePayload = {
        ...it,
        status: newStatus,
        planning_date: targetDate,
        year: Number(targetDate.slice(0, 4)),
        month: Number(targetDate.slice(5, 7)),
        day: Number(targetDate.slice(8, 10))
      };
      await onUpdateItem?.(updatePayload);
      showToast?.({
        type: 'success',
        title: 'Updated',
        message: newStatus === 'A' ? 'Moved to Next Month Aim.' : 'Moved status.'
      });
    } catch (e) {
      console.error(e);
      showToast?.({ type: 'error', title: 'Update failed', message: 'Could not move the item.' });
    }
  };

  if (!selectedId) {
    const filteredStudents = (students || [])
      .filter((s) => String(s.classroom_id) === String(filterClass))
      .filter((s) => {
        const q = (search || '').trim().toLowerCase();
        if (!q) return true;
        return `${s.first_name || ''} ${s.last_name || ''}`.toLowerCase().includes(q);
      });

    return (
      <div style={{ width: '100%', maxWidth: '100%' }}>
         <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          {classrooms.map((c) => (
            <button
              key={c.id}
              onClick={() => setFilterClass(c.id)}
              style={{
                border: 'none', cursor: 'pointer', padding: '12px 20px',
                background: String(filterClass) === String(c.id) ? THEME.brandPrimary : '#fff',
                color: String(filterClass) === String(c.id) ? '#fff' : THEME.text,
                boxShadow: String(filterClass) === String(c.id) ? `6px 6px 0px 0px ${THEME.brandSecondary}` : '2px 2px 0px #eee',
                fontWeight: 700
              }}
            >
              {c.name}
            </button>
          ))}
        </div>
        <Card style={{ padding: 14, marginBottom: 18 }}>
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search student…"
            style={{ width: '100%', padding: '12px 12px', border: '1px solid #eee', fontWeight: 600 }}
          />
        </Card>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 24 }}>
          {filteredStudents.map((s) => (
            <Card key={s.id} onClick={() => { setSelectedId(s.id); setSearch(''); }} style={{ padding: 30, cursor: 'pointer', textAlign: 'center' }}>
              <div style={{ width: 70, height: 70, background: THEME.brandAccent, margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 900, color: THEME.text, clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }}>{s.first_name?.[0] || '?'}</div>
              <div style={{ fontWeight: 600, fontSize: 18 }}>{s.first_name} {s.last_name}</div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // --- Selected Student View ---
  return (
    <div style={{ width: '100%', maxWidth: '100%', overflowX: 'auto', paddingBottom: 24 }}>
      <AddActivityModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        statusDefault={addStatusDefault}
        defaultDate={addDefaultDate}
        classroom={selectedClassroom}
        classroomStudents={classroomStudents}
        preSelectedStudentId={student?.id}
        currMeta={currMeta}
        activeDateISO={dateISO(activeDateObj)}
        onQuickAdd={onQuickAdd}
        showToast={showToast}
      />

      <div style={{ minWidth: 980 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {!isParentLocked && (
              <Button variant="ghost" onClick={() => setSelectedId(null)} style={{ paddingLeft: 0, fontSize: 13 }}>← All Students</Button>
            )}
            <div>
              <h2 style={{ fontSize: 32, margin: 0, fontFamily: THEME.serifFont, color: THEME.text }}>
                {student?.first_name} {student?.last_name}
              </h2>
              <div style={{ marginTop: 6, fontSize: 13, fontWeight: 700, color: THEME.textMuted }}>
                {classrooms.find((c) => String(c.id) === String(student?.classroom_id))?.name || ''}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <Button variant={tab === 'KANBAN' ? 'active' : 'ghost'} onClick={() => setTab('KANBAN')}>Montly Plan</Button>
            <Button variant={tab === 'PLAN' ? 'active' : 'ghost'} onClick={() => setTab('PLAN')}>Week Plan</Button>
            <Button variant={tab === 'ASSESS' ? 'active' : 'ghost'} onClick={() => setTab('ASSESS')}>Assessments</Button>
          </div>
        </div>

        <Card style={{ padding: 12, marginBottom: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
            <TopStat label={`To Present — ${monthLabel(activeDateObj)}`} value={topStats.p} tone="P" />
            <TopStat label={`Practicing — ${monthLabel(activeDateObj)}`} value={topStats.w} tone="W" />
            <TopStat label={`Aim — ${monthLabel(nextMonthObj)}`} value={topStats.a} tone="A" />
            <TopStat label="Total (shown)" value={topStats.total} tone="TOTAL" />
          </div>
        </Card>

        {tab === 'PLAN' && (
          <PlannerTab
            student={student}
            studentPlans={allStudentPlans}
            masterPlans={masterPlans}
            planSessions={planSessions}
            activeDate={activeDate}
            setActiveDate={setActiveDate}
            onQuickAdd={onQuickAdd}
            onMoveItemToDate={onMoveItemToDate}
            setEditingItem={setEditingItem}
            curriculum={curriculum}
            showToast={showToast}
          />
        )}

        {tab === 'ASSESS' && (
          <AssessmentPanel
            profile={profile}
            student={student}
            classroomId={student?.classroom_id}
            curriculum={curriculum}
            currMeta={currMeta}
            activeDateISO={dateISO(activeDateObj)}
            nextMonthFirstISO={nextMonthFirstISO}
            onQuickAdd={onQuickAdd}
            showToast={showToast}
          />
        )}

        {tab === 'KANBAN' && (
          <div>
            <Card style={{ padding: 14, marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                   <Button variant="ghost" onClick={() => setActiveDate(firstOfMonthISO(addMonths(activeDateObj, -1)))}>← Prev</Button>
                   <div style={{ fontWeight: 900, fontSize: 16, color: THEME.text, fontFamily: THEME.serifFont, minWidth: 140, textAlign: 'center' }}>
                     {monthLabel(activeDateObj)}
                   </div>
                   <Button variant="ghost" onClick={() => setActiveDate(firstOfMonthISO(addMonths(activeDateObj, 1)))}>Next →</Button>
                </div>

                <div style={{ display: 'flex', gap: 10, flex: 1, justifyContent: 'flex-end', alignItems: 'center' }}>
                   <Button variant="ghost" onClick={() => setExpandAction({ type: 'EXPAND', ts: Date.now() })}>Expand</Button>
                   <Button variant="ghost" onClick={() => setExpandAction({ type: 'COLLAPSE', ts: Date.now() })}>Collapse</Button>

                   <div style={{ height: 20, width: 1, background: '#eee', margin: '0 8px' }} />

                   <input
                    value={search} onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search activity..."
                    style={{ padding: '10px 12px', border: '1px solid #ddd', fontWeight: 600, borderRadius: 12, width: 200 }}
                   />

                   <select
                     value={areaFilter}
                     onChange={(e) => { setAreaFilter(e.target.value); setCatFilter('ALL'); }}
                     style={{ padding: '10px 12px', border: '1px solid #ddd', fontWeight: 600, borderRadius: 12, maxWidth: 160 }}
                   >
                      {areaFilterOptions.map(o => <option key={o} value={o}>{o === 'ALL' ? 'All Areas' : o}</option>)}
                   </select>

                   <select
                     value={catFilter}
                     onChange={(e) => setCatFilter(e.target.value)}
                     style={{ padding: '10px 12px', border: '1px solid #ddd', fontWeight: 600, borderRadius: 12, maxWidth: 160 }}
                   >
                      {catFilterOptions.map(o => <option key={o} value={o}>{o === 'ALL' ? 'All Categories' : o}</option>)}
                   </select>
                </div>
              </div>
            </Card>

            <div style={{ width: '100%', overflowX: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(340px, 1fr))', gap: 18, minWidth: 1080 }}>
                              <KanbanColumn
                  key="W" status="W" items={columnItems.W}
                  students={students} classrooms={classrooms}
                  onEditItem={setEditingItem} onDeleteItem={onDeleteItem}
                  selectedClassroomId={student?.classroom_id} mode="SINGLE_STUDENT"
                  onMoveItemStatus={onMoveItemStatus} getItemById={(id) => planById.get(String(id))}
                  columnLabelOverride={`Practicing`}
                  onQuickAdd={() => openAdd('W')}
                  currMeta={currMeta}
                  expandAction={expandAction}
                />
                <KanbanColumn
                  key="P" status="P" items={columnItems.P}
                  students={students} classrooms={classrooms}
                  onEditItem={setEditingItem} onDeleteItem={onDeleteItem}
                  selectedClassroomId={student?.classroom_id} mode="SINGLE_STUDENT"
                  onMoveItemStatus={onMoveItemStatus} getItemById={(id) => planById.get(String(id))}
                  columnLabelOverride={`To Present`}
                  onQuickAdd={() => openAdd('P')}
                  currMeta={currMeta}
                  expandAction={expandAction}
                />
                <KanbanColumn
                  key="A" status="A" items={columnItems.A}
                  students={students} classrooms={classrooms}
                  onEditItem={setEditingItem} onDeleteItem={onDeleteItem}
                  selectedClassroomId={student?.classroom_id} mode="SINGLE_STUDENT"
                  onMoveItemStatus={onMoveItemStatus} getItemById={(id) => planById.get(String(id))}
                  columnLabelOverride={`Aim for ${monthLabel(nextMonthObj)}`}
                  onQuickAdd={() => openAdd('A', nextMonthFirstISO)}
                  currMeta={currMeta}
                  expandAction={expandAction}
                />
              </div>
            </div>
          </div>
        )}

        {editingItem && (
          <EditActivityModal
            item={editingItem}
            curriculum={curriculum}
            areaOptions={editAreaOptions}
            categoryOptions={editCategoryOptions}
            onSave={onUpdateItem}
            onDelete={onDeleteItem}
            onClose={() => setEditingItem(null)}
          />
        )}
      </div>
    </div>
  );
}

function TopStat({ label, value, tone }) {
  const meta =
    tone === 'W' ? { bg: '#FFF7E6', border: '1px solid rgba(240,187,107,0.35)' }
    : tone === 'P' ? { bg: '#EEF5FF', border: '1px solid rgba(10,53,92,0.15)' }
    : tone === 'A' ? { bg: '#F7F1FF', border: '1px solid rgba(120,80,200,0.18)' }
    : { bg: '#fff', border: '1px solid #eee' };

  return (
    <div style={{ padding: 12, background: meta.bg, border: meta.border }}>
      <div style={{ fontSize: 11, fontWeight: 900, color: THEME.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
      <div style={{ marginTop: 6, fontSize: 22, fontWeight: 900, color: THEME.text, fontFamily: THEME.serifFont }}>{value}</div>
    </div>
  );
}

function PlannerTab({ student, studentPlans, masterPlans, planSessions, activeDate, setActiveDate, onQuickAdd, onMoveItemToDate, setEditingItem, curriculum, showToast }) {
  const weekStart = startOfWeekMonday(activeDate);
  const weekDays = Array.from({ length: 5 }, (_, i) => ({ label: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'][i], date: dateISO(addDays(weekStart, i)) }));
  const currentWeek = getWeekFromDate(activeDate);

  const currSessionsByArea = useMemo(() => {
    const plans = (masterPlans || []).filter((p) => Number(p.week_number) === Number(currentWeek) && String(p.classroom_id) === String(student.classroom_id));
    const sessions = (planSessions || []).filter((s) => plans.some((p) => String(p.id) === String(s.plan_id)));
    const groups = {};
    sessions.forEach((s) => {
      const area = (s.curriculum_areas?.name || 'General').trim() || 'General';
      const label = (s.raw_activity || s.curriculum_activities?.name || s.session_label || 'Activity').trim();
      if (!groups[area]) groups[area] = [];
      groups[area].push({ ...s, __label: label });
    });
    return groups;
  }, [masterPlans, planSessions, currentWeek, student?.classroom_id]);

  const sortedAreas = useMemo(() => Object.keys(currSessionsByArea).sort(), [currSessionsByArea]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 360px) minmax(0, 1fr)', gap: 18, alignItems: 'start' }}>
      <Card style={{ padding: 18, height: 'calc(100vh - 220px)', overflow: 'auto', position: 'sticky', top: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
          <div>
            <h3 style={{ margin: 0, fontFamily: THEME.serifFont }}>Week Builder</h3>
            <div style={{ marginTop: 4, fontSize: 12, color: THEME.textMuted, fontWeight: 700 }}>Suggestions from curriculum week {currentWeek}</div>
          </div>
          <Button variant="ghost" onClick={() => setActiveDate(dateISO(new Date()))}>Today</Button>
        </div>
        <div style={{ marginTop: 14, display: 'grid', gap: 14 }}>
          {sortedAreas.map((area) => {
            const subj = getSubjectStyle ? getSubjectStyle(area) : { border: '#ccc', bg: '#fff', text: '#333' };
            return (
              <div key={area} style={{ border: `1px solid ${subj.border}`, background: '#fff' }}>
                <div style={{ padding: '10px 12px', background: subj.bg, borderBottom: '1px solid rgba(0,0,0,0.05)', fontWeight: 900, color: subj.text, textTransform: 'uppercase', fontSize: 12 }}>{area}</div>
                <div style={{ padding: 10, display: 'grid', gap: 10 }}>
                  {currSessionsByArea[area].map((s) => (
                    <div key={s.id} draggable onDragStart={(e) => e.dataTransfer.setData('item', JSON.stringify({ type: 'CURR_SESSION', id: s.id }))} style={{ padding: 10, border: '1px solid #eee', background: 'white', cursor: 'grab' }}>
                      <div style={{ fontWeight: 900, fontSize: 12, color: THEME.text }}>{s.session_label ? `${s.session_label} — ` : ''}{s.__label}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
      <div style={{ minWidth: 0 }}>
        <Card style={{ padding: 16, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div style={{ fontWeight: 800, fontFamily: THEME.serifFont }}>Weekly Plan</div>
              <input type="date" value={activeDate} onChange={(e) => setActiveDate(e.target.value)} style={inputStyle()} />
            </div>
            <div style={{ fontSize: 12, fontWeight: 800, color: THEME.textMuted }}>Drag from Week Builder into a day.</div>
          </div>
        </Card>
        <div style={{ width: '100%', overflowX: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(240px, 1fr))', gap: 10, minWidth: 1200 }}>
            {weekDays.map((d) => (
              <div key={d.date} onDragOver={(e) => e.preventDefault()} onDrop={async (e) => {
                  e.preventDefault();
                  try {
                    const payload = JSON.parse(e.dataTransfer.getData('item'));
                    if (payload.type === 'PLAN_ITEM') onMoveItemToDate(payload, d.date);
                    if (payload.type === 'CURR_SESSION') {
                       const session = (planSessions || []).find((x) => String(x.id) === String(payload.id));
                       if (session) await onQuickAdd({ student_id: student.id, activity: session.curriculum_activities?.name || session.raw_activity || 'Activity', status: 'P', date: d.date, curriculum_activity_id: session.curriculum_activity_id, curriculum_area_id: session.curriculum_area_id, raw_activity: session.raw_activity || null });
                    }
                  } catch (err) {}
                }} style={{ background: 'white', padding: 10, minHeight: 420, border: '1px solid #eee', boxShadow: THEME.cardShadow }}>
                <div style={{ textAlign: 'center', fontWeight: 900, marginBottom: 12, color: THEME.text }}>{d.label}<div style={{ fontSize: 11, color: THEME.textMuted, fontWeight: 700, marginTop: 2 }}>{safeDate(d.date)}</div></div>
                {(studentPlans || []).filter((p) => String(p.planning_date || '').startsWith(d.date)).map((i) => (
                    <div key={i.id} draggable onDragStart={(e) => e.dataTransfer.setData('item', JSON.stringify({ type: 'PLAN_ITEM', id: i.id }))} onClick={() => setEditingItem(i)} style={{ background: '#FAFAFA', padding: 10, marginBottom: 8, fontSize: 12, cursor: 'pointer', border: '1px solid #eee', fontWeight: 800 }}>{getNormalizedItem(i).rawActivity || getNormalizedItem(i).title}</div>
                  ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
