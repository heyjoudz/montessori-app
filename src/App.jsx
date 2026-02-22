import { useState, useEffect, useMemo, useRef, Component } from 'react';
import { supabase } from './supabaseClient';
import { useAuth } from './context/AuthContext';
import LoginScreen from './LoginScreen';
import WaitingApproval from './WaitingApproval';
import { THEME, FontLoader } from './ui/theme';
import AssessmentsView from './views/AssessmentsView';

// ✅ Admin View
import AdminView from './views/AdminView';

import {
  normalizeStatusCode,
  dateISO,
  enrichCurrRefs,
  fetchAllRows,
  inputStyle,
  selectStyle,
  primeCurrCache,
  getFirstName,
  getDisplayName
} from './utils/helpers';

import Button from './components/ui/Button';
import Card from './components/ui/Card';
import Modal from './components/ui/Modal';
import SearchableSelect from './components/ui/SearchableSelect';
import Toast from './components/ui/Toast';
import LoadingScreen from './components/ui/LoadingScreen';
import NavItem from './components/ui/NavItem';

// ✅ Views
import MasterTimelineView from './views/MasterTimelineView';
import IndividualPlanner from './views/IndividualPlanner';
import ConfigurationView from './views/ConfigurationView';

// ✅ NEW: Weekly Coordination View
import WeeklyCoordinationView from './views/WeeklyCoordinationView';

// ------------------------
// Error Boundary
// ------------------------
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }
  static getDerivedStateFromError(err) {
    return { hasError: true, message: err?.message || 'Something went wrong.' };
  }
  componentDidCatch(err) {
    console.error('UI ErrorBoundary caught:', err);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24 }}>
          <Card style={{ padding: 18 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: THEME.text }}>Oops — the page crashed.</div>
            <div style={{ marginTop: 8, fontSize: 13, color: THEME.textMuted, lineHeight: 1.5 }}>
              {this.state.message}
            </div>
            <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
              <Button onClick={() => this.setState({ hasError: false, message: '' })}>Try again</Button>
              <Button variant="ghost" onClick={() => window.location.reload()}>Reload</Button>
            </div>
          </Card>
        </div>
      );
    }
    return this.props.children;
  }
}

