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
  danger: '#D32F2F',
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
      onMouseDown={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.25)', 
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: 16,
        backdropFilter: 'blur(2px)'
      }}
    >
      <ThemedCard
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: 'min(760px, 100%)',
          padding: '24px 28px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 20 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 20, color: UI.primary, fontFamily: THEME.serifFont }}>
              Edit Activity
            </div>
            <div style={{ marginTop: 4, fontSize: 12, color: UI.muted, fontWeight: 500 }}>
              Update details, date, or add teacher notes.
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontWeight: 900, fontSize: 24, color: UI.muted }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <FormLabel>Status</FormLabel>
            <Field as="select" value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Field>
          </div>
          <div>
            <FormLabel>Date (optional)</FormLabel>
            <Field type="date" value={planningDate} onChange={(e) => setPlanningDate(e.target.value)} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.5fr', gap: 16, marginBottom: 16 }}>
          <div>
            <FormLabel>Area</FormLabel>
            <Field as="select" value={area} onChange={(e) => setArea(e.target.value)}>
              <option value="">—</option>
              {derivedAreas.map((a) => <option key={a} value={a}>{a}</option>)}
            </Field>
          </div>

          <div>
            <FormLabel>Category (optional)</FormLabel>
            <Field as="select" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">—</option>
              {derivedCategories.map((c) => <option key={c} value={c}>{c}</option>)}
            </Field>
          </div>

          <div>
            <FormLabel>
                Activity <span style={{fontWeight: 400, color: UI.muted, marginLeft: 4}} title="If options are missing, add them in Settings">ⓘ</span>
            </FormLabel>
            <Field
              list="edit-activity-suggestions"
              value={activity}
              onChange={(e) => setActivity(e.target.value)}
              placeholder="Start typing…"
            />
            <datalist id="edit-activity-suggestions">
              {activitySuggestions.slice(0, 250).map((a) => (
                <option key={`${a.id || a.act}`} value={a.act} />
              ))}
            </datalist>
          </div>
        </div>
        
        <div style={{ fontSize: 11, color: UI.muted, fontStyle: 'italic', marginBottom: 20, marginTop: -8 }}>
            Don't see the Area or Activity? You can configure new ones in the Settings menu.
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <FormLabel>Sub-activity (Teacher Bullet)</FormLabel>
              <textarea
                value={rawActivity}
                onChange={(e) => setRawActivity(e.target.value)}
                placeholder="Ex: c,a,n,r,m,t memory game"
                style={{ 
                  width: '100%', padding: '10px 14px', borderRadius: THEME.radius, 
                  border: `1px solid ${UI.borderSoft}`, fontSize: 13, outline: 'none', 
                  fontFamily: THEME.sansFont, color: UI.text, resize: 'vertical', minHeight: 80 
                }}
                onFocus={(e) => e.target.style.borderColor = UI.primary}
                onBlur={(e) => e.target.style.borderColor = UI.borderSoft}
              />
            </div>
            <div>
              <FormLabel>Teacher Notes (Italic on dashboard)</FormLabel>
              <textarea 
                value={notes} 
                onChange={(e) => setNotes(e.target.value)} 
                placeholder="Review notes or specific instructions..."
                style={{ 
                  width: '100%', padding: '10px 14px', borderRadius: THEME.radius, 
                  border: `1px solid ${UI.borderSoft}`, fontSize: 13, outline: 'none', 
                  fontFamily: THEME.sansFont, color: UI.text, resize: 'vertical', minHeight: 80 
                }}
                onFocus={(e) => e.target.style.borderColor = UI.primary}
                onBlur={(e) => e.target.style.borderColor = UI.borderSoft}
              />
            </div>
        </div>

        {/* FOOTER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, paddingTop: 16, borderTop: `1px solid ${UI.borderSoft}` }}>
          <button
            onClick={() => onDelete?.(item)}
            style={{ border: 'none', background: 'transparent', color: UI.danger, fontWeight: 700, cursor: 'pointer', fontSize: 13 }}
          >
            Delete Item
          </button>

          <div style={{ display: 'flex', gap: 10 }}>
            <StyledButton variant="ghost" onClick={onClose}>
              Cancel
            </StyledButton>
            <StyledButton onClick={handleSave}>
              Save Changes
            </StyledButton>
          </div>
        </div>
      </ThemedCard>
    </div>
  );
}