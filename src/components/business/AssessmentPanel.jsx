import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../supabaseClient';
import { THEME } from '../../ui/theme';
import { ChevronDown, ChevronRight, CheckCircle, Clock, Star } from 'lucide-react';

// -------------------- SHARED UI & THEME --------------------
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
  borderSoft: rgba(THEME.brandAccent, 0.28),
};

const ThemedCard = ({ children, style, className = '', onClick }) => (
  <div
    className={`mb-card ${className}`}
    onClick={onClick}
    style={{
      backgroundColor: UI.card,
      borderRadius: THEME.radius,
      boxShadow: THEME.cardShadow,
      border: `1px solid ${UI.borderSoft}`,
      ...style,
    }}
  >
    {children}
  </div>
);

// -------------------- SCORE HELPERS --------------------

const isSpecialToken = (v) => {
  const s = String(v ?? '').trim().toLowerCase();
  return s === 'x' || s === 'na' || s === 'n/a' || s === 'absent';
};

const normalizeScore = (raw) => {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (isSpecialToken(s)) return null;

  const clean = s.replace(/%/g, '').trim();
  const num = parseFloat(clean);
  return Number.isFinite(num) ? num : null;
};

const formatScoreDisplay = (raw) => {
  if (raw === null || raw === undefined) return '-';
  const s = String(raw).trim();
  if (!s) return '-';
  if (isSpecialToken(s) || s.toUpperCase() === 'X') return 'X';

  const n = normalizeScore(raw);
  if (n === null) return '-';
  const shown = Number.isInteger(n) ? n : Math.round(n);
  return String(shown);
};

// Montessori Color Scale (Mastery based, not competitive)
const getScoreStyle = (rawVal) => {
  const s = String(rawVal ?? '').trim();
  if (s && (isSpecialToken(s) || s.toUpperCase() === 'X')) {
    return { color: THEME.textMuted, fontWeight: 700, fontStyle: 'italic' };
  }

  const val = normalizeScore(rawVal);
  if (val === null) return { color: THEME.textMuted };
  
  // 80+ = Mastered (Green)
  // 50-79 = Progressing (Orange/Yellow)
  // <50 = Presented / Needs Practice (Red/Grey)
  if (val >= 80) return { color: '#2E7D32', fontWeight: 800 }; 
  if (val >= 50) return { color: '#F57F17', fontWeight: 800 }; 
  return { color: '#D32F2F', fontWeight: 800 }; 
};

