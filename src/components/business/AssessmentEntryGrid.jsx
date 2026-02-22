import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../supabaseClient';
import { Loader, Check, Filter } from 'lucide-react';
import { THEME } from '../../ui/theme';

// ---------- Color helpers ----------
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

// Match AssessmentsView UI palette
const UI = {
  bg: THEME.bg,
  card: THEME.cardBg,
  text: THEME.text,
  muted: THEME.textMuted,
  primary: THEME.brandPrimary,
  secondary: THEME.brandSecondary,
  accent: THEME.brandAccent,
  yellow: THEME.brandYellow,
  border: THEME.brandAccent,
  danger: '#D32F2F',
  success: '#2E7D32',
};

// ---------- Score helpers ----------
const isSpecialToken = (v) => {
  const s = String(v ?? '').trim().toLowerCase();
  return s === 'x' || s === 'na' || s === 'n/a' || s === 'absent';
};

const normalizeScore = (raw) => {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (isSpecialToken(s) || s.toUpperCase() === 'X') return null;

  const clean = s.replace(/%/g, '').trim();
  const num = parseFloat(clean);
  return Number.isFinite(num) ? num : null;
};

const sanitizeScoreForDb = (input) => {
  const s = String(input ?? '').trim();
  if (!s) return null;
  if (isSpecialToken(s) || s.toUpperCase() === 'X') return 'X';

  const clean = s.replace(/%/g, '').trim();
  const num = parseFloat(clean);
  if (!Number.isFinite(num)) return null;

  const clamped = Math.max(0, Math.min(100, num));
  const rounded = Math.round(clamped);
  return String(rounded);
};

const displayForInput = (raw) => {
  if (raw === null || raw === undefined) return '';
  const s = String(raw).trim();
  if (!s) return '';
  if (isSpecialToken(s) || s.toUpperCase() === 'X') return 'X';

  const n = normalizeScore(s);
  if (n === null) return '';
  return String(Math.round(n));
};

const getScoreStyle = (rawVal) => {
  const s = String(rawVal ?? '').trim();
  if (s && (isSpecialToken(s) || s.toUpperCase() === 'X')) {
    return { color: UI.muted, fontWeight: 500, fontStyle: 'italic' };
  }

  const val = normalizeScore(rawVal);
  if (val === null) return { color: UI.muted, fontWeight: 500 };
  if (val >= 80) return { color: UI.success, fontWeight: 550 };
  if (val >= 55) return { color: '#B7791F', fontWeight: 550 };
  return { color: UI.danger, fontWeight: 550 };
};

