import { useEffect, useMemo, useState } from 'react';
import { THEME } from '../../ui/theme';

// ---------- SHARED UI ----------
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

const UI = {
  bg: THEME.bg,
  card: THEME.cardBg,
  text: THEME.text,
  muted: THEME.textMuted,
  primary: THEME.brandPrimary,
  borderSoft: rgba(THEME.brandAccent, 0.28),
};

const ThemedCard = ({ children, style, onMouseDown }) => (
  <div
    onMouseDown={onMouseDown}
    style={{
      backgroundColor: UI.card,
      borderRadius: THEME.radius,
      boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
      border: `1px solid ${UI.borderSoft}`,
      overflow: 'visible',
      ...style,
    }}
  >
    {children}
  </div>
);

const FormLabel = ({ children, style }) => (
  <label
    style={{
      display: 'block',
      fontSize: 10,
      fontWeight: 700,
      color: UI.muted,
      marginBottom: 6,
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      fontFamily: THEME.sansFont,
      ...style,
    }}
  >
    {children}
  </label>
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
        border: `1px solid ${UI.borderSoft}`,
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
        e.currentTarget.style.boxShadow = `0 0 0 3px ${rgba(UI.primary, 0.12)}`;
        onFocus?.(e);
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = UI.borderSoft;
        e.currentTarget.style.boxShadow = 'none';
        onBlur?.(e);
      }}
    >
      {children}
    </Comp>
  );
};

const StyledButton = ({ variant = 'primary', children, style, ...props }) => {
  const base = {
    borderRadius: THEME.radius,
    fontFamily: THEME.sansFont,
    fontWeight: 600,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: '8px 16px',
    fontSize: 12,
    border: 'none',
    transition: 'transform 100ms ease, box-shadow 100ms ease',
    userSelect: 'none',
    whiteSpace: 'nowrap',
  };

  const variants = {
    primary: {
      background: UI.primary,
      color: '#fff',
      boxShadow: `2px 2px 0px 0px ${rgba(THEME.brandAccent, 0.6)}`,
    },
    ghost: {
      background: 'transparent',
      color: UI.muted,
      border: '1px solid transparent',
      boxShadow: 'none',
    }
  };

  return (
    <button
      {...props}
      style={{ ...base, ...(variants[variant] || variants.primary), ...style }}
      onMouseDown={(e) => {
        if (variant !== 'ghost') {
          e.currentTarget.style.transform = 'translate(1px, 1px)';
          e.currentTarget.style.boxShadow = `1px 1px 0px 0px ${UI.borderSoft}`;
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
    for (const a of curriculumAreas || []) {
      if (a?.name) map.set(a.name, a.name);
    }
    for (const c of curriculum || []) {
      const n = c?.curriculum_areas?.name || c?.area || '';
      if (n) map.set(n, n);
    }
    map.set('General', 'General');
    return Array.from(map.values()).sort((x, y) => x.localeCompare(y));
  }, [curriculumAreas, curriculum]);

  const categoryOptions = useMemo(() => {
    if (!area) return [];
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
        zIndex: 9999,
        backdropFilter: 'blur(2px)'
      }}
    >
      <ThemedCard
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: 'min(860px, 96vw)',
          padding: '24px 28px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: UI.primary, fontFamily: THEME.serifFont }}>
              Add Activity
            </div>
            <div style={{ marginTop: 4, fontSize: 12, color: UI.muted, fontWeight: 500 }}>
              Pick area/category/activity, select students, optional date — done.
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              border: 'none',
              background: 'transparent',
              fontSize: 24,
              cursor: 'pointer',
              color: UI.muted,
              lineHeight: '20px'
            }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <FormLabel>Classroom</FormLabel>
            <Field as="select" value={classroomId} onChange={(e) => setClassroomId(e.target.value)}>
              {classrooms.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Field>
          </div>

          <div>
            <FormLabel>Status</FormLabel>
            <Field as="select" value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUS_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Field>
          </div>

          <div>
            <FormLabel>Date (optional)</FormLabel>
            <Field type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: 16, marginBottom: 16 }}>
          <div>
            <FormLabel>Area</FormLabel>
            <Field as="select" value={area} onChange={(e) => { setArea(e.target.value); setCategory(''); }}>
              <option value="">Select…</option>
              {areaOptions.map(a => <option key={a} value={a}>{a}</option>)}
            </Field>
          </div>

          <div>
            <FormLabel>Category (optional)</FormLabel>
            <Field as="select" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">—</option>
              {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
            </Field>
          </div>

          <div>
            <FormLabel>Activity (pick or type)</FormLabel>
            <Field list="quick-add-activity-suggestions" value={activity} onChange={(e) => setActivity(e.target.value)} placeholder="Start typing…" />
            <datalist id="quick-add-activity-suggestions">
              {activityOptions.slice(0, 200).map(a => <option key={a} value={a} />)}
            </datalist>
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <FormLabel>Teacher note / sub-activity (optional)</FormLabel>
          <textarea
            value={teacherNote}
            onChange={(e) => setTeacherNote(e.target.value)}
            placeholder="Example: • c,a,n,r,m,t memory game"
            style={{
              width: '100%',
              minHeight: 70,
              borderRadius: THEME.radius,
              border: `1px solid ${UI.borderSoft}`,
              padding: '10px 14px',
              fontSize: 13,
              fontWeight: 500,
              background: '#fff',
              resize: 'vertical',
              fontFamily: THEME.sansFont,
              outline: 'none'
            }}
            onFocus={(e) => e.target.style.borderColor = UI.primary}
            onBlur={(e) => e.target.style.borderColor = UI.borderSoft}
          />
        </div>

        <div style={{ padding: 16, borderRadius: THEME.radius, border: `1px solid ${UI.borderSoft}`, background: '#f8fafc' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: UI.primary }}>
              Students ({selected.size} selected)
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={selectAll} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: UI.primary, fontWeight: 600, fontSize: 12 }}>Select all</button>
              <button onClick={clearAll} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: UI.muted, fontWeight: 600, fontSize: 12 }}>Clear</button>
            </div>
          </div>

          <Field value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)} placeholder="Search student…" />

          <div style={{ marginTop: 12, maxHeight: 180, overflowY: 'auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
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
                    padding: '8px 12px',
                    border: `1px solid ${checked ? UI.primary : UI.borderSoft}`,
                    background: checked ? rgba(UI.primary, 0.08) : '#fff',
                    borderRadius: 6,
                    cursor: 'pointer',
                    userSelect: 'none',
                    transition: 'all 0.15s'
                  }}
                >
                  <input type="checkbox" checked={checked} onChange={() => toggleStudent(id)} style={{ accentColor: UI.primary }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: checked ? UI.primary : UI.text }}>{name}</span>
                </label>
              );
            })}
            {filteredStudents.length === 0 ? (
              <div style={{ padding: 12, fontSize: 12, color: UI.muted, fontWeight: 500 }}>
                No students match your search.
              </div>
            ) : null}
          </div>
        </div>

        <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: 12, color: UI.muted, fontWeight: 500 }}>
            Keep it simple: pick the activity, add students, optional date.
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <StyledButton variant="ghost" onClick={onClose}>Cancel</StyledButton>
            <StyledButton onClick={doSubmit}>Add Activity</StyledButton>
          </div>
        </div>
      </ThemedCard>
    </div>
  );
}