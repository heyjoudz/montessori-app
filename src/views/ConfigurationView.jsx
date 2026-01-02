import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { THEME, getSubjectStyle } from '../ui/theme';
import Card from '../components/ui/Card';
import {
  Search, Plus, Save, X,
  School, Users, GraduationCap, BookOpen, Calendar,
  ChevronRight, ChevronDown, Loader, Check, Info, Mail
} from 'lucide-react';

// ---------- small color helpers (no deps) ----------
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
  secondary: THEME.brandSecondary,
  accent: THEME.brandAccent,
  yellow: THEME.brandYellow,

  line: rgba(THEME.brandAccent, 0.55),
  soft: rgba(THEME.brandAccent, 0.25),
  soft2: rgba(THEME.brandSecondary, 0.18),
};

// ---------- Reusable UI ----------
const FormLabel = ({ children }) => (
  <label
    style={{
      display: 'block',
      fontSize: 11,
      fontWeight: 600,
      color: UI.muted,
      marginBottom: 6,
      textTransform: 'uppercase',
      letterSpacing: '0.6px'
    }}
  >
    {children}
  </label>
);

const StyledInput = ({ style, ...props }) => (
  <input
    {...props}
    style={{
      width: '100%',
      padding: '12px 14px',
      borderRadius: 12,
      border: `1px solid ${UI.line}`,
      fontSize: 14,
      outline: 'none',
      marginBottom: 16,
      boxSizing: 'border-box',
      fontFamily: 'inherit',
      color: UI.text,
      backgroundColor: '#fff',
      transition: 'box-shadow 0.15s, border-color 0.15s',
      ...style
    }}
    onFocus={(e) => {
      e.target.style.borderColor = UI.primary;
      e.target.style.boxShadow = `0 0 0 4px ${UI.soft}`;
    }}
    onBlur={(e) => {
      e.target.style.borderColor = UI.line;
      e.target.style.boxShadow = 'none';
    }}
  />
);

const StyledSelect = ({ style, children, ...props }) => (
  <select
    {...props}
    style={{
      width: '100%',
      padding: '12px 14px',
      borderRadius: 12,
      border: `1px solid ${UI.line}`,
      fontSize: 14,
      outline: 'none',
      marginBottom: 16,
      backgroundColor: '#fff',
      boxSizing: 'border-box',
      fontFamily: 'inherit',
      color: UI.text,
      cursor: 'pointer',
      ...style
    }}
  >
    {children}
  </select>
);

const TabButton = ({ active, label, icon: Icon, onClick }) => (
  <button
    onClick={onClick}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '12px 18px',
      width: '100%',
      textAlign: 'left',
      backgroundColor: active ? UI.soft : 'transparent',
      border: 'none',
      borderLeft: active ? `6px solid ${UI.secondary}` : '6px solid transparent',
      color: active ? UI.text : UI.muted,
      fontWeight: active ? 800 : 600,
      cursor: 'pointer',
      transition: 'all 0.15s',
      fontSize: 14
    }}
  >
    <Icon size={18} color={active ? UI.primary : UI.muted} />
    <span>{label}</span>
  </button>
);

const TinyPill = ({ children, tone = 'accent' }) => {
  const bg =
    tone === 'secondary' ? rgba(UI.secondary, 0.25)
      : tone === 'yellow' ? rgba(UI.yellow, 0.25)
        : rgba(UI.accent, 0.25);

  const border =
    tone === 'secondary' ? rgba(UI.secondary, 0.45)
      : tone === 'yellow' ? rgba(UI.yellow, 0.55)
        : rgba(UI.accent, 0.55);

  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 700,
        padding: '3px 8px',
        borderRadius: 999,
        background: bg,
        border: `1px solid ${border}`,
        color: UI.text
      }}
    >
      {children}
    </span>
  );
};

