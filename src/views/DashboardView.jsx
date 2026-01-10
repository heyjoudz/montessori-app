// src/views/DashboardView.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import { THEME, getSubjectStyle, getStatusStyle } from '../ui/theme';
import { ACADEMIC_START, safeDate, dateISO, addDays, normalizeStatusCode } from '../utils/helpers';

import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import KanbanColumn from '../components/business/Kanban';

import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  ArrowRight,
  Search,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

// -------------------- Helpers --------------------

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

function fmtMonthLabel(d) {
  try {
    return d.toLocaleString('en-US', { month: 'long' }) + ' ' + d.getFullYear();
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
  return { y, m, start: new Date(y, m, 1), end: new Date(y, m + 1, 1) };
}

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
  if (u === 'A' || u === 'P' || u === 'W' || u === 'M') return u;
  try {
    const z = normalizeStatusCode(raw);
    return z === 'A' ? 'A' : z;
  } catch {
    return 'P';
  }
}

function isArchivedStatus(raw) {
  return String(raw || '').toLowerCase().includes('archiv');
}

function normalizeScore(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  const clean = String(raw).replace(/%/g, '').trim();
  const num = parseFloat(clean);
  return isNaN(num) ? null : num;
}

// -------------------- Theme-aligned tiny UI atoms --------------------

const INPUT_BASE = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: THEME.radius,
  border: '1px solid #eee',
  background: '#fff',
  fontFamily: THEME.sansFont,
  color: THEME.text,
  fontSize: 13,
  outline: 'none'
};

const SELECT_BASE = {
  ...INPUT_BASE,
  cursor: 'pointer'
};

const Label = ({ children }) => (
  <div style={{ fontSize: 11, fontWeight: 700, color: THEME.textMuted, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 6 }}>
    {children}
  </div>
);

const IconBtn = ({ onClick, title, children }) => (
  <button
    title={title}
    onClick={onClick}
    style={{
      width: 34,
      height: 34,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: THEME.radius,
      border: '1px solid #eee',
      background: '#fff',
      boxShadow: '3px 3px 0px 0px #BFD8D2',
      cursor: 'pointer',
      transition: 'transform 0.15s ease, box-shadow 0.15s ease'
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.transform = 'translate(-1px,-1px)';
      e.currentTarget.style.boxShadow = '4px 4px 0px 0px #BFD8D2';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.transform = 'translate(0,0)';
      e.currentTarget.style.boxShadow = '3px 3px 0px 0px #BFD8D2';
    }}
  >
    {children}
  </button>
);

const ClassroomBtn = ({ active, label, onClick }) => (
  <button
    onClick={onClick}
    style={{
      padding: '8px 12px',
      borderRadius: THEME.radius,
      border: active ? `2px solid ${THEME.brandPrimary}` : '1px solid #eee',
      background: active ? THEME.brandPrimary : '#fff',
      color: active ? '#fff' : THEME.text,
      fontFamily: THEME.sansFont,
      fontSize: 12,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      cursor: 'pointer',
      boxShadow: active ? `3px 3px 0px 0px ${THEME.brandSecondary}` : `3px 3px 0px 0px ${THEME.brandAccent}`,
      transition: 'transform 0.15s ease, box-shadow 0.15s ease'
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.transform = 'translate(-1px,-1px)';
      e.currentTarget.style.boxShadow = active ? `4px 4px 0px 0px ${THEME.brandSecondary}` : `4px 4px 0px 0px ${THEME.brandAccent}`;
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.transform = 'translate(0,0)';
      e.currentTarget.style.boxShadow = active ? `3px 3px 0px 0px ${THEME.brandSecondary}` : `3px 3px 0px 0px ${THEME.brandAccent}`;
    }}
  >
    {label}
  </button>
);

const SoftChip = ({ dot, label, count }) => (
  <div
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 10,
      padding: '8px 12px',
      background: '#fff',
      border: '1px solid #eee',
      borderRadius: THEME.radius,
      boxShadow: '3px 3px 0px 0px #F9F3EF',
      fontFamily: THEME.sansFont,
      fontSize: 12,
      fontWeight: 700,
      color: THEME.text,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      whiteSpace: 'nowrap'
    }}
  >
    <span style={{ width: 8, height: 8, background: dot }} />
    <span style={{ opacity: 0.9 }}>{label}</span>
    <span style={{ marginLeft: 2, fontWeight: 800 }}>{count}</span>
  </div>
);