// ---------- Sub-component: GridCell ----------
const GridCell = ({ studentId, skillId, initialData, onSave, isMissing }) => {
  const getSafeValue = (d) => displayForInput(d?.score_raw);

  const [val, setVal] = useState(getSafeValue(initialData));
  const [status, setStatus] = useState('idle');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [modalScore, setModalScore] = useState('');
  const [modalComment, setModalComment] = useState('');

  useEffect(() => {
    setVal(getSafeValue(initialData));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData?.score_raw, initialData?.comment]);

  const triggerSave = async (newScore, newComment) => {
    setStatus('saving');
    try {
      await onSave(studentId, skillId, newScore, newComment);
      setStatus('saved');
      setTimeout(() => setStatus('idle'), 1600);
    } catch (e) {
      console.error(e);
      setStatus('error');
    }
  };

  const handleBlur = async () => {
    const currentDbValue = getSafeValue(initialData);
    if (String(val ?? '') === String(currentDbValue ?? '')) return;
    const cleaned = sanitizeScoreForDb(val);
    setVal(displayForInput(cleaned));
    await triggerSave(cleaned, initialData?.comment || '');
  };

  const openModal = () => {
    setModalScore(val);
    setModalComment(initialData?.comment || '');
    setIsModalOpen(true);
  };

  const saveFromModal = async () => {
    const cleaned = sanitizeScoreForDb(modalScore);
    setVal(displayForInput(cleaned));
    await triggerSave(cleaned, modalComment);
    setIsModalOpen(false);
  };

  const hasComment = !!initialData?.comment;

  let containerStyle = {
    position: 'relative',
    height: '100%',
    minHeight: 30,
    background: 'transparent',
  };

  if (status === 'error') {
    containerStyle.background = rgba(UI.danger, 0.08);
  } else if (isMissing) {
    containerStyle.background = rgba(UI.yellow, 0.22);
    containerStyle.boxShadow = `inset 0 0 0 1px ${rgba(UI.yellow, 0.9)}`;
  }

  return (
    <div style={containerStyle} onDoubleClick={openModal} title={isMissing ? 'Missing grade for this student' : ''}>
      <input
        type="text"
        inputMode="numeric"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={handleBlur}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          textAlign: 'center',
          background: 'transparent',
          fontSize: 11,
          outline: 'none',
          fontFamily: THEME.sansFont,
          padding: 0,
          fontWeight: 500,
          ...getScoreStyle(val),
        }}
      />

      {status === 'saved' && (
        <div style={{ position: 'absolute', top: 2, right: 2, pointerEvents: 'none', opacity: 0.9 }}>
          <Check size={10} color={UI.primary} strokeWidth={3} />
        </div>
      )}

      {hasComment && (
        <div
          title={initialData.comment}
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: 0,
            height: 0,
            borderStyle: 'solid',
            borderWidth: '0 7px 7px 0',
            borderColor: `transparent ${UI.yellow} transparent transparent`,
          }}
        />
      )}

      {isModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: rgba(UI.primary, 0.2),
            backdropFilter: 'blur(2px)',
            padding: 18,
          }}
          onClick={() => setIsModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 360,
              maxWidth: '100%',
              background: '#fff',
              borderRadius: THEME.radius,
              padding: 18,
              boxShadow: `10px 10px 0px 0px ${UI.accent}`,
              border: `1px solid ${rgba(UI.border, 0.6)}`,
            }}
          >
            <div
              style={{
                margin: '0 0 14px',
                fontSize: 16,
                fontWeight: 650,
                color: UI.text,
                fontFamily: THEME.serifFont,
              }}
            >
              Edit grade & note
            </div>

            <div style={{ marginBottom: 12 }}>
              <label
                style={{
                  display: 'block',
                  fontSize: 10,
                  fontWeight: 600,
                  color: UI.muted,
                  marginBottom: 6,
                  textTransform: 'uppercase',
                  letterSpacing: '0.45px',
                  fontFamily: THEME.sansFont,
                }}
              >
                Score / Grade
              </label>
              <input
                autoFocus
                value={modalScore}
                onChange={(e) => setModalScore(e.target.value)}
                placeholder="0–100 or X"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: `1px solid ${rgba(UI.border, 0.6)}`,
                  borderRadius: THEME.radius,
                  fontWeight: 500,
                  fontSize: 13,
                  outline: 'none',
                  color: UI.text,
                  fontFamily: THEME.sansFont,
                }}
                onFocus={(e) => (e.target.style.borderColor = UI.primary)}
                onBlur={(e) => (e.target.style.borderColor = rgba(UI.border, 0.6))}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label
                style={{
                  display: 'block',
                  fontSize: 10,
                  fontWeight: 600,
                  color: UI.muted,
                  marginBottom: 6,
                  textTransform: 'uppercase',
                  letterSpacing: '0.45px',
                  fontFamily: THEME.sansFont,
                }}
              >
                Teacher note
              </label>
              <textarea
                rows={4}
                value={modalComment}
                onChange={(e) => setModalComment(e.target.value)}
                placeholder="Enter observations..."
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: `1px solid ${rgba(UI.border, 0.6)}`,
                  borderRadius: THEME.radius,
                  fontSize: 13,
                  outline: 'none',
                  fontFamily: THEME.sansFont,
                  resize: 'vertical',
                  color: UI.text,
                  fontWeight: 500,
                }}
                onFocus={(e) => (e.target.style.borderColor = UI.primary)}
                onBlur={(e) => (e.target.style.borderColor = rgba(UI.border, 0.6))}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{
                  padding: '8px 14px',
                  border: `1px solid ${rgba(UI.border, 0.6)}`,
                  background: '#fff',
                  cursor: 'pointer',
                  color: UI.text,
                  fontWeight: 600,
                  borderRadius: THEME.radius,
                  fontFamily: THEME.sansFont,
                }}
              >
                Cancel
              </button>
              <button
                onClick={saveFromModal}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  background: UI.primary,
                  color: '#fff',
                  borderRadius: THEME.radius,
                  cursor: 'pointer',
                  fontWeight: 650,
                  fontFamily: THEME.sansFont,
                  boxShadow: `3px 3px 0px 0px ${rgba(UI.accent, 0.75)}`,
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default function AssessmentEntryGrid({ template, classroomId, skills, students }) {
  const [loading, setLoading] = useState(true);
  const [matrix, setMatrix] = useState({});
  const [assessmentIds, setAssessmentIds] = useState({});
  const [areas, setAreas] = useState([]);

  const [filterArea, setFilterArea] = useState('ALL');
  const [filterStudent, setFilterStudent] = useState('ALL');
  const [hideEmpty, setHideEmpty] = useState(false);

  const studentsKey = useMemo(() => (students || []).map((s) => String(s.id)).join('|'), [students]);

  useEffect(() => {
    if (!template?.id || !classroomId) return;
    loadGridData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template?.id, classroomId, studentsKey]);

  const loadGridData = async () => {
    if (!template?.id) return;
    setLoading(true);

    try {
      const { data: areaData, error: areaErr } = await supabase
        .from('curriculum_areas')
        .select('id, name, color_hex')
        .order('name');
      if (areaErr) throw areaErr;
      setAreas(areaData || []);

      const { data: runs, error: runError } = await supabase
        .from('student_assessments')
        .select('id, student_id')
        .eq('template_id', template.id)
        .eq('classroom_id', classroomId);

      if (runError) throw runError;

      const runMapByStudent = {};
      const studentByRunId = {};
      (runs || []).forEach((r) => {
        runMapByStudent[String(r.student_id)] = r.id;
        studentByRunId[String(r.id)] = r.student_id;
      });
      setAssessmentIds(runMapByStudent);

      const matrixData = {};
      (students || []).forEach((st) => {
        matrixData[String(st.id)] = {};
      });

      if ((runs || []).length > 0) {
        const ids = runs.map((r) => r.id);

        const { data: scores, error: scoreError } = await supabase
          .from('student_assessment_scores')
          .select('assessment_id, skill_id, score_raw, comment, created_at')
          .in('assessment_id', ids)
          .order('created_at', { ascending: false });

        if (scoreError) throw scoreError;

        (scores || []).forEach((s) => {
          const studentId = studentByRunId[String(s.assessment_id)];
          if (!studentId) return;

          const sid = String(studentId);
          const kid = String(s.skill_id);

          // latest wins
          if (!matrixData[sid][kid]) {
            matrixData[sid][kid] = { score_raw: s.score_raw, comment: s.comment };
          }
        });
      }

      setMatrix(matrixData);
    } catch (e) {
      console.error('Grid Load Error', e);
    } finally {
      setLoading(false);
    }
  };

  const handleCellSave = async (studentId, skillId, rawScore, comment) => {
    const sid = String(studentId);
    let runId = assessmentIds[sid];

    const { data: userRes } = await supabase.auth.getUser();
    const teacherId = userRes?.user?.id || null;

    if (!runId) {
      const { data, error } = await supabase
        .from('student_assessments')
        .insert({
          template_id: template.id,
          classroom_id: classroomId,
          student_id: studentId,
          teacher_id: teacherId,
          title: template.title,
          assessment_date: template.default_date || new Date().toISOString().split('T')[0],
        })
        .select();

      if (error) throw error;
      runId = data?.[0]?.id;
      setAssessmentIds((prev) => ({ ...prev, [sid]: runId }));
    }

    const payload = {
      assessment_id: runId,
      skill_id: skillId,
      score_raw: rawScore,
      comment: comment,
      classroom_id: classroomId,
    };

    let upsertErr = null;
    const upsertRes = await supabase
      .from('student_assessment_scores')
      .upsert(payload, { onConflict: 'assessment_id, skill_id' });

    upsertErr = upsertRes?.error || null;

    if (upsertErr && String(upsertErr.message || '').toLowerCase().includes('no unique')) {
      const { data: existing, error: existErr } = await supabase
        .from('student_assessment_scores')
        .select('id')
        .eq('assessment_id', runId)
        .eq('skill_id', skillId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (existErr) throw existErr;

      if (existing?.length) {
        const { error: updErr } = await supabase
          .from('student_assessment_scores')
          .update({ score_raw: rawScore, comment: comment, classroom_id: classroomId })
          .eq('id', existing[0].id);

        if (updErr) throw updErr;
      } else {
        const { error: insErr } = await supabase.from('student_assessment_scores').insert(payload);
        if (insErr) throw insErr;
      }
    } else if (upsertErr) {
      throw upsertErr;
    }

    setMatrix((prev) => ({
      ...prev,
      [sid]: {
        ...(prev[sid] || {}),
        [String(skillId)]: { score_raw: rawScore, comment: comment },
      },
    }));
  };

  const filteredStudents = useMemo(() => {
    if (filterStudent === 'ALL') return students || [];
    return (students || []).filter((s) => String(s.id) === String(filterStudent));
  }, [students, filterStudent]);

  // Column stats (preserved logic)
  const columnStats = useMemo(() => {
    const stats = {};
    (skills || []).forEach((skill) => {
      let filledCount = 0;
      const total = filteredStudents.length;

      filteredStudents.forEach((st) => {
        const hasVal = matrix[String(st.id)]?.[String(skill.id)]?.score_raw;
        if (hasVal) filledCount++;
      });

      stats[skill.id] = {
        hasData: filledCount > 0,
        completion: total > 0 ? filledCount / total : 0,
      };
    });
    return stats;
  }, [skills, filteredStudents, matrix]);

  const groupedSkills = useMemo(() => {
    if (!skills || !areas) return [];

    let relevantSkills = skills;

    if (filterArea !== 'ALL') {
      if (filterArea === 'GENERAL') relevantSkills = skills.filter((s) => !s.area_id);
      else relevantSkills = skills.filter((s) => String(s.area_id) === String(filterArea));
    }

    if (hideEmpty) {
      relevantSkills = relevantSkills.filter((s) => columnStats[s.id]?.hasData);
    }

    const groups = {};
    const noArea = [];

    relevantSkills.forEach((skill) => {
      if (skill.area_id) {
        if (!groups[skill.area_id]) groups[skill.area_id] = [];
        groups[skill.area_id].push(skill);
      } else {
        noArea.push(skill);
      }
    });

    const result = [];
    (areas || []).forEach((area) => {
      if (groups[area.id] && groups[area.id].length > 0) {
        result.push({
          areaId: area.id,
          areaName: area.name,
          color: area.color_hex,
          skills: groups[area.id],
        });
      }
    });

    if (noArea.length > 0) {
      result.push({
        areaId: 'GENERAL',
        areaName: 'General',
        color: UI.secondary,
        skills: noArea,
      });
    }

    return result;
  }, [skills, areas, filterArea, hideEmpty, columnStats]);

  const flatSkills = useMemo(() => groupedSkills.flatMap((g) => g.skills), [groupedSkills]);

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: UI.muted, fontFamily: THEME.sansFont, fontWeight: 500 }}>
        <Loader className="spin" /> Loading data...
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
        minWidth: 0,

        // IMPORTANT: removing outer overflow hidden avoids hard clipping
        overflow: 'visible',

        fontFamily: THEME.sansFont,
      }}
    >
      {/* Filters */}
      <div
        style={{
          background: UI.card,
          border: `1px solid ${rgba(UI.border, 0.45)}`,
          boxShadow: THEME.cardShadow,
          borderRadius: THEME.radius,
          padding: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
          flexShrink: 0,
          marginBottom: 12,
          minWidth: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: UI.muted, fontSize: 12, fontWeight: 600 }}>
          <Filter size={14} /> Filters
        </div>

        <select
          value={filterArea}
          onChange={(e) => setFilterArea(e.target.value)}
          style={{
            padding: '8px 12px',
            borderRadius: THEME.radius,
            border: `1px solid ${rgba(UI.border, 0.45)}`,
            fontSize: 12,
            color: UI.text,
            outline: 'none',
            background: '#fff',
            cursor: 'pointer',
            fontFamily: THEME.sansFont,
            fontWeight: 500,
          }}
          onFocus={(e) => (e.target.style.borderColor = UI.primary)}
          onBlur={(e) => (e.target.style.borderColor = rgba(UI.border, 0.45))}
        >
          <option value="ALL">All Areas</option>
          {areas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>

        <select
          value={filterStudent}
          onChange={(e) => setFilterStudent(e.target.value)}
          style={{
            padding: '8px 12px',
            borderRadius: THEME.radius,
            border: `1px solid ${rgba(UI.border, 0.45)}`,
            fontSize: 12,
            color: UI.text,
            outline: 'none',
            background: '#fff',
            cursor: 'pointer',
            fontFamily: THEME.sansFont,
            fontWeight: 500,
          }}
          onFocus={(e) => (e.target.style.borderColor = UI.primary)}
          onBlur={(e) => (e.target.style.borderColor = rgba(UI.border, 0.45))}
        >
          <option value="ALL">All Students</option>
          {(students || []).map((s) => (
            <option key={s.id} value={String(s.id)}>
              {s.first_name} {s.last_name}
            </option>
          ))}
        </select>

        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 12,
            fontWeight: 500,
            color: UI.text,
            cursor: 'pointer',
            marginLeft: 4,
            userSelect: 'none',
          }}
        >
          <input
            type="checkbox"
            checked={hideEmpty}
            onChange={(e) => setHideEmpty(e.target.checked)}
            style={{ accentColor: UI.primary }}
          />
          Hide Unstarted Skills
        </label>

        <div style={{ marginLeft: 'auto', fontSize: 11, color: UI.muted, fontWeight: 500 }}>
          Tip: <span style={{ color: UI.text }}>yellow cells</span> = missing grade for a started skill
        </div>
      </div>

      {/* Scroll frame (single scroll surface) */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          minWidth: 0,
          overflow: 'auto',
          border: `1px solid ${rgba(UI.border, 0.45)}`,
          borderRadius: THEME.radius,
          background: '#fff',
          boxShadow: THEME.cardShadow,
          WebkitOverflowScrolling: 'touch',

          // prevents bottom scrollbar being visually cut tight
          paddingBottom: 10,
        }}
      >
        <table
          style={{
            borderCollapse: 'separate',
            borderSpacing: 0,
            width: 'max-content',
            minWidth: '100%',
            fontSize: 12,
          }}
        >
          <thead>
            {/* Row 1: Area headers */}
            <tr>
              <th
                style={{
                  position: 'sticky',
                  left: 0,
                  top: 0,
                  zIndex: 30,
                  background: UI.bg,
                  borderBottom: `1px solid ${rgba(UI.border, 0.45)}`,
                  borderRight: `1px solid ${rgba(UI.border, 0.45)}`,
                  minWidth: 180,
                  height: 30,
                }}
              />
              {groupedSkills.map((group) => (
                <th
                  key={String(group.areaId)}
                  colSpan={group.skills.length}
                  style={{
                    padding: '6px 10px',
                    background: rgba(group.color || UI.secondary, 0.45),
                    color: UI.text,
                    fontWeight: 600,
                    fontSize: 10,
                    textTransform: 'uppercase',
                    letterSpacing: '0.45px',
                    borderBottom: `1px solid ${rgba(UI.border, 0.45)}`,
                    position: 'sticky',
                    top: 0,
                    zIndex: 20,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {group.areaName}
                </th>
              ))}
            </tr>

            {/* Row 2: Skill names */}
            <tr>
              <th
                style={{
                  position: 'sticky',
                  left: 0,
                  top: 30,
                  zIndex: 30,
                  background: '#fff',
                  borderBottom: `1px solid ${rgba(UI.border, 0.45)}`,
                  borderRight: `1px solid ${rgba(UI.border, 0.45)}`,
                  padding: '10px 12px',
                  textAlign: 'left',
                  fontWeight: 600,
                  color: UI.text,
                  fontSize: 12,
                }}
              >
                Student Name
              </th>

              {flatSkills.map((skill) => (
                <th
                  key={skill.id}
                  style={{
                    minWidth: 70,
                    maxWidth: 96,
                    padding: '8px 8px',
                    borderBottom: `1px solid ${rgba(UI.border, 0.45)}`,
                    borderLeft: `1px solid ${rgba(UI.border, 0.35)}`,
                    background: '#fff',
                    fontWeight: 550,
                    color: UI.muted,
                    fontSize: 10,
                    position: 'sticky',
                    top: 30,
                    zIndex: 20,
                    height: 64,
                    verticalAlign: 'bottom',
                    lineHeight: 1.15,
                  }}
                >
                  <div
                    style={{
                      maxHeight: 56,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'normal',
                      wordBreak: 'break-word',
                    }}
                    title={skill.name}
                  >
                    {skill.name}
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {filteredStudents.length === 0 ? (
              <tr>
                <td colSpan={100} style={{ padding: 40, textAlign: 'center', color: UI.muted, fontWeight: 500 }}>
                  No students found.
                </td>
              </tr>
            ) : (
              filteredStudents.map((student) => (
                <tr key={student.id}>
                  <td
                    style={{
                      position: 'sticky',
                      left: 0,
                      background: '#fff',
                      zIndex: 10,
                      padding: '10px 12px',
                      fontWeight: 550,
                      borderRight: `1px solid ${rgba(UI.border, 0.45)}`,
                      borderBottom: `1px solid ${rgba(UI.border, 0.35)}`,
                      color: UI.text,
                      fontSize: 12,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {student.first_name} {student.last_name}
                  </td>

                  {flatSkills.map((skill) => {
                    const cellData = matrix[String(student.id)]?.[String(skill.id)];
                    const hasVal = !!cellData?.score_raw;
                    const stats = columnStats[skill.id];
                    const isMissing = !hasVal && stats && stats.hasData;

                    return (
                      <td
                        key={skill.id}
                        style={{
                          borderLeft: `1px solid ${rgba(UI.border, 0.35)}`,
                          borderBottom: `1px solid ${rgba(UI.border, 0.35)}`,
                          padding: 0,
                          height: 32,
                        }}
                      >
                        <GridCell
                          studentId={student.id}
                          skillId={skill.id}
                          initialData={cellData}
                          onSave={handleCellSave}
                          isMissing={isMissing}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
