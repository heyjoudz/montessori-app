import { useEffect, useMemo, useState } from 'react';
import { THEME, getStatusStyle, getSubjectStyle } from '../../ui/theme';
import { getNormalizedItem, formatStudentName, safeDate } from '../../utils/helpers';
import Card from '../ui/Card';

/**
 * KanbanColumn
 * Supports:
 *  - DASHBOARD: Class → Area → Category → Activity → Sub-activity → Students
 *  - SINGLE_STUDENT: Area → Category → Sub-activity (teacher bullet) only
 *
 * Design updates:
 *  - Forced status colors: W = yellow, P/A = 2 blues
 *  - Compact rows in SINGLE_STUDENT + pencil action
 *  - Optional pencil at area header (SINGLE_STUDENT)
 */
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
  columnLabelOverride
}) {
  const safeStatus = status || '';

  // --- force the column palette (so we get: W yellow, P/A two blues)
  const FORCED_STATUS = {
    W: {
      accent: THEME?.brandSecondary || '#F0BB6B',     // yellow
      headerBg: '#FFF7E6',
      panelBg: '#FFFCF4'
    },
    P: {
      accent: THEME?.brandPrimary || '#0A355C',       // deep blue
      headerBg: '#EEF5FF',
      panelBg: '#F7FBFF'
    },
    A: {
      accent: '#4B7FB8',                              // lighter blue
      headerBg: '#F0F7FF',
      panelBg: '#FAFCFF'
    },
    M: {
      accent: THEME?.brandTeal || '#5E9494',
      headerBg: '#EAF7F6',
      panelBg: '#F7FFFE'
    }
  };

  const fromTheme = getStatusStyle?.(safeStatus) || {};
  const forced = FORCED_STATUS[safeStatus] || {};
  const statusMeta = { ...forced, ...fromTheme }; // theme can override if you want later

  const statusLabel =
    safeStatus === 'W'
      ? 'Practicing'
      : safeStatus === 'P'
      ? 'To Present'
      : safeStatus === 'A'
      ? 'Next Month Aim'
      : safeStatus === 'M'
      ? 'Mastered'
      : safeStatus
      ? String(safeStatus)
      : 'Items';

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

  // --- Expand/collapse state (no regression)
  const [openMap, setOpenMap] = useState({}); // key -> boolean, plus __ALL__

  useEffect(() => {
    if (!expandAction?.type) return;
    setOpenMap((prev) => ({ ...prev, __ALL__: expandAction.type === 'EXPAND' }));
  }, [expandAction?.ts]); // intentional

  const isOpen = (key, defaultOpen = false) => {
    if (openMap[key] !== undefined) return !!openMap[key]; // per-key wins
    if (openMap.__ALL__ !== undefined) return !!openMap.__ALL__;
    return defaultOpen;
  };

  const toggle = (key) => setOpenMap((p) => ({ ...p, [key]: !isOpen(key) }));

  // ---- DASHBOARD tree
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
        root.set(k, {
          key: k,
          label: useClassGrouping ? (cls?.name || 'Unassigned') : null,
          color: cls.__color,
          areas: new Map(),
          count: 0
        });
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

      const catLabel =
        (it.curriculum_categories?.name || '').trim() ||
        (it.category || '').trim() ||
        'Uncategorized';
      const catKey = normKey(catLabel);

      const activityLabel = (norm.title || it.activity || 'Activity').trim() || 'Activity';
      const actKey = normKey(activityLabel);

      const subLabel = (norm.rawActivity || it.raw_activity || '').trim() || '—';
      const subKey = normKey(subLabel);

      const classNode = getClassNode(it.classroom_id);
      classNode.count += 1;

      const areaNode = ensure(classNode.areas, areaKey, () => ({
        key: areaKey,
        label: areaLabel,
        categories: new Map(),
        count: 0
      }));
      areaNode.count += 1;

      const catNode = ensure(areaNode.categories, catKey, () => ({
        key: catKey,
        label: catLabel,
        activities: new Map(),
        count: 0
      }));
      catNode.count += 1;

      const actNode = ensure(catNode.activities, actKey, () => ({
        key: actKey,
        label: activityLabel,
        subs: new Map(),
        count: 0
      }));
      actNode.count += 1;

      const subNode = ensure(actNode.subs, subKey, () => ({
        key: subKey,
        label: subLabel,
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
          cat.activitiesArr = toSorted(cat.activities, (x, y) => x.label.localeCompare(y.label));
          cat.activitiesArr.forEach((act) => {
            act.subsArr = toSorted(act.subs, (x, y) => x.label.localeCompare(y.label));
            act.subsArr.forEach((sub) => {
              sub.studentsArr = Array.from(sub.students.values()).sort((x, y) => x.label.localeCompare(y.label));
            });
          });
        });
      });
    });

    return { useClassGrouping, classNodes };
  }, [items, mode, selectedClassroomId, classById, studentById]);

  // ---- SINGLE STUDENT tree
  const studentTree = useMemo(() => {
    if (mode !== 'SINGLE_STUDENT') return null;

    const root = new Map();
    const ensure = (map, key, init) => {
      if (!map.has(key)) map.set(key, init());
      return map.get(key);
    };

    (items || []).forEach((it) => {
      const norm = getNormalizedItem(it);

      const areaLabel = (norm.area || 'General').trim() || 'General';
      const areaKey = normKey(areaLabel);

      const catLabel =
        (it.curriculum_categories?.name || '').trim() ||
        (it.category || '').trim() ||
        'Uncategorized';
      const catKey = normKey(catLabel);

      const subLabel =
        (norm.rawActivity || it.raw_activity || '').trim() ||
        (norm.title || it.activity || '—');
      const subKey = normKey(subLabel);

      const areaNode = ensure(root, areaKey, () => ({
        key: areaKey,
        label: areaLabel,
        categories: new Map(),
        count: 0
      }));
      areaNode.count += 1;

      const catNode = ensure(areaNode.categories, catKey, () => ({
        key: catKey,
        label: catLabel,
        subs: new Map(),
        count: 0
      }));
      catNode.count += 1;

      const subNode = ensure(catNode.subs, subKey, () => ({
        key: subKey,
        label: subLabel,
        items: [],
        count: 0
      }));
      subNode.count += 1;
      subNode.items.push(it);
    });

    const toSorted = (map, sorter) => Array.from(map.values()).sort(sorter);

    const areasArr = toSorted(root, (a, b) => a.label.localeCompare(b.label));
    areasArr.forEach((a) => {
      a.categoriesArr = toSorted(a.categories, (x, y) => x.label.localeCompare(y.label));
      a.categoriesArr.forEach((cat) => {
        cat.subsArr = toSorted(cat.subs, (x, y) => x.label.localeCompare(y.label));
      });
    });

    return { areasArr };
  }, [items, mode]);

  return (
    <Card
      style={{
        padding: 0,
        overflow: 'hidden',
        borderTop: `4px solid ${statusMeta?.accent || THEME.brandSecondary}`,
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
          alignItems: 'baseline'
        }}
      >
        <div style={{ fontWeight: 800, fontSize: 13, color: THEME.text }}>{headerLabel}</div>
        <div style={{ fontSize: 12, fontWeight: 800, color: THEME.textMuted }}>{(items || []).length}</div>
      </div>

      <div style={{ padding: 12 }}>
        {(items || []).length === 0 && (
          <div style={{ padding: 12, border: '1px dashed #ddd', background: '#fff', color: '#999', fontWeight: 700, fontSize: 13 }}>
            No items.
          </div>
        )}

        {/* DASHBOARD MODE */}
        {mode !== 'SINGLE_STUDENT' &&
          dashboardTree?.classNodes?.map((cls) => {
            const clsKey = `cls:${safeStatus}:${cls.key}`;
            const openCls = !dashboardTree.useClassGrouping ? true : isOpen(clsKey, false);

            return (
              <div key={cls.key} style={{ marginBottom: 10 }}>
                {dashboardTree.useClassGrouping && (
                  <GroupHeader
                    label={cls.label || 'Unassigned'}
                    count={cls.count}
                    color={cls.color}
                    open={openCls}
                    onToggle={() => toggle(clsKey)}
                  />
                )}

                {openCls && (
                  <div style={{ paddingLeft: dashboardTree.useClassGrouping ? 10 : 0, display: 'grid', gap: 8, marginTop: 8 }}>
                    {cls.areasArr.map((area) => {
                      const subj = getSubjectStyle(area.label);
                      const areaKey = `area:${safeStatus}:${cls.key}:${area.key}`;
                      const openArea = isOpen(areaKey, false);

                      return (
                        <div key={area.key} style={{ border: `1px solid ${subj.border}`, background: '#fff', borderRadius: 12, overflow: 'hidden' }}>
                          <div
                            onClick={() => toggle(areaKey)}
                            style={{
                              cursor: 'pointer',
                              padding: '10px 12px',
                              background: subj.bg,
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center'
                            }}
                          >
                            <div style={{ fontWeight: 800, color: subj.text, fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase' }}>
                              {area.label}
                            </div>
                            <div style={{ fontSize: 12, fontWeight: 800, color: THEME.textMuted }}>
                              {area.count} {openArea ? '−' : '+'}
                            </div>
                          </div>

                          {openArea && (
                            <div style={{ padding: 10, display: 'grid', gap: 10 }}>
                              {area.categoriesArr.map((cat) => {
                                const catKey = `cat:${safeStatus}:${cls.key}:${area.key}:${cat.key}`;
                                const openCat = isOpen(catKey, false);

                                return (
                                  <div key={cat.key} style={{ border: '1px solid #eee', background: '#fff', borderRadius: 10, overflow: 'hidden' }}>
                                    <div
                                      onClick={() => toggle(catKey)}
                                      style={{
                                        cursor: 'pointer',
                                        padding: '9px 10px',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center'
                                      }}
                                    >
                                      <div style={{ fontWeight: 800, fontSize: 12, color: THEME.text }}>{cat.label}</div>
                                      <div style={{ fontSize: 12, fontWeight: 800, color: THEME.textMuted }}>
                                        {cat.count} {openCat ? '−' : '+'}
                                      </div>
                                    </div>

                                    {openCat && (
                                      <div style={{ padding: 10, display: 'grid', gap: 10 }}>
                                        {cat.activitiesArr.map((act) => {
                                          const actKey = `act:${safeStatus}:${cls.key}:${area.key}:${cat.key}:${act.key}`;
                                          const openAct = isOpen(actKey, false);

                                          return (
                                            <div key={act.key} style={{ border: '1px solid #f0f0f0', background: '#fff', borderRadius: 10, overflow: 'hidden' }}>
                                              <div
                                                onClick={() => toggle(actKey)}
                                                style={{
                                                  cursor: 'pointer',
                                                  padding: '9px 10px',
                                                  display: 'flex',
                                                  justifyContent: 'space-between',
                                                  alignItems: 'center'
                                                }}
                                              >
                                                <div style={{ fontWeight: 700, fontSize: 12, color: THEME.text }}>{act.label}</div>
                                                <div style={{ fontSize: 12, fontWeight: 800, color: THEME.textMuted }}>
                                                  {act.count} {openAct ? '−' : '+'}
                                                </div>
                                              </div>

                                              {openAct && (
                                                <div style={{ padding: 10, display: 'grid', gap: 10 }}>
                                                  {act.subsArr.map((sub) => (
                                                    <div key={sub.key} style={{ border: '1px solid #eee', background: '#fafafa', padding: 10, borderRadius: 10 }}>
                                                      <div style={{ fontWeight: 800, fontSize: 12, color: THEME.text }}>{sub.label}</div>

                                                      <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                                        {sub.studentsArr.map((s) => {
                                                          const it = s.items?.[0];
                                                          const dup = (s.items || []).length;
                                                          return (
                                                            <StudentChip
                                                              key={s.id}
                                                              label={s.label}
                                                              count={dup}
                                                              onClick={() => it && onEditItem?.(it)}
                                                              onDelete={() => it && onDeleteItem?.(it.id)}
                                                            />
                                                          );
                                                        })}
                                                      </div>
                                                    </div>
                                                  ))}
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
                  </div>
                )}
              </div>
            );
          })}

        {/* SINGLE STUDENT MODE (compact rows + pencil) */}
        {mode === 'SINGLE_STUDENT' &&
          studentTree?.areasArr?.map((area) => {
            const subj = getSubjectStyle(area.label);
            const areaKey = `stuArea:${safeStatus}:${area.key}`;
            const openArea = isOpen(areaKey, false);

            const firstAreaItem =
              area?.categoriesArr?.[0]?.subsArr?.[0]?.items?.[0] ||
              area?.categoriesArr?.[0]?.subsArr?.[0]?.items?.[0] ||
              null;

            return (
              <div key={area.key} style={{ border: `1px solid ${subj.border}`, background: '#fff', marginBottom: 10, borderRadius: 12, overflow: 'hidden' }}>
                <div
                  onClick={() => toggle(areaKey)}
                  style={{
                    cursor: 'pointer',
                    padding: '10px 12px',
                    background: subj.bg,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 10
                  }}
                >
                  <div style={{ fontWeight: 800, color: subj.text, fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase' }}>
                    {area.label}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {/* tiny pencil at AREA level */}
                    {firstAreaItem && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditItem?.(firstAreaItem);
                        }}
                        style={iconBtnStyle}
                        title="Edit (area)"
                        aria-label="Edit area items"
                      >
                        <PencilIcon />
                      </button>
                    )}

                    <div style={{ fontSize: 12, fontWeight: 800, color: THEME.textMuted }}>
                      {area.count} {openArea ? '−' : '+'}
                    </div>
                  </div>
                </div>

                {openArea && (
                  <div style={{ padding: 10, display: 'grid', gap: 10 }}>
                    {area.categoriesArr.map((cat) => {
                      const catKey = `stuCat:${safeStatus}:${area.key}:${cat.key}`;
                      const openCat = isOpen(catKey, false);

                      return (
                        <div key={cat.key} style={{ border: '1px solid #eee', background: '#fff', borderRadius: 10, overflow: 'hidden' }}>
                          <div
                            onClick={() => toggle(catKey)}
                            style={{
                              cursor: 'pointer',
                              padding: '9px 10px',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center'
                            }}
                          >
                            <div style={{ fontWeight: 800, fontSize: 12, color: THEME.text }}>{cat.label}</div>
                            <div style={{ fontSize: 12, fontWeight: 800, color: THEME.textMuted }}>
                              {cat.count} {openCat ? '−' : '+'}
                            </div>
                          </div>

                          {openCat && (
                            <div style={{ padding: 10, display: 'grid', gap: 8 }}>
                              {cat.subsArr.map((sub) => {
                                const firstItem = sub.items?.[0];
                                if (!firstItem) return null;

                                return (
                                  <div key={sub.key} style={rowStyle}>
                                    <div
                                      onClick={() => onEditItem?.(firstItem)}
                                      style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
                                      title="Open"
                                    >
                                      <div style={{ fontWeight: 700, fontSize: 12, color: THEME.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {sub.label}
                                      </div>
                                      <div style={{ marginTop: 2, fontSize: 11, fontWeight: 700, color: THEME.textMuted }}>
                                        {sub.items?.length || 0} item(s)
                                        {firstItem?.planning_date ? ` • ${safeDate(firstItem.planning_date)}` : ''}
                                      </div>
                                    </div>

                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onEditItem?.(firstItem);
                                      }}
                                      style={iconBtnStyle}
                                      title="Edit"
                                      aria-label="Edit"
                                    >
                                      <PencilIcon />
                                    </button>

                                    {onDeleteItem && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onDeleteItem?.(firstItem.id);
                                        }}
                                        style={{ ...iconBtnStyle, color: '#C0392B' }}
                                        title="Delete"
                                        aria-label="Delete"
                                      >
                                        <TrashIcon />
                                      </button>
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
      </div>
    </Card>
  );
}

function GroupHeader({ label, count, color, open, onToggle }) {
  return (
    <div
      onClick={onToggle}
      style={{
        cursor: 'pointer',
        padding: '10px 12px',
        border: '1px solid #eee',
        background: '#fff',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderLeft: `6px solid ${color || '#eee'}`,
        borderRadius: 12
      }}
    >
      <div style={{ fontWeight: 800, color: THEME.text, fontSize: 12 }}>{label}</div>
      <div style={{ fontWeight: 800, color: THEME.textMuted, fontSize: 12 }}>
        {count} {open ? '−' : '+'}
      </div>
    </div>
  );
}

function StudentChip({ label, count = 1, onClick, onDelete }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        border: '1px solid #eaeaea',
        background: '#fff',
        padding: '6px 10px',
        cursor: 'pointer',
        fontWeight: 800,
        fontSize: 12,
        borderRadius: 999
      }}
      onClick={onClick}
      title={count > 1 ? `${count} entries` : 'Open'}
    >
      <span>{label}</span>
      {count > 1 && <span style={{ fontSize: 11, fontWeight: 800, color: THEME.textMuted }}>×{count}</span>}
      {onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontWeight: 900, color: '#C0392B' }}
          title="Delete"
        >
          ×
        </button>
      )}
    </div>
  );
}

const rowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  border: '1px solid #eee',
  background: '#fafafa',
  padding: '8px 10px',
  borderRadius: 10
};

const iconBtnStyle = {
  width: 32,
  height: 32,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: '1px solid #eaeaea',
  background: '#fff',
  borderRadius: 10,
  cursor: 'pointer'
};

function PencilIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 20h9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 6h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M8 6V4h8v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M6 6l1 16h10l1-16" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M10 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
