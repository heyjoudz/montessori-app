import { useState, useEffect, useMemo } from 'react';
import { THEME, getSubjectStyle } from '../ui/theme';
import {
  getNormalizedItem,
  startOfWeekMonday,
  dateISO,
  addDays,
  getWeekFromDate,
  safeDate,
  inputStyle
} from '../utils/helpers';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import KanbanColumn from '../components/business/Kanban';
import EditActivityModal from '../components/business/EditActivityModal';

/** ---------------------------
 *  DATE HELPERS (robust)
 *  --------------------------- */
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

/** ---------------------------
 *  AREA BUCKET (consistent)
 *  --------------------------- */
function bucketArea(rawArea) {
  const a = String(rawArea || '').toLowerCase();
  if (a.includes('math')) return 'Math';
  if (a.includes('english') || a.includes('language')) return 'English';
  if (a.includes('sensor')) return 'Sensorial';
  if (a.includes('culture') || a.includes('geo') || a.includes('science')) return 'Culture';
  if (a.includes('practical')) return 'Practical Life';
  return (rawArea || '').trim() ? rawArea : 'General';
}

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
  showToast
}) {
  const [selectedId, setSelectedId] = useState(forcedStudentId || null);
  const [filterClass, setFilterClass] = useState(classrooms[0]?.id);

  const [tab, setTab] = useState('KANBAN');
  const [editingItem, setEditingItem] = useState(null);

  // collapse-by-default on entering kanban (no regression)
  const [expandAction, setExpandAction] = useState({ type: 'COLLAPSE', ts: Date.now() });

  // search + filters
  const [studentSearch, setStudentSearch] = useState('');
  const [search, setSearch] = useState('');
  const [areaFilter, setAreaFilter] = useState('ALL');
  const [catFilter, setCatFilter] = useState('ALL');

  // simplified quick add modal
  const [qaOpen, setQaOpen] = useState(false);

  useEffect(() => {
    if (forcedStudentId) setSelectedId(forcedStudentId);
  }, [forcedStudentId]);

  useEffect(() => {
    if (tab === 'KANBAN') setExpandAction({ type: 'COLLAPSE', ts: Date.now() });
  }, [tab]);

  const isParentLocked = !!forcedStudentId;

  const student = useMemo(
    () => students.find((s) => String(s.id) === String(selectedId)),
    [students, selectedId]
  );

  const allStudentPlans = useMemo(() => {
    if (!selectedId) return [];
    return planItems.filter((p) => String(p.student_id) === String(selectedId));
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

  // filter options
  const areaOptions = useMemo(() => {
    const set = new Set();
    allStudentPlans.forEach((it) => {
      const n = getNormalizedItem(it);
      set.add(bucketArea(n.area));
    });
    return Array.from(set).sort();
  }, [allStudentPlans]);

  const categoryOptions = ifyCatOptions(allStudentPlans);

  function ifyCatOptions(items) {
    const set = new Set();
    (items || []).forEach((it) => {
      const cat =
        (it.curriculum_categories?.name || '').trim() ||
        (it.category || '').trim() ||
        'Uncategorized';
      set.add(cat);
    });
    return Array.from(set).sort();
  }

  const matchesFilters = useMemo(() => {
    const q = (search || '').trim().toLowerCase();

    return (it) => {
      const n = getNormalizedItem(it);
      const area = bucketArea(n.area);
      const cat =
        (it.curriculum_categories?.name || '').trim() ||
        (it.category || '').trim() ||
        'Uncategorized';

      if (areaFilter !== 'ALL' && area !== areaFilter) return false;
      if (catFilter !== 'ALL' && cat !== catFilter) return false;

      if (!q) return true;

      const fields = [
        n.title,
        n.rawActivity,
        n.notes,
        it.activity,
        it.raw_activity,
        it.notes,
        it.session_label,
        area,
        cat
      ]
        .filter(Boolean)
        .map((x) => String(x).toLowerCase());

      return fields.some((f) => f.includes(q));
    };
  }, [search, areaFilter, catFilter]);

  // board columns:
  // P/W = CURRENT month, A = NEXT month
  const columnItems = useMemo(() => {
    const currMonth = allStudentPlans.filter((it) => inMonthKey(it, currentMonthKey));
    const nextMonth = allStudentPlans.filter((it) => inMonthKey(it, nextMonthKey));

    return {
      P: currMonth.filter((it) => it.status === 'P').filter(matchesFilters),
      W: currMonth.filter((it) => it.status === 'W').filter(matchesFilters),
      A: nextMonth.filter((it) => it.status === 'A').filter(matchesFilters)
    };
  }, [allStudentPlans, currentMonthKey, nextMonthKey, inMonthKey, matchesFilters]);

  // drag drop status change
  const onMoveItemStatus = async (itemId, newStatus) => {
    const it = planById.get(String(itemId));
    if (!it) return;

    try {
      const targetDate =
        newStatus === 'A'
          ? nextMonthFirstISO
          : (activeDate || dateISO(new Date()));

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
        message:
          newStatus === 'A'
            ? 'Moved to Next Month Aim.'
            : newStatus === 'W'
            ? 'Moved to Practicing.'
            : 'Moved to To Present.'
      });
    } catch (e) {
      console.error(e);
      showToast?.({ type: 'error', title: 'Update failed', message: 'Could not move the item.' });
    }
  };

  /** ---------------------------
   *  STUDENT PICKER
   *  --------------------------- */
  if (!selectedId) {
    const filteredStudents = students
      .filter((s) => String(s.classroom_id) === String(filterClass))
      .filter((s) => {
        const q = (studentSearch || '').trim().toLowerCase();
        if (!q) return true;
        return `${s.first_name || ''} ${s.last_name || ''}`.toLowerCase().includes(q);
      });

    return (
      <div>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          {classrooms.map((c) => (
            <button
              key={c.id}
              onClick={() => setFilterClass(c.id)}
              style={{
                border: 'none',
                cursor: 'pointer',
                padding: '12px 20px',
                background: String(filterClass) === String(c.id) ? THEME.brandPrimary : '#fff',
                color: String(filterClass) === String(c.id) ? '#fff' : THEME.text,
                boxShadow:
                  String(filterClass) === String(c.id)
                    ? `6px 6px 0px 0px ${THEME.brandSecondary}`
                    : '2px 2px 0px #eee',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                transition: 'all 0.2s'
              }}
            >
              {c.name}
            </button>
          ))}
        </div>

        <Card style={{ padding: 14, marginBottom: 18 }}>
          <input
            value={studentSearch}
            onChange={(e) => setStudentSearch(e.target.value)}
            placeholder="Search student…"
            style={{
              width: '100%',
              padding: '12px 12px',
              border: '1px solid #eee',
              fontWeight: 600
            }}
          />
        </Card>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 24 }}>
          {filteredStudents.map((s) => (
            <Card
              key={s.id}
              onClick={() => {
                setSelectedId(s.id);
                setExpandAction({ type: 'COLLAPSE', ts: Date.now() });
              }}
              style={{ padding: 30, cursor: 'pointer', textAlign: 'center' }}
            >
              <div
                style={{
                  width: 70,
                  height: 70,
                  background: THEME.brandAccent,
                  margin: '0 auto 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 24,
                  fontWeight: 900,
                  color: THEME.text,
                  clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)'
                }}
              >
                {s.first_name?.[0] || '?'}
              </div>
              <div style={{ fontWeight: 600, fontSize: 18 }}>
                {s.first_name} {s.last_name}
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  /** ---------------------------
   *  SELECTED STUDENT
   *  --------------------------- */
  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14, gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {!isParentLocked && (
            <Button variant="ghost" onClick={() => setSelectedId(null)} style={{ paddingLeft: 0, fontSize: 13 }}>
              ← All Students
            </Button>
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
          <Button variant="secondary" onClick={() => setQaOpen(true)}>
            + Add
          </Button>

          <Button variant={tab === 'KANBAN' ? 'active' : 'ghost'} onClick={() => setTab('KANBAN')}>
            Overview
          </Button>
          <Button variant={tab === 'PLAN' ? 'active' : 'ghost'} onClick={() => setTab('PLAN')}>
            Week Plan
          </Button>
          <Button variant={tab === 'REPORT' ? 'active' : 'ghost'} onClick={() => setTab('REPORT')}>
            Report
          </Button>
        </div>
      </div>

      {/* Tabs */}
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

{tab === 'KANBAN' && (
  <div>
    {/* Month bar (clean, compact) */}
    <Card style={{ padding: 14, marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <div style={{ fontWeight: 900, fontSize: 16, color: THEME.text, fontFamily: THEME.serifFont }}>
            {monthLabel(activeDateObj)}
          </div>
          <div style={{ fontSize: 12, fontWeight: 800, color: THEME.textMuted }}>
            {student?.first_name} • {classrooms.find((c) => String(c.id) === String(student?.classroom_id))?.name || ''}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <Button variant="ghost" onClick={() => setActiveDate(firstOfMonthISO(addMonths(activeDateObj, -1)))}>
            ← Prev
          </Button>
          <input type="date" value={activeDate} onChange={(e) => setActiveDate(e.target.value)} style={inputStyle()} />
          <Button variant="ghost" onClick={() => setActiveDate(firstOfMonthISO(addMonths(activeDateObj, 1)))}>
            Next →
          </Button>
        </div>
      </div>
    </Card>

    {/* Filters row (clean spacing) */}
    <Card style={{ padding: 12, marginBottom: 14 }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <Button variant="ghost" onClick={() => setExpandAction({ type: 'EXPAND', ts: Date.now() })}>
          Expand All
        </Button>
        <Button variant="ghost" onClick={() => setExpandAction({ type: 'COLLAPSE', ts: Date.now() })}>
          Collapse All
        </Button>

        <div style={{ width: 1, height: 28, background: '#eee', margin: '0 4px' }} />

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search activity or teacher bullet…"
          style={{
            padding: '10px 12px',
            border: '1px solid #eee',
            fontWeight: 700,
            minWidth: 260
          }}
        />

        <select
          value={areaFilter}
          onChange={(e) => setAreaFilter(e.target.value)}
          style={{ padding: '10px 12px', border: '1px solid #eee', fontWeight: 700 }}
        >
          <option value="ALL">All Areas</option>
          {areaOptions.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>

        <select
          value={catFilter}
          onChange={(e) => setCatFilter(e.target.value)}
          style={{ padding: '10px 12px', border: '1px solid #eee', fontWeight: 700 }}
        >
          <option value="ALL">All Categories</option>
          {categoryOptions.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <div style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 800, color: THEME.textMuted }}>
          Drag to change status
        </div>
      </div>
    </Card>

    {/* Kanban */}
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 18 }}>
      <KanbanColumn
        key="P"
        status="P"
        items={columnItems.P}
        students={students}
        classrooms={classrooms}
        onEditItem={setEditingItem}
        onDeleteItem={onDeleteItem}
        expandAction={expandAction}
        selectedClassroomId={student?.classroom_id}
        mode="SINGLE_STUDENT"
        onMoveItemStatus={onMoveItemStatus}
        getItemById={(id) => planById.get(String(id))}
        columnLabelOverride={`To Present — ${monthLabel(activeDateObj)}`}
      />

      <KanbanColumn
        key="W"
        status="W"
        items={columnItems.W}
        students={students}
        classrooms={classrooms}
        onEditItem={setEditingItem}
        onDeleteItem={onDeleteItem}
        expandAction={expandAction}
        selectedClassroomId={student?.classroom_id}
        mode="SINGLE_STUDENT"
        onMoveItemStatus={onMoveItemStatus}
        getItemById={(id) => planById.get(String(id))}
        columnLabelOverride={`Practicing — ${monthLabel(activeDateObj)}`}
      />

      <KanbanColumn
        key="A"
        status="A"
        items={columnItems.A}
        students={students}
        classrooms={classrooms}
        onEditItem={setEditingItem}
        onDeleteItem={onDeleteItem}
        expandAction={expandAction}
        selectedClassroomId={student?.classroom_id}
        mode="SINGLE_STUDENT"
        onMoveItemStatus={onMoveItemStatus}
        getItemById={(id) => planById.get(String(id))}
        columnLabelOverride={`Next Month Aim — ${monthLabel(nextMonthObj)}`}
      />
    </div>
  </div>
)}


      {tab === 'REPORT' && <StudentReportView student={student} allPlans={allStudentPlans} />}

      {editingItem && (
        <EditActivityModal
          item={editingItem}
          curriculum={curriculum}
          areaOptions={areaOptions}
          categoryOptions={categoryOptions}
          onSave={onUpdateItem}
          onDelete={onDeleteItem}
          onClose={() => setEditingItem(null)}
        />
      )}

      {/* Simplified quick add modal */}
      <QuickAddLiteModal
        open={qaOpen}
        onClose={() => setQaOpen(false)}
        curriculum={curriculum || []}
        defaultStudentId={student?.id}
        currentMonthFirstISO={currentMonthFirstISO}
        nextMonthFirstISO={nextMonthFirstISO}
        onSubmit={async (payload) => {
          try {
            const chosenStatus = payload.status || 'P';
            const finalDate =
              payload.date ||
              (chosenStatus === 'A' ? nextMonthFirstISO : (activeDate || dateISO(new Date())));

            await onQuickAdd?.({
              student_id: student.id,
              status: chosenStatus,
              date: finalDate,
              activity: payload.activity,
              curriculum_activity_id: payload.curriculum_activity_id || null,
              curriculum_area_id: payload.curriculum_area_id || null,
              raw_activity: payload.raw_activity || null
            });

            showToast?.({ type: 'success', title: 'Added', message: 'Activity added.' });
          } catch (e) {
            console.error(e);
            showToast?.({ type: 'error', title: 'Add failed', message: 'Could not add activity.' });
          }
        }}
      />
    </div>
  );
}

/** ---------------------------
 *  REPORT (unchanged)
 *  --------------------------- */
function StudentReportView({ student, allPlans }) {
  const byStatus = useMemo(() => {
    const total = allPlans.length;
    const m = allPlans.filter((p) => p.status === 'M').length;
    const w = allPlans.filter((p) => p.status === 'W').length;
    const p = allPlans.filter((p) => p.status === 'P').length;
    const a = allPlans.filter((p) => p.status === 'A').length;
    return { total, m, w, p, a };
  }, [allPlans]);

  const byArea = useMemo(() => {
    const map = {};
    allPlans.forEach((it) => {
      const n = getNormalizedItem(it);
      const key = (n.area || '').trim() ? n.area : 'General';
      map[key] = map[key] || { total: 0, M: 0, W: 0, P: 0, A: 0 };
      map[key].total += 1;
      map[key][it.status] = (map[key][it.status] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1].total - a[1].total).slice(0, 8);
  }, [allPlans]);

  const recent = useMemo(() => {
    return allPlans
      .slice()
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
      .slice(0, 10);
  }, [allPlans]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 30 }}>
      <Card style={{ padding: 30 }}>
        <h3 style={{ fontFamily: THEME.serifFont, marginTop: 0, marginBottom: 6 }}>Progress Report</h3>
        <div style={{ color: THEME.textMuted, fontWeight: 600, fontSize: 13 }}>Overall progress + breakdown by area</div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginTop: 24 }}>
          <StatBox label="Mastered" value={byStatus.m} bg="#E8F5E9" border="1px solid #E0F2E9" />
          <StatBox label="Practicing" value={byStatus.w} bg="#FFF8EB" border="1px solid #F5E7C8" />
          <StatBox label="To Present" value={byStatus.p} bg="#F3F4F6" border="1px solid #eee" />
          <StatBox label="Aim (A)" value={byStatus.a} bg="#F7F1FF" border="1px solid #EEE3FF" />
          <StatBox label="Total" value={byStatus.total} bg="#fff" border="1px solid #eee" />
        </div>

        <div style={{ marginTop: 30 }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: THEME.textMuted, textTransform: 'uppercase', marginBottom: 16 }}>
            Progress by area
          </div>

          <div style={{ display: 'grid', gap: 14 }}>
            {byArea.map(([area, stats]) => {
              const subj = getSubjectStyle(area);
              const pct = stats.total ? Math.round(((stats.M || 0) / stats.total) * 100) : 0;
              return (
                <div key={area} style={{ padding: 16, border: `1px solid ${subj.border}`, background: '#fff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
                    <div style={{ fontWeight: 600, color: THEME.text }}>
                      <span style={{ color: subj.text }}>{area}</span>
                      <span style={{ marginLeft: 8, fontSize: 12, color: THEME.textMuted, fontWeight: 600 }}>
                        {stats.total} activities
                      </span>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: THEME.textMuted }}>{pct}% mastered</div>
                  </div>
                  <div style={{ marginTop: 10, height: 8, background: '#f0f0f0', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: subj.accent }} />
                  </div>
                </div>
              );
            })}
            {byArea.length === 0 && <div style={{ opacity: 0.6, fontStyle: 'italic' }}>No activity data yet.</div>}
          </div>
        </div>
      </Card>

      <div style={{ display: 'grid', gap: 22 }}>
        <Card style={{ padding: 22 }}>
          <h3 style={{ fontFamily: THEME.serifFont, marginTop: 0, marginBottom: 6 }}>Activity Feed</h3>
          <div style={{ fontSize: 13, color: THEME.textMuted, fontWeight: 600, marginBottom: 16 }}>Latest updates</div>
          {recent.length === 0 && <div style={{ opacity: 0.6, fontStyle: 'italic' }}>No activities yet.</div>}
          <div style={{ display: 'grid', gap: 12 }}>
            {recent.map((r) => {
              const n = getNormalizedItem(r);
              const subj = getSubjectStyle(n.area);
              return (
                <div key={r.id} style={{ padding: 14, border: '1px solid #eee', background: '#fff', borderLeft: `4px solid ${subj.accent}` }}>
                  <div style={{ fontWeight: 800, fontSize: 13 }}>{n.title}</div>
                  <div style={{ marginTop: 4, fontSize: 12, color: THEME.textMuted, fontWeight: 700 }}>
                    {n.area} • {r.status || '-'} • {safeDate(r.planning_date)}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}

function StatBox({ label, value, bg, border }) {
  return (
    <div style={{ textAlign: 'center', padding: 16, background: bg, border: border || 'none' }}>
      <div style={{ fontSize: 24, fontWeight: 900, color: THEME.text, fontFamily: THEME.serifFont }}>{value}</div>
      <div style={{ fontSize: 12, fontWeight: 800, color: THEME.textMuted, marginTop: 4 }}>{label}</div>
    </div>
  );
}

/** ---------------------------
 *  WEEK PLAN TAB (unchanged)
 *  --------------------------- */
function PlannerTab({
  student,
  studentPlans,
  masterPlans,
  planSessions,
  activeDate,
  setActiveDate,
  onQuickAdd,
  onMoveItemToDate,
  setEditingItem,
  curriculum,
  showToast
}) {
  const weekStart = startOfWeekMonday(activeDate);
  const weekDays = Array.from({ length: 5 }, (_, i) => ({
    label: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'][i],
    date: dateISO(addDays(weekStart, i))
  }));

  const currentWeek = getWeekFromDate(activeDate);

  const currSessionsByArea = useMemo(() => {
    const plans = masterPlans.filter(
      (p) => Number(p.week_number) === Number(currentWeek) && String(p.classroom_id) === String(student.classroom_id)
    );
    const sessions = planSessions.filter((s) => plans.some((p) => String(p.id) === String(s.plan_id)));

    const groups = {};
    sessions.forEach((s) => {
      const area = (s.curriculum_areas?.name || 'General').trim() || 'General';
      const label = (s.raw_activity || s.curriculum_activities?.name || s.session_label || 'Activity').trim();
      if (!groups[area]) groups[area] = [];
      groups[area].push({ ...s, __label: label });
    });

    Object.keys(groups).forEach((k) => (groups[k] = groups[k].slice(0, 10)));
    return groups;
  }, [masterPlans, planSessions, currentWeek, student?.classroom_id]);

  const sortedAreas = useMemo(() => Object.keys(currSessionsByArea).sort(), [currSessionsByArea]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 18, alignItems: 'start' }}>
      {/* Week Builder */}
      <Card style={{ padding: 18, height: 'calc(100vh - 220px)', overflow: 'auto', position: 'sticky', top: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
          <div>
            <h3 style={{ margin: 0, fontFamily: THEME.serifFont }}>Week Builder</h3>
            <div style={{ marginTop: 4, fontSize: 12, color: THEME.textMuted, fontWeight: 700 }}>
              Suggestions from curriculum week {currentWeek} (grouped by area)
            </div>
          </div>
          <Button variant="ghost" onClick={() => setActiveDate(dateISO(new Date()))}>
            Today
          </Button>
        </div>

        <div style={{ marginTop: 14, display: 'grid', gap: 14 }}>
          {sortedAreas.length === 0 && (
            <div style={{ padding: 12, background: '#fafafa', border: '1px dashed #ddd', fontSize: 13, color: '#999', fontWeight: 700 }}>
              No curriculum sessions for this week.
            </div>
          )}

          {sortedAreas.map((area) => {
            const subj = getSubjectStyle(area);
            return (
              <div key={area} style={{ border: `1px solid ${subj.border}`, background: '#fff' }}>
                <div
                  style={{
                    padding: '10px 12px',
                    background: subj.bg,
                    borderBottom: '1px solid rgba(0,0,0,0.05)',
                    fontWeight: 900,
                    color: subj.text,
                    textTransform: 'uppercase',
                    fontSize: 12,
                    letterSpacing: 0.6
                  }}
                >
                  {area}
                </div>

                <div style={{ padding: 10, display: 'grid', gap: 10 }}>
                  {currSessionsByArea[area].map((s) => (
                    <div
                      key={s.id}
                      draggable
                      onDragStart={(e) =>
                        e.dataTransfer.setData('item', JSON.stringify({ type: 'CURR_SESSION', id: s.id }))
                      }
                      style={{
                        padding: 10,
                        border: '1px solid #eee',
                        background: 'white',
                        cursor: 'grab',
                        boxShadow: '2px 2px 0px rgba(0,0,0,0.05)'
                      }}
                      title="Drag into a day"
                    >
                      <div style={{ fontWeight: 900, fontSize: 12, color: THEME.text }}>
                        {s.session_label ? `${s.session_label} — ` : ''}
                        {s.__label}
                      </div>
                      {s.teacher_notes && (
                        <div style={{ marginTop: 4, fontSize: 12, color: THEME.textMuted, fontWeight: 700 }}>
                          {s.teacher_notes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Weekly Plan */}
      <div>
        <Card style={{ padding: 16, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div style={{ fontWeight: 800, fontFamily: THEME.serifFont }}>Weekly Plan</div>
              <input type="date" value={activeDate} onChange={(e) => setActiveDate(e.target.value)} style={inputStyle()} />
            </div>
            <div style={{ fontSize: 12, fontWeight: 800, color: THEME.textMuted }}>
              Drag from Week Builder into a day.
            </div>
          </div>
        </Card>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 10 }}>
          {weekDays.map((d) => (
            <div
              key={d.date}
              onDragOver={(e) => e.preventDefault()}
              onDrop={async (e) => {
                e.preventDefault();
                try {
                  const payload = JSON.parse(e.dataTransfer.getData('item'));
                  if (payload.type === 'PLAN_ITEM') {
                    onMoveItemToDate(payload, d.date);
                    return;
                  }
                  if (payload.type === 'CURR_SESSION') {
                    const session = planSessions.find((x) => String(x.id) === String(payload.id));
                    if (!session) return;

                    await onQuickAdd({
                      student_id: student.id,
                      activity:
                        session.curriculum_activities?.name ||
                        session.raw_activity ||
                        session.session_label ||
                        'Curriculum Activity',
                      status: 'P',
                      date: d.date,
                      curriculum_activity_id: session.curriculum_activity_id,
                      curriculum_area_id: session.curriculum_area_id,
                      raw_activity: session.raw_activity || null
                    });
                    return;
                  }
                } catch (err) {
                  console.error(err);
                }
              }}
              style={{
                background: 'white',
                padding: 10,
                minHeight: 420,
                border: '1px solid #eee',
                boxShadow: THEME.cardShadow,
                overflow: 'hidden'
              }}
            >
              <div style={{ textAlign: 'center', fontWeight: 900, marginBottom: 12, color: THEME.text }}>
                {d.label}
                <div style={{ fontSize: 11, color: THEME.textMuted, fontWeight: 700, marginTop: 2 }}>{safeDate(d.date)}</div>
              </div>

              {studentPlans
                .filter((p) => String(p.planning_date || '').startsWith(d.date))
                .map((i) => (
                  <div
                    key={i.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData('item', JSON.stringify({ type: 'PLAN_ITEM', id: i.id }))}
                    onClick={() => setEditingItem(i)}
                    style={{
                      background: '#FAFAFA',
                      padding: 10,
                      marginBottom: 8,
                      fontSize: 12,
                      cursor: 'pointer',
                      border: '1px solid #eee',
                      fontWeight: 800
                    }}
                    title="Click to edit • Drag to move"
                  >
                    {getNormalizedItem(i).rawActivity || getNormalizedItem(i).title}
                  </div>
                ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** ---------------------------
 *  QUICK ADD LITE MODAL (embedded)
 *  --------------------------- */
function QuickAddLiteModal({
  open,
  onClose,
  onSubmit,
  curriculum = [],
  defaultStudentId,
  currentMonthFirstISO,
  nextMonthFirstISO
}) {
  const [status, setStatus] = useState('P');
  const [date, setDate] = useState('');
  const [area, setArea] = useState('');
  const [custom, setCustom] = useState(false);
  const [activity, setActivity] = useState('');

  useEffect(() => {
    if (!open) return;
    setStatus('P');
    setDate('');
    setArea('');
    setCustom(false);
    setActivity('');
  }, [open]);

  const areas = useMemo(() => {
    const m = new Map();
    curriculum.forEach((c) => {
      const label = (c.curriculum_areas?.name || c.area || '').trim() || 'General';
      m.set(label.toLowerCase(), label);
    });
    if (!m.has('general')) m.set('general', 'General');
    return Array.from(m.values()).sort((a, b) => a.localeCompare(b));
  }, [curriculum]);

  const officialActivities = useMemo(() => {
    const list = curriculum
      .map((c) => {
        const areaLabel = (c.curriculum_areas?.name || c.area || '').trim() || 'General';
        const name = (c.activity || c.name || '').trim();
        return { id: c.id, name, areaLabel, areaId: c.curriculum_area_id || c.area_id || null };
      })
      .filter((x) => x.name);

    if (!area) return list;
    return list.filter((x) => x.areaLabel.toLowerCase() === area.toLowerCase());
  }, [curriculum, area]);

  if (!open) return null;

  const handleSubmit = async () => {
    if (!defaultStudentId) return;
    const v = (activity || '').trim();
    if (!v) return;

    let selected = null;
    if (!custom) {
      selected = officialActivities.find((x) => x.name.toLowerCase() === v.toLowerCase()) || null;
    }

    const chosenStatus = status || 'P';
    const finalDate =
      (date || '').trim()
        ? date
        : (chosenStatus === 'A' ? nextMonthFirstISO : currentMonthFirstISO);

    await onSubmit?.({
      student_id: defaultStudentId,
      status: chosenStatus,
      date: finalDate,
      activity: custom ? v : (selected?.name || v),
      curriculum_activity_id: custom ? null : (selected?.id || null),
      curriculum_area_id: selected?.areaId || null
    });

    onClose?.();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.22)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: 16
      }}
      onClick={onClose}
    >
      <div style={{ width: 'min(520px, 100%)' }} onClick={(e) => e.stopPropagation()}>
        <Card style={{ padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 12 }}>
            <div style={{ fontWeight: 900, suggestFontSize: 15, color: THEME.text }}>Add</div>
            <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontWeight: 900 }}>
              ✕
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <div style={labelStyle}>Status</div>
              <select value={status} onChange={(e) => setStatus(e.target.value)} style={selectStyle}>
                <option value="P">To Present</option>
                <option value="W">Practicing</option>
                <option value="M">Mastered</option>
                <option value="A">Aim (A)</option>
              </select>
            </div>
            <div>
              <div style={labelStyle}>Optional date</div>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle()} />
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <div style={labelStyle}>Area</div>
            <select value={area} onChange={(e) => setArea(e.target.value)} style={selectStyle}>
              <option value="">Any</option>
              {areas.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>

          <div style={{ marginTop: 12 }}>
            <div style={{ ...labelStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Activity</span>
              <label style={{ fontSize: 12, fontWeight: 800, color: THEME.textMuted, display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="checkbox" checked={custom} onChange={(e) => setCustom(e.target.checked)} />
                Custom
              </label>
            </div>

            {!custom ? (
              <>
                <input
                  list="qaOfficialStudent"
                  value={activity}
                  onChange={(e) => setActivity(e.target.value)}
                  placeholder="Pick an official activity…"
                  style={{ width: '100%', padding: '12px 12px', border: '1px solid #eee', fontWeight: 800 }}
                />
                <datalist id="qaOfficialStudent">
                  {officialActivities.slice(0, 250).map((a) => (
                    <option key={a.id} value={a.name} />
                  ))}
                </datalist>
              </>
            ) : (
              <input
                value={activity}
                onChange={(e) => setActivity(e.target.value)}
                placeholder="Type custom activity…"
                style={{ width: '100%', padding: '12px 12px', border: '1px solid #eee', fontWeight: 800 }}
              />
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button variant="secondary" onClick={handleSubmit}>Add</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

const labelStyle = { fontSize: 12, fontWeight: 900, color: THEME.textMuted, marginBottom: 6 };
const selectStyle = { ...inputStyle(), padding: '10px 12px', fontWeight: 900 };
