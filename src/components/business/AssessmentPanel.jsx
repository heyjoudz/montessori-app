import React, { useEffect, useState, useMemo, useRef } from 'react';
import { supabase } from '../../supabaseClient'; 
import { THEME } from '../../ui/theme'; 
import { dateISO, safeDate } from '../../utils/helpers';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import { ChevronDown, ChevronRight } from 'lucide-react'; 

// --- HELPERS ---

const normalizeScore = (raw) => {
  if (raw === null || raw === undefined || raw === '') return null;
  const clean = String(raw).replace(/%/g, '').trim();
  const num = parseFloat(clean);
  return isNaN(num) ? null : num;
};

const formatScoreDisplay = (raw) => {
  const n = normalizeScore(raw);
  if (n === null) return '-';
  const shown = Number.isInteger(n) ? n : Math.round(n * 10) / 10;
  return `${shown}%`;
};

const getScoreStyle = (rawVal) => {
  const val = normalizeScore(rawVal);
  if (val === null) return { color: '#B0BEC5' }; 
  if (val >= 80) return { color: '#2E7D32', fontWeight: 800 }; // Green
  if (val >= 55) return { color: '#F57F17', fontWeight: 800 }; // Orange
  return { color: '#D32F2F', fontWeight: 800 }; // Red
};

const formatComment = (text) => {
  if (!text) return '';
  if (String(text).toUpperCase() === 'EMPTY') return '';
  return text;
};

// --- SUB-COMPONENT: EDITABLE CELL ---
const EditableCell = ({ scoreRec, assessmentId, skillId, onSave }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editScore, setEditScore] = useState('');
  const [editComment, setEditComment] = useState('');
  
  useEffect(() => {
    if (isEditing) {
      setEditScore(scoreRec?.score_raw || '');
      setEditComment(scoreRec?.comment || '');
    }
  }, [isEditing, scoreRec]);

  const handleSave = (e) => {
    e.stopPropagation(); 
    onSave(assessmentId, skillId, editScore, editComment, scoreRec?.id);
    setIsEditing(false);
  };

  const handleCancel = (e) => {
    e.stopPropagation();
    setIsEditing(false);
  };

  // --- EDIT POPUP MODE ---
  if (isEditing) {
    return (
      <div 
        onClick={(e) => e.stopPropagation()} 
        style={{ 
          // CRITICAL: This allows the absolute popup to anchor to THIS cell
          position: 'relative', 
          width: '100%',
          height: '100%',
          minHeight: 64
        }}
      >
        <div style={{ 
          position: 'absolute', 
          top: -10, 
          left: -10, 
          width: 280, // Fixed width so it doesn't stretch
          zIndex: 9999, // Ensure it sits ON TOP of everything
          background: '#FFFFFF', 
          border: `2px solid ${THEME.brandPrimary}`, 
          padding: 16, 
          boxShadow: `6px 6px 0px 0px ${THEME.brandAccent}`, // Hard shadow
          borderRadius: 4
        }}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display:'block', fontSize: 11, fontWeight: 700, color: THEME.textMuted, marginBottom: 4 }}>
              SCORE %
            </label>
            <input
              type="number" autoFocus value={editScore} onChange={(e) => setEditScore(e.target.value)}
              placeholder="0-100"
              style={{ 
                width: '100%', padding: '8px', fontSize: 14, fontWeight: 700, color: THEME.text,
                border: '1px solid #ddd', borderRadius: 0, outline: 'none', background: '#FAFAFA'
              }}
            />
          </div>
          <div style={{ marginBottom: 14 }}>
             <label style={{ display:'block', fontSize: 11, fontWeight: 700, color: THEME.textMuted, marginBottom: 4 }}>
               NOTE
             </label>
            <textarea
              rows={2} value={editComment} onChange={(e) => setEditComment(e.target.value)}
              placeholder="Optional comment..."
              style={{ 
                width: '100%', padding: '8px', fontSize: 13, fontFamily: THEME.sansFont, color: THEME.text,
                border: '1px solid #ddd', borderRadius: 0, outline: 'none', background: '#FAFAFA'
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <Button variant="ghost" onClick={handleCancel} style={{ fontSize: 12, padding: '6px 12px' }}>Cancel</Button>
            <Button onClick={handleSave} style={{ fontSize: 12, padding: '6px 16px', background: THEME.brandPrimary, color: '#fff' }}>Save</Button>
          </div>
        </div>
      </div>
    );
  }

  // --- VIEW MODE ---
  const hasScore = scoreRec && scoreRec.score_raw !== null;
  const comment = scoreRec ? formatComment(scoreRec.comment) : '';
  const scoreStyle = getScoreStyle(scoreRec?.score_raw);

  return (
    <div 
      onClick={() => setIsEditing(true)}
      style={{ 
        position: 'relative', // CRITICAL: Anchors the popup if it opens
        cursor: 'pointer', 
        padding: '12px 8px', 
        height: '100%', 
        minHeight: 64,
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: hasScore ? 'flex-start' : 'center',
        transition: 'background 0.2s'
      }}
      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F0F4F8'} 
      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
    >
      {hasScore ? (
        <>
          <div style={{ fontSize: 16, marginBottom: 6, ...scoreStyle }}>
            {formatScoreDisplay(scoreRec.score_raw)}
          </div>
          {comment && (
            <div style={{
              background: '#FFF9C4', 
              border: `1px solid #FBC02D`, 
              color: '#333',
              fontSize: 11,
              lineHeight: 1.3,
              padding: '6px 8px',
              width: '100%',
              maxWidth: 160,
              textAlign: 'left',
              boxShadow: '2px 2px 0px 0px rgba(0,0,0,0.1)'
            }}>
              {comment}
            </div>
          )}
        </>
      ) : (
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#eee' }} />
      )}
    </div>
  );
};