// ------------------------
// Quick Add (Ctrl/Cmd + K)
// ------------------------
function QuickAddModal({
  open,
  onClose,
  students,
  classrooms,
  curriculum,
  defaultStudentId,
  defaultDateISO,
  onQuickAdd,
  showToast
}) {
  const [mode, setMode] = useState('CURR');
  const [studentId, setStudentId] = useState(defaultStudentId || '');
  const [status, setStatus] = useState('P');
  const [date, setDate] = useState(defaultDateISO || dateISO(new Date()));
  const [notes, setNotes] = useState('');

  const [currId, setCurrId] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [customArea, setCustomArea] = useState('General');

  useEffect(() => {
    if (!open) return;
    setStudentId(defaultStudentId || '');
    setDate(defaultDateISO || dateISO(new Date()));
    setStatus('P');
    setNotes('');
    setMode('CURR');
    setCurrId('');
    setCustomTitle('');
    setCustomArea('General');
  }, [open, defaultStudentId, defaultDateISO]);

  const studentOptions = useMemo(() => {
    return [
      { value: '', label: 'Select a student…' },
      ...students
        .slice()
        .sort((a, b) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`))
        .map(s => {
          const c = classrooms.find(x => String(x.id) === String(s.classroom_id));
          return { value: s.id, label: `${s.first_name} ${s.last_name}`, hint: c?.name || '' };
        })
    ];
  }, [students, classrooms]);

  const curriculumOptions = useMemo(() => ([
    { value: '', label: 'Select a curriculum activity…' },
    ...curriculum
      .slice()
      .sort((a, b) => (a.sort_order ?? 999999) - (b.sort_order ?? 999999))
      .map(a => ({ value: a.id, label: a.name || a.activity || 'Untitled' }))
  ]), [curriculum]);

  if (!open) return null;

  const save = async () => {
    if (!studentId) {
      showToast?.({ type: 'error', title: 'Missing student', message: 'Select a student to add an activity.' });
      return;
    }

    const d = date || dateISO(new Date());

    if (mode === 'CURR') {
      const picked = curriculum.find(x => x.id == currId);
      if (!picked) {
        showToast?.({ type: 'error', title: 'Missing activity', message: 'Pick a curriculum activity (or switch to Custom).' });
        return;
      }

      await onQuickAdd?.({
        student_id: studentId,
        activity: picked.name || picked.activity,
        status,
        date: d,
        notes: notes || '',
        curriculum_activity_id: picked.id,
        curriculum_area_id: picked.curriculum_area_id,
        curriculum_category_id: picked.category_id || picked.curriculum_category_id
      });

      onClose();
      return;
    }

    if (!customTitle.trim()) {
      showToast?.({ type: 'error', title: 'Missing title', message: 'Add a name for your custom activity.' });
      return;
    }

    await onQuickAdd?.({
      student_id: studentId,
      activity: customTitle.trim(),
      status,
      date: d,
      notes: notes || '',
      area: customArea || 'General'
    });

    onClose();
  };

  return (
    <Modal
      title="Quick Add"
      subtitle="Add a curriculum activity or a custom note — instantly."
      onClose={onClose}
      width={820}
    >
      <div style={{ display: 'grid', gap: 16 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Button variant={mode === 'CURR' ? 'active' : 'ghost'} onClick={() => setMode('CURR')}>Curriculum Activity</Button>
          <Button variant={mode === 'CUSTOM' ? 'active' : 'ghost'} onClick={() => setMode('CUSTOM')}>Custom</Button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr 0.8fr', gap: 12 }}>
          <SearchableSelect
            options={studentOptions}
            value={studentId}
            onChange={setStudentId}
            placeholder="Student"
            style={{ minWidth: 260 }}
          />
          <select value={status} onChange={e => setStatus(e.target.value)} style={selectStyle()}>
            <option value="P">To Present</option>
            <option value="W">Practicing</option>
            <option value="M">Mastered</option>
          </select>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle()} />
        </div>

        {mode === 'CURR' ? (
          <SearchableSelect
            options={curriculumOptions}
            value={currId}
            onChange={setCurrId}
            placeholder="Curriculum activity"
            style={{ minWidth: 360 }}
          />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 12 }}>
            <input
              value={customTitle}
              onChange={e => setCustomTitle(e.target.value)}
              placeholder="Custom activity / note…"
              style={inputStyle()}
            />
            <select value={customArea} onChange={e => setCustomArea(e.target.value)} style={selectStyle()}>
              <option value="General">General</option>
              <option value="Math">Math</option>
              <option value="English">English</option>
              <option value="Sensorial">Sensorial</option>
              <option value="Culture">Culture</option>
              <option value="Practical Life">Practical Life</option>
            </select>
          </div>
        )}

        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Notes (optional)…"
          style={{ ...inputStyle(), height: 90, resize: 'vertical' }}
        />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
          <div style={{ fontSize: 12, color: THEME.textMuted, fontWeight: 600 }}>
            Tip: press <b>Ctrl/⌘ + K</b> anytime to open Quick Add.
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button onClick={save}>Add</Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ------------------------
// MAIN APP
// ------------------------
export default function App() {
  const { user, profile, loading, signOut } = useAuth();

  const [viewState, setViewState] = useState('HOME');

  const [activeDate, setActiveDate] = useState(dateISO(new Date()));

  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);

  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [targetStudentId, setTargetStudentId] = useState(null);

  const showToast = (t) => {
    setToast(t);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 2600);
  };

  const [schools, setSchools] = useState([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState(null);

  const [classrooms, setClassrooms] = useState([]);
  const [students, setStudents] = useState([]);
  const [planItems, setPlanItems] = useState([]);

  const [curriculum, setCurriculum] = useState([]);
  const [curriculumAreas, setCurriculumAreas] = useState([]);
  const [curriculumCategories, setCurriculumCategories] = useState([]);

  const [masterPlans, setMasterPlans] = useState([]);
  const [planSessions, setPlanSessions] = useState([]);

  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setQuickAddOpen(true);
      }
      if (e.key === 'Escape') setQuickAddOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (viewState === 'DASHBOARD') setViewState('HOME');
  }, [viewState]);

  useEffect(() => {
    if (!user || !profile) return;
    const status = user.user_metadata?.status;
    if (status === 'pending') {
      setInitialLoading(false);
      return;
    }

    async function initSchools() {
      let query = supabase.from('schools').select('*').order('name');
      if (profile.customer_id) query = query.eq('customer_id', profile.customer_id);

      const { data, error } = await query;
      if (!error && data?.length > 0) {
        setSchools(data);
        setSelectedSchoolId(data[0].id);
      } else {
        setInitialLoading(false);
      }
    }

    initSchools();
  }, [user, profile]);

  useEffect(() => {
    if (!selectedSchoolId) return;

    let alive = true;
    setInitialLoading(true);

    async function loadSchoolData() {
      try {
        const [cls, acts, areas, cats, tPlans] = await Promise.all([
          supabase.from('classrooms').select('*').eq('school_id', selectedSchoolId).order('name'),
          supabase.from('curriculum_activities').select('*').order('sort_order'),
          supabase.from('curriculum_areas').select('*').order('name'),
          supabase.from('curriculum_categories').select('*').order('name'),
          supabase.from('term_plans').select('*').order('week_number')
        ]);

        if (!alive) return;

        primeCurrCache({
          activities: acts.data || [],
          areas: areas.data || [],
          categories: cats.data || []
        });

        const loadedClassrooms = cls.data || [];
        setClassrooms(loadedClassrooms);

        const classroomIds = loadedClassrooms.map(c => c.id);
        let loadedStudents = [];

        if (classroomIds.length > 0) {
          const stus = await supabase.from('students').select('*').in('classroom_id', classroomIds).order('first_name');
          loadedStudents = stus.data || [];
        }
        setStudents(loadedStudents);

        setCurriculumAreas(areas.data || []);
        setCurriculumCategories(cats.data || []);
        setCurriculum((acts.data || []).map(enrichCurrRefs));

        const relevantPlans = (tPlans.data || []).filter(tp =>
          !tp.classroom_id || classroomIds.includes(tp.classroom_id)
        );
        setMasterPlans(relevantPlans);

        setInitialLoading(false);

        loadHeavyInBackground(classroomIds);
      } catch (e) {
        console.error('Core Data Load Error', e);
        if (alive) setInitialLoading(false);
        showToast({ type: 'error', title: 'Load error', message: e?.message || 'Failed to load school data.' });
      }
    }

    async function loadHeavyInBackground(classroomIds) {
      if (classroomIds.length === 0) {
        setPlanItems([]);
        setPlanSessions([]);
        return;
      }

      try {
        const allPlanItems = await fetchAllRows((from, to) =>
          supabase
            .from('plan_items')
            .select('*')
            .in('classroom_id', classroomIds)
            .neq('status', 'Archived')
            .order('id', { ascending: true })
            .range(from, to)
        );

        const allTermSessions = await fetchAllRows((from, to) =>
          supabase
            .from('term_plan_sessions')
            .select('*')
            .order('id', { ascending: true })
            .range(from, to)
        );

        if (!alive) return;

        setPlanItems(
          (allPlanItems || [])
            .map(enrichCurrRefs)
            .map(p => ({ ...p, status: normalizeStatusCode(p.status) }))
        );

        setPlanSessions((allTermSessions || []).map(enrichCurrRefs));
      } catch (e) {
        console.error('Heavy Data Load Error', e);
        showToast({ type: 'error', title: 'Load error', message: e?.message || 'Failed to load plan data.' });
      }
    }

    loadSchoolData();
    return () => { alive = false; };
  }, [selectedSchoolId]);

  const handleQuickAdd = async (payload) => {
    const student = students.find(s => s.id == payload.student_id);
    if (!student) return;

    const targetDate = payload.date ? new Date(payload.date) : new Date();
    const dISO = payload.date ? dateISO(targetDate) : null;

    const newItem = {
      classroom_id: student.classroom_id,
      teacher_id: user.id,
      student_id: payload.student_id,
      activity: payload.activity,
      status: payload.status,
      area: payload.area || 'General',
      planning_date: payload.date ? dISO : null,
      year: targetDate.getFullYear(),
      month: targetDate.getMonth() + 1,
      day: targetDate.getDate(),
      notes: payload.notes || '',
      curriculum_activity_id: payload.curriculum_activity_id,
      curriculum_area_id: payload.curriculum_area_id,
      curriculum_category_id: payload.curriculum_category_id
    };

    const { data, error } = await supabase
      .from('plan_items')
      .insert([newItem])
      .select('*');

    if (error) {
      showToast({ type: 'error', title: 'Error', message: error.message });
      return;
    }

    if (data?.[0]) {
      const enriched = enrichCurrRefs(data[0]);
      setPlanItems(prev => [...prev, { ...enriched, status: normalizeStatusCode(enriched.status) }]);
      showToast({ type: 'success', title: 'Added', message: `${payload.activity}` });
    }
  };

  const handleUpdateItem = async (updatedItem) => {
    let dateFields = {};
    if (updatedItem.planning_date) {
      const d = new Date(updatedItem.planning_date);
      if (!isNaN(d.getTime())) {
        dateFields = { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
      }
    }

    const { error } = await supabase
      .from('plan_items')
      .update({
        status: updatedItem.status,
        notes: updatedItem.notes,
        planning_date: updatedItem.planning_date,
        area: updatedItem.area,
        ...dateFields
      })
      .eq('id', updatedItem.id);

    if (error) showToast({ type: 'error', title: 'Error', message: error.message });
    else {
      setPlanItems(prev => prev.map(i => i.id === updatedItem.id ? { ...i, ...updatedItem, ...dateFields } : i));
      showToast({ type: 'success', title: 'Saved', message: 'Activity updated.' });
    }
  };

  const handleDeleteItem = async (itemId) => {
    if (!confirm('Delete this activity?')) return;
    const { error } = await supabase.from('plan_items').delete().eq('id', itemId);
    if (error) showToast({ type: 'error', title: 'Error', message: error.message });
    else {
      setPlanItems(prev => prev.filter(i => i.id !== itemId));
      showToast({ type: 'success', title: 'Deleted', message: 'Activity removed.' });
    }
  };

  const handleMoveItemToDate = async (item, newISODate) => {
    const d = new Date(newISODate);
    const updated = { ...item, planning_date: newISODate, year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };

    const { error } = await supabase
      .from('plan_items')
      .update({ planning_date: newISODate, year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() })
      .eq('id', item.id);

    if (error) showToast({ type: 'error', title: 'Error', message: error.message });
    else {
      setPlanItems(prev => prev.map(i => i.id === item.id ? updated : i));
      showToast({ type: 'success', title: 'Moved', message: 'Item rescheduled.' });
    }
  };

  if (loading) return <LoadingScreen />;
  if (!user) return <LoginScreen />;

  if (user.user_metadata?.status === 'pending') {
    return <WaitingApproval user={user} onLogout={signOut} />;
  }

  if (initialLoading) return <LoadingScreen />;

  const isSupervisor = profile?.role === 'supervisor' || profile?.role === 'super_admin';
  const isCoordinator = isSupervisor || profile?.role === 'coordinator';

  const displayName = getDisplayName(profile, user);
  const firstName = getFirstName(displayName);
  const parentStudentId = (profile?.role === 'parent' && profile?.student_id) ? profile.student_id : null;

  return (
    <div style={{ fontFamily: THEME.sansFont, background: THEME.bg, minHeight: '100vh', color: THEME.text, width: '100%', overflowX: 'hidden' }}>
      <FontLoader />
      <Toast toast={toast} onClose={() => setToast(null)} />

      <QuickAddModal
        open={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        students={students}
        classrooms={classrooms}
        curriculum={curriculum}
        defaultStudentId={parentStudentId || targetStudentId || ''}
        defaultDateISO={activeDate}
        onQuickAdd={handleQuickAdd}
        showToast={showToast}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', minHeight: '100vh' }}>
        <Sidebar
          firstName={firstName}
          profile={profile}
          viewState={viewState}
          onNavigate={setViewState}
          onSignOut={signOut}
          schools={schools}
          selectedSchoolId={selectedSchoolId}
          onSchoolChange={setSelectedSchoolId}
        />

        <div
          style={{
            padding: viewState === 'HOME' ? 0 : 'clamp(16px, 3vw, 50px)',
            maxWidth: 1650,
            margin: '0 auto',
            width: '100%',
            boxSizing: 'border-box',
            height: viewState === 'ASSESSMENTS' ? '100vh' : 'auto',
            display: 'flex',
            flexDirection: 'column',
            overflowY: viewState === 'ASSESSMENTS' ? 'hidden' : 'auto'
          }}
        >
          <ErrorBoundary>
            {viewState === 'HOME' && (
              <HomeMenu
                userName={firstName}
                onNavigate={setViewState}
                isCoordinator={isCoordinator}
              />
            )}

            {viewState === 'YEARLY' && (
              <MasterTimelineView
                masterPlans={masterPlans}
                planSessions={planSessions}
                classrooms={classrooms}
                activeDate={activeDate}
                setActiveDate={setActiveDate}
                showToast={showToast}
              />
            )}

            {/* ✅ NEW VIEW */}
            {viewState === 'COORDINATION' && (
              <WeeklyCoordinationView
                profile={profile}
                showToast={showToast}
                selectedSchoolId={selectedSchoolId}
                classrooms={classrooms}
                students={students}
                masterPlans={masterPlans}
              />
            )}

            {viewState === 'INDIVIDUAL' && (
              <IndividualPlanner
                profile={profile}
                forcedStudentId={parentStudentId}
                students={students}
                planItems={planItems}
                curriculum={curriculum}
                curriculumAreas={curriculumAreas}
                curriculumCategories={curriculumCategories}
                classrooms={classrooms}
                masterPlans={masterPlans}
                planSessions={planSessions}
                activeDate={activeDate}
                setActiveDate={setActiveDate}
                onQuickAdd={handleQuickAdd}
                onUpdateItem={handleUpdateItem}
                onMoveItemToDate={handleMoveItemToDate}
                onDeleteItem={handleDeleteItem}
                openQuickAdd={() => setQuickAddOpen(true)}
                showToast={showToast}
              />
            )}

            {viewState === 'ASSESSMENTS' && (
              <AssessmentsView
                profile={profile}
                classrooms={classrooms}
                curriculumAreas={curriculumAreas}
                showToast={showToast}
              />
            )}

            {viewState === 'CONFIG' && <ConfigurationView isReadOnly={!isSupervisor} />}

            {viewState === 'ADMIN' && <AdminView />}
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
}

// ------------------------
// SIDEBAR
// ------------------------
function Sidebar({
  firstName,
  profile,
  viewState,
  onNavigate,
  onSignOut,
  schools,
  selectedSchoolId,
  onSchoolChange
}) {
  const isSupervisor = profile?.role === 'supervisor' || profile?.role === 'super_admin';
  const isCoordinator = isSupervisor || profile?.role === 'coordinator';

  const handleSafeSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) console.log("Logout error (ignored):", error.message);
    localStorage.clear();
    if (onSignOut) onSignOut();
    window.location.href = '/';
  };

  return (
    <div style={{ position: 'sticky', top: 0, height: '100vh', background: '#FFFFFF', borderRight: '1px solid #eee', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '26px 22px', borderBottom: '1px solid #eee' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontFamily: THEME.serifFont, fontWeight: 600, fontSize: 20, color: THEME.text, lineHeight: 1.05 }}>
            Montessori<br /><span style={{ color: THEME.brandSecondary }}>OS</span>
          </div>
          <div style={{ width: 44, height: 44, background: THEME.brandAccent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 18, color: THEME.text, border: '2px solid white', borderRadius: 14 }}>
            {(firstName || 'T').slice(0, 1).toUpperCase()}
          </div>
        </div>

        {schools && schools.length > 1 ? (
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: THEME.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Current School
            </label>
            <select
              value={selectedSchoolId || ''}
              onChange={(e) => onSchoolChange(Number(e.target.value))}
              style={{
                width: '100%',
                marginTop: 4,
                padding: '6px 8px',
                borderRadius: 8,
                border: '1px solid #ddd',
                fontSize: 14,
                fontWeight: 500,
                color: THEME.text,
                fontFamily: THEME.sansFont,
                cursor: 'pointer',
                outline: 'none',
                background: '#f9f9f9'
              }}
            >
              {schools.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        ) : (
          <div style={{ fontSize: 13, color: THEME.textMuted, fontWeight: 500, marginBottom: 8 }}>
            {schools[0]?.name || '...'}
          </div>
        )}

        <div>
          <div style={{ fontWeight: 500, fontSize: 15, color: THEME.text }}>{firstName}</div>
        </div>
      </div>

      <div style={{ padding: '10px 0', flex: 1 }}>
        <NavItem label="Home" active={viewState === 'HOME'} onClick={() => onNavigate('HOME')} />
        <NavItem label="Scope & Sequence" active={viewState === 'YEARLY'} onClick={() => onNavigate('YEARLY')} />

        {/* ✅ NEW MENU ITEM */}
        {isCoordinator && (
          <NavItem label="Weekly Coordination" active={viewState === 'COORDINATION'} onClick={() => onNavigate('COORDINATION')} />
        )}

        <NavItem label="Individual Plans" active={viewState === 'INDIVIDUAL'} onClick={() => onNavigate('INDIVIDUAL')} />
        <NavItem label="Assessments" active={viewState === 'ASSESSMENTS'} onClick={() => onNavigate('ASSESSMENTS')} />
        <NavItem label="Configuration" active={viewState === 'CONFIG'} onClick={() => onNavigate('CONFIG')} />

        {isSupervisor && (
          <NavItem label="Admin Panel" active={viewState === 'ADMIN'} onClick={() => onNavigate('ADMIN')} />
        )}
      </div>

      <div style={{ padding: 22 }}>
        <Button
          variant="ghost"
          onClick={handleSafeSignOut}
          style={{ width: '100%', border: '1px solid #eee', fontWeight: 500 }}
        >
          Sign Out
        </Button>
      </div>
    </div>
  );
}

// ------------------------
// HOME MENU
// ------------------------
function HomeMenu({ userName, onNavigate, isCoordinator = false }) {
  return (
    <div style={{ minHeight: '92vh', padding: '60px 20px', background: THEME.bg, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ maxWidth: 1000, width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 60 }}>
          <div style={{ width: 80, height: 80, background: THEME.brandYellow, margin: '0 auto 20px', clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }} />
          <h1 style={{ fontFamily: THEME.serifFont, fontSize: '3rem', color: THEME.text, marginBottom: 16 }}>
            Hello, <span style={{ color: THEME.brandSecondary }}>{userName}</span>
          </h1>
          <p style={{ color: THEME.textMuted, fontSize: '1.2rem', fontWeight: 500, margin: 0, maxWidth: 600, marginInline: 'auto' }}>
            Welcome to the Montessori digital planner.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 30 }}>
          <HomeCard icon="🗺️" title="Scope & Sequence" desc="Yearly timeline, themes and lessons." onClick={() => onNavigate('YEARLY')} color={THEME.brandYellow} />

          {/* ✅ Optional Home shortcut (coordinators only) */}
          {isCoordinator && (
            <HomeCard
              icon="📋"
              title="Weekly Coordination"
              desc="Meeting notes, follow-ups, and weekly action plans."
              onClick={() => onNavigate('COORDINATION')}
              color={THEME.brandAccent}
            />
          )}

          <HomeCard icon="🎓" title="Individual Plans" desc="Student tracking, reports and progress boards." onClick={() => onNavigate('INDIVIDUAL')} color={THEME.brandAccent} />
          <HomeCard icon="📝" title="Assessments" desc="Create report cards + view classroom summaries." onClick={() => onNavigate('ASSESSMENTS')} color={THEME.brandSecondary} />
          <HomeCard icon="⚙️" title="Configuration" desc="Manage classrooms, students, roles, and assessments." onClick={() => onNavigate('CONFIG')} color="#ddd" />
        </div>
      </div>
    </div>
  );
}

function HomeCard({ icon, title, desc, onClick, color }) {
  return (
    <Card onClick={onClick} style={{ padding: 40, cursor: 'pointer', borderTop: `6px solid ${color}` }}>
      <div style={{ display: 'flex', alignItems: 'start', gap: 20 }}>
        <div style={{ fontSize: 32 }}>{icon}</div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 22, fontWeight: 600, color: THEME.text, fontFamily: THEME.serifFont }}>{title}</div>
          <div style={{ fontSize: 15, color: THEME.textMuted, marginTop: 10, lineHeight: 1.6, fontWeight: 500 }}>{desc}</div>
        </div>
      </div>
    </Card>
  );
}