const normKey = (s) =>
  String(s || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

// -------------------- SUB-COMPONENT: SCORE CELL --------------------

const ScoreCell = ({ scoreRec }) => {
  const raw = scoreRec?.score_raw;
  const hasValue = raw !== null && raw !== undefined && String(raw).trim() !== '';
  const scoreStyle = getScoreStyle(raw);
  const comment = scoreRec?.comment ? scoreRec.comment : '';

  return (
    <div
      style={{
        padding: '12px 8px',
        height: '100%',
        minHeight: 64,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: hasValue ? 'flex-start' : 'center',
        backgroundColor: '#fff', 
        borderRight: `1px solid ${UI.borderSoft}`
      }}
    >
      {hasValue ? (
        <>
          <div style={{ fontSize: 16, marginBottom: 2, ...scoreStyle }}>
            {formatScoreDisplay(raw)}
          </div>
          
          {/* COMMENT (Sticky Note Style) */}
          {comment && (
            <div
              style={{
                background: '#FEF3C7',
                border: `1px solid #FDE68A`,
                color: '#92400E',
                fontSize: 11,
                lineHeight: 1.3,
                padding: '4px 8px',
                marginTop: 4,
                width: 'fit-content',
                maxWidth: 140,
                minWidth: 40,
                borderRadius: 4,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                textAlign: 'center',
              }}
            >
              {comment}
            </div>
          )}
        </>
      ) : (
        <div style={{ color: rgba(UI.text, 0.1), fontSize: 20 }}>-</div>
      )}
    </div>
  );
};

// -------------------- INSIGHTS PANEL (Montessori Style) --------------------

const InsightsPanel = ({ areas }) => {
  const analyzed = useMemo(() => {
    const mastered = [];
    const progressing = [];
    let lowestSkill = null;
    let lowestScore = 101;

    areas.forEach(area => {
        // Area Analysis
        if (area.overallAverage !== null) {
            if (area.overallAverage >= 80) mastered.push(area.name);
            else if (area.overallAverage < 80) progressing.push(area.name);
        }

        // Find a specific skill that might need a "re-presentation"
        area.groups.forEach(grp => {
            if (grp.rowAverage !== null && grp.rowAverage < 60 && grp.rowAverage < lowestScore) {
                lowestScore = grp.rowAverage;
                lowestSkill = grp.name;
            }
        });
    });

    return { mastered, progressing, lowestSkill };
  }, [areas]);

  if (!analyzed.mastered.length && !analyzed.progressing.length) return null;

  return (
    <ThemedCard style={{ marginBottom: 24, padding: 20, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 20 }}>
        {/* Mastered */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#2E7D32', fontWeight: 700, fontSize: 12, textTransform: 'uppercase' }}>
                <CheckCircle size={16} /> Mastery Observed
            </div>
            <div style={{ fontSize: 13, color: THEME.text, fontWeight: 500, lineHeight: 1.4 }}>
                {analyzed.mastered.length > 0 ? analyzed.mastered.join(', ') : 'Working towards mastery.'}
            </div>
        </div>

        {/* Working On */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#D97706', fontWeight: 700, fontSize: 12, textTransform: 'uppercase' }}>
                <Clock size={16} /> Currently Practicing
            </div>
            <div style={{ fontSize: 13, color: THEME.text, fontWeight: 500, lineHeight: 1.4 }}>
                {analyzed.progressing.length > 0 ? analyzed.progressing.join(', ') : 'Consistent performance.'}
            </div>
        </div>

        {/* Suggestion */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, borderLeft: `2px solid ${UI.borderSoft}`, paddingLeft: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: THEME.brandPrimary, fontWeight: 700, fontSize: 12, textTransform: 'uppercase' }}>
                <Star size={16} /> Recommended Focus
            </div>
            <div style={{ fontSize: 13, color: THEME.text, fontWeight: 500, lineHeight: 1.4 }}>
                {analyzed.lowestSkill ? (
                    <>Consider re-presenting or practicing: <strong>{analyzed.lowestSkill}</strong>.</>
                ) : 'Continue with current curriculum progression.'}
            </div>
        </div>
    </ThemedCard>
  );
};

// -------------------- MAIN: INDIVIDUAL REPORT --------------------

export default function AssessmentPanel({ profile, student, classroomId, showToast }) {
  const [loading, setLoading] = useState(false);

  // CORE DATA
  const [templates, setTemplates] = useState([]); 
  const [assessmentMap, setAssessmentMap] = useState({}); 
  const [skills, setSkills] = useState([]);
  const [domains, setDomains] = useState([]);
  const [areas, setAreas] = useState([]);
  const [allScores, setAllScores] = useState([]);
  
  const [filterArea, setFilterArea] = useState('ALL');
  const [filterTemplate, setFilterTemplate] = useState('ALL');
  const [expandedAreas, setExpandedAreas] = useState({});

  const refresh = async () => {
    if (!student?.id) return;
    setLoading(true);
    try {
      // 1) Templates
      const { data: tmplData } = await supabase
        .from('assessment_templates')
        .select('*')
        .order('default_date', { ascending: true });

      const relevantTemplates = (tmplData || []).filter((t) =>
        (t.classroom_ids || []).map(String).includes(String(classroomId || student.classroom_id))
      );
      setTemplates(relevantTemplates);

      // 2) Student assessments (runs)
      const { data: assessData } = await supabase
        .from('student_assessments')
        .select('*')
        .eq('student_id', student.id);

      const aMap = {};
      (assessData || []).forEach((a) => {
        if (a.template_id) aMap[a.template_id] = a;
      });
      setAssessmentMap(aMap);

      // 3) Domains + Skills + Areas
      const { data: domainData } = await supabase.from('assessment_domains').select('*');
      setDomains(domainData || []);

      const { data: skillData } = await supabase
        .from('assessment_skills')
        .select('id, name, area_id, domain_id, sort_order')
        .order('sort_order');
      setSkills(skillData || []);

      const { data: areaData } = await supabase.from('curriculum_areas').select('id, name').order('name');
      setAreas(areaData || []);

      // 4) Scores (Individual Only)
      if (assessData?.length > 0) {
        const ids = assessData.map((a) => a.id);
        const { data: scoreData } = await supabase
          .from('student_assessment_scores')
          .select('id, assessment_id, skill_id, score_raw, comment, created_at, classroom_id')
          .in('assessment_id', ids);

        setAllScores(scoreData || []);
      } else {
        setAllScores([]);
      }

    } catch (e) {
      console.error(e);
      showToast?.({ type: 'error', message: 'Failed to load data.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student?.id, classroomId]);


  // Score index: choose latest if duplicates exist
  const scoreIndex = useMemo(() => {
    const m = new Map();
    const newer = (a, b) => {
      const ta = a?.created_at ? new Date(a.created_at).getTime() : 0;
      const tb = b?.created_at ? new Date(b.created_at).getTime() : 0;
      if (ta !== tb) return ta > tb;
      const ida = Number(a?.id || 0);
      const idb = Number(b?.id || 0);
      return ida > idb;
    };

    for (const s of allScores || []) {
      const key = `${String(s.assessment_id)}|${String(s.skill_id)}`;
      const cur = m.get(key);
      if (!cur || newer(s, cur)) m.set(key, s);
    }
    return m;
  }, [allScores]);

  // skill -> owning template (via domain)
  const skillTemplateMap = useMemo(() => {
    const map = {};
    const domById = new Map((domains || []).map((d) => [String(d.id), d]));
    (skills || []).forEach((s) => {
      const dom = domById.get(String(s.domain_id));
      if (dom) map[s.id] = dom.template_id;
    });
    return map;
  }, [skills, domains]);

  // visible templates by filter
  const visibleTemplates = useMemo(() => {
    if (filterTemplate === 'ALL') return templates;
    return templates.filter((t) => String(t.id) === String(filterTemplate));
  }, [templates, filterTemplate]);

  const processedData = useMemo(() => {
    if (!visibleTemplates.length || !skills.length) return { areas: [] };

    const areaById = new Map((areas || []).map((a) => [String(a.id), a]));
    const getAreaName = (id) => areaById.get(String(id))?.name || 'General';

    const visibleTemplateIds = new Set(visibleTemplates.map((t) => String(t.id)));

    // areaId -> { id, name, groupsMap }
    const bucket = new Map();

    const ensureArea = (areaId) => {
      const key = String(areaId);
      if (!bucket.has(key)) bucket.set(key, { id: key, name: getAreaName(key), groupsMap: new Map() });
      return bucket.get(key);
    };

    // Build grouped skills
    for (const sk of skills) {
      const tId = String(skillTemplateMap[sk.id] ?? '');
      if (!tId || !visibleTemplateIds.has(tId)) continue;

      const areaId = sk.area_id ? String(sk.area_id) : 'uncategorized';
      const areaObj = ensureArea(areaId);

      const gKey = `${areaId}::${normKey(sk.name)}`;
      if (!areaObj.groupsMap.has(gKey)) {
        areaObj.groupsMap.set(gKey, {
          key: gKey,
          name: String(sk.name || '').trim() || 'Untitled Skill',
          areaId,
          sortOrder: Number.isFinite(sk.sort_order) ? sk.sort_order : 999999,
          skillIdsByTemplate: {}, 
          cells: {}, 
          rowAverage: null,
          delta: null,
        });
      }

      const grp = areaObj.groupsMap.get(gKey);
      grp.sortOrder = Math.min(grp.sortOrder, Number.isFinite(sk.sort_order) ? sk.sort_order : 999999);

      if (!grp.skillIdsByTemplate[tId]) grp.skillIdsByTemplate[tId] = [];
      grp.skillIdsByTemplate[tId].push(String(sk.id));
    }

    // Pick best record
    const pickBestRecord = (assessmentId, skillIds) => {
      if (!assessmentId || !skillIds?.length) return null;
      let best = null;

      const rankOf = (rec) => {
        if (!rec) return 0;
        const raw = rec.score_raw;
        const s = String(raw ?? '').trim();
        const numeric = normalizeScore(raw);
        if (numeric !== null) return 4;
        if (s && (s.toUpperCase() === 'X' || isSpecialToken(s))) return 3;
        if (rec.comment) return 2;
        return 1;
      };

      const newer = (a, b) => {
        const ta = a?.created_at ? new Date(a.created_at).getTime() : 0;
        const tb = b?.created_at ? new Date(b.created_at).getTime() : 0;
        if (ta !== tb) return ta > tb;
        const ida = Number(a?.id || 0);
        const idb = Number(b?.id || 0);
        return ida > idb;
      };

      for (const sid of skillIds) {
        const rec = scoreIndex.get(`${String(assessmentId)}|${String(sid)}`);
        if (!rec) continue;
        const r = rankOf(rec);
        if (!best || r > best.rank || (r === best.rank && newer(rec, best.rec))) {
          best = { rec, rank: r };
        }
      }
      return best?.rec || null;
    };

    // Build final areas list & Filter Empty Rows
    let areaList = Array.from(bucket.values()).map((a) => {
      const groups = Array.from(a.groupsMap.values())
        .filter(grp => {
            // Check if any template has data for this group
            let hasData = false;
            visibleTemplates.forEach(tmpl => {
                const tId = String(tmpl.id);
                const ass = assessmentMap[tmpl.id];
                const skillIds = grp.skillIdsByTemplate[tId] || [];
                const bestRec = ass ? pickBestRecord(ass.id, skillIds) : null;
                if (bestRec && (bestRec.score_raw || bestRec.comment)) {
                    hasData = true;
                }
            });
            return hasData;
        })
        .sort((x, y) => x.sortOrder - y.sortOrder);
      
      return { id: a.id, name: a.name, groups };
    });
    
    // Remove areas that have no groups left
    areaList = areaList.filter(a => a.groups.length > 0);

    // filter by area selector
    if (filterArea !== 'ALL') {
      areaList = areaList.filter((a) => String(a.id) === String(filterArea));
    }

    // Build cells + averages (Student Only)
    for (const area of areaList) {
      for (const grp of area.groups) {
        let sum = 0;
        let cnt = 0;

        visibleTemplates.forEach((tmpl) => {
          const tId = String(tmpl.id);
          const ass = assessmentMap[tmpl.id];
          const skillIds = grp.skillIdsByTemplate[tId] || [];

          const bestRec = ass ? pickBestRecord(ass.id, skillIds) : null;
          const numVal = bestRec ? normalizeScore(bestRec.score_raw) : null;
          if (numVal !== null) {
            sum += numVal;
            cnt += 1;
          }
          
          grp.cells[tId] = {
            templateId: tId,
            assessmentId: ass?.id || null,
            record: bestRec,
            numVal,
          };
        });

        grp.rowAverage = cnt > 0 ? Math.round(sum / cnt) : null;

        // Delta
        if (visibleTemplates.length >= 2) {
          const firstId = String(visibleTemplates[0].id);
          const lastId = String(visibleTemplates[visibleTemplates.length - 1].id);
          const a = grp.cells[firstId]?.numVal ?? null;
          const b = grp.cells[lastId]?.numVal ?? null;
          grp.delta = a !== null && b !== null ? Math.round(b - a) : null;
        } else {
          grp.delta = null;
        }
      }

      // Area averages
      area.averages = {};
      area.overallAverage = null;

      let areaAvgSum = 0;
      let areaAvgCnt = 0;

      visibleTemplates.forEach((tmpl) => {
        const tId = String(tmpl.id);
        let ts = 0;
        let tc = 0;

        area.groups.forEach((grp) => {
          const v = grp.cells[tId]?.numVal ?? null;
          if (v !== null) {
            ts += v;
            tc += 1;
          }
        });

        if (tc > 0) {
          const avg = Math.round(ts / tc);
          area.averages[tId] = avg;
          areaAvgSum += avg;
          areaAvgCnt += 1;
        } else {
          area.averages[tId] = null;
        }
      });

      area.overallAverage = areaAvgCnt > 0 ? Math.round(areaAvgSum / areaAvgCnt) : null;
    }

    return { areas: areaList };
  }, [visibleTemplates, skills, areas, filterArea, skillTemplateMap, assessmentMap, scoreIndex]);

  const toggleArea = (areaId) => setExpandedAreas((prev) => ({ ...prev, [areaId]: !prev[areaId] }));

  if (!student) return <div style={{ padding: 20 }}>Select a student.</div>;

  return (
    <div style={{ fontFamily: THEME.sansFont, color: THEME.text }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        
        <div style={{ display: 'flex', gap: 12 }}>
          <select
            value={filterArea}
            onChange={(e) => setFilterArea(e.target.value)}
            style={{ padding: '8px 12px', border: `1px solid ${UI.borderSoft}`, borderRadius: 6, color: THEME.text, fontWeight: 600, background: '#fff', fontSize: 13 }}
          >
            <option value="ALL">All Areas</option>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>

          <select
            value={filterTemplate}
            onChange={(e) => setFilterTemplate(e.target.value)}
            style={{ padding: '8px 12px', border: `1px solid ${UI.borderSoft}`, borderRadius: 6, color: THEME.text, fontWeight: 600, background: '#fff', fontSize: 13 }}
          >
            <option value="ALL">All Assessments</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </div>
      </div>
    
      {/* INSIGHTS PANEL */}
      <InsightsPanel areas={processedData.areas} />

      <ThemedCard style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: rgba(UI.primary, 0.04), borderBottom: `1px solid ${UI.borderSoft}` }}>
                <th style={{ textAlign: 'left', padding: '14px 20px', color: UI.muted, width: 250, textTransform: 'uppercase', fontSize: 11, letterSpacing: 1, fontWeight: 700 }}>
                  Skill / Criteria
                </th>
                {visibleTemplates.map((tmpl) => {
                    return (
                        <th key={tmpl.id} style={{ padding: 14, minWidth: 160, textAlign: 'center', borderLeft: `1px solid ${UI.borderSoft}` }}>
                            <div style={{ fontWeight: 700, color: UI.text, fontSize: 14, fontFamily: THEME.serifFont }}>{tmpl.title}</div>
                            <div style={{ fontSize: 11, fontWeight: 600, color: UI.primary, marginTop: 4 }}>{tmpl.default_date || 'No Date'}</div>
                        </th>
                    );
                })}
                <th style={{ padding: 14, minWidth: 100, textAlign: 'center', background: '#FAFAFA', borderLeft: `1px solid ${UI.borderSoft}` }}>
                  <div style={{ fontWeight: 800, color: UI.text, fontSize: 11 }}>AVG</div>
                </th>
              </tr>
            </thead>

            <tbody>
              {processedData.areas.map((area) => {
                const isExpanded = !!expandedAreas[area.id];
                return (
                  <React.Fragment key={area.id}>
                    <tr onClick={() => toggleArea(area.id)} style={{ background: '#FCFCFC', cursor: 'pointer', borderBottom: `1px solid ${UI.borderSoft}` }}>
                      <td style={{ padding: '14px 20px', fontWeight: 800, color: UI.primary, fontSize: 13, display: 'flex', alignItems: 'center', gap: 10 }}>
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        {String(area.name || 'GENERAL').toUpperCase()}
                      </td>

                      {visibleTemplates.map((tmpl) => {
                        const tId = String(tmpl.id);
                        const avg = area.averages?.[tId] ?? null;
                        
                        return (
                          <td key={tmpl.id} style={{ textAlign: 'center', fontSize: 14, verticalAlign: 'middle', borderLeft: `1px solid ${UI.borderSoft}` }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <div style={getScoreStyle(avg)}>{formatScoreDisplay(avg)}</div>
                            </div>
                          </td>
                        );
                      })}

                      <td style={{ textAlign: 'center', fontWeight: 800, color: UI.text, background: '#FAFAFA', borderLeft: `1px solid ${UI.borderSoft}` }}>
                        {formatScoreDisplay(area.overallAverage)}
                      </td>
                    </tr>

                    {isExpanded &&
                      area.groups.map((grp) => {
                        return (
                          <tr key={grp.key} style={{ borderBottom: `1px solid ${UI.borderSoft}` }}>
                            <td style={{ padding: '12px 20px', color: '#546E7A', verticalAlign: 'middle', fontWeight: 500, paddingLeft: 46, fontSize: 13 }}>
                              {grp.name}
                            </td>

                            {visibleTemplates.map((tmpl) => {
                              const tId = String(tmpl.id);
                              const cell = grp.cells[tId];

                              return (
                                <td key={`${tmpl.id}-${grp.key}`} style={{ padding: 0, verticalAlign: 'top' }}>
                                  <ScoreCell
                                    scoreRec={cell?.record || null}
                                  />
                                </td>
                              );
                            })}

                            <td
                              style={{
                                textAlign: 'center',
                                background: '#FAFAFA',
                                borderLeft: `1px solid ${UI.borderSoft}`,
                                fontWeight: 800,
                                color: UI.text,
                                padding: '0 10px',
                              }}
                            >
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 64 }}>
                                <div style={{ ...getScoreStyle(grp.rowAverage), fontSize: 13 }}>{formatScoreDisplay(grp.rowAverage)}</div>

                                {grp.delta !== null && (
                                  <div style={{ marginTop: 4, fontSize: 11, fontWeight: 800, color: grp.delta >= 0 ? '#2E7D32' : '#D32F2F' }}>
                                    {grp.delta >= 0 ? `+${grp.delta}` : `${grp.delta}`}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </React.Fragment>
                );
              })}

              {processedData.areas.length === 0 && (
                <tr>
                  <td colSpan={10} style={{ padding: 40, textAlign: 'center', color: UI.muted, fontSize: 13 }}>
                    {loading ? 'Loading...' : 'No data found for this filter.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </ThemedCard>
    </div>
  );
}