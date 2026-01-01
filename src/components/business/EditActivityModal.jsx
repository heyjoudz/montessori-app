import { useEffect, useMemo, useState } from 'react';
import { THEME } from '../../ui/theme';
import { inputStyle } from '../../utils/helpers';
import Card from '../ui/Card';
import Button from '../ui/Button';

const STATUS_OPTIONS = [
  { value: 'P', label: 'To Present' },
  { value: 'W', label: 'Practicing' },
  { value: 'A', label: 'Next Month Aim' },
  { value: 'M', label: 'Mastered' }
];

function clean(s) {
  return String(s || '').trim();
}

function iso10(v) {
  const s = String(v || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
}

function resolveAreaId(areaName, curriculum = []) {
  const target = clean(areaName).toLowerCase();
  if (!target) return null;

  const hit = curriculum.find((c) => {
    const nm = clean(c?.curriculum_areas?.name || c?.area || '').toLowerCase();
    return nm === target;
  });

  return hit?.curriculum_area_id || hit?.area_id || hit?.curriculum_areas?.id || null;
}

function resolveCategoryId(categoryName, curriculum = []) {
  const target = clean(categoryName).toLowerCase();
  if (!target) return null;

  const hit = curriculum.find((c) => {
    const nm = clean(c?.curriculum_categories?.name || c?.category || '').toLowerCase();
    return nm === target;
  });

  return hit?.curriculum_category_id || hit?.category_id || hit?.curriculum_categories?.id || null;
}

function resolveActivityId(activityName, curriculum = [], areaName = '') {
  const target = clean(activityName).toLowerCase();
  if (!target) return null;

  const areaTarget = clean(areaName).toLowerCase();

  const inArea = curriculum.find((c) => {
    const act = clean(c?.activity || c?.name || c?.curriculum_activities?.name || '').toLowerCase();
    if (act !== target) return false;
    if (!areaTarget) return true;
    const ar = clean(c?.curriculum_areas?.name || c?.area || '').toLowerCase();
    return ar === areaTarget;
  });

  const hit =
    inArea ||
    curriculum.find((c) => {
      const act = clean(c?.activity || c?.name || c?.curriculum_activities?.name || '').toLowerCase();
      return act === target;
    });

  return hit?.id || hit?.curriculum_activity_id || hit?.curriculum_activities?.id || null;
}

export default function EditActivityModal({
  item,
  curriculum = [],
  areaOptions = [],
  categoryOptions = [],
  onSave,
  onDelete,
  onClose
}) {
  const [status, setStatus] = useState('P');
  const [planningDate, setPlanningDate] = useState('');
  const [area, setArea] = useState('');
  const [category, setCategory] = useState('');
  const [activity, setActivity] = useState('');
  const [rawActivity, setRawActivity] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!item) return;

    setStatus(item.status || 'P');
    setPlanningDate(iso10(item.planning_date || item.date || ''));

    const relArea =
      clean(item?.curriculum_areas?.name) ||
      clean(item?.area) ||
      clean(item?.curriculum_area_name) ||
      '';
    setArea(relArea);

    const relCat = clean(item?.curriculum_categories?.name) || clean(item?.category) || '';
    setCategory(relCat);

    const act = clean(item?.activity) || clean(item?.curriculum_activities?.name) || '';
    setActivity(act);

    setRawActivity(clean(item?.raw_activity));
    setNotes(clean(item?.notes));
  }, [item]);

  const derivedAreas = useMemo(() => {
    if (Array.isArray(areaOptions) && areaOptions.length) return areaOptions;

    const set = new Map();
    (curriculum || []).forEach((c) => {
      const nm = clean(c?.curriculum_areas?.name || c?.area || '') || 'General';
      set.set(nm.toLowerCase(), nm);
    });
    if (!set.has('general')) set.set('general', 'General');
    return Array.from(set.values()).sort((a, b) => a.localeCompare(b));
  }, [areaOptions, curriculum]);

  const derivedCategories = useMemo(() => {
    if (Array.isArray(categoryOptions) && categoryOptions.length) return categoryOptions;

    const set = new Map();
    (curriculum || []).forEach((c) => {
      const nm = clean(c?.curriculum_categories?.name || c?.category || '');
      if (nm) set.set(nm.toLowerCase(), nm);
    });
    return Array.from(set.values()).sort((a, b) => a.localeCompare(b));
  }, [categoryOptions, curriculum]);

  const activitySuggestions = useMemo(() => {
    const areaTarget = clean(area).toLowerCase();
    const list = (curriculum || [])
      .map((c) => {
        const act = clean(c?.activity || c?.name || c?.curriculum_activities?.name || '');
        const ar = clean(c?.curriculum_areas?.name || c?.area || '') || 'General';
        return act ? { id: c?.id || c?.curriculum_activity_id, act, ar } : null;
      })
      .filter(Boolean);

    if (!areaTarget) return list;
    return list.filter((x) => clean(x.ar).toLowerCase() === areaTarget);
  }, [curriculum, area]);

  const labelStyle = {
    fontSize: 12,
    fontWeight: 700,
    color: THEME.textMuted,
    marginBottom: 6
  };

  const fieldBase = {
    ...inputStyle(),
    padding: '10px 12px',
    borderRadius: 12,
    fontWeight: 600,
    border: '1px solid #eee',
    background: '#fff'
  };

  const handleSave = async () => {
    if (!item) return;

    const aName = clean(area);
    const cName = clean(category);
    const actName = clean(activity);

    const areaId = resolveAreaId(aName, curriculum);
    const catId = resolveCategoryId(cName, curriculum);
    const actId = resolveActivityId(actName, curriculum, aName);

    const pd = planningDate ? planningDate : null;

    const updatePayload = {
      ...item,
      status,
      planning_date: pd,
      activity: actName || null,
      raw_activity: clean(rawActivity) || null,
      notes: clean(notes) || null,
      category: cName || null,
      curriculum_activity_id: actId || null,
      curriculum_area_id: areaId || item.curriculum_area_id || null,
      curriculum_category_id: catId || item.curriculum_category_id || null
    };

    if (pd) {
      updatePayload.year = Number(pd.slice(0, 4));
      updatePayload.month = Number(pd.slice(5, 7));
      updatePayload.day = Number(pd.slice(8, 10));
    }

    await onSave?.(updatePayload);
    onClose?.();
  };

  if (!item) return null;

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
      <div style={{ width: 'min(760px, 100%)' }} onClick={(e) => e.stopPropagation()}>
        <Card style={{ padding: 18, borderTop: `4px solid ${THEME.brandSecondary}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: THEME.text }}>Edit activity</div>
            <button
              onClick={onClose}
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontWeight: 900, fontSize: 18 }}
              aria-label="Close"
            >
              ×
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <div style={labelStyle}>Status</div>
              <select value={status} onChange={(e) => setStatus(e.target.value)} style={fieldBase}>
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div style={labelStyle}>Planning date (optional)</div>
              <input type="date" value={planningDate} onChange={(e) => setPlanningDate(e.target.value)} style={fieldBase} />
              <div style={{ marginTop: 6, fontSize: 12, color: THEME.textMuted, fontWeight: 600 }}>Empty = unscheduled</div>
            </div>

            <div>
              <div style={labelStyle}>Area</div>
              <select value={area} onChange={(e) => setArea(e.target.value)} style={fieldBase}>
                <option value="">—</option>
                {derivedAreas.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
            <div>
              <div style={labelStyle}>Category (optional)</div>
              <select value={category} onChange={(e) => setCategory(e.target.value)} style={fieldBase}>
                <option value="">—</option>
                {derivedCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div style={labelStyle}>Activity (pick or type)</div>
              <input
                list="edit-activity-suggestions"
                value={activity}
                onChange={(e) => setActivity(e.target.value)}
                placeholder="Start typing…"
                style={fieldBase}
              />
              <datalist id="edit-activity-suggestions">
                {activitySuggestions.slice(0, 250).map((a) => (
                  <option key={`${a.id || a.act}`} value={a.act} />
                ))}
              </datalist>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 12, marginTop: 12 }}>
            <div>
              <div style={labelStyle}>Sub-activity (teacher bullet)</div>
              <textarea
                value={rawActivity}
                onChange={(e) => setRawActivity(e.target.value)}
                placeholder="Example: c,a,n,r,m,t memory game"
                rows={4}
                style={{ ...fieldBase, resize: 'vertical' }}
              />
            </div>
            <div>
              <div style={labelStyle}>Notes</div>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} style={{ ...fieldBase, resize: 'vertical' }} />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
            <button
              onClick={() => onDelete?.(item)}
              style={{ border: 'none', background: 'transparent', color: '#C0392B', fontWeight: 800, cursor: 'pointer' }}
            >
              Delete
            </button>

            <div style={{ display: 'flex', gap: 10 }}>
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button variant="secondary" onClick={handleSave}>
                Save
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
