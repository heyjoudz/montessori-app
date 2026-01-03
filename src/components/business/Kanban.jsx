import { useEffect, useMemo, useState } from 'react';
import { THEME, getStatusStyle, getSubjectStyle } from '../../ui/theme';
import { getNormalizedItem, formatStudentName, safeDate } from '../../utils/helpers';
import Card from '../ui/Card';

// Helper to lighten/tint colors
const getTint = (color, opacity = 0.12) => {
  if (!color) return 'rgba(0,0,0,0.05)';
  let c = color;
  if (c.startsWith('#')) {
    c = c.substring(1);
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    const r = parseInt(c.substr(0, 2), 16);
    const g = parseInt(c.substr(2, 2), 16);
    const b = parseInt(c.substr(4, 2), 16);
    return `rgba(${r},${g},${b},${opacity})`;
  }
  return color; // Fallback if not hex
};

function GroupHeader({ label, count, color, open, onToggle, variant = 'primary' }) {
  const isSecondary = variant === 'secondary';
  const displayColor = color || '#ccc';
  const shadowColor = getTint(displayColor, 0.25); // Hard shadow color
  const bgTint = getTint(displayColor, 0.04);

  // --- NEW BOX STYLE ---
  // Primary (Areas): Top Border + Hard Shadow + Sharp
  // Secondary (Categories): Clean Box + Left Border Indicator + Sharp
  const style = isSecondary
    ? {
        // Secondary Style (Category)
        padding: '8px 10px',
        border: '1px solid #eee',
        borderLeft: `3px solid ${displayColor}`, // Keep a subtle left indicator for hierarchy
        background: '#fff',
        borderRadius: 4,
        marginBottom: 8,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        cursor: 'pointer'
      }
    : {
        // Primary Style (Area) - Matches "Suggested" cards
        padding: '10px 12px',
        border: '1px solid #eee',
        borderTop: `4px solid ${displayColor}`,
        boxShadow: `3px 3px 0px 0px ${shadowColor}`,
        background: '#fff',
        borderRadius: 4,
        marginBottom: 0, // Margin handled by container grid
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        cursor: 'pointer'
      };

  return (
    <div onClick={onToggle} style={style}>
      <div
        style={{
          fontWeight: isSecondary ? 700 : 850,
          color: THEME.text,
          fontSize: isSecondary ? 11.5 : 12,
          textTransform: isSecondary ? 'none' : 'uppercase',
          letterSpacing: isSecondary ? 0 : 0.5
        }}
      >
        {label}
      </div>
      <div style={{ fontWeight: 800, color: THEME.textMuted, fontSize: 11 }}>
        {count} {open ? '−' : '+'}
      </div>
    </div>
  );
}

// Chip for a Student (Dashboard View)
function StudentChip({ label, count = 1, onClick, onDelete }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        border: '1px solid rgba(0,0,0,0.08)',
        background: '#fff',
        padding: '4px 8px',
        cursor: 'pointer',
        fontWeight: 600,
        fontSize: 11,
        borderRadius: 4 // Sharper radius
      }}
      onClick={onClick}
      title={count > 1 ? `${count} entries` : 'Open'}
    >
      <span>{label}</span>
      {count > 1 && <span style={{ fontSize: 10, fontWeight: 800, color: THEME.textMuted }}>×{count}</span>}
      {onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontWeight: 900, color: '#e57373', marginLeft: 2 }}
          title="Delete"
        >
          ×
        </button>
      )}
    </div>
  );
}

