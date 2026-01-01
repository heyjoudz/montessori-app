import { useState, useMemo } from 'react';
import { THEME } from '../ui/theme';
import {
  SUBJECT_KEYS, getNormalizedItem, dateISO
} from '../utils/helpers';

import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import SearchableSelect from '../components/ui/SearchableSelect';
import KanbanColumn from '../components/business/Kanban';
import EditActivityModal from '../components/business/EditActivityModal';
import QuickAddModal from '../components/business/QuickAddModal';

export default function DashboardView({
  planItems, students, classrooms, activeDate, setActiveDate, onUpdateItem, onDeleteItem,
  onQuickAdd, curriculum, showToast
}) {
  const [tab] = useState('MONTH');
  const [classFilter, setClassFilter] = useState('ALL');
  const [studentFilter, setStudentFilter] = useState('ALL');
  const [areaFilter, setAreaFilter] = useState('ALL');
  const [textSearch, setTextSearch] = useState('');
  const [editingItem, setEditingItem] = useState(null);
  const [expandAction, setExpandAction] = useState({ type: 'COLLAPSE', ts: Date.now() });
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  const currentD = new Date(activeDate);
  const monthLabel = currentD.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const selectedClassroomId = useMemo(() => {
    return classFilter !== 'ALL' ? String(classFilter) : null;
  }, [classFilter]);

  const classOptions = useMemo(() => {
    return [
      { value: 'ALL', label: 'All Classrooms' },
      ...classrooms.map((c, idx) => ({
        value: c.id,
        label: c.name,
        color: THEME.classroomColors[idx % THEME.classroomColors.length]
      }))
    ];
  }, [classrooms]);

  const studentsForDropdown = useMemo(() => {
    if (!selectedClassroomId) return students;
    return students.filter(s => String(s.classroom_id) === String(selectedClassroomId));
  }, [students, selectedClassroomId]);

  const studentOptions = useMemo(() => {
    const base = [{ value: 'ALL', label: 'All Students' }];
    const list = studentsForDropdown
      .slice()
      .sort((a, b) => (`${a.first_name} ${a.last_name}`).localeCompare(`${b.first_name} ${b.last_name}`))
      .map(s => {
        const c = classrooms.find(x => String(x.id) === String(s.classroom_id));
        return {
          value: s.id,
          label: `${s.first_name} ${s.last_name}`,
          hint: selectedClassroomId ? '' : (c?.name || '')
        };
      });
    return [...base, ...list];
  }, [studentsForDropdown, classrooms, selectedClassroomId]);

  const areaOptions = useMemo(() => ([
    { value: 'ALL', label: 'All Areas' },
    ...SUBJECT_KEYS.map(x => ({ value: x, label: x })),
    { value: 'General', label: 'General' }
  ]), []);

  const filterList = (list) => {
    let items = list;
    if (classFilter !== 'ALL') items = items.filter(i => String(i.classroom_id) === String(classFilter));
    if (studentFilter !== 'ALL') items = items.filter(i => String(i.student_id) === String(studentFilter));
    if (areaFilter !== 'ALL') items = items.filter(i => (getNormalizedItem(i).area || 'General') === areaFilter);
    if (textSearch.trim()) {
      const q = textSearch.toLowerCase();
      items = items.filter(i => {
        const norm = getNormalizedItem(i);
        return (norm.title || '').toLowerCase().includes(q) ||
               (norm.notes || '').toLowerCase().includes(q) ||
               (norm.rawActivity || '').toLowerCase().includes(q);
      });
    }
    return items;
  };

  const currentItems = useMemo(() => {
    const m = currentD.getMonth() + 1;
    const y = currentD.getFullYear();
    const ymPrefix = `${y}-${String(m).padStart(2, '0')}`;

    const items = planItems.filter(i => {
      const pd = (i.planning_date || '').toString().slice(0, 10);
      const inMonthByPlanningDate = pd && pd.startsWith(ymPrefix);
      const inMonthByCols = (Number(i.year) === y && Number(i.month) === m);
      const isUnscheduled = !pd;
      return inMonthByPlanningDate || inMonthByCols || isUnscheduled;
    });

    return filterList(items);
  }, [planItems, activeDate, classFilter, studentFilter, areaFilter, textSearch]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 22, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: 32, margin: '0 0 8px 0', fontFamily: THEME.serifFont, color: THEME.text }}>Dashboard</h2>
          <div style={{ fontSize: 14, color: THEME.textMuted, fontWeight: 600 }}>
            {tab === 'MONTH' ? `Monthly board for ${monthLabel}` : ''}
          </div>
        </div>

      </div>

      <Card style={{ padding: 20, marginBottom: 24, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', overflow: 'visible', position: 'relative', zIndex: 50 }}>
        <SearchableSelect options={classOptions} value={classFilter} onChange={(v) => { setClassFilter(v); setStudentFilter('ALL'); }} placeholder="Classrooms" />
        <SearchableSelect options={studentOptions} value={studentFilter} onChange={setStudentFilter} placeholder="Students" />
        <SearchableSelect options={areaOptions} value={areaFilter} onChange={setAreaFilter} placeholder="Areas" />
        <input
          type="text"
          placeholder="Search activities or notes..."
          value={textSearch}
          onChange={e => setTextSearch(e.target.value)}
          style={{ padding: '12px 16px', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 0, fontSize: '14px', minWidth: 200, outline: 'none' }}
        />
        <div style={{ flex: 1 }} />
        <Button variant="ghost" onClick={() => setExpandAction({ type: 'EXPAND', ts: Date.now() })}>Expand All</Button>
        <Button variant="ghost" onClick={() => setExpandAction({ type: 'COLLAPSE', ts: Date.now() })}>Collapse All</Button>
      </Card>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20, alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Button variant="ghost" onClick={() => { const d = new Date(activeDate); d.setMonth(d.getMonth() - 1); setActiveDate(dateISO(d)); }}>←</Button>
          <div style={{ fontSize: 20, fontWeight: 600, fontFamily: THEME.serifFont }}>{monthLabel}</div>
          <Button variant="ghost" onClick={() => { const d = new Date(activeDate); d.setMonth(d.getMonth() + 1); setActiveDate(dateISO(d)); }}>→</Button>
        </div>
      </div>

      {/* IMPORTANT: Next Month Aim (A) removed from dashboard Kanban */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 30, marginBottom: 40 }}>
        {['W', 'P', 'M'].map(status => (
          <KanbanColumn
            key={status}
            status={status}
            items={currentItems.filter(i => i.status === status)}
            students={students}
            classrooms={classrooms}
            onEditItem={setEditingItem}
            onDeleteItem={onDeleteItem}
            expandAction={expandAction}
            selectedClassroomId={selectedClassroomId}
            mode="DASHBOARD"
          />
        ))}
      </div>

      {editingItem && (
        <EditActivityModal
          item={editingItem}
          curriculum={curriculum}
          onSave={onUpdateItem}
          onDelete={onDeleteItem}
          onClose={() => setEditingItem(null)}
        />
      )}

      <QuickAddModal
        open={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        curriculum={curriculum}
        // Only if a student is already filtered
        defaultStudentId={studentFilter !== 'ALL' ? String(studentFilter) : null}
        defaultStatus="P"
        defaultDate=""
        title="Add"
        onSubmit={async (payload) => {
          try {
            await onQuickAdd?.(payload);
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
