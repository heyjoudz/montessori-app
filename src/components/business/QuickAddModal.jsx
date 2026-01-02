import { useEffect, useMemo, useState } from 'react';
import { THEME } from '../../ui/theme';
import Card from '../ui/Card';
import Button from '../ui/Button';

const STATUS_OPTIONS = [
  { value: 'P', label: 'To Present' },
  { value: 'W', label: 'Practicing' },
  { value: 'M', label: 'Mastered' }
];

function clean(s) {
  return String(s || '').trim();
}

export default function QuickAddModal({
  open,
  onClose,
  onSubmit,
  classrooms = [],
  students = [],
  curriculum = [],
  curriculumAreas = [],
  curriculumCategories = [],
  defaults = {},
  showToast
}) {
  const [classroomId, setClassroomId] = useState(defaults.classroom_id ?? classrooms?.[0]?.id ?? '');
  const [status, setStatus] = useState(defaults.status ?? 'P');
  const [date, setDate] = useState(defaults.date ?? '');
  const [area, setArea] = useState(defaults.area ?? '');
  const [category, setCategory] = useState(defaults.category ?? '');
  const [activity, setActivity] = useState(defaults.activity ?? '');
  const [teacherNote, setTeacherNote] = useState(defaults.teacher_note ?? '');

  const [studentSearch, setStudentSearch] = useState('');
  const [selected, setSelected] = useState(() => new Set());

  useEffect(() => {
    if (!open) return;
    setClassroomId(defaults.classroom_id ?? classrooms?.[0]?.id ?? '');
    setStatus(defaults.status ?? 'P');
    setDate(defaults.date ?? '');
    setArea(defaults.area ?? '');
    setCategory(defaults.category ?? '');
    setActivity(defaults.activity ?? '');
    setTeacherNote(defaults.teacher_note ?? '');
    setStudentSearch('');
    setSelected(new Set());
  }, [open, defaults, classrooms]);

  // --- options ---
  const areaOptions = useMemo(() => {
    const map = new Map();

    // prefer explicit curriculumAreas
    for (const a of curriculumAreas || []) {
      if (a?.name) map.set(a.name, a.name);
    }

    // fallback: derive from curriculum activities
    for (const c of curriculum || []) {
      const n = c?.curriculum_areas?.name || c?.area || '';
      if (n) map.set(n, n);
    }

    map.set('General', 'General');

    return Array.from(map.values()).sort((x, y) => x.localeCompare(y));
  }, [curriculumAreas, curriculum]);

  const categoryOptions = useMemo(() => {
    if (!area) return [];

    // derive categories used by activities under chosen area (most robust)
    const catIds = new Set();
    for (const c of curriculum || []) {
      const aName = c?.curriculum_areas?.name || c?.area || '';
      if (clean(aName).toLowerCase() !== clean(area).toLowerCase()) continue;
      const cid = c?.category_id || c?.curriculum_category_id || c?.curriculum_category?.id || c?.curriculum_categories?.id;
      if (cid != null) catIds.add(String(cid));
    }

    const idToName = new Map();
    for (const cat of curriculumCategories || []) {
      if (cat?.id == null) continue;
      idToName.set(String(cat.id), cat.name || '');
    }

    const names = [];
    for (const id of catIds) {
      const nm = idToName.get(id);
      if (nm) names.push(nm);
    }

    // fallback: if we couldn't resolve categories, show all categories
    const fallback = (curriculumCategories || []).map(c => c?.name).filter(Boolean);

    const out = (names.length ? names : fallback).filter(Boolean);
    return Array.from(new Set(out)).sort((x, y) => x.localeCompare(y));
  }, [area, curriculum, curriculumCategories]);

  const activityOptions = useMemo(() => {
    const a = clean(area).toLowerCase();
    const cat = clean(category).toLowerCase();

    const list = (curriculum || []).filter(c => {
      const aName = clean(c?.curriculum_areas?.name || c?.area).toLowerCase();
      if (a && aName !== a) return false;

      if (cat) {
        const catName = clean(c?.curriculum_categories?.name || c?.category).toLowerCase();
        if (catName !== cat) return false;
      }
      return true;
    });

    // unique names
    const set = new Map();
    for (const c of list) {
      if (!c?.name) continue;
      set.set(c.name, c);
    }

    return Array.from(set.keys()).sort((x, y) => x.localeCompare(y));
  }, [curriculum, area, category]);

  const filteredStudents = useMemo(() => {
    const q = clean(studentSearch).toLowerCase();
    if (!q) return students || [];
    return (students || []).filter(s => {
      const nm = `${s.first_name || ''} ${s.last_name || ''}`.trim().toLowerCase();
      return nm.includes(q);
    });
  }, [students, studentSearch]);

  const toggleStudent = (id) => {
    setSelected(prev => {
      const n = new Set(prev);
      const k = String(id);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  };

  const selectAll = () => setSelected(new Set((filteredStudents || []).map(s => String(s.id))));
  const clearAll = () => setSelected(new Set());

  if (!open) return null;

  const doSubmit = async () => {
    if (!classroomId) return showToast?.('Please choose a classroom', 'error');
    if (!clean(activity)) return showToast?.('Please choose or type an activity', 'error');
    if (selected.size === 0) return showToast?.('Please select at least one student', 'error');

    await onSubmit?.({
      classroom_id: classroomId,
      status,
      planning_date: date || null,
      area: area || 'General',
      category: category || null,
      activity: clean(activity),
      teacher_note: clean(teacherNote) || null,
      student_ids: Array.from(selected)
    });
  };

  return (
    <div
      onMouseDown={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.25)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        zIndex: 9999
      }}
    >
      <Card
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: 'min(860px, 96vw)',
          padding: 16,
          border: '1px solid rgba(10,53,92,0.10)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: THEME.brandPrimary, fontFamily: THEME.serifFont }}>
              Add activity
            </div>
            <div style={{ marginTop: 4, fontSize: 12, color: THEME.textMuted, fontWeight: 500 }}>
              Pick area/category/activity, select students, optional date — done.
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              border: 'none',
              background: 'transparent',
              fontSize: 22,
              cursor: 'pointer',
              color: THEME.textMuted,
              lineHeight: '20px'
            }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 650, color: THEME.brandPrimary, marginBottom: 6 }}>Classroom</div>
            <select
              value={classroomId}
              onChange={(e) => setClassroomId(e.target.value)}
              style={{
                width: '100%',
                height: 38,
                borderRadius: 12,
                border: '1px solid rgba(10,53,92,0.14)',
                padding: '0 10px',
                fontSize: 13,
                fontWeight: 600,
                background: '#fff'
              }}
            >
              {classrooms.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 650, color: THEME.brandPrimary, marginBottom: 6 }}>Status</div>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              style={{
                width: '100%',
                height: 38,
                borderRadius: 12,
                border: '1px solid rgba(10,53,92,0.14)',
                padding: '0 10px',
                fontSize: 13,
                fontWeight: 600,
                background: '#fff'
              }}
            >
              {STATUS_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 650, color: THEME.brandPrimary, marginBottom: 6 }}>
              Date (optional)
            </div>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={{
                width: '100%',
                height: 38,
                borderRadius: 12,
                border: '1px solid rgba(10,53,92,0.14)',
                padding: '0 10px',
                fontSize: 13,
                fontWeight: 600,
                background: '#fff'
              }}
            />
          </div>
        </div>

        <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: 10 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 650, color: THEME.brandPrimary, marginBottom: 6 }}>Area</div>
            <select
              value={area}
              onChange={(e) => {
                setArea(e.target.value);
                setCategory('');
              }}
              style={{
                width: '100%',
                height: 38,
                borderRadius: 12,
                border: '1px solid rgba(10,53,92,0.14)',
                padding: '0 10px',
                fontSize: 13,
                fontWeight: 600,
                background: '#fff'
              }}
            >
              <option value="">Select…</option>
              {areaOptions.map(a => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 650, color: THEME.brandPrimary, marginBottom: 6 }}>
              Category (optional)
            </div>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={{
                width: '100%',
                height: 38,
                borderRadius: 12,
                border: '1px solid rgba(10,53,92,0.14)',
                padding: '0 10px',
                fontSize: 13,
                fontWeight: 600,
                background: '#fff'
              }}
            >
              <option value="">—</option>
              {categoryOptions.map(c => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 650, color: THEME.brandPrimary, marginBottom: 6 }}>
              Activity (pick or type)
            </div>

            <input
              list="activity-suggestions"
              value={activity}
              onChange={(e) => setActivity(e.target.value)}
              placeholder="Start typing…"
              style={{
                width: '100%',
                height: 38,
                borderRadius: 12,
                border: '1px solid rgba(10,53,92,0.14)',
                padding: '0 12px',
                fontSize: 13,
                fontWeight: 500,
                background: '#fff'
              }}
            />
            <datalist id="activity-suggestions">
              {activityOptions.slice(0, 200).map(a => (
                <option key={a} value={a} />
              ))}
            </datalist>
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 650, color: THEME.brandPrimary, marginBottom: 6 }}>
            Teacher note / sub-activity (optional)
          </div>
          <textarea
            value={teacherNote}
            onChange={(e) => setTeacherNote(e.target.value)}
            placeholder="Example: • c,a,n,r,m,t memory game"
            style={{
              width: '100%',
              minHeight: 70,
              borderRadius: 14,
              border: '1px solid rgba(10,53,92,0.14)',
              padding: 12,
              fontSize: 13,
              fontWeight: 500,
              background: '#fff',
              resize: 'vertical'
            }}
          />
        </div>

        <div style={{ marginTop: 12, padding: 12, borderRadius: 14, border: '1px solid rgba(10,53,92,0.10)', background: '#fff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: THEME.brandPrimary }}>
              Students ({selected.size} selected)
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="ghost" onClick={selectAll}>Select all</Button>
              <Button variant="ghost" onClick={clearAll}>Clear</Button>
            </div>
          </div>

          <input
            value={studentSearch}
            onChange={(e) => setStudentSearch(e.target.value)}
            placeholder="Search student…"
            style={{
              marginTop: 10,
              width: '100%',
              height: 36,
              borderRadius: 12,
              border: '1px solid rgba(10,53,92,0.14)',
              padding: '0 12px',
              fontSize: 13,
              fontWeight: 500,
              background: '#fff'
            }}
          />

          <div style={{ marginTop: 10, maxHeight: 220, overflow: 'auto', borderRadius: 12, border: '1px solid rgba(10,53,92,0.10)' }}>
            {filteredStudents.map(s => {
              const id = String(s.id);
              const checked = selected.has(id);
              const name = `${s.first_name || ''} ${s.last_name || ''}`.trim();

              return (
                <label
                  key={id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    borderBottom: '1px solid rgba(10,53,92,0.06)',
                    cursor: 'pointer',
                    userSelect: 'none'
                  }}
                >
                  <input type="checkbox" checked={checked} onChange={() => toggleStudent(id)} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: THEME.brandPrimary }}>{name}</span>
                </label>
              );
            })}
            {filteredStudents.length === 0 ? (
              <div style={{ padding: 12, fontSize: 12, color: THEME.textMuted, fontWeight: 500 }}>
                No students match your search.
              </div>
            ) : null}
          </div>
        </div>

        <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: 12, color: THEME.textMuted, fontWeight: 500 }}>
            Keep it simple: pick the activity, add students, optional date.
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button onClick={doSubmit}>Add</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
