import { useEffect, useMemo, useState } from 'react';
import { THEME } from '../../ui/theme';
import Card from '../ui/Card';
import Button from '../ui/Button';

// --- Options for the Status Dropdown ---
const STATUS_OPTIONS = [
  { value: 'P', label: 'To Present' },
  { value: 'W', label: 'Practicing' },
  { value: 'A', label: 'Next Month Aim' },
  { value: 'M', label: 'Mastered' }
];

// --- Helpers ---
function clean(s) {
  return String(s || '').trim();
}

function iso10(v) {
  const s = String(v || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
}

// --- ID Resolvers (Kept strict to ensure DB integrity) ---
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

  // Try to find activity within the specific area first
  const inArea = curriculum.find((c) => {
    const act = clean(c?.activity || c?.name || c?.curriculum_activities?.name || '').toLowerCase();
    if (act !== target) return false;
    if (!areaTarget) return true;
    const ar = clean(c?.curriculum_areas?.name || c?.area || '').toLowerCase();
    return ar === areaTarget;
  });

  const hit = inArea || curriculum.find((c) => {
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

  // --- Load Item Data ---
  useEffect(() => {
    if (!item) return;

    setStatus(item.status || 'P');
    setPlanningDate(iso10(item.planning_date || item.date || ''));

    const relArea = clean(item?.curriculum_areas?.name) || clean(item?.area) || clean(item?.curriculum_area_name) || '';
    setArea(relArea);

    const relCat = clean(item?.curriculum_categories?.name) || clean(item?.category) || '';
    setCategory(relCat);

    const act = clean(item?.activity) || clean(item?.curriculum_activities?.name) || '';
    setActivity(act);

    setRawActivity(clean(item?.raw_activity));
    setNotes(clean(item?.notes));
  }, [item]);

  // --- Derived Options ---
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
    const list = (curriculum || []).map((c) => {
        const act = clean(c?.activity || c?.name || c?.curriculum_activities?.name || '');
        const ar = clean(c?.curriculum_areas?.name || c?.area || '') || 'General';
        return act ? { id: c?.id || c?.curriculum_activity_id, act, ar } : null;
      }).filter(Boolean);

    if (!areaTarget) return list;
    return list.filter((x) => clean(x.ar).toLowerCase() === areaTarget);
  }, [curriculum, area]);

  // --- Save Logic ---
  const handleSave = async () => {
    if (!item) return;

    const aName = clean(area);
    const cName = clean(category);
    const actName = clean(activity);

    // Resolve IDs based on names selected
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

  // --- Styles from QuickAddModal for Consistency ---
  const fieldLabel = { fontSize: 12, fontWeight: 650, color: THEME.brandPrimary, marginBottom: 6 };
  const inputBase = {
    width: '100%',
    height: 38,
    borderRadius: 12,
    border: '1px solid rgba(10,53,92,0.14)',
    padding: '0 10px',
    fontSize: 13,
    fontWeight: 600,
    background: '#fff'
  };

  return (
    <div
      onMouseDown={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.25)', // Slightly darker for better focus
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: 16
      }}
    >
      <Card
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: 'min(760px, 100%)',
          padding: 18,
          border: '1px solid rgba(10,53,92,0.10)',
          boxShadow: '0 10px 40px rgba(0,0,0,0.15)'
        }}
      >
        {/* HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18, color: THEME.brandPrimary, fontFamily: THEME.serifFont }}>
              Edit activity
            </div>
            <div style={{ marginTop: 4, fontSize: 12, color: THEME.textMuted, fontWeight: 500 }}>
              Update details, date, or add teacher notes.
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontWeight: 900, fontSize: 22, color: THEME.textMuted }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* TOP ROW: Status | Date */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <div style={fieldLabel}>Status</div>
            <select value={status} onChange={(e) => setStatus(e.target.value)} style={inputBase}>
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <div style={fieldLabel}>Date (optional)</div>
            <input type="date" value={planningDate} onChange={(e) => setPlanningDate(e.target.value)} style={inputBase} />
          </div>
        </div>

        {/* MIDDLE ROW: Area | Category | Activity */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.5fr', gap: 12, marginBottom: 12 }}>
          <div>
            <div style={fieldLabel}>Area</div>
            <select value={area} onChange={(e) => setArea(e.target.value)} style={inputBase}>
              <option value="">—</option>
              {derivedAreas.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>

          <div>
            <div style={fieldLabel}>Category (optional)</div>
            <select value={category} onChange={(e) => setCategory(e.target.value)} style={inputBase}>
              <option value="">—</option>
              {derivedCategories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <div style={fieldLabel}>
                Activity 
                <span style={{fontWeight: 400, color: THEME.textMuted, marginLeft: 4}} title="If options are missing, add them in Settings">ⓘ</span>
            </div>
            <input
              list="edit-activity-suggestions"
              value={activity}
              onChange={(e) => setActivity(e.target.value)}
              placeholder="Start typing…"
              style={inputBase}
            />
            <datalist id="edit-activity-suggestions">
              {activitySuggestions.slice(0, 250).map((a) => (
                <option key={`${a.id || a.act}`} value={a.act} />
              ))}
            </datalist>
          </div>
        </div>
        
        {/* Helper text for missing config */}
        <div style={{ fontSize: 11, color: THEME.textMuted, fontStyle: 'italic', marginBottom: 16, marginTop: -8 }}>
            Don't see the Area or Activity? You can configure new ones in the Settings menu.
        </div>

        {/* BOTTOM ROW: Sub-activity & Notes */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={fieldLabel}>Sub-activity (Teacher Bullet)</div>
              <textarea
                value={rawActivity}
                onChange={(e) => setRawActivity(e.target.value)}
                placeholder="Ex: c,a,n,r,m,t memory game"
                rows={4}
                style={{ ...inputBase, height: 'auto', padding: 12, resize: 'vertical', minHeight: 80 }}
              />
            </div>
            <div>
              <div style={fieldLabel}>Teacher Notes (Italic on dashboard)</div>
              <textarea 
                value={notes} 
                onChange={(e) => setNotes(e.target.value)} 
                placeholder="Review notes or specific instructions..."
                rows={4} 
                style={{ ...inputBase, height: 'auto', padding: 12, resize: 'vertical', minHeight: 80 }} 
              />
            </div>
        </div>

        {/* FOOTER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, paddingTop: 16, borderTop: '1px solid #eee' }}>
          <button
            onClick={() => onDelete?.(item)}
            style={{ border: 'none', background: 'transparent', color: '#e57373', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}
          >
            Delete Item
          </button>

          <div style={{ display: 'flex', gap: 10 }}>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              Save Changes
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}