export default function AssessmentPanel({ profile, student, classroomId, showToast }) {
  const [loading, setLoading] = useState(false);
  const [assessments, setAssessments] = useState([]);
  const [skills, setSkills] = useState([]);
  const [areas, setAreas] = useState([]);
  const [allScores, setAllScores] = useState([]);
  
  const [filterArea, setFilterArea] = useState('ALL');
  // Initialize as empty object -> collapsed by default
  const [expandedAreas, setExpandedAreas] = useState({});

  const [createOpen, setCreateOpen] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [newTemplateId, setNewTemplateId] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState(dateISO(new Date()));

  // --- FETCH ---
  const refresh = async () => {
    if (!student?.id) return;
    setLoading(true);
    try {
      const { data: assessData } = await supabase.from('student_assessments').select('*').eq('student_id', student.id).order('assessment_date', { ascending: false });
      setAssessments(assessData || []);

      const { data: tmplData } = await supabase.from('assessment_templates').select('id, title').order('title');
      setTemplates(tmplData || []);
      if (tmplData?.length) setNewTemplateId(tmplData[0].id);

      const { data: skillData } = await supabase.from('assessment_skills').select('id, name, area_id, sort_order').order('sort_order');
      setSkills(skillData || []);

      const { data: areaData } = await supabase.from('curriculum_areas').select('id, name').order('name');
      setAreas(areaData || []);

      if (assessData?.length > 0) {
        const ids = assessData.map(a => a.id);
        const { data: scoreData } = await supabase.from('student_assessment_scores').select('*').in('assessment_id', ids);
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

  useEffect(() => { refresh(); }, [student?.id]);

  // --- SAVE ---
  const handleSaveScore = async (assessmentId, skillId, newVal, newComment, existingScoreId) => {
    try {
      const payload = {
        assessment_id: assessmentId,
        skill_id: skillId,
        score_raw: newVal,
        comment: newComment,
        ...(existingScoreId ? { id: existingScoreId } : {}) 
      };
      const { data, error } = await supabase.from('student_assessment_scores').upsert(payload).select();
      if (error) throw error;
      setAllScores(prev => {
        const other = prev.filter(s => !(String(s.assessment_id) === String(assessmentId) && String(s.skill_id) === String(skillId)));
        return [...other, data[0]];
      });
      showToast?.({ type: 'success', message: 'Saved' });
    } catch (e) {
      showToast?.({ type: 'error', message: 'Save failed' });
    }
  };

  // --- PROCESS DATA ---
  const scoreIndex = useMemo(() => {
    const m = new Map();
    for (const s of allScores) {
      m.set(`${String(s.assessment_id)}|${String(s.skill_id)}`, s);
    }
    return m;
  }, [allScores]);

  const processedData = useMemo(() => {
    if (!assessments.length || !skills.length) return { areas: [] };
    const getAreaName = (id) => areas.find(a => String(a.id) === String(id))?.name || 'General';

    // 1. Group Skills
    const grouped = {};
    skills.forEach(skill => {
      const areaId = skill.area_id ?? 'uncategorized';
      if (!grouped[areaId]) grouped[areaId] = { id: areaId, name: getAreaName(areaId), skills: [] };
      
      const hasData = assessments.some(a => scoreIndex.has(`${a.id}|${skill.id}`));
      if (hasData) grouped[areaId].skills.push(skill);
    });

    let activeAreas = Object.values(grouped).filter(g => g.skills.length > 0);
    if (filterArea !== 'ALL') activeAreas = activeAreas.filter(a => String(a.id) === String(filterArea));

    // 2. Averages
    activeAreas.forEach(area => {
      area.averages = {}; 
      area.overallAverage = 0; 
      let areaTotalSum = 0, areaTotalCount = 0;

      assessments.forEach(assess => {
        let total = 0, count = 0;
        area.skills.forEach(skill => {
          const rec = scoreIndex.get(`${String(assess.id)}|${String(skill.id)}`);
          const val = normalizeScore(rec?.score_raw);
          if (val !== null) { total += val; count++; }
        });
        if (count > 0) {
          area.averages[assess.id] = Math.round(total / count);
          areaTotalSum += area.averages[assess.id];
          areaTotalCount++;
        }
      });
      area.overallAverage = areaTotalCount > 0 ? Math.round(areaTotalSum / areaTotalCount) : null;
    });

    return { areas: activeAreas };
  }, [assessments, skills, areas, allScores, filterArea, scoreIndex]);

  // --- COLLAPSE HANDLER ---
  const toggleArea = (areaId) => {
    setExpandedAreas(prev => ({ ...prev, [areaId]: !prev[areaId] }));
  };

  const handleCreate = async () => {
    if (!newTemplateId) return;
    try {
      const selectedTmpl = templates.find(t => String(t.id) === String(newTemplateId));
      const payload = {
        student_id: student.id,
        classroom_id: classroomId || student.classroom_id,
        teacher_id: profile?.id,
        template_id: newTemplateId,
        title: newTitle || selectedTmpl?.title || 'New Assessment',
        kind: 'ASSESSMENT_2',
        assessment_date: newDate
      };
      const { error } = await supabase.from('student_assessments').insert(payload);
      if (error) throw error;
      setCreateOpen(false); setNewTitle(''); refresh();
    } catch (e) { showToast?.({ type: 'error', message: e.message }); }
  };

  if (!student) return <div style={{ padding: 20 }}>Select a student.</div>;

  return (
    <div style={{ padding: '20px 40px', maxWidth: 1400, margin: '0 auto', fontFamily: THEME.sansFont, color: THEME.text }}>
      
      {/* HEADER SECTION */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          {/* Hexagon Icon */}
          <div style={{ 
            width: 50, height: 50, 
            background: THEME.brandYellow, 
            clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 24
          }}>
            📋
          </div>
          <div>
            <h1 style={{ fontFamily: THEME.serifFont, fontSize: 32, margin: 0, color: THEME.brandPrimary }}>
              Progress <span style={{ color: THEME.brandSecondary }}>Report</span>
            </h1>
            <p style={{ margin: '4px 0 0', color: THEME.textMuted, fontWeight: 500 }}>
              {student.first_name} {student.last_name}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <select
            value={filterArea}
            onChange={(e) => setFilterArea(e.target.value)}
            style={{ 
              padding: '10px 16px', borderRadius: 0, 
              border: '1px solid #ddd', 
              color: THEME.text, fontWeight: 600, 
              outline: 'none', cursor: 'pointer', background: '#fff',
              boxShadow: '2px 2px 0px 0px #eee'
            }}
          >
            <option value="ALL">All Areas</option>
            {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
      </div>

      {/* MATRIX TABLE CARD */}
      <div style={{ 
        background: '#fff', 
        border: 'none',
        // THE HARD SHADOW
        boxShadow: `6px 6px 0px 0px ${THEME.brandAccent}`,
        borderTop: `6px solid ${THEME.brandSecondary}` 
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #eee' }}>
                <th style={{ textAlign: 'left', padding: 20, color: THEME.textMuted, width: 250, textTransform: 'uppercase', fontSize: 11, letterSpacing: 1, fontWeight: 700 }}>
                  Skill / Criteria
                </th>
                
                {assessments.map(a => (
                  <th key={a.id} style={{ padding: 16, minWidth: 160, textAlign: 'center' }}>
                    <div style={{ fontWeight: 700, color: THEME.text, fontSize: 15, fontFamily: THEME.serifFont }}>{a.title}</div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: THEME.brandSecondary, marginTop: 4 }}>{safeDate(a.assessment_date)}</div>
                  </th>
                ))}

                <th style={{ padding: 16, minWidth: 100, textAlign: 'center', background: '#FAFAFA', borderLeft: '1px solid #eee' }}>
                  <div style={{ fontWeight: 800, color: THEME.text, fontSize: 12 }}>AVG</div>
                </th>
              </tr>
            </thead>

            <tbody>
              {processedData.areas.map(area => {
                const isExpanded = !!expandedAreas[area.id];
                
                return (
                  <React.Fragment key={area.id}>
                    {/* CATEGORY HEADER ROW (Click to Expand) */}
                    <tr 
                      onClick={() => toggleArea(area.id)}
                      style={{ background: '#FCFCFC', cursor: 'pointer', borderBottom: '1px solid #eee' }}
                    > 
                      <td style={{ padding: '16px 20px', fontWeight: 800, color: THEME.brandPrimary, fontSize: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
                         {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                         {area.name.toUpperCase()}
                      </td>
                      
                      {assessments.map(a => {
                        const avg = area.averages[a.id];
                        const style = avg ? getScoreStyle(avg) : { color: '#ccc' };
                        return (
                          <td key={a.id} style={{ textAlign: 'center', ...style, fontSize: 15 }}>
                            {avg ? `${avg}%` : '-'}
                          </td>
                        );
                      })}
                      <td style={{ textAlign: 'center', fontWeight: 800, color: THEME.text, background: '#FAFAFA', borderLeft: '1px solid #eee' }}>
                        {area.overallAverage ? `${area.overallAverage}%` : '-'}
                      </td>
                    </tr>

                    {/* SKILL ROWS (Hidden unless Expanded) */}
                    {isExpanded && area.skills.map(skill => {
                      let skillSum = 0, skillCount = 0;
                      assessments.forEach(a => {
                        const r = scoreIndex.get(`${a.id}|${skill.id}`);
                        const val = normalizeScore(r?.score_raw);
                        if(val !== null) { skillSum += val; skillCount++; }
                      });
                      const skillAvg = skillCount > 0 ? Math.round(skillSum / skillCount) : null;
                      const avgStyle = skillAvg ? getScoreStyle(skillAvg) : { color: '#ccc' };

                      return (
                        <tr key={skill.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                          <td style={{ padding: '12px 20px', color: '#546E7A', verticalAlign: 'middle', fontWeight: 500, paddingLeft: 46 }}>
                            {skill.name}
                          </td>

                          {assessments.map(a => (
                            <td key={`${a.id}-${skill.id}`} style={{ padding: 0, borderLeft: '1px solid #fafafa', verticalAlign: 'top' }}>
                              <EditableCell
                                assessmentId={a.id} skillId={skill.id}
                                scoreRec={scoreIndex.get(`${a.id}|${skill.id}`)}
                                onSave={handleSaveScore}
                              />
                            </td>
                          ))}

                          <td style={{ textAlign: 'center', verticalAlign: 'middle', background: '#FAFAFA', borderLeft: '1px solid #eee', ...avgStyle }}>
                            {skillAvg ? `${skillAvg}%` : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              })}
              {processedData.areas.length === 0 && (
                 <tr><td colSpan={10} style={{padding: 40, textAlign: 'center', color: '#999'}}>No data available for this filter.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE MODAL */}
      {createOpen && (
        <Modal title="New Assessment" onClose={() => setCreateOpen(false)} width={450}>
          <div style={{ display: 'grid', gap: 16 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: THEME.textMuted }}>TEMPLATE</label>
              <select 
                value={newTemplateId} onChange={e => setNewTemplateId(e.target.value)}
                style={{ width: '100%', padding: 10, marginTop: 6, border: '1px solid #ddd', background: '#fff', color: THEME.text }}
              >
                {templates.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: THEME.textMuted }}>TITLE</label>
              <input 
                value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="e.g. Winter Term Evaluation"
                style={{ width: '100%', padding: 10, marginTop: 6, border: '1px solid #ddd', color: THEME.text }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: THEME.textMuted }}>DATE</label>
              <input 
                type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
                style={{ width: '100%', padding: 10, marginTop: 6, border: '1px solid #ddd', color: THEME.text }}
              />
            </div>
            <div style={{ textAlign: 'right', marginTop: 10 }}>
              <Button onClick={handleCreate} style={{ background: THEME.brandSecondary, color: THEME.text }}>
                Create
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}