// Collapsible tree row
const TreeRow = ({
  label,
  depth = 0,
  isOpen,
  onClick,
  children,
  icon: Icon,
  stripeColor,
  actions
}) => (
  <div style={{ userSelect: 'none' }}>
    <div
      onClick={onClick}
      style={{
        padding: '12px 14px',
        paddingLeft: 14 + (depth * 18),
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        cursor: 'pointer',
        backgroundColor: isOpen ? UI.soft : 'transparent',
        borderBottom: `1px solid ${rgba(UI.accent, 0.25)}`,
        color: UI.text,
        fontWeight: isOpen || depth === 0 ? 800 : 650,
        transition: 'background-color 0.12s',
        position: 'relative'
      }}
    >
      {stripeColor && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 4,
            background: stripeColor
          }}
        />
      )}

      <div style={{ color: UI.primary, display: 'flex', alignItems: 'center' }}>
        {children ? (isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />) : <div style={{ width: 16 }} />}
      </div>

      {Icon && <Icon size={16} color={UI.primary} />}

      <span style={{ flex: 1, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </span>

      {actions}
    </div>

    {isOpen && children && <div>{children}</div>}
  </div>
);

// ---------- MAIN ----------
export default function ConfigurationView({ isReadOnly }) {
  // ✅ allow everyone to edit for now (ignore isReadOnly)
  const canEdit = true;

  const [activeTab, setActiveTab] = useState('calendar');
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Data
  const [schools, setSchools] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [students, setStudents] = useState([]);
  const [termPlans, setTermPlans] = useState([]);
  const [curriculum, setCurriculum] = useState([]);
  const [currAreas, setCurrAreas] = useState([]);
  const [currCats, setCurrCats] = useState([]);
  const [userClassrooms, setUserClassrooms] = useState([]);

  // UI
  const [searchTerm, setSearchTerm] = useState('');
  const [editingItem, setEditingItem] = useState(null);
  const [expandedNodes, setExpandedNodes] = useState({ YEAR_2025: true });

  useEffect(() => { fetchEverything(); }, []);

  const fetchEverything = async () => {
    setLoading(true);
    try {
      const [s, c, p, st, cur, ca, cc, tp, uc] = await Promise.all([
        supabase.from('schools').select('*').order('name'),
        supabase.from('classrooms').select('*').order('name'),
        supabase.from('profiles').select('*').order('last_name'),
        supabase.from('students').select('*').order('first_name'),
        supabase.from('curriculum_activities').select('*').order('sort_order'),
        supabase.from('curriculum_areas').select('*').order('name'),
        supabase.from('curriculum_categories').select('*').order('name'),
        supabase.from('term_plans').select('*').order('week_number'),
        supabase.from('user_classrooms').select('*')
      ]);

      setSchools(s.data || []);
      setClassrooms(c.data || []);
      setProfiles(p.data || []);
      setStudents(st.data || []);
      setCurriculum(cur.data || []);
      setCurrAreas(ca.data || []);
      setCurrCats(cc.data || []);
      setTermPlans(tp.data || []);
      setUserClassrooms(uc.data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const toggleNode = (id) => setExpandedNodes(prev => ({ ...prev, [id]: !prev[id] }));

  const handleCreate = () => {
    const templates = {
      schools: { name: '', address: '' },
      classrooms: { name: '', school_id: schools[0]?.id },
      staff: { first_name: '', last_name: '', email: '', role: 'teacher' },
      students: { first_name: '', last_name: '', classroom_id: classrooms[0]?.id },
      curriculum: { name: '', category_id: currCats[0]?.id, is_official: true, is_active: true },
      calendar: { week_number: (termPlans?.length || 0) + 1, term_name: 'Term 1', date_range: '', theme: '' }
    };

    setEditingItem({ ...templates[activeTab], id: 'NEW' });
  };

  const handleSave = async () => {
    if (!editingItem) return;

    setIsSaving(true);

    const tableMap = {
      schools: 'schools',
      classrooms: 'classrooms',
      staff: 'profiles',
      students: 'students',
      curriculum: 'curriculum_activities',
      calendar: 'term_plans'
    };

    const table = tableMap[activeTab];

    try {
      const { id, themes, ...payload } = editingItem;
      let result;

      if (id === 'NEW') {
        const { data, error } = await supabase.from(table).insert([payload]).select();
        if (error) throw error;
        result = data?.[0];

        if (activeTab === 'schools') setSchools(prev => [...prev, result]);
        if (activeTab === 'classrooms') setClassrooms(prev => [...prev, result]);
        if (activeTab === 'staff') setProfiles(prev => [...prev, result]);
        if (activeTab === 'students') setStudents(prev => [...prev, result]);
        if (activeTab === 'curriculum') setCurriculum(prev => [...prev, result]);
        if (activeTab === 'calendar') setTermPlans(prev => [...prev, result]);
      } else {
        const { data, error } = await supabase.from(table).update(payload).eq('id', id).select();
        if (error) throw error;
        result = data?.[0];

        const u = (prev) => prev.map(i => i.id === id ? result : i);
        if (activeTab === 'schools') setSchools(u);
        if (activeTab === 'classrooms') setClassrooms(u);
        if (activeTab === 'staff') setProfiles(u);
        if (activeTab === 'students') setStudents(u);
        if (activeTab === 'curriculum') setCurriculum(u);
        if (activeTab === 'calendar') setTermPlans(u);
      }

      setEditingItem(prev => ({ ...result, themes: prev?.themes }));
    } catch (err) {
      alert(err.message || String(err));
    } finally {
      setIsSaving(false);
    }
  };

  const toggleTeacherClass = async (uid, cid) => {
    const exists = userClassrooms.find(uc => uc.user_id === uid && uc.classroom_id === cid);
    if (exists) {
      await supabase.from('user_classrooms').delete().match({ user_id: uid, classroom_id: cid });
      setUserClassrooms(prev => prev.filter(uc => !(uc.user_id === uid && uc.classroom_id === cid)));
    } else {
      const { data } = await supabase.from('user_classrooms').insert({ user_id: uid, classroom_id: cid }).select();
      if (data?.[0]) setUserClassrooms(prev => [...prev, data[0]]);
    }
  };

  // ---------- Trees / Lists ----------
  const renderCalendarTree = () => (
    <TreeRow
      label="Year 2025–2026"
      depth={0}
      isOpen={expandedNodes.YEAR_2025}
      onClick={() => toggleNode('YEAR_2025')}
      stripeColor={UI.yellow}
    >
      {['Term 1', 'Term 2', 'Term 3'].map(term => {
        const weeks = termPlans
          .filter(p => p.term_name === term)
          .slice()
          .sort((a, b) => (a.week_number ?? 0) - (b.week_number ?? 0));

        const termId = `TERM_${term}`;

        const map = new Map();
        weeks.forEach(w => {
          const key = w.week_number;
          if (!map.has(key)) map.set(key, { ...w, themes: new Set([w.theme]) });
          else map.get(key).themes.add(w.theme);
        });

        const uniqueWeeks = Array.from(map.values());

        return (
          <TreeRow
            key={term}
            label={term}
            depth={1}
            isOpen={expandedNodes[termId]}
            onClick={() => toggleNode(termId)}
            stripeColor={UI.secondary}
          >
            {uniqueWeeks.map(week => {
              const isActive = editingItem?.id === week.id;
              return (
                <div
                  key={week.id}
                  onClick={(e) => { e.stopPropagation(); setEditingItem(week); }}
                  style={{
                    padding: '10px 12px 10px 64px',
                    borderBottom: `1px solid ${rgba(UI.accent, 0.22)}`,
                    cursor: 'pointer',
                    backgroundColor: isActive ? UI.soft2 : '#fff',
                    borderLeft: isActive ? `4px solid ${UI.secondary}` : '4px solid transparent',
                    // Updated to match Curriculum leaf node style (font size 14, lighter weight when inactive)
                    color: isActive ? UI.text : UI.muted,
                    fontSize: 14,
                    fontWeight: isActive ? 800 : 650
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span>Week {week.week_number}</span>
                    <span style={{ fontWeight: 500, opacity: 0.85 }}>
                      {week.date_range ? `- ${week.date_range}` : ''}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                    {Array.from(week.themes).filter(Boolean).map((t, i) => (
                      <TinyPill key={i} tone="yellow">{t}</TinyPill>
                    ))}
                  </div>
                </div>
              );
            })}
          </TreeRow>
        );
      })}
    </TreeRow>
  );

  const renderCurriculumTree = () => {
    const filterTxt = (searchTerm || '').toLowerCase().trim();

    if (filterTxt) {
      return curriculum
        .filter(c => (c.name || '').toLowerCase().includes(filterTxt))
        .map(c => {
          const isActive = editingItem?.id === c.id;
          return (
            <div
              key={c.id}
              onClick={() => setEditingItem(c)}
              style={{
                padding: 14,
                borderBottom: `1px solid ${rgba(UI.accent, 0.22)}`,
                cursor: 'pointer',
                background: isActive ? UI.soft : '#fff',
                borderLeft: isActive ? `4px solid ${UI.secondary}` : '4px solid transparent'
              }}
            >
              <div style={{ fontWeight: 600, color: UI.text }}>{c.name}</div>
            </div>
          );
        });
    }

    return currAreas.map(area => {
      const cats = currCats.filter(c => c.area_id === area.id);
      if (!cats.length) return null;

      const subj = getSubjectStyle(area.name);
      const stripe = subj?.accent || UI.accent;

      return (
        <TreeRow
          key={area.id}
          label={area.name}
          depth={0}
          isOpen={expandedNodes[`AREA_${area.id}`]}
          onClick={() => toggleNode(`AREA_${area.id}`)}
          stripeColor={stripe}
        >
          {cats.map(cat => {
            const acts = curriculum.filter(a => a.category_id === cat.id);
            return (
              <TreeRow
                key={cat.id}
                label={cat.name}
                depth={1}
                isOpen={expandedNodes[`CAT_${cat.id}`]}
                onClick={() => toggleNode(`CAT_${cat.id}`)}
              >
                {acts.map(act => {
                  const isActive = editingItem?.id === act.id;
                  return (
                    <div
                      key={act.id}
                      onClick={(e) => { e.stopPropagation(); setEditingItem(act); }}
                      style={{
                        padding: '10px 12px 10px 64px',
                        cursor: 'pointer',
                        borderBottom: `1px solid ${rgba(UI.accent, 0.22)}`,
                        backgroundColor: isActive ? UI.soft2 : '#fff',
                        color: isActive ? UI.text : UI.muted,
                        borderLeft: isActive ? `4px solid ${UI.secondary}` : '4px solid transparent',
                        fontSize: 14,
                        fontWeight: isActive ? 800 : 650
                      }}
                    >
                      {act.name}
                    </div>
                  );
                })}
              </TreeRow>
            );
          })}
        </TreeRow>
      );
    });
  };

  const renderGenericList = (data, titleKey, subKey) => {
    const q = (searchTerm || '').toLowerCase();
    return data
      .filter(i => ((i[titleKey] || '') + '').toLowerCase().includes(q))
      .map(item => {
        const isActive = editingItem?.id === item.id;

        let title = item[titleKey];
        let sub =
          subKey === 'role'
            ? item.role
            : subKey === 'classroom_id'
              ? classrooms.find(c => String(c.id) === String(item.classroom_id))?.name
              : item[subKey];

        if (activeTab === 'staff' || activeTab === 'students') {
          title = `${item.first_name || ''} ${item.last_name || ''}`.trim();
        }

        return (
          <div
            key={item.id}
            onClick={() => setEditingItem(item)}
            style={{
              padding: '14px 18px',
              borderBottom: `1px solid ${rgba(UI.accent, 0.22)}`,
              cursor: 'pointer',
              backgroundColor: isActive ? UI.soft : '#fff',
              borderLeft: isActive ? `4px solid ${UI.secondary}` : '4px solid transparent'
            }}
          >
            <div style={{ fontWeight: 600, color: UI.text }}>{title}</div>
            {sub ? (
              <div style={{ fontSize: 12, color: UI.muted, marginTop: 4, fontWeight: 650 }}>
                {String(sub).replace('_', ' ')}
              </div>
            ) : null}
          </div>
        );
      });
  };

  const listTitle =
    activeTab === 'calendar' ? 'Weeks'
      : activeTab === 'curriculum' ? 'Curriculum'
        : activeTab.charAt(0).toUpperCase() + activeTab.slice(1);

  const showSearch = activeTab !== 'calendar';

  return (
    <div
      style={{
        display: 'flex',
        gap: 24,
        height: 'calc(100vh - 120px)',
        padding: '0 20px',
        fontFamily: THEME.sansFont
      }}
    >
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* LEFT NAV */}
      <Card style={{ width: 270, padding: '22px 0' }}>
        <div style={{ padding: '0 22px 14px 22px' }}>
          <h3 style={{ margin: 0, fontFamily: THEME.serifFont, color: UI.text, fontSize: 20, fontWeight: 900 }}>
            Configuration
          </h3>
          <div style={{ marginTop: 10, height: 1, background: rgba(UI.accent, 0.35) }} />
        </div>

        <div style={{ padding: '0 22px', marginTop: 14 }}>
          <FormLabel>Planning</FormLabel>
        </div>

        <TabButton
          active={activeTab === 'calendar'}
          label="School Calendar"
          icon={Calendar}
          onClick={() => { setActiveTab('calendar'); setEditingItem(null); setSearchTerm(''); }}
        />
        <TabButton
          active={activeTab === 'curriculum'}
          label="Curriculum"
          icon={BookOpen}
          onClick={() => { setActiveTab('curriculum'); setEditingItem(null); }}
        />

        <div style={{ height: 18 }} />

        <div style={{ padding: '0 22px' }}>
          <FormLabel>People & School</FormLabel>
        </div>

        <TabButton
          active={activeTab === 'students'}
          label="Students"
          icon={GraduationCap}
          onClick={() => { setActiveTab('students'); setEditingItem(null); }}
        />
        <TabButton
          active={activeTab === 'staff'}
          label="Staff"
          icon={Users}
          onClick={() => { setActiveTab('staff'); setEditingItem(null); }}
        />
        <TabButton
          active={activeTab === 'classrooms'}
          label="Classrooms"
          icon={BookOpen}
          onClick={() => { setActiveTab('classrooms'); setEditingItem(null); }}
        />
        <TabButton
          active={activeTab === 'schools'}
          label="Schools"
          icon={School}
          onClick={() => { setActiveTab('schools'); setEditingItem(null); }}
        />
      </Card>

      {/* MIDDLE LIST/TREE */}
      <Card style={{ width: 380, padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* Tip banner (kept but light) */}
        <div
          style={{
            backgroundColor: UI.soft,
            padding: '10px 14px',
            borderBottom: `1px solid ${rgba(UI.accent, 0.35)}`,
            display: 'flex',
            alignItems: 'center',
            gap: 10
          }}
        >
          <Info size={15} color={UI.primary} />
          <div style={{ fontSize: 12, color: UI.text, fontWeight: 750 }}>
            Select a row to edit.
          </div>
        </div>

        {/* Header */}
        <div style={{ padding: 16, borderBottom: `1px solid ${rgba(UI.accent, 0.25)}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 900, color: UI.text, fontFamily: THEME.serifFont }}>
                {listTitle}
              </div>
            </div>

            <button
              onClick={handleCreate}
              title="Add New"
              style={{
                backgroundColor: UI.primary,
                border: `2px solid #fff`,
                borderRadius: 999,
                width: 40,
                height: 40,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: `6px 6px 0px 0px ${UI.accent}`
              }}
            >
              <Plus size={18} color="#fff" />
            </button>
          </div>

          {showSearch && (
            <div style={{ position: 'relative', marginTop: 14 }}>
              <Search size={14} style={{ position: 'absolute', left: 12, top: 12, color: UI.muted }} />
              <input
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder={activeTab === 'curriculum' ? 'Search curriculum…' : 'Search…'}
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 34px',
                  borderRadius: 12,
                  border: `1px solid ${UI.line}`,
                  outline: 'none',
                  fontSize: 13,
                  color: UI.text
                }}
                onFocus={(e) => { e.target.style.borderColor = UI.primary; e.target.style.boxShadow = `0 0 0 4px ${UI.soft}`; }}
                onBlur={(e) => { e.target.style.borderColor = UI.line; e.target.style.boxShadow = 'none'; }}
              />
            </div>
          )}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', backgroundColor: '#fff' }}>
          {loading && (
            <div style={{ padding: 18, color: UI.muted, fontWeight: 700 }}>
              Loading…
            </div>
          )}

          {!loading && activeTab === 'calendar' && renderCalendarTree()}
          {!loading && activeTab === 'curriculum' && renderCurriculumTree()}

          {!loading && (activeTab !== 'calendar' && activeTab !== 'curriculum') && (
            renderGenericList(
              activeTab === 'students' ? students : activeTab === 'staff' ? profiles : activeTab === 'classrooms' ? classrooms : schools,
              activeTab === 'schools' ? 'name' : (activeTab === 'classrooms' ? 'name' : 'first_name'),
              activeTab === 'students' ? 'classroom_id' : (activeTab === 'staff' ? 'role' : 'address')
            )
          )}
        </div>
      </Card>

      {/* RIGHT EDITOR */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {editingItem ? (
          <Card style={{ height: '100%', padding: 34, overflowY: 'auto', position: 'relative' }}>
            <button
              onClick={() => setEditingItem(null)}
              style={{ position: 'absolute', right: 18, top: 18, border: 'none', background: 'none', cursor: 'pointer' }}
              title="Close"
            >
              <X color={rgba(UI.text, 0.4)} />
            </button>

            <div style={{ marginBottom: 22 }}>
              <TinyPill tone="secondary">
                {editingItem.id === 'NEW' ? 'Creating' : 'Editing'}
              </TinyPill>

              <h2
                style={{
                  margin: '12px 0 0 0',
                  fontFamily: THEME.serifFont,
                  fontSize: 32,
                  color: UI.text,
                  letterSpacing: '-0.02em'
                }}
              >
                {activeTab === 'calendar'
                  ? `Week ${editingItem.week_number ?? ''}`
                  : (editingItem.name || editingItem.first_name || 'New Item')}
              </h2>

              <div style={{ marginTop: 10, height: 1, background: rgba(UI.accent, 0.35) }} />
            </div>

            {/* Forms */}
            <div style={{ maxWidth: 560 }}>
              {activeTab === 'schools' && (
                <>
                  <FormLabel>School Name</FormLabel>
                  <StyledInput
                    value={editingItem.name || ''}
                    onChange={e => setEditingItem({ ...editingItem, name: e.target.value })}
                  />
                  <FormLabel>Address</FormLabel>
                  <StyledInput
                    value={editingItem.address || ''}
                    onChange={e => setEditingItem({ ...editingItem, address: e.target.value })}
                  />
                </>
              )}

              {activeTab === 'classrooms' && (
                <>
                  <FormLabel>Name</FormLabel>
                  <StyledInput
                    value={editingItem.name || ''}
                    onChange={e => setEditingItem({ ...editingItem, name: e.target.value })}
                  />
                  <FormLabel>School</FormLabel>
                  <StyledSelect
                    value={editingItem.school_id ?? ''}
                    onChange={e => setEditingItem({ ...editingItem, school_id: e.target.value })}
                  >
                    {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </StyledSelect>
                </>
              )}

              {activeTab === 'staff' && (
                <>
                  <div style={{ display: 'flex', gap: 16 }}>
                    <div style={{ flex: 1 }}>
                      <FormLabel>First Name</FormLabel>
                      <StyledInput
                        value={editingItem.first_name || ''}
                        onChange={e => setEditingItem({ ...editingItem, first_name: e.target.value })}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <FormLabel>Last Name</FormLabel>
                      <StyledInput
                        value={editingItem.last_name || ''}
                        onChange={e => setEditingItem({ ...editingItem, last_name: e.target.value })}
                      />
                    </div>
                  </div>

                  <FormLabel>Role</FormLabel>
                  <StyledSelect
                    value={editingItem.role || 'teacher'}
                    onChange={e => setEditingItem({ ...editingItem, role: e.target.value })}
                  >
                    <option value="teacher">Teacher</option>
                    <option value="admin">Admin</option>
                    <option value="parent">Parent</option>
                  </StyledSelect>

                  <FormLabel>Email</FormLabel>
                  <StyledInput
                    value={editingItem.email || ''}
                    onChange={e => setEditingItem({ ...editingItem, email: e.target.value })}
                    disabled={editingItem.id !== 'NEW'}
                  />

                  {editingItem.role === 'teacher' && editingItem.id !== 'NEW' && (
                    <div
                      style={{
                        marginTop: 16,
                        padding: 18,
                        backgroundColor: UI.soft,
                        borderRadius: 14,
                        border: `1px solid ${rgba(UI.accent, 0.45)}`
                      }}
                    >
                      <FormLabel>Assigned Classrooms</FormLabel>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 10 }}>
                        {classrooms.map(c => {
                          const isAssigned = userClassrooms.some(
                            uc => String(uc.user_id) === String(editingItem.id) && String(uc.classroom_id) === String(c.id)
                          );

                          return (
                            <div
                              key={c.id}
                              onClick={() => toggleTeacherClass(editingItem.id, c.id)}
                              style={{
                                padding: '8px 12px',
                                borderRadius: 999,
                                fontSize: 13,
                                cursor: 'pointer',
                                fontWeight: 600,
                                backgroundColor: isAssigned ? UI.primary : '#fff',
                                color: isAssigned ? '#fff' : UI.text,
                                border: `1px solid ${isAssigned ? UI.primary : rgba(UI.accent, 0.7)}`,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 8
                              }}
                            >
                              {c.name}
                              {isAssigned && <Check size={14} color="#fff" />}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}

              {activeTab === 'students' && (
                <>
                  <div style={{ display: 'flex', gap: 16 }}>
                    <div style={{ flex: 1 }}>
                      <FormLabel>First Name</FormLabel>
                      <StyledInput
                        value={editingItem.first_name || ''}
                        onChange={e => setEditingItem({ ...editingItem, first_name: e.target.value })}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <FormLabel>Last Name</FormLabel>
                      <StyledInput
                        value={editingItem.last_name || ''}
                        onChange={e => setEditingItem({ ...editingItem, last_name: e.target.value })}
                      />
                    </div>
                  </div>

                  <FormLabel>Classroom</FormLabel>
                  <StyledSelect
                    value={editingItem.classroom_id ?? ''}
                    onChange={e => setEditingItem({ ...editingItem, classroom_id: e.target.value })}
                  >
                    {classrooms.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </StyledSelect>

                  <div style={{ position: 'relative', marginTop: 6 }}>
                    <FormLabel>Parent Email (Login)</FormLabel>
                    <Mail size={16} style={{ position: 'absolute', right: 12, top: 32, color: UI.primary }} />
                    <StyledInput
                      value={editingItem.parent1_email || ''}
                      onChange={e => setEditingItem({ ...editingItem, parent1_email: e.target.value })}
                      style={{
                        border: `1px solid ${rgba(UI.secondary, 0.65)}`,
                        background: rgba(UI.secondary, 0.14),
                        fontWeight: 600
                      }}
                    />
                  </div>
                </>
              )}

              {activeTab === 'curriculum' && (
                <>
                  <FormLabel>Activity Name</FormLabel>
                  <StyledInput
                    value={editingItem.name || ''}
                    onChange={e => setEditingItem({ ...editingItem, name: e.target.value })}
                  />
                  <FormLabel>Category</FormLabel>
                  <StyledSelect
                    value={editingItem.category_id ?? ''}
                    onChange={e => setEditingItem({ ...editingItem, category_id: e.target.value })}
                  >
                    {currCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </StyledSelect>

                  <div style={{ fontSize: 12, color: UI.muted, display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, fontWeight: 750 }}>
                    <Check size={14} color={UI.primary} /> Official curriculum item
                  </div>
                </>
              )}

              {activeTab === 'calendar' && (
                <>
                  <div style={{ display: 'flex', gap: 16 }}>
                    <div style={{ width: 120 }}>
                      <FormLabel>Week #</FormLabel>
                      <StyledInput
                        type="number"
                        value={editingItem.week_number ?? ''}
                        onChange={e => setEditingItem({ ...editingItem, week_number: e.target.value })}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <FormLabel>Date Range</FormLabel>
                      <StyledInput
                        value={editingItem.date_range || ''}
                        placeholder="e.g. Sep 8 – 12"
                        onChange={e => setEditingItem({ ...editingItem, date_range: e.target.value })}
                      />
                    </div>
                  </div>

                  <FormLabel>Primary Theme</FormLabel>
                  <StyledInput
                    value={editingItem.theme || ''}
                    onChange={e => setEditingItem({ ...editingItem, theme: e.target.value })}
                  />

                  <FormLabel>Term</FormLabel>
                  <StyledSelect
                    value={editingItem.term_name || 'Term 1'}
                    onChange={e => setEditingItem({ ...editingItem, term_name: e.target.value })}
                  >
                    <option>Term 1</option>
                    <option>Term 2</option>
                    <option>Term 3</option>
                  </StyledSelect>
                </>
              )}
            </div>

            {/* Save */}
            <div
              style={{
                marginTop: 26,
                paddingTop: 18,
                borderTop: `1px solid ${rgba(UI.accent, 0.25)}`,
                display: 'flex',
                justifyContent: 'flex-end'
              }}
            >
              <button
                onClick={handleSave}
                disabled={isSaving}
                style={{
                  backgroundColor: UI.primary,
                  color: '#fff',
                  border: 'none',
                  padding: '12px 22px',
                  borderRadius: 999,
                  fontWeight: 900,
                  fontSize: 14,
                  cursor: isSaving ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  boxShadow: `6px 6px 0px 0px ${UI.accent}`,
                  opacity: isSaving ? 0.9 : 1
                }}
              >
                {isSaving ? <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={18} />}
                {isSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </Card>
        ) : (
          // ✅ simplified empty state
          <Card style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center', padding: 22 }}>
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 999,
                  backgroundColor: rgba(UI.secondary, 0.18),
                  border: `1px solid ${rgba(UI.secondary, 0.35)}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 14px'
                }}
              >
                <span style={{ fontSize: 22, fontWeight: 900, color: UI.primary }}>✎</span>
              </div>

              <div style={{ fontFamily: THEME.serifFont, fontSize: 22, fontWeight: 900, color: UI.text }}>
              </div>
              <div style={{ marginTop: 8, fontSize: 13, color: UI.muted, fontWeight: 650 }}>
                Click on the + button to add a new item.
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}