export default function KanbanColumn({
  status,
  items,
  students,
  classrooms,
  selectedClassroomId = null,
  expandAction,
  onEditItem,
  onDeleteItem,
  mode = 'DASHBOARD',
  columnLabelOverride,
  onQuickAdd,
  currMeta
}) {
  const safeStatus = status || '';

  const FORCED_STATUS = {
    W: { accent: THEME?.brandYellow || '#F0BB6B', headerBg: '#fff', panelBg: '#fff' },
    P: { accent: THEME?.brandPrimary || '#0A355C', headerBg: '#fff', panelBg: '#fff' },
    A: { accent: THEME?.brandSalmon || '#FFB6A3', headerBg: '#fff', panelBg: '#fff' },
    M: { accent: THEME?.brandTeal || '#5E9494', headerBg: '#fff', panelBg: '#fff' }
  };

  const fromTheme = getStatusStyle?.(safeStatus) || {};
  const forced = FORCED_STATUS[safeStatus] || {};
  const statusMeta = { ...fromTheme, ...forced };

  const statusLabel =
    safeStatus === 'W' ? 'Practicing'
    : safeStatus === 'P' ? 'To Present'
    : safeStatus === 'A' ? 'Next Month Aim'
    : safeStatus === 'M' ? 'Mastered'
    : safeStatus || 'Items';

  const headerLabel = (columnLabelOverride ?? statusLabel) || 'Items';

  const studentById = useMemo(() => {
    const m = new Map();
    (students || []).forEach((s) => m.set(String(s.id), s));
    return m;
  }, [students]);

  const classById = useMemo(() => {
    const m = new Map();
    (classrooms || []).forEach((c, idx) => {
      const color =
        THEME?.classroomColors?.[idx % (THEME?.classroomColors?.length || 1)] || THEME.brandAccent;
      m.set(String(c.id), { ...c, __color: color });
    });
    return m;
  }, [classrooms]);

  const normKey = (v) => String(v || '').toLowerCase().replace(/\s+/g, ' ').trim();

  // State for expands
  const [openMap, setOpenMap] = useState({});

  useEffect(() => {
    if (!expandAction?.type) return;
    setOpenMap((prev) => ({ ...prev, __ALL__: expandAction.type === 'EXPAND' }));
  }, [expandAction?.ts]);

  const isOpen = (key, defaultOpen = false) => {
    if (openMap[key] !== undefined) return !!openMap[key];
    if (openMap.__ALL__ !== undefined) return !!openMap.__ALL__;
    return defaultOpen;
  };

  const toggle = (key) => setOpenMap((p) => ({ ...p, [key]: !isOpen(key) }));

  // --- 1. DASHBOARD TREE (Multi Student) ---
  const dashboardTree = useMemo(() => {
    if (mode === 'SINGLE_STUDENT') return null;

    const root = new Map();
    const useClassGrouping =
      !selectedClassroomId &&
      new Set((items || []).map((x) => String(x.classroom_id))).size > 1;

    const getClassNode = (classId) => {
      const k = useClassGrouping ? String(classId || 'NOCLASS') : '__SINGLE_CLASS__';
      if (!root.has(k)) {
        const cls = classById.get(String(classId || '')) || { name: 'Unassigned', __color: '#eee' };
        root.set(k, { key: k, label: useClassGrouping ? (cls?.name || 'Unassigned') : null, color: cls.__color, areas: new Map(), count: 0 });
      }
      return root.get(k);
    };

    const ensure = (map, key, init) => {
      if (!map.has(key)) map.set(key, init());
      return map.get(key);
    };

    (items || []).forEach((it) => {
      const norm = getNormalizedItem(it);
      const areaLabel = (norm.area || 'General').trim() || 'General';
      const areaKey = normKey(areaLabel);
      
      const catLabel = (it.curriculum_categories?.name || it.category || 'Uncategorized').trim();
      const catKey = normKey(catLabel);
      
      const activityLabel = (norm.title || it.activity || 'Activity').trim() || 'Activity';
      const actKey = normKey(activityLabel);
      
      const subLabel = (norm.rawActivity || it.raw_activity || '').trim();
      const subKey = subLabel ? normKey(subLabel) : '__nosub__';
      const displaySubLabel = subLabel || activityLabel;

      const classNode = getClassNode(it.classroom_id);
      classNode.count += 1;

      const areaNode = ensure(classNode.areas, areaKey, () => ({ key: areaKey, label: areaLabel, categories: new Map(), count: 0 }));
      areaNode.count += 1;

      const catNode = ensure(areaNode.categories, catKey, () => ({ key: catKey, label: catLabel, subs: new Map(), count: 0 }));
      catNode.count += 1;

      const uniqueSubKey = `${actKey}_${subKey}`;
      const subNode = ensure(catNode.subs, uniqueSubKey, () => ({ 
          key: uniqueSubKey, 
          label: displaySubLabel,
          parentActivity: activityLabel,
          students: new Map(), 
          count: 0 
      }));
      subNode.count += 1;

      const sid = String(it.student_id || '');
      const stu = studentById.get(sid);
      const stuLabel = stu ? formatStudentName(stu) : 'Unknown';

      if (!subNode.students.has(sid)) subNode.students.set(sid, { id: sid, label: stuLabel, items: [] });
      subNode.students.get(sid).items.push(it);
    });

    const toSorted = (map, sorter) => Array.from(map.values()).sort(sorter);
    const classNodes = toSorted(root, (a, b) => (a.label || '').localeCompare(b.label || ''));

    classNodes.forEach((c) => {
      c.areasArr = toSorted(c.areas, (a, b) => a.label.localeCompare(b.label));
      c.areasArr.forEach((a) => {
        a.categoriesArr = toSorted(a.categories, (x, y) => x.label.localeCompare(y.label));
        a.categoriesArr.forEach((cat) => {
             cat.subsArr = toSorted(cat.subs, (x, y) => x.label.localeCompare(y.label));
             cat.subsArr.forEach((sub) => {
               sub.studentsArr = Array.from(sub.students.values()).sort((x, y) => x.label.localeCompare(y.label));
             });
        });
      });
    });

    return { useClassGrouping, classNodes };
  }, [items, mode, selectedClassroomId, classById, studentById]);

  // --- 2. SINGLE STUDENT TREE (Area -> Items) [FLATTENED] ---
  const singleStudentTree = useMemo(() => {
    if (mode !== 'SINGLE_STUDENT') return null;

    const ensure = (map, key, init) => {
        if (!map.has(key)) map.set(key, init());
        return map.get(key);
    };

    const root = new Map(); // Areas

    (items || []).forEach(it => {
        const norm = getNormalizedItem(it);
        const areaLabel = (norm.area || 'General').trim() || 'General';
        const areaKey = normKey(areaLabel);
        
        const areaNode = ensure(root, areaKey, () => ({ key: areaKey, label: areaLabel, items: [], count: 0 }));
        areaNode.count++;
        
        areaNode.items.push(it);
    });

    const toSorted = (map, sorter) => Array.from(map.values()).sort(sorter);
    
    const areaNodes = toSorted(root, (a,b) => a.label.localeCompare(b.label));
    areaNodes.forEach(a => {
        a.items.sort((x, y) => {
            const nx = getNormalizedItem(x);
            const ny = getNormalizedItem(y);
            const tx = nx.rawActivity || nx.title || '';
            const ty = ny.rawActivity || ny.title || '';
            return tx.localeCompare(ty);
        });
    });

    return areaNodes;

  }, [items, mode]);


  // ---------------- RENDER ----------------

  return (
    <Card
      style={{
        padding: 0,
        overflow: 'hidden',
        // Update: Ensure the main column card is also sharp to match
        borderRadius: 8, 
        borderTop: `6px solid ${statusMeta?.accent || THEME.brandSecondary}`,
        background: statusMeta?.panelBg || '#fff'
      }}
    >
      <div
        style={{
          padding: '12px 14px',
          borderBottom: '1px solid rgba(0,0,0,0.06)',
          background: statusMeta?.headerBg || '#fff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 10
        }}
      >
        <div style={{ fontWeight: 850, fontSize: 13, color: THEME.text }}>{headerLabel}</div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {onQuickAdd && (
            <button
              onClick={onQuickAdd}
              title="Add activity"
              style={{
                height: 32, padding: '0 12px', borderRadius: 999, border: '1px solid rgba(0,0,0,0.12)',
                background: '#fff', cursor: 'pointer', fontWeight: 900, color: THEME.text,
                display: 'inline-flex', alignItems: 'center', gap: 8
              }}
            >
              <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
              <span style={{ fontSize: 12 }}>Add</span>
            </button>
          )}
          <div style={{ fontSize: 12, fontWeight: 850, color: THEME.textMuted }}>{(items || []).length}</div>
        </div>
      </div>

      <div style={{ padding: 12 }}>
        {(items || []).length === 0 && (
          <div style={{ padding: 12, border: '1px dashed #ddd', background: '#fff', color: '#999', fontWeight: 700, fontSize: 13, borderRadius: 4 }}>
            No items.
          </div>
        )}

        {/* --- DASHBOARD VIEW (Multi Student) --- */}
        {mode !== 'SINGLE_STUDENT' &&
          dashboardTree?.classNodes?.map((cls) => {
            const clsKey = `cls:${safeStatus}:${cls.key}`;
            const openCls = !dashboardTree.useClassGrouping ? true : isOpen(clsKey, true);

            return (
              <div key={cls.key} style={{ marginBottom: 10 }}>
                {dashboardTree.useClassGrouping && (
                  <GroupHeader label={cls.label || 'Unassigned'} count={cls.count} color={cls.color} open={openCls} onToggle={() => toggle(clsKey)} />
                )}
                {openCls && (
                  <div style={{ paddingLeft: dashboardTree.useClassGrouping ? 10 : 0, display: 'grid', gap: 14, marginTop: 10 }}>
                    {cls.areasArr.map((area) => {
                      const subj = getSubjectStyle(area.label);
                      const areaKey = `area:${safeStatus}:${cls.key}:${area.key}`;
                      const openArea = isOpen(areaKey, false);

                      return (
                        <div key={area.key} style={{ borderRadius: 4 }}>
                          <GroupHeader 
                            label={area.label} 
                            count={area.count} 
                            color={subj.border} 
                            open={openArea} 
                            onToggle={() => toggle(areaKey)} 
                            variant="primary"
                          />

                          {openArea && (
                            <div style={{ padding: '8px 0 0 0', display: 'grid', gap: 8 }}>
                              {area.categoriesArr.map((cat) => {
                                const catKey = `cat:${safeStatus}:${cls.key}:${area.key}:${cat.key}`;
                                const openCat = isOpen(catKey, true);
                                return (
                                  <div key={cat.key}>
                                    <GroupHeader 
                                      label={cat.label} 
                                      count={cat.count} 
                                      color={subj.border} 
                                      open={openCat} 
                                      onToggle={() => toggle(catKey)} 
                                      variant="secondary"
                                    />
                                    
                                    {openCat && (
                                      <div style={{ paddingLeft: 4, display: 'grid', gap: 8 }}>
                                        {cat.subsArr.map((sub) => {
                                            const subKey = `sub:${safeStatus}:${cls.key}:${area.key}:${cat.key}:${sub.key}`;
                                            const openSub = isOpen(subKey, false); // Students collapsed by default
                                            const studentCount = sub.studentsArr.length;

                                            return (
                                                <div key={sub.key} style={{ background: '#fff', border: '1px solid #eee', borderRadius: 4, padding: '8px 10px', boxShadow:'0 1px 2px rgba(0,0,0,0.02)' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                                                      <div>
                                                        <div style={{ fontWeight: 700, fontSize: 12, color: THEME.text, lineHeight: 1.3 }}>{sub.label}</div>
                                                        {sub.parentActivity && sub.parentActivity !== sub.label && (
                                                          <div style={{ fontSize: 10, color: THEME.textMuted, marginTop: 2 }}>{sub.parentActivity}</div>
                                                        )}
                                                      </div>
                                                      <div 
                                                        onClick={() => toggle(subKey)}
                                                        style={{ 
                                                          fontSize: 10, fontWeight: 800, 
                                                          color: openSub ? THEME.textMuted : THEME.brandPrimary,
                                                          background: openSub ? '#f5f5f5' : 'rgba(10,53,92,0.06)',
                                                          padding: '2px 6px', borderRadius: 4, cursor: 'pointer',
                                                          whiteSpace: 'nowrap'
                                                        }}
                                                      >
                                                        {studentCount} student{studentCount !== 1 ? 's' : ''} {openSub ? '▲' : '▼'}
                                                      </div>
                                                    </div>

                                                    {/* Student List */}
                                                    {openSub && (
                                                      <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed #eee', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                                          {sub.studentsArr.map(s => (
                                                              <StudentChip 
                                                                  key={s.id} 
                                                                  label={s.label} 
                                                                  count={s.items.length} 
                                                                  onClick={() => s.items[0] && onEditItem?.(s.items[0])}
                                                                  onDelete={() => s.items[0] && onDeleteItem?.(s.items[0].id)} 
                                                              />
                                                          ))}
                                                      </div>
                                                    )}
                                                </div>
                                            )
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
              </div>
            );
          })}
        
        {/* --- SINGLE STUDENT VIEW (Area -> Items) [FLATTENED & BULLETS] --- */}
        {mode === 'SINGLE_STUDENT' && singleStudentTree?.map(area => {
             const subj = getSubjectStyle(area.label);
             const areaKey = `ss:area:${safeStatus}:${area.key}`;
             const openArea = isOpen(areaKey, false);

             return (
                <div key={area.key} style={{ marginBottom: 12 }}>
                     <GroupHeader 
                        label={area.label} 
                        count={area.count} 
                        color={subj.border} 
                        open={openArea} 
                        onToggle={() => toggle(areaKey)} 
                        variant="primary"
                      />
                      
                    {openArea && (
                        <div style={{ padding: '8px 4px', background: '#fff', borderLeft: `1px solid ${subj.border}`, marginLeft: 12 }}>
                           {area.items.map(it => {
                              const norm = getNormalizedItem(it);
                              const displayName = norm.rawActivity || norm.title || 'Untitled';
                              
                              return (
                                <div key={it.id} style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 8, paddingLeft: 8 }}>
                                   <div style={{ color: THEME.brandPrimary, fontSize: 14, lineHeight: 1, marginRight: 8, marginTop: 2 }}>•</div>
                                   <div style={{ flex: 1 }}>
                                      <div 
                                        onClick={() => onEditItem?.(it)}
                                        style={{ 
                                           cursor: 'pointer', 
                                           fontSize: 13, 
                                           fontWeight: 400,
                                           color: THEME.text,
                                           lineHeight: 1.4
                                        }}
                                      >
                                         {displayName}
                                      </div>
                                   </div>
                                   {onDeleteItem && (
                                     <button
                                        onClick={(e) => { e.stopPropagation(); onDeleteItem(it.id); }}
                                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#e57373', fontSize: 16, lineHeight: 1, padding: '0 4px', marginLeft: 4 }}
                                        title="Delete"
                                      >
                                        ×
                                      </button>
                                   )}
                                </div>
                              )
                           })}
                        </div>
                    )}
                </div>
             )
        })}

      </div>
    </Card>
  );
}