const ProgressRing = ({ pct = 0, size = 40 }) => {
  const stroke = 4;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, pct));
  const dash = (clamped / 100) * c;

  return (
    <svg width={size} height={size} style={{ display: 'block' }}>
      <circle cx={size / 2} cy={size / 2} r={r} stroke="#F9F3EF" strokeWidth={stroke} fill="none" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={THEME.brandAccent}
        strokeWidth={stroke}
        fill="none"
        strokeDasharray={`${dash} ${c - dash}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
};

// -------------------- Modals --------------------

function AddActivityModal({
  open,
  onClose,
  statusDefault,
  classroom,
  classroomStudents,
  currMeta,
  activeDateISO,
  onQuickAdd,
  showToast,
  defaultDate
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
    setStatus(statusDefault || 'P');
    setDate(defaultDate || '');
    setAreaId('');
    setCategoryId('');
    setActivityId('');
    setActivityText('');
    setSubNote('');
    setStudentSearch('');
    setSelectedStudentIds([]);
  }, [open, statusDefault, defaultDate]);

  const areaOptions = useMemo(
    () => [{ value: '', label: 'Select…' }, ...(currMeta?.areas || []).map((x) => ({ value: String(x.id), label: x.name }))],
    [currMeta]
  );

  const categoryOptions = useMemo(() => {
    const all = currMeta?.categories || [];
    const filtered = areaId ? all.filter((c) => String(c.area_id) === String(areaId)) : all;
    return [{ value: '', label: '—' }, ...filtered.map((c) => ({ value: String(c.id), label: c.name }))];
  }, [currMeta, areaId]);

  const activityOptions = useMemo(() => {
    let filtered = currMeta?.activities || [];
    if (categoryId) filtered = filtered.filter((a) => String(a.category_id) === String(categoryId));
    return [{ value: '', label: 'Type to search…' }, ...filtered.map((a) => ({ value: String(a.id), label: a.name }))];
  }, [currMeta, categoryId]);

  const filteredStudents = useMemo(() => {
    const q = (studentSearch || '').toLowerCase().trim();
    if (!q) return classroomStudents;
    return (classroomStudents || []).filter((s) => `${s.first_name} ${s.last_name}`.toLowerCase().includes(q));
  }, [classroomStudents, studentSearch]);

  const toggleStudent = (id) =>
    setSelectedStudentIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const save = async () => {
    if (!classroom?.id) return;
    if (!selectedStudentIds.length) {
      showToast?.('Select at least one student.');
      return;
    }

    let pickedName = (activityText || '').trim();
    const picked = (currMeta?.activities || []).find((a) => String(a.id) === String(activityId));
    let catId = categoryId || null;
    let arId = areaId || null;

    if (picked) {
      pickedName = picked.name;
      catId = picked.category_id;
      arId = picked.area_id;
    }
    if (!pickedName) {
      showToast?.('Select or type an activity.');
      return;
    }

    try {
      await Promise.all(
        selectedStudentIds.map((sid) =>
          onQuickAdd?.({
            student_id: sid,
            status,
            date: date || activeDateISO,
            activity: pickedName,
            notes: subNote,
            curriculum_activity_id: picked?.id,
            curriculum_category_id: catId,
            curriculum_area_id: arId
          })
        )
      );
      onClose();
    } catch (e) {
      console.error(e);
      showToast?.('Failed to add activity.');
    }
  };

  if (!open) return null;

  return (
    <Modal title="Add Activity" onClose={onClose} width={720}>
      <div style={{ display: 'grid', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <Label>Status</Label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} style={SELECT_BASE}>
              <option value="P">To Present</option>
              <option value="W">Practicing</option>
              <option value="M">Mastered</option>
              <option value="A">Next Month Aim</option>
            </select>
          </div>
          <div>
            <Label>Date</Label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={INPUT_BASE} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <Label>Area</Label>
            <select value={areaId} onChange={(e) => setAreaId(e.target.value)} style={SELECT_BASE}>
              {areaOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Category</Label>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} style={SELECT_BASE}>
              {categoryOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <Label>Activity</Label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <select
              value={activityId}
              onChange={(e) => {
                setActivityId(e.target.value);
                setActivityText('');
              }}
              style={SELECT_BASE}
            >
              {activityOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <input
              placeholder="Or type custom…"
              value={activityText}
              onChange={(e) => {
                setActivityText(e.target.value);
                setActivityId('');
              }}
              style={INPUT_BASE}
            />
          </div>
        </div>

        <div>
          <Label>Notes (optional)</Label>
          <input value={subNote} onChange={(e) => setSubNote(e.target.value)} placeholder="Short note…" style={INPUT_BASE} />
        </div>

        <div style={{ border: '1px solid #eee', padding: 12, boxShadow: '3px 3px 0px 0px #F9F3EF' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: THEME.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 }}>
              Students ({selectedStudentIds.length})
            </div>
            <div style={{ width: 260, position: 'relative' }}>
              <input
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                placeholder="Search…"
                style={{ ...INPUT_BASE, paddingLeft: 34 }}
              />
              <div style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}>
                <Search size={16} color={THEME.textMuted} />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', maxHeight: 140, overflowY: 'auto', paddingRight: 6 }}>
            {(filteredStudents || []).map((s) => {
              const active = selectedStudentIds.includes(s.id);
              return (
                <button
                  key={s.id}
                  onClick={() => toggleStudent(s.id)}
                  style={{
                    border: active ? `2px solid ${THEME.brandPrimary}` : '1px solid #eee',
                    background: '#fff',
                    color: THEME.text,
                    padding: '7px 10px',
                    borderRadius: THEME.radius,
                    fontWeight: 700,
                    fontSize: 12,
                    cursor: 'pointer',
                    boxShadow: active ? `3px 3px 0px 0px ${THEME.brandAccent}` : '2px 2px 0px 0px #F9F3EF'
                  }}
                >
                  {s.first_name}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <Button variant="primary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="secondary" onClick={save}>
            Add Activity
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function BatchAssessmentModal({ open, onClose, students, templates, classroomId, teacherId, onRefresh }) {
  const [tmplId, setTmplId] = useState('');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(dateISO(new Date()));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (templates.length > 0 && !tmplId) {
      setTmplId(templates[0].id);
      if (templates[0].default_date) setDate(templates[0].default_date);
    }
  }, [templates, open, tmplId]);

  const handleCreate = async () => {
    if (!tmplId || !title.trim()) return;
    setLoading(true);
    try {
      const rows = (students || []).map((s) => ({
        student_id: s.id,
        classroom_id: classroomId,
        teacher_id: teacherId || null,
        template_id: tmplId,
        title: title,
        kind: 'ASSESSMENT_2',
        assessment_date: date
      }));
      await supabase.from('student_assessments').insert(rows);
      onRefresh?.();
      onClose?.();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <Modal title="Create Class Assessment" onClose={onClose} width={540}>
      <div style={{ display: 'grid', gap: 16 }}>
        <div>
          <Label>Template</Label>
          <select
            value={tmplId}
            onChange={(e) => {
              setTmplId(e.target.value);
              const t = templates.find((x) => String(x.id) === String(e.target.value));
              if (t?.default_date) setDate(t.default_date);
            }}
            style={SELECT_BASE}
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </div>

        <div>
          <Label>Title</Label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Winter Term Report" style={INPUT_BASE} />
        </div>

        <div>
          <Label>Target date</Label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={INPUT_BASE} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <Button variant="primary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="secondary" onClick={handleCreate} disabled={loading}>
            {loading ? 'Creating...' : 'Create'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// -------------------- MAIN DASHBOARD VIEW --------------------

export default function DashboardView({
  planItems,
  students,
  classrooms,
  activeDate,
  setActiveDate,
  onUpdateItem,
  onDeleteItem,
  curriculum,
  masterPlans,
  planSessions,
  showToast,
  onQuickAdd,
  curriculumAreas,
  curriculumCategories
}) {
  const [selectedClassId, setSelectedClassId] = useState(classrooms?.[0]?.id || null);
  const [dashTab, setDashTab] = useState('daily');

  const [assessments, setAssessments] = useState([]);
  const [assessmentScores, setAssessmentScores] = useState([]);
  const [templates, setTemplates] = useState([]);

  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const [addStatusDefault, setAddStatusDefault] = useState('P');
  const [addDefaultDate, setAddDefaultDate] = useState('');
  const [areaFilter, setAreaFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  // Suggestions: default all closed
  const [suggestAreaOpenMap, setSuggestAreaOpenMap] = useState({});

  const selectedClassroom = useMemo(
    () => (classrooms || []).find((c) => String(c.id) === String(selectedClassId)),
    [classrooms, selectedClassId]
  );

  const classroomStudents = useMemo(
    () => (students || []).filter((s) => String(s.classroom_id) === String(selectedClassId)),
    [students, selectedClassId]
  );

  const activeD = useMemo(() => parseActiveDate(activeDate), [activeDate]);
  const monthLabel = useMemo(() => fmtMonthLabel(activeD), [activeD]);

  const fetchAssessments = async () => {
    try {
      if (!selectedClassId || classroomStudents.length === 0) return;

      const studentIds = classroomStudents.map((s) => s.id);
      const { data: assessData } = await supabase
        .from('student_assessments')
        .select('*')
        .in('student_id', studentIds)
        .order('assessment_date', { ascending: false });

      if (assessData) {
        setAssessments(assessData);

        const aIds = assessData.map((a) => a.id);
        if (aIds.length > 0) {
          const { data: scoreData } = await supabase
            .from('student_assessment_scores')
            .select('*, skill:assessment_skills(name, area:curriculum_areas(name))')
            .in('assessment_id', aIds);

          setAssessmentScores(scoreData || []);
        } else {
          setAssessmentScores([]);
        }
      }

      const { data: tmplData } = await supabase.from('assessment_templates').select('id, title, default_date');
      if (tmplData) setTemplates(tmplData);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchAssessments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClassId, classroomStudents.length]);

  const analyticsData = useMemo(() => {
    const groups = {};
    (assessments || []).forEach((a) => {
      const key = `${a.title}_${a.assessment_date}`;
      if (!groups[key]) groups[key] = { title: a.title, date: a.assessment_date, ids: [], totalStudents: classroomStudents.length };
      groups[key].ids.push(a.id);
    });

    return Object.values(groups).map((g) => {
      const completedCount = g.ids.length;
      const groupScores = (assessmentScores || []).filter((s) => g.ids.includes(s.assessment_id));

      const areaSums = {};
      groupScores.forEach((s) => {
        const val = normalizeScore(s.score_raw);
        if (val !== null) {
          const areaName = s.skill?.area?.name || 'General';
          if (!areaSums[areaName]) areaSums[areaName] = { sum: 0, count: 0 };
          areaSums[areaName].sum += val;
          areaSums[areaName].count += 1;
        }
      });

      const areaAverages = Object.keys(areaSums)
        .map((k) => ({ area: k, avg: Math.round(areaSums[k].sum / areaSums[k].count) }))
        .sort((a, b) => b.avg - a.avg);

      const totalSum = groupScores.reduce((acc, s) => acc + (normalizeScore(s.score_raw) || 0), 0);
      const validScores = groupScores.filter((s) => normalizeScore(s.score_raw) !== null).length;
      const overallAvg = validScores > 0 ? Math.round(totalSum / validScores) : 0;

      return { ...g, completedCount, overallAvg, areaAverages };
    });
  }, [assessments, assessmentScores, classroomStudents.length]);

  const nextMonthFirstDate = dateISO(new Date(activeD.getFullYear(), activeD.getMonth() + 1, 1));
  const currMeta = useMemo(
    () => ({ areas: curriculumAreas || [], categories: curriculumCategories || [], activities: curriculum || [] }),
    [curriculumAreas, curriculumCategories, curriculum]
  );

  const allClassItems = useMemo(
    () => (planItems || []).filter((i) => String(i.classroom_id) === String(selectedClassId)),
    [planItems, selectedClassId]
  );

  const { start: monthStart, end: monthEnd } = useMemo(() => monthBounds(activeD), [activeD]);

  const baseMonthItems = useMemo(() => {
    return allClassItems.filter((i) => {
      if (isArchivedStatus(i.status)) return false;
      const d = toDate(i.planning_date || safeDate(i.planning_date));
      return d && d >= monthStart && d < monthEnd;
    });
  }, [allClassItems, monthStart, monthEnd]);

  const aimItems = useMemo(() => {
    const nextM = new Date(activeD.getFullYear(), activeD.getMonth() + 1, 1);
    const { start, end } = monthBounds(nextM);
    return allClassItems.filter((i) => {
      if (normalizeStatusSafe(i.status) !== 'A') return false;
      const d = toDate(i.planning_date || safeDate(i.planning_date));
      return d && d >= start && d < end;
    });
  }, [allClassItems, activeD]);

  const filteredMonthItems = useMemo(() => {
    const q = (search || '').toLowerCase();
    return baseMonthItems.filter((i) => {
      if (areaFilter !== 'ALL' && i.area !== areaFilter) return false;
      if (q && !(i.activity || '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [baseMonthItems, search, areaFilter]);

  const areaFilterOptions = useMemo(() => {
    const set = new Set();
    baseMonthItems.forEach((i) => {
      if (i.area) set.add(i.area);
    });
    return ['ALL', ...Array.from(set).sort()];
  }, [baseMonthItems]);

  const suggestedWeeks = useMemo(() => {
    if (!selectedClassId) return [];
    const academicStartDate = toDate(ACADEMIC_START) || new Date(new Date().getFullYear(), 8, 1);

    const plans = (masterPlans || []).filter((tp) => String(tp.classroom_id) === String(selectedClassId));
    const calculatedPlans = plans
      .map((tp) => {
        const wn = parseInt(tp.week_number || 0, 10);
        if (!wn) return null;
        const weekStart = addDays(academicStartDate, (wn - 1) * 7);
        const weekEnd = addDays(weekStart, 4);
        return { ...tp, weekStart, weekEnd };
      })
      .filter(Boolean);

    const monthPlans = calculatedPlans.filter((tp) => hasStrictOverlap(tp.weekStart, monthStart, monthEnd));

    const sessMap = new Map();
    (planSessions || []).forEach((s) => {
      const id = String(s.term_plan_id || s.plan_id);
      if (!sessMap.has(id)) sessMap.set(id, []);
      sessMap.get(id).push(s);
    });

    const output = [];
    monthPlans.forEach((tp) => {
      const sessions = sessMap.get(String(tp.id)) || [];
      sessions.forEach((s) => output.push({ ...s, subject: tp.subject }));
    });

    return output;
  }, [masterPlans, planSessions, selectedClassId, monthStart, monthEnd]);

  const suggestedByArea = useMemo(() => {
    const map = {};
    (suggestedWeeks || []).forEach((s) => {
      const area = s.subject || 'General';
      if (!map[area]) map[area] = { subject: area, total: 0, categories: {} };

      let catName = s.category;
      if (!catName && s.curriculum_activity_id && curriculumCategories) {
        const act = (curriculum || []).find((a) => a.id === s.curriculum_activity_id);
        if (act) {
          const catObj = (curriculumCategories || []).find((c) => c.id === act.category_id);
          if (catObj) catName = catObj.name;
        }
      }

      const cat = catName || 'Uncategorized';
      if (!map[area].categories[cat]) map[area].categories[cat] = { category: cat, bullets: [] };

      const txt = s.raw_activity || s.activity;
      if (txt) {
        map[area].categories[cat].bullets.push({ text: txt });
        map[area].total++;
      }
    });

    return Object.values(map).map((a) => ({
      ...a,
      categories: Object.values(a.categories)
    }));
  }, [suggestedWeeks, curriculum, curriculumCategories]);

  const openAdd = (status, d) => {
    setAddStatusDefault(status);
    setAddDefaultDate(d || dateISO(activeD));
    setAddOpen(true);
  };

  const isAreaOpen = (subject) => suggestAreaOpenMap[subject] ?? false;
  const toggleArea = (subject) => setSuggestAreaOpenMap((p) => ({ ...p, [subject]: !(p[subject] ?? false) }));

  const setAllSuggestions = (open) => {
    const next = {};
    (suggestedByArea || []).forEach((a) => {
      next[a.subject] = open;
    });
    setSuggestAreaOpenMap(next);
  };

  const monthCounts = useMemo(() => {
    const counts = { P: 0, W: 0, A: 0, M: 0 };
    baseMonthItems.forEach((i) => {
      const s = normalizeStatusSafe(i.status);
      counts[s] = (counts[s] || 0) + 1;
    });
    return counts;
  }, [baseMonthItems]);

  const stW = getStatusStyle('W');
  const stP = getStatusStyle('P');
  const stA = getStatusStyle('A');

  const [openAssessMap, setOpenAssessMap] = useState({});
  const toggleAssess = (key) => setOpenAssessMap((p) => ({ ...p, [key]: !(p[key] ?? false) }));
  const isAssessOpen = (key) => openAssessMap[key] ?? false;

  // -------- Layout spacing constants (more air) --------
  const GAP_L = 26; // large vertical gaps between sections
  const GAP_M = 18;

  return (
    <div style={{ maxWidth: 1320, margin: '0 auto', padding: '32px 24px 70px', fontFamily: THEME.sansFont, color: THEME.text }}>
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

      <BatchAssessmentModal
        open={batchModalOpen}
        onClose={() => setBatchModalOpen(false)}
        students={classroomStudents}
        templates={templates}
        classroomId={selectedClassId}
        onRefresh={fetchAssessments}
      />

      {/* HEADER (no subtitle, more space) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 18, flexWrap: 'wrap', marginBottom: GAP_M }}>
        <div>
          <div style={{ fontFamily: THEME.serifFont, fontSize: 36, fontWeight: 700, color: THEME.text, lineHeight: 1.05 }}>Dashboard</div>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {(classrooms || []).map((c) => (
            <ClassroomBtn key={c.id} active={String(c.id) === String(selectedClassId)} label={c.name} onClick={() => setSelectedClassId(c.id)} />
          ))}
        </div>
      </div>

      {/* Tabs + chips (more breathing room; no extra helper text) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'center', flexWrap: 'wrap', marginBottom: GAP_L }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Button variant={dashTab === 'daily' ? 'active' : 'primary'} onClick={() => setDashTab('daily')} style={{ padding: '9px 14px', fontSize: 12 }}>
            Daily Plan
          </Button>
          <Button
            variant={dashTab === 'assessments' ? 'active' : 'primary'}
            onClick={() => setDashTab('assessments')}
            style={{ padding: '9px 14px', fontSize: 12 }}
          >
            Assessment Analytics
          </Button>
        </div>

        {dashTab === 'daily' && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <SoftChip dot={stW.dot} label="Practicing" count={monthCounts.W} />
            <SoftChip dot={stP.dot} label="To Present" count={monthCounts.P} />
            <SoftChip dot={stA.dot} label="Next Month Aim" count={aimItems.length} />
          </div>
        )}
      </div>

      {/* DAILY PLAN */}
      {dashTab === 'daily' && (
        <>
          {/* Month / controls (extra spacing below card) */}
          <Card style={{ padding: 18, marginBottom: GAP_L }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <IconBtn title="Previous month" onClick={() => setActiveDate(dateISO(new Date(activeD.getFullYear(), activeD.getMonth() - 1, 1)))}>
                  <ChevronLeft size={18} color={THEME.text} />
                </IconBtn>

                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: THEME.textMuted, letterSpacing: 0.6, textTransform: 'uppercase' }}>Month</div>
                  <div style={{ fontFamily: THEME.serifFont, fontSize: 21, fontWeight: 700, color: THEME.text }}>{monthLabel}</div>
                </div>

                <IconBtn title="Next month" onClick={() => setActiveDate(dateISO(new Date(activeD.getFullYear(), activeD.getMonth() + 1, 1)))}>
                  <ChevronRight size={18} color={THEME.text} />
                </IconBtn>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <Button variant="primary" onClick={() => setActiveDate(dateISO(new Date()))} style={{ padding: '9px 14px', fontSize: 12 }}>
                  Jump to Current Week
                </Button>

                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ width: 240, position: 'relative' }}>
                    <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search activities…" style={{ ...INPUT_BASE, paddingLeft: 34 }} />
                    <div style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}>
                      <Search size={16} color={THEME.textMuted} />
                    </div>
                  </div>

                  <div style={{ width: 180 }}>
                    <select value={areaFilter} onChange={(e) => setAreaFilter(e.target.value)} style={SELECT_BASE}>
                      {areaFilterOptions.map((a) => (
                        <option key={a} value={a}>
                          {a === 'ALL' ? 'All areas' : a}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Suggestions header (removed helper subtitle), with more bottom spacing */}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: GAP_M }}>
            <div style={{ fontFamily: THEME.serifFont, fontSize: 21, fontWeight: 700, color: THEME.text }}>Suggested from Scope &amp; Sequence</div>

            <div style={{ display: 'flex', gap: 10 }}>
              <Button variant="ghost" onClick={() => setAllSuggestions(true)} style={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Expand all
              </Button>
              <Button variant="ghost" onClick={() => setAllSuggestions(false)} style={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Collapse all
              </Button>
            </div>
          </div>

          {/* Suggestions grid (more gap + more bottom margin) */}
          <div style={{ marginBottom: GAP_L }}>
            {suggestedByArea.length === 0 ? (
              <Card style={{ padding: 20 }}>
                <div style={{ color: THEME.textMuted, fontWeight: 600 }}>No suggestions for this month.</div>
              </Card>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 18 }}>
                {suggestedByArea.map((area) => {
                  const subj = getSubjectStyle(area.subject);
                  const open = isAreaOpen(area.subject);

                  return (
                    <Card key={area.subject} style={{ padding: 0 }}>
                      <div
                        onClick={() => toggleArea(area.subject)}
                        style={{
                          cursor: 'pointer',
                          padding: 16,
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: 10,
                          borderBottom: '1px solid #F9F3EF'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                          <div style={{ width: 10, height: 10, background: subj.accent }} />
                          <div style={{ fontWeight: 700, color: THEME.text, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {area.subject}{' '}
                            <span style={{ opacity: 0.7, fontWeight: 600, marginLeft: 6 }}>({area.total})</span>
                          </div>
                        </div>
                        {open ? <ChevronUp size={18} color={THEME.textMuted} /> : <ChevronDown size={18} color={THEME.textMuted} />}
                      </div>

                      {open && (
                        <div style={{ padding: 16, maxHeight: 280, overflowY: 'auto' }}>
                          {area.categories.map((c) => (
                            <div key={c.category} style={{ marginBottom: 14 }}>
                              <div style={{ fontSize: 11, fontWeight: 800, color: THEME.textMuted, marginBottom: 7, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                                {c.category}
                              </div>
                              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: THEME.text }}>
                                {c.bullets.map((b, i) => (
                                  <li key={i} style={{ marginBottom: 5 }}>
                                    {b.text}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* Kanban (more gap between columns and sections) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20 }}>
            <Card style={{ padding: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div>
                  <div style={{ fontFamily: THEME.serifFont, fontSize: 18, fontWeight: 700, color: THEME.text }}>Practicing</div>
                  <div style={{ marginTop: 6, fontSize: 12, color: THEME.textMuted, fontWeight: 600 }}>
                    {filteredMonthItems.filter((i) => normalizeStatusSafe(i.status) === 'W').length} items
                  </div>
                </div>
                <IconBtn title="Add Practicing" onClick={() => openAdd('W')}>
                  <Plus size={18} color={THEME.brandYellow} />
                </IconBtn>
              </div>

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
                onCreateItem={onQuickAdd}
                showToast={showToast}
                embedded={true}
              />
            </Card>

            <Card style={{ padding: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div>
                  <div style={{ fontFamily: THEME.serifFont, fontSize: 18, fontWeight: 700, color: THEME.text }}>To Present</div>
                  <div style={{ marginTop: 6, fontSize: 12, color: THEME.textMuted, fontWeight: 600 }}>
                    {filteredMonthItems.filter((i) => normalizeStatusSafe(i.status) === 'P').length} items
                  </div>
                </div>
                <IconBtn title="Add To Present" onClick={() => openAdd('P')}>
                  <Plus size={18} color={THEME.brandSecondary} />
                </IconBtn>
              </div>

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
                onCreateItem={onQuickAdd}
                showToast={showToast}
                embedded={true}
              />
            </Card>

            <Card style={{ padding: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div>
                  <div style={{ fontFamily: THEME.serifFont, fontSize: 18, fontWeight: 700, color: THEME.text }}>Next Month Aim</div>
                  <div style={{ marginTop: 6, fontSize: 12, color: THEME.textMuted, fontWeight: 600 }}>{aimItems.length} items</div>
                </div>
                <IconBtn title="Add Next Month Aim" onClick={() => openAdd('A', nextMonthFirstDate)}>
                  <Plus size={18} color={THEME.brandAccent} />
                </IconBtn>
              </div>

              <KanbanColumn
                status="A"
                items={aimItems}
                students={students}
                classrooms={classrooms}
                selectedClassroomId={selectedClassId}
                currMeta={currMeta}
                classroomStudents={classroomStudents}
                defaultDateISO={nextMonthFirstDate}
                onEditItem={onUpdateItem}
                onDeleteItem={onDeleteItem}
                onCreateItem={onQuickAdd}
                showToast={showToast}
                embedded={true}
              />
            </Card>
          </div>
        </>
      )}

      {/* ASSESSMENT ANALYTICS (removed helper subtitle; more spacing) */}
      {dashTab === 'assessments' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: GAP_L }}>
            <div style={{ fontFamily: THEME.serifFont, fontSize: 21, fontWeight: 700, color: THEME.text }}>Assessment Analytics</div>
            <Button variant="secondary" onClick={() => setBatchModalOpen(true)}>
              + New Class Assessment
            </Button>
          </div>

          {analyticsData.length === 0 ? (
            <Card style={{ padding: 28, textAlign: 'center' }}>
              <div style={{ color: THEME.textMuted, fontWeight: 600 }}>No assessments found. Create one to see analytics.</div>
            </Card>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 20 }}>
              {analyticsData.map((data) => {
                const key = `${data.title}_${data.date}`;
                const open = isAssessOpen(key);
                const completionPct = data.totalStudents ? Math.min(100, (data.completedCount / data.totalStudents) * 100) : 0;

                return (
                  <Card key={key} style={{ padding: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontFamily: THEME.serifFont, fontSize: 20, fontWeight: 700, color: THEME.text, marginBottom: 8 }}>
                          {data.title}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: THEME.textMuted, fontWeight: 600 }}>
                          <CalendarIcon size={14} /> {safeDate(data.date)}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 32, fontWeight: 800, color: THEME.text, lineHeight: 1 }}>{data.overallAvg}%</div>
                          <div style={{ fontSize: 11, fontWeight: 800, color: THEME.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                            Avg
                          </div>
                        </div>
                        <div title={`Completion ${Math.round(completionPct)}%`}>
                          <ProgressRing pct={completionPct} />
                        </div>
                      </div>
                    </div>

                    <div style={{ marginTop: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 800, color: THEME.textMuted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                        <span>Completed</span>
                        <span>
                          {data.completedCount}/{data.totalStudents}
                        </span>
                      </div>

                      <div style={{ height: 10, background: '#F9F3EF', border: '1px solid #eee' }}>
                        <div style={{ height: '100%', width: `${completionPct}%`, background: THEME.brandAccent }} />
                      </div>
                    </div>

                    <div style={{ marginTop: 16, display: 'grid', gap: 12 }}>
                      {data.areaAverages.slice(0, open ? 10 : 4).map((area) => (
                        <div key={area.area} style={{ display: 'grid', gridTemplateColumns: '130px 1fr 44px', gap: 10, alignItems: 'center' }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: THEME.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {area.area}
                          </div>
                          <div style={{ height: 8, background: '#F9F3EF', border: '1px solid #eee' }}>
                            <div style={{ height: '100%', width: `${area.avg}%`, background: THEME.brandAccent }} />
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 800, color: THEME.textMuted, textAlign: 'right' }}>{area.avg}%</div>
                        </div>
                      ))}
                    </div>

                    <div style={{ marginTop: 18, paddingTop: 14, borderTop: '2px solid #F9F3EF', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                      <Button variant="ghost" onClick={() => toggleAssess(key)} style={{ padding: '6px 10px' }}>
                        {open ? 'Hide details' : 'Show details'}
                      </Button>

                      <button
                        style={{
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          color: THEME.text,
                          fontFamily: THEME.sansFont,
                          fontWeight: 800,
                          fontSize: 12,
                          textTransform: 'uppercase',
                          letterSpacing: 0.6,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 8
                        }}
                      >
                        Full Report <ArrowRight size={16} />
                      </button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
