// src/views/AssessmentsView.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import { THEME } from '../ui/theme';
import AssessmentEntryGrid from '../components/business/AssessmentEntryGrid';
import {
  Plus,
  Save,
  X,
  Check,
  Trash2,
  Grid,
  LayoutDashboard,
  ChevronDown,
  BookOpen,
  Target,
  AlertCircle,
  Settings,
  Download,
  RefreshCcw,
  ArrowUpDown,
  ArrowLeft,
  FileText,
  Edit3,
  Calendar,
  Table
} from 'lucide-react';

// ---------- Color & UI Helpers ----------
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
  borderSoft: rgba(THEME.brandAccent, 0.28),
  borderHover: rgba(THEME.brandPrimary, 0.4),
  danger: '#D32F2F',
  success: '#2E7D32',
};

const normalizeScore = (raw) => {
  if (raw === null || raw === undefined || raw === '') return null;
  const clean = String(raw).replace(/%/g, '').trim();
  const num = parseFloat(clean);
  return Number.isFinite(num) ? num : null;
};

// ---------- UI Primitives ----------
const Divider = ({ style }) => <div style={{ height: 1, background: UI.borderSoft, ...style }} />;

const FormLabel = ({ children, style }) => (
  <label
    style={{
      display: 'block',
      fontSize: 10,
      fontWeight: 600,
      color: UI.muted,
      marginBottom: 4,
      textTransform: 'uppercase',
      letterSpacing: '0.4px',
      fontFamily: THEME.sansFont,
      ...style,
    }}
  >
    {children}
  </label>
);

const ThemedCard = ({ children, style, className = '', onClick }) => (
  <div
    className={`mb-card ${className}`}
    onClick={onClick}
    style={{
      backgroundColor: UI.card,
      borderRadius: THEME.radius,
      boxShadow: THEME.cardShadow,
      border: `1px solid ${UI.borderSoft}`,
      overflow: 'visible',
      cursor: onClick ? 'pointer' : 'default',
      ...style,
    }}
  >
    {children}
  </div>
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

const Button = ({ variant = 'primary', children, style, ...props }) => {
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
    transition: 'transform 120ms ease, box-shadow 120ms ease, background 120ms ease',
    userSelect: 'none',
    whiteSpace: 'nowrap',
  };

  const variants = {
    primary: {
      background: UI.primary,
      color: '#fff',
      boxShadow: `2px 2px 0px 0px ${rgba(UI.accent, 0.55)}`,
    },
    secondary: {
      background: rgba(UI.secondary, 0.15),
      color: UI.primary,
      border: `1px solid ${rgba(UI.primary, 0.2)}`,
    },
    danger: {
      background: 'transparent',
      color: UI.danger,
      border: `1px solid ${rgba(UI.danger, 0.5)}`,
    },
    ghost: {
      background: 'transparent',
      color: UI.muted,
      border: '1px solid transparent',
    }
  };

  return (
    <button
      {...props}
      style={{ ...base, ...(variants[variant] || variants.primary), ...style }}
      onMouseDown={(e) => (e.currentTarget.style.transform = 'translate(1px, 1px)')}
      onMouseUp={(e) => (e.currentTarget.style.transform = 'translate(0, 0)')}
      onMouseLeave={(e) => (e.currentTarget.style.transform = 'translate(0, 0)')}
    >
      {children}
    </button>
  );
};

const TabPill = ({ active, icon: Icon, label, onClick }) => (
  <button
    onClick={onClick}
    className="mb-tabpill"
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '6px 14px',
      borderRadius: 4,
      border: `1px solid ${active ? rgba(UI.primary, 0.22) : 'transparent'}`,
      background: active ? rgba(UI.primary, 0.08) : 'transparent',
      color: active ? UI.primary : UI.muted,
      fontFamily: THEME.sansFont,
      fontSize: 12,
      fontWeight: 600,
      cursor: 'pointer',
      boxShadow: 'none',
      transition: 'all 0.15s ease',
      userSelect: 'none',
      whiteSpace: 'nowrap',
    }}
  >
    {Icon && <Icon size={14} strokeWidth={active ? 2.5 : 2} />}
    {label}
  </button>
);

const IconBadge = ({ color, children }) => (
  <div
    style={{
      width: 32,
      height: 32,
      borderRadius: 8,
      display: 'grid',
      placeItems: 'center',
      background: rgba(color, 0.1),
      border: `1px solid ${rgba(color, 0.2)}`,
      color: color,
      flexShrink: 0,
    }}
  >
    {children}
  </div>
);

const SoftChip = ({ tone = 'neutral', children, onClick, title }) => {
  const tones = {
    neutral: { bg: rgba(UI.text, 0.04), bd: rgba(UI.text, 0.12), fg: UI.text },
    warn: { bg: rgba(UI.yellow, 0.15), bd: rgba(UI.yellow, 0.35), fg: '#7A5C00' },
    danger: { bg: rgba(UI.danger, 0.08), bd: rgba(UI.danger, 0.22), fg: UI.danger },
    primary: { bg: rgba(UI.primary, 0.08), bd: rgba(UI.primary, 0.22), fg: UI.primary },
    success: { bg: rgba(UI.success, 0.1), bd: rgba(UI.success, 0.25), fg: UI.success },
  };
  const t = tones[tone] || tones.neutral;
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      onClick={onClick}
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 8px',
        borderRadius: 4,
        border: `1px solid ${t.bd}`,
        background: t.bg,
        color: t.fg,
        fontSize: 10,
        fontWeight: 600,
        fontFamily: THEME.sansFont,
        cursor: onClick ? 'pointer' : 'default',
        userSelect: 'none',
        lineHeight: 1,
      }}
    >
      {children}
    </Comp>
  );
};

const SuccessToast = ({ show }) => (
  <div
    style={{
      position: 'fixed',
      bottom: show ? 26 : -120,
      right: 26,
      backgroundColor: UI.primary,
      color: '#fff',
      padding: '10px 16px',
      borderRadius: THEME.radius,
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      boxShadow: `0 10px 30px -10px ${rgba(UI.primary, 0.5)}`,
      transition: 'all 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
      opacity: show ? 1 : 0,
      zIndex: 9999,
      fontWeight: 600,
      fontSize: 12,
      fontFamily: THEME.sansFont,
      border: `1px solid ${rgba('#fff', 0.2)}`,
    }}
  >
    <Check size={16} strokeWidth={3} />
    Changes Saved
  </div>
);

const ProgressBar = ({ value, color, height = 6 }) => (
  <div
    style={{
      height: height,
      width: '100%',
      background: rgba(UI.text, 0.08),
      borderRadius: 99,
      overflow: 'hidden',
    }}
  >
    <div
      style={{
        height: '100%',
        width: `${Math.min(100, Math.max(0, value || 0))}%`,
        background: color,
        borderRadius: 99,
        transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    />
  </div>
);

// Simple modal
const SimpleModal = ({ open, title, onClose, children }) => {
  if (!open) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: rgba(UI.bg, 0.6),
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 18,
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(500px, 100%)',
          maxHeight: '80vh',
          background: '#fff',
          borderRadius: THEME.radius,
          border: `1px solid ${UI.borderSoft}`,
          boxShadow: THEME.cardShadow,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            padding: '14px 18px',
            borderBottom: `1px solid ${UI.borderSoft}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            background: UI.bg,
          }}
        >
          <div style={{ fontFamily: THEME.serifFont, fontSize: 16, fontWeight: 700, color: UI.text }}>{title}</div>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 4 }}>
            <X size={18} color={UI.muted} />
          </button>
        </div>
        <div style={{ padding: 16, overflowY: 'auto' }}>{children}</div>
      </div>
    </div>
  );
};

const SelectWithChevron = ({ value, onChange, children }) => (
  <div style={{ position: 'relative' }}>
    <Field
      as="select"
      value={value}
      onChange={onChange}
      style={{
        paddingRight: 34,
        fontWeight: 600,
        color: UI.primary,
        background: rgba(UI.primary, 0.03),
        border: `1px solid ${rgba(UI.primary, 0.2)}`,
        fontSize: 13
      }}
    >
      {children}
    </Field>
    <ChevronDown
      size={14}
      color={UI.primary}
      style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
    />
  </div>
);

export default function AssessmentsView({ profile, classrooms = [], curriculumAreas = [], showToast }) {
  const isSupervisor = ['supervisor', 'super_admin', 'admin'].includes(profile?.role);

  // States
  const [activeMode, setActiveMode] = useState('templates'); // Default: Templates
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedToast, setSavedToast] = useState(false);

  // Data
  const [templates, setTemplates] = useState([]);
  const [domains, setDomains] = useState([]);
  const [skills, setSkills] = useState([]);
  const [students, setStudents] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [analyticsScores, setAnalyticsScores] = useState([]);

  // Selection & Editing
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('ALL');
  
  // Template Management States
  const [isEditingTemplate, setIsEditingTemplate] = useState(false); // New toggle for list vs form
  const [editing, setEditing] = useState(null);

  // Sorting for student table
  const [studentSort, setStudentSort] = useState({ key: 'name', dir: 'asc' });

  // Helpers for editing
  const [newSkillName, setNewSkillName] = useState('');
  const [newSkillAreaId, setNewSkillAreaId] = useState('');
  const [editSkillId, setEditSkillId] = useState(null);

  // Modals
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailPayload, setDetailPayload] = useState(null);

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ensure non-supervisors fall back to grid
  useEffect(() => {
    if (profile && !isSupervisor && activeMode === 'templates') {
      setActiveMode('grid');
    }
  }, [profile, isSupervisor, activeMode]);

  useEffect(() => {
    if (classrooms.length > 0 && !selectedClassId) setSelectedClassId(classrooms[0].id);
  }, [classrooms, selectedClassId]);

  useEffect(() => {
    if (savedToast) {
      const t = setTimeout(() => setSavedToast(false), 2200);
      return () => clearTimeout(t);
    }
  }, [savedToast]);

  useEffect(() => {
    if (!newSkillAreaId && curriculumAreas?.[0]?.id) setNewSkillAreaId(curriculumAreas[0].id);
  }, [curriculumAreas, newSkillAreaId]);

  // Reset editing mode when switching tabs
  useEffect(() => {
    if (activeMode !== 'templates') {
      setIsEditingTemplate(false);
      setEditing(null);
    }
  }, [activeMode]);

  const openListModal = (title, studentsList) => {
    setDetailPayload({
      title,
      rows: (studentsList || []).map((s) => ({ name: s.name, avg: s.avg })),
    });
    setDetailOpen(true);
  };

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [t, d, s, scores, stud, runs] = await Promise.all([
        supabase.from('assessment_templates').select('*').order('created_at', { ascending: false }),
        supabase.from('assessment_domains').select('*'),
        supabase.from('assessment_skills').select('*').order('sort_order', { ascending: true }),
        supabase.from('student_assessment_scores').select(`
          id, score_raw, comment, skill_id, assessment_id,
          student_assessments!inner(id, classroom_id, assessment_date, title, template_id, student_id)
        `),
        supabase.from('students').select('id, first_name, last_name, classroom_id'),
        supabase.from('student_assessments').select('id, classroom_id, assessment_date, title, template_id, student_id'),
      ]);

      setTemplates(t.data || []);
      setDomains(d.data || []);
      setSkills(s.data || []);
      setAnalyticsScores(scores.data || []);
      setStudents(stud.data || []);
      setAssessments(runs.data || []);
    } catch (e) {
      console.error(e);
      showToast?.({ type: 'error', title: 'Load error', message: 'Failed to load assessments.' });
    } finally {
      setLoading(false);
    }
  };

  const templatesForSelectedClass = useMemo(() => {
    if (!selectedClassId) return templates || [];
    const filtered = (templates || []).filter((t) => (t.classroom_ids || []).map(String).includes(String(selectedClassId)));
    return filtered.length ? filtered : templates || [];
  }, [templates, selectedClassId]);

  // ---------- ANALYTICS COMPUTATION ----------
  const analyticsData = useMemo(() => {
    if (!selectedClassId) return null;

    const studentsInClass = (students || []).filter((st) => String(st.classroom_id) === String(selectedClassId));
    const studentName = (st) => `${st.first_name || ''} ${st.last_name || ''}`.trim();

    const skillsById = new Map((skills || []).map((s) => [String(s.id), s]));
    const areaById = new Map((curriculumAreas || []).map((a) => [String(a.id), a]));

    // Expected skills for progress tracking
    let expectedSkillCount = 0;
    if (selectedTemplateId !== 'ALL') {
      const domainIds = (domains || [])
        .filter((d) => String(d.template_id) === String(selectedTemplateId))
        .map((d) => String(d.id));
      const tSkills = (skills || []).filter((sk) => domainIds.includes(String(sk.domain_id)));
      expectedSkillCount = tSkills.length;
    }

    let relevantScores = (analyticsScores || []).filter(
      (s) => String(s.student_assessments?.classroom_id) === String(selectedClassId)
    );
    if (selectedTemplateId !== 'ALL') {
      relevantScores = relevantScores.filter(
        (s) => String(s.student_assessments?.template_id) === String(selectedTemplateId)
      );
    }

    const hasAnyScoreRow = relevantScores.length > 0;

    let totalSum = 0, totalCount = 0;
    const perStudent = {};
    const perStudentSkills = {}; // To track individual skill scores per student for "Focus Areas"
    const perArea = {};
    const skillGroups = {};
    const perStudentStatus = {}; // sid -> { numericCount, xCount, blankCount }

    // Init student status
    studentsInClass.forEach(s => {
      perStudentStatus[s.id] = { numericCount: 0, xCount: 0, blankCount: 0 };
      perStudent[s.id] = { sum: 0, count: 0 };
      perStudentSkills[s.id] = [];
    });

    relevantScores.forEach((rec) => {
      const sid = String(rec.student_assessments?.student_id || '');
      if (!sid || !perStudentStatus[sid]) return;

      const rawStr = rec.score_raw === null || rec.score_raw === undefined ? '' : String(rec.score_raw).trim();
      const isX = rawStr.toLowerCase() === 'x';
      const isBlank = rawStr === '';
      const val = normalizeScore(rec.score_raw);
      const skill = skillsById.get(String(rec.skill_id));
      const areaId = String(skill?.area_id ?? 'OTHER');

      if (isX) perStudentStatus[sid].xCount += 1;
      if (isBlank) perStudentStatus[sid].blankCount += 1;

      if (val !== null) {
        perStudentStatus[sid].numericCount += 1;
        totalSum += val;
        totalCount += 1;
        perStudent[sid].sum += val;
        perStudent[sid].count += 1;
        
        // Track individual skill for student focus areas
        if(skill) {
            perStudentSkills[sid].push({
                name: skill.name,
                val: val,
                areaId: areaId,
                areaColor: areaById.get(areaId)?.color_hex || UI.secondary
            });
        }
      }

      if (val !== null) {
        const nameKey = String(skill?.name || 'Unknown').trim().toLowerCase();

        // Area stats
        if (!perArea[areaId]) perArea[areaId] = { sum: 0, count: 0, skillIds: new Set() };
        perArea[areaId].sum += val;
        perArea[areaId].count += 1;
        if (skill?.id) perArea[areaId].skillIds.add(String(skill.id));

        // Skill group stats
        const templateId = String(rec.student_assessments?.template_id || '');
        const groupKey = selectedTemplateId === 'ALL' ? `${areaId}|${nameKey}` : `${templateId}|${areaId}|${nameKey}`;
        
        if (!skillGroups[groupKey]) {
          skillGroups[groupKey] = {
            key: groupKey,
            name: skill?.name || 'Unknown',
            areaId,
            sum: 0,
            count: 0,
            scoreCount: 0,
          };
        }
        skillGroups[groupKey].sum += val;
        skillGroups[groupKey].count += 1;
        skillGroups[groupKey].scoreCount += 1;
      }
    });

    // Compute derived lists
    const notPerformedStudents = [];
    const ungradedStudents = [];
    
    // Comprehensive Student Stats Array for Table
    const studentStats = studentsInClass.map(st => {
      const sid = String(st.id);
      const stats = perStudentStatus[sid];
      const scores = perStudent[sid];
      
      const totalGraded = stats.numericCount + stats.xCount;
      const isNotPerformed = stats.xCount > 0 && stats.numericCount === 0;
      const isUngraded = totalGraded === 0; // Truly empty
      
      if (isNotPerformed) notPerformedStudents.push({ id: st.id, name: studentName(st) });
      if (isUngraded) ungradedStudents.push({ id: st.id, name: studentName(st) });

      // Determine weak skills (lowest 2)
      const weakSkills = (perStudentSkills[sid] || [])
        .sort((a, b) => a.val - b.val)
        .slice(0, 2); // Show top 2 weakest

      return {
        id: st.id,
        name: studentName(st),
        avg: scores.count ? Math.round(scores.sum / scores.count) : null,
        count: totalGraded, // Total observations (including X)
        xCount: stats.xCount,
        weakSkills // Array of {name, val, areaColor}
      };
    });

    const hasNumeric = totalCount > 0;
    const masteryRate = hasNumeric ? Math.round(totalSum / totalCount) : null;

    const areaAvgs = Object.entries(perArea)
      .map(([areaId, a]) => {
        const def = areaById.get(String(areaId));
        return {
          id: areaId,
          name: def?.name || 'General',
          color: def?.color_hex || UI.secondary,
          avg: a.count ? Math.round(a.sum / a.count) : null,
          skillCount: a.skillIds ? a.skillIds.size : 0,
        };
      })
      .filter((x) => x.avg !== null)
      .sort((x, y) => y.avg - x.avg);

    const skillAvgs = Object.values(skillGroups)
      .map((g) => ({
        key: g.key,
        name: g.name,
        areaId: g.areaId,
        areaName: areaById.get(String(g.areaId))?.name || 'General',
        areaColor: areaById.get(String(g.areaId))?.color_hex || UI.secondary,
        avg: g.count ? Math.round(g.sum / g.count) : null,
        scoreCount: g.scoreCount || 0,
      }))
      .filter((x) => x.avg !== null);

    skillAvgs.sort((a, b) => a.avg - b.avg);
    const needsFocusSkills = skillAvgs.slice(0, 5);

    return {
      hasAnyScoreRow,
      hasNumeric,
      masteryRate,
      areaAvgs,
      needsFocusSkills,
      studentsInClass,
      notPerformedStudents,
      ungradedStudents,
      studentStats,
      expectedSkillCount
    };
  }, [selectedClassId, selectedTemplateId, analyticsScores, students, skills, templates, curriculumAreas, domains, assessments]);

  // ---------- ACTIONS & UTILS ----------
  const handleExportAnalyticsCSV = () => {
    if (!analyticsData || !analyticsData.studentStats) return;
    
    const rows = [['Student Name', 'Average Score', 'Missed / Not Performed', 'Weakest Skills']];
    analyticsData.studentStats.forEach(s => {
      const weakStr = s.weakSkills.map(w => `${w.name}`).join('; ');
      rows.push([
        `"${s.name}"`, 
        s.avg !== null ? `${s.avg}%` : '-', 
        s.xCount, 
        `"${weakStr}"`
      ]);
    });

    downloadCSV(rows, 'Analytics_Report');
  };

  const handleExportGridCSV = () => {
    if (!selectedClassId || selectedTemplateId === 'ALL') {
        alert('Please select a specific assessment to export the grade grid.');
        return;
    }

    // 1. Get filtered data
    const studentsInClass = students.filter(s => String(s.classroom_id) === String(selectedClassId));
    studentsInClass.sort((a, b) => (a.first_name + a.last_name).localeCompare(b.first_name + b.last_name));

    // Get skills for this template
    const currentDomainIds = domains
        .filter(d => String(d.template_id) === String(selectedTemplateId))
        .map(d => d.id);
    
    const currentSkills = skills
        .filter(s => currentDomainIds.includes(s.domain_id))
        .sort((a, b) => a.sort_order - b.sort_order);

    // 2. Build Header Row
    const headers = ['Student Name'];
    currentSkills.forEach(s => headers.push(`"${s.name}"`));

    // 3. Build Data Rows
    const rows = [headers];

    const scoresMap = new Map(); // Key: "studentId_skillId", Value: raw_score
    analyticsScores.forEach(score => {
        const studentId = score.student_assessments?.student_id;
        const skillId = score.skill_id;
        if (studentId && skillId) {
             scoresMap.set(`${studentId}_${skillId}`, score.score_raw);
        }
    });

    studentsInClass.forEach(st => {
        const row = [`"${st.first_name} ${st.last_name}"`];
        currentSkills.forEach(sk => {
            const key = `${st.id}_${sk.id}`;
            let val = scoresMap.get(key);
            if (val === undefined || val === null) val = '';
            row.push(`"${val}"`);
        });
        rows.push(row);
    });

    downloadCSV(rows, 'Grade_Grid_Export');
  };

  const downloadCSV = (rows, filenamePrefix) => {
    const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${filenamePrefix}_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const createNewTemplate = () => {
    if (!isSupervisor) return showToast?.({ type: 'error', message: 'Not allowed' });
    setEditing({ id: 'NEW', title: 'New Assessment Template', default_date: '', classroom_ids: [] });
    setIsEditingTemplate(true); // Switch to editor view
  };

  const handleEditTemplate = (tmpl) => {
    setEditing(tmpl);
    setIsEditingTemplate(true);
  }

  const handleBackToTemplates = () => {
    setEditing(null);
    setIsEditingTemplate(false);
  }

  const saveEditing = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const { id, ...payload } = editing;
      if (id === 'NEW') {
        const { data: tData, error: tErr } = await supabase.from('assessment_templates').insert([payload]).select();
        if (tErr) throw tErr;
        const createdTmpl = tData[0];
        // Create default domain
        const { data: dData } = await supabase.from('assessment_domains').insert({ template_id: createdTmpl.id, name: 'General' }).select();
        if (dData?.[0]) setDomains((prev) => [...prev, dData[0]]);
        setTemplates((prev) => [createdTmpl, ...(prev || [])]);
        setEditing(createdTmpl);
      } else {
        const { data, error } = await supabase.from('assessment_templates').update(payload).eq('id', id).select();
        if (error) throw error;
        setTemplates((prev) => (prev || []).map((t) => (t.id === id ? data[0] : t)));
        setEditing(data[0]);
      }
      setSavedToast(true);
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteEditing = async (e, tmpl) => {
    e?.stopPropagation();
    const target = tmpl || editing;
    if (!target) return;
    
    if (!window.confirm(`Delete "${target.title}"? All student scores for this template will be lost.`)) return;

    setSaving(true);
    try {
      const { data: doms } = await supabase.from('assessment_domains').select('id').eq('template_id', target.id);
      const domIds = (doms || []).map((d) => d.id);
      if (domIds.length > 0) {
        const { data: skls } = await supabase.from('assessment_skills').select('id').in('domain_id', domIds);
        const skillIds = (skls || []).map((s) => s.id);
        if (skillIds.length > 0) await supabase.from('student_assessment_scores').delete().in('skill_id', skillIds);
        await supabase.from('assessment_skills').delete().in('domain_id', domIds);
        await supabase.from('assessment_domains').delete().in('id', domIds);
      }
      await supabase.from('student_assessments').delete().eq('template_id', target.id);
      await supabase.from('assessment_templates').delete().eq('id', target.id);

      setTemplates((prev) => prev.filter((t) => t.id !== target.id));
      if (editing?.id === target.id) {
          setEditing(null);
          setIsEditingTemplate(false);
      }
      showToast?.({ type: 'success', message: 'Template deleted.' });
    } catch (e) {
      alert('Delete failed: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteSkill = async (skillId) => {
    if (!confirm('Delete this skill? Grades will be lost.')) return;
    try {
      await supabase.from('student_assessment_scores').delete().eq('skill_id', skillId);
      await supabase.from('assessment_skills').delete().eq('id', skillId);
      setSkills((prev) => prev.filter((s) => s.id !== skillId));
    } catch (e) {
      alert('Error deleting skill: ' + e.message);
    }
  };

  const addSkill = async () => {
    if (!newSkillName.trim()) return;
    const currentDomain = domains.find((d) => String(d.template_id) === String(editing.id));
    if (!currentDomain) return alert('Please save template first');

    const payload = {
      domain_id: currentDomain.id,
      name: newSkillName,
      area_id: newSkillAreaId || null,
      sort_order: skills.filter((s) => s.domain_id === currentDomain.id).length + 1,
    };

    const { data, error } = await supabase.from('assessment_skills').insert(payload).select();
    if (!error && data) {
      setSkills((prev) => [...prev, data[0]]);
      setNewSkillName('');
    }
  };

  const renameSkill = async (skillId, val) => {
    if (!val.trim()) return;
    await supabase.from('assessment_skills').update({ name: val }).eq('id', skillId);
    setSkills((prev) => prev.map((s) => (s.id === skillId ? { ...s, name: val } : s)));
    setEditSkillId(null);
  };

  const groupedSkills = useMemo(() => {
    if (!editing) return new Map();
    const dom = domains.find((d) => String(d.template_id) === String(editing.id));
    if (!dom) return new Map();
    const tSkills = skills.filter((s) => String(s.domain_id) === String(dom.id));
    const map = new Map();
    tSkills.forEach((s) => {
      const key = s.area_id ? String(s.area_id) : 'OTHER';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(s);
    });
    return map;
  }, [editing, skills, domains]);

  const getSortedStudents = () => {
    if(!analyticsData?.studentStats) return [];
    const { key, dir } = studentSort;
    return [...analyticsData.studentStats].sort((a, b) => {
      let vA = a[key], vB = b[key];
      if (key === 'name') { vA = vA.toLowerCase(); vB = vB.toLowerCase(); }
      if (vA < vB) return dir === 'asc' ? -1 : 1;
      if (vA > vB) return dir === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const handleSort = (key) => {
    setStudentSort(prev => ({
      key,
      dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc'
    }));
  };

  // ---------- RENDER ----------
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - clamp(32px, 6vw, 100px))', width: '100%', background: UI.bg, fontFamily: THEME.sansFont, overflow: 'hidden' }}>
      <style>{`
        .mb-card { will-change: transform, box-shadow; transition: transform 0.2s, box-shadow 0.2s; }
        .mb-card:hover { transform: translateY(-1px); box-shadow: ${THEME.cardShadowHover}; }
        .mb-tabpill:hover { background: ${rgba(UI.primary, 0.05)}; }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-thumb { background: ${rgba(UI.text, 0.2)}; borderRadius: 4px; }
      `}</style>

      <SuccessToast show={savedToast} />

      <SimpleModal open={detailOpen} title={detailPayload?.title} onClose={() => setDetailOpen(false)}>
        {detailPayload?.rows ? (
          <div style={{ display: 'grid', gap: 6 }}>
            {detailPayload.rows.map((r, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 6, border: `1px solid ${UI.borderSoft}`, background: UI.bg }}>
                <div style={{ fontWeight: 600, color: UI.text, fontSize: 13 }}>{r.name}</div>
                {r.avg !== null && <div style={{ fontWeight: 700, color: UI.primary, fontSize: 13 }}>{r.avg}%</div>}
              </div>
            ))}
          </div>
        ) : <div style={{ color: UI.muted, fontSize: 13 }}>No details.</div>}
      </SimpleModal>

      {/* HEADER */}
      <div style={{ flexShrink: 0, background: UI.bg, borderBottom: `1px solid ${UI.borderSoft}`, padding: '16px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontFamily: THEME.serifFont, fontSize: 20, fontWeight: 700, color: UI.text, margin: 0, lineHeight: 1.1 }}>Assessments</h1>
            <p style={{ margin: '4px 0 0', fontSize: 12, fontWeight: 500, color: UI.muted }}>
              {activeMode === 'templates' && 'Manage assessment structures.'}
              {activeMode === 'grid' && 'Enter scores & comments per student.'}
              {activeMode === 'analytics' && 'Track mastery & progress.'}
            </p>
          </div>

          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {isSupervisor && <TabPill active={activeMode === 'templates'} icon={Settings} label="Templates" onClick={() => setActiveMode('templates')} />}
            <TabPill active={activeMode === 'grid'} icon={Grid} label="Grade Grid" onClick={() => { setActiveMode('grid'); setEditing(null); }} />
            <TabPill active={activeMode === 'analytics'} icon={LayoutDashboard} label="Analytics" onClick={() => { setActiveMode('analytics'); setEditing(null); }} />
            
            <div style={{ width: 1, height: 20, background: UI.borderSoft, margin: '0 6px' }} />
            
            <Button variant="ghost" onClick={fetchAll} title="Reload Data" style={{ padding: 6 }}>
                <RefreshCcw size={14} className={loading ? 'spin' : ''} />
            </Button>
            
            {/* Context-Aware Export Button */}
            {activeMode === 'analytics' && (
                <Button variant="ghost" onClick={handleExportAnalyticsCSV} title="Export Analytics Report" style={{ padding: 6 }}>
                    <Download size={14} />
                </Button>
            )}
            {activeMode === 'grid' && (
                <Button variant="ghost" onClick={handleExportGridCSV} title="Export Grade Grid CSV" style={{ padding: 6 }}>
                    <Table size={14} />
                </Button>
            )}
          </div>
        </div>

        {/* CONTROLS (Only show if NOT in Templates mode) */}
        {activeMode !== 'templates' && (
          <div style={{ marginTop: 16 }}>
            <ThemedCard style={{ padding: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 1fr) minmax(240px, 1.5fr)', gap: 12 }}>
                <div>
                  <FormLabel>Classroom</FormLabel>
                  <SelectWithChevron value={selectedClassId} onChange={(e) => { setSelectedClassId(e.target.value); if (activeMode === 'analytics') setSelectedTemplateId('ALL'); }}>
                    {classrooms.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </SelectWithChevron>
                </div>
                <div>
                  <FormLabel>Assessment</FormLabel>
                  <SelectWithChevron value={selectedTemplateId} onChange={(e) => setSelectedTemplateId(e.target.value)}>
                    <option value="ALL">{activeMode === 'analytics' ? 'All Assessments (Aggregate)' : 'Select Assessment...'}</option>
                    {templatesForSelectedClass.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
                  </SelectWithChevron>
                </div>
              </div>
            </ThemedCard>
          </div>
        )}
      </div>

      {/* CONTENT AREA */}
      <div style={{ flex: 1, minHeight: 0, padding: 20, overflowY: activeMode === 'grid' ? 'hidden' : 'auto', overflowX: 'hidden' }}>

        {/* --- TEMPLATE MANAGEMENT (MASTER-DETAIL) --- */}
        {activeMode === 'templates' && isSupervisor && (
          <div style={{ maxWidth: 1000, margin: '0 auto' }}>
            
            {!isEditingTemplate ? (
                // LIST VIEW (Master)
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                    <div 
                        onClick={createNewTemplate}
                        style={{ 
                            border: `2px dashed ${UI.borderSoft}`, 
                            borderRadius: THEME.radius, 
                            display: 'flex', 
                            flexDirection: 'column', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            minHeight: 160, 
                            cursor: 'pointer',
                            color: UI.primary,
                            background: rgba(UI.primary, 0.02),
                            transition: 'all 0.2s ease'
                        }}
                    >
                        <Plus size={28} />
                        <div style={{ fontWeight: 600, marginTop: 10, fontSize: 13 }}>Create New Assessment</div>
                    </div>

                    {templates.map(t => (
                        <ThemedCard key={t.id} onClick={() => handleEditTemplate(t)} style={{ padding: 16, minHeight: 160, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div style={{ fontFamily: THEME.serifFont, fontSize: 16, fontWeight: 700, color: UI.text }}>{t.title}</div>
                                    <FileText size={16} color={UI.muted} />
                                </div>
                                <div style={{ fontSize: 11, color: UI.muted, marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <Calendar size={12}/> {t.default_date ? new Date(t.default_date).toLocaleDateString() : 'No date set'}
                                </div>
                            </div>
                            
                            <div style={{ paddingTop: 14, borderTop: `1px solid ${UI.borderSoft}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', gap: 6 }}>
                                    {(t.classroom_ids || []).slice(0, 3).map(cid => {
                                        const c = classrooms.find(cl => cl.id === cid);
                                        if(!c) return null;
                                        return <SoftChip key={cid} tone="primary">{c.name}</SoftChip>
                                    })}
                                    {(t.classroom_ids || []).length > 3 && <SoftChip>+{(t.classroom_ids.length - 3)}</SoftChip>}
                                </div>
                                <Button variant="ghost" style={{ padding: 6 }}><Edit3 size={14}/></Button>
                            </div>
                        </ThemedCard>
                    ))}
                </div>
            ) : (
                // EDITOR VIEW (Detail)
                <ThemedCard style={{ padding: 20 }}>
                    {/* Editor Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20, borderBottom: `1px solid ${UI.borderSoft}`, paddingBottom: 16 }}>
                        <div style={{ width: '100%' }}>
                            <div style={{ marginBottom: 12 }}>
                                <Button variant="ghost" onClick={handleBackToTemplates} style={{ paddingLeft: 0, paddingBottom: 0 }}>
                                    <ArrowLeft size={14} /> Back to List
                                </Button>
                            </div>
                            
                            <input
                                value={editing.title}
                                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                                placeholder="Assessment Title"
                                style={{ 
                                    fontSize: 20, fontFamily: THEME.serifFont, fontWeight: 700, border: 'none', 
                                    width: '100%', outline: 'none', background: 'transparent', color: UI.text 
                                }}
                            />
                            
                            <div style={{ display: 'flex', gap: 16, marginTop: 16 }}>
                                <div style={{ flex: 1 }}>
                                    <FormLabel>Default Date</FormLabel>
                                    <Field type="date" value={editing.default_date || ''} onChange={(e) => setEditing({ ...editing, default_date: e.target.value })} />
                                </div>
                                <div style={{ flex: 2 }}>
                                    <FormLabel>Linked Classrooms</FormLabel>
                                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                        {classrooms.map(c => {
                                            const active = (editing.classroom_ids || []).includes(c.id);
                                            return (
                                                <SoftChip 
                                                    key={c.id} 
                                                    tone={active ? 'primary' : 'neutral'} 
                                                    onClick={() => setEditing({ ...editing, classroom_ids: active ? editing.classroom_ids.filter(x => x !== c.id) : [...(editing.classroom_ids || []), c.id] })}
                                                >
                                                    {active && <Check size={10} />} {c.name}
                                                </SoftChip>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Toolbar */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginBottom: 20 }}>
                        {editing.id !== 'NEW' && <Button variant="danger" onClick={(e) => deleteEditing(e, editing)}><Trash2 size={14}/> Delete Template</Button>}
                        <Button onClick={saveEditing} disabled={saving}>{saving ? 'Saving...' : <><Save size={14} /> Save Changes</>}</Button>
                    </div>

                    {/* Skills Editor */}
                    {editing.id !== 'NEW' && (
                        <div style={{ background: rgba(UI.bg, 0.5), padding: 16, borderRadius: THEME.radius, border: `1px solid ${UI.borderSoft}` }}>
                            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginBottom: 16 }}>
                                <div style={{ flex: 1 }}>
                                    <FormLabel>Add New Skill</FormLabel>
                                    <Field value={newSkillName} onChange={(e) => setNewSkillName(e.target.value)} placeholder="e.g. Can count to 10..." />
                                </div>
                                <div style={{ width: 200 }}>
                                    <FormLabel>Curriculum Area</FormLabel>
                                    <Field as="select" value={newSkillAreaId} onChange={(e) => setNewSkillAreaId(e.target.value)}>
                                        {curriculumAreas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                        <option value="">General</option>
                                    </Field>
                                </div>
                                <Button variant="secondary" onClick={addSkill} style={{ height: 38 }}><Plus size={16}/></Button>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                {Array.from(groupedSkills.entries()).map(([areaId, list]) => (
                                    <div key={areaId} style={{ background: '#fff', borderRadius: THEME.radius, border: `1px solid ${UI.borderSoft}`, overflow: 'hidden' }}>
                                        <div style={{ padding: '6px 12px', background: rgba(UI.primary, 0.05), fontWeight: 600, fontSize: 11, borderBottom: `1px solid ${UI.borderSoft}` }}>
                                            {areaId === 'OTHER' ? 'General' : curriculumAreas.find(a => String(a.id) === String(areaId))?.name}
                                        </div>
                                        {list.map(skill => (
                                            <div key={skill.id} style={{ padding: '8px 12px', borderBottom: `1px solid ${rgba(UI.borderSoft, 0.5)}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                {editSkillId === skill.id ? (
                                                    <input 
                                                        autoFocus
                                                        defaultValue={skill.name}
                                                        onBlur={(e) => renameSkill(skill.id, e.target.value)}
                                                        onKeyDown={(e) => e.key === 'Enter' && renameSkill(skill.id, e.currentTarget.value)}
                                                        style={{ width: '100%', padding: '4px 8px', fontSize: 13, borderRadius: 4, border: `1px solid ${UI.primary}`, outline: 'none' }}
                                                    />
                                                ) : (
                                                    <span onClick={() => setEditSkillId(skill.id)} style={{ cursor: 'pointer', flex: 1, fontSize: 13 }}>{skill.name}</span>
                                                )}
                                                <button onClick={() => deleteSkill(skill.id)} style={{ border: 'none', background: 'transparent', color: UI.muted, cursor: 'pointer', padding: 4 }}>
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </ThemedCard>
            )}
          </div>
        )}

        {/* --- GRID VIEW --- */}
        {activeMode === 'grid' && (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {selectedTemplateId && selectedTemplateId !== 'ALL' ? (
              <ThemedCard style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                <div style={{ height: '100%', overflow: 'auto', WebkitOverflowScrolling: 'touch', padding: 8 }}>
                  <AssessmentEntryGrid
                    template={templates.find((t) => String(t.id) === String(selectedTemplateId))}
                    classroomId={selectedClassId}
                    students={students.filter((s) => String(s.classroom_id) === String(selectedClassId))}
                    skills={skills.filter((s) => {
                      const dom = domains.find((d) => String(d.id) === String(s.domain_id));
                      return dom && String(dom.template_id) === String(selectedTemplateId);
                    })}
                  />
                </div>
              </ThemedCard>
            ) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: UI.muted, flexDirection: 'column', gap: 12 }}>
                 <Grid size={40} strokeWidth={1} />
                 <div style={{ fontSize: 14, fontWeight: 600 }}>Select a specific assessment above to start grading.</div>
              </div>
            )}
          </div>
        )}

        {/* --- ANALYTICS --- */}
        {activeMode === 'analytics' && (
          <div style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: 40 }}>
            {analyticsData?.hasNumeric || analyticsData?.hasAnyScoreRow ? (
              <div style={{ display: 'grid', gap: 20 }}>
                {/* Stats Row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
                  {/* Mastery */}
                  <ThemedCard style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
                    <IconBadge color={UI.success}><Target size={18} /></IconBadge>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: UI.muted, textTransform: 'uppercase' }}>Overall Mastery</div>
                      <div style={{ fontSize: 24, fontWeight: 700, color: UI.text, lineHeight: 1, marginTop: 4 }}>{analyticsData.masteryRate || 0}%</div>
                    </div>
                  </ThemedCard>

                  {/* Status Tracker */}
                  <ThemedCard style={{ padding: 16 }}>
                    <div style={{ display: 'flex', gap: 14 }}>
                        <IconBadge color={UI.yellow}><AlertCircle size={18} /></IconBadge>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: UI.muted, textTransform: 'uppercase', marginBottom: 6 }}>Action Items</div>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                {analyticsData.ungradedStudents.length > 0 ? (
                                    <SoftChip tone="warn" onClick={() => openListModal('Ungraded', analyticsData.ungradedStudents)}>
                                        {analyticsData.ungradedStudents.length} Ungraded
                                    </SoftChip>
                                ) : <SoftChip tone="success">All graded</SoftChip>}
                                
                                {analyticsData.notPerformedStudents.length > 0 && (
                                    <SoftChip tone="danger" onClick={() => openListModal('Not Performed (X)', analyticsData.notPerformedStudents)}>
                                        {analyticsData.notPerformedStudents.length} Missed
                                    </SoftChip>
                                )}
                            </div>
                        </div>
                    </div>
                  </ThemedCard>
                </div>

                {/* Charts Row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) minmax(300px, 1fr)', gap: 20 }}>
                   {/* Area Breakdown */}
                   <ThemedCard style={{ padding: 20 }}>
                      <div style={{ fontFamily: THEME.serifFont, fontSize: 16, fontWeight: 700, marginBottom: 14 }}>Curriculum Breakdown</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {analyticsData.areaAvgs.map((a) => (
                            <div key={a.id}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12, fontWeight: 600 }}>
                                    <span>{a.name}</span>
                                    <span style={{ color: UI.primary }}>{a.avg}%</span>
                                </div>
                                <ProgressBar value={a.avg} color={a.color} />
                            </div>
                        ))}
                      </div>
                   </ThemedCard>

                   {/* Focus Skills */}
                   <ThemedCard style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                      <div style={{ padding: '12px 16px', background: rgba(UI.yellow, 0.1), borderBottom: `1px solid ${UI.borderSoft}` }}>
                          <div style={{ fontFamily: THEME.serifFont, fontSize: 14, fontWeight: 700, color: '#7A5C00' }}>Class Focus Areas</div>
                          <div style={{ fontSize: 11, opacity: 0.8 }}>Skills with lowest class average</div>
                      </div>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        {analyticsData.needsFocusSkills.map((s, i) => (
                            <div key={i} style={{ padding: '10px 16px', borderBottom: `1px solid ${rgba(UI.borderSoft, 0.6)}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <div style={{ fontSize: 12, fontWeight: 600 }}>{s.name}</div>
                                    <div style={{ fontSize: 10, color: UI.muted, marginTop: 2 }}>{s.areaName}</div>
                                </div>
                                <div style={{ fontSize: 14, fontWeight: 700, color: UI.text }}>{s.avg}%</div>
                            </div>
                        ))}
                        {analyticsData.needsFocusSkills.length === 0 && <div style={{ padding: 16, color: UI.muted, fontStyle: 'italic', fontSize: 12 }}>No data available.</div>}
                      </div>
                   </ThemedCard>
                </div>

                {/* Student Performance Table */}
                <ThemedCard style={{ padding: 0, overflow: 'hidden' }}>
                    <div style={{ padding: '14px 16px', borderBottom: `1px solid ${UI.borderSoft}`, background: UI.bg }}>
                        <div style={{ fontFamily: THEME.serifFont, fontSize: 16, fontWeight: 700 }}>Student Performance</div>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                            <thead>
                                <tr style={{ background: rgba(UI.primary, 0.04), borderBottom: `1px solid ${UI.borderSoft}`, textAlign: 'left', color: UI.muted }}>
                                    <th style={{ padding: '10px 16px', cursor: 'pointer', fontSize: 11 }} onClick={() => handleSort('name')}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>Student <ArrowUpDown size={12}/></div>
                                    </th>
                                    <th style={{ padding: '10px 16px', cursor: 'pointer', textAlign: 'center', fontSize: 11 }} onClick={() => handleSort('xCount')}>
                                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>Missed / Not Performed <ArrowUpDown size={12}/></div>
                                    </th>
                                    <th style={{ padding: '10px 16px', fontSize: 11 }}>Focus Areas (Weakest Skills)</th>
                                    <th style={{ padding: '10px 16px', cursor: 'pointer', textAlign: 'right', fontSize: 11 }} onClick={() => handleSort('avg')}>Average Score</th>
                                </tr>
                            </thead>
                            <tbody>
                                {getSortedStudents().map((s) => (
                                    <tr key={s.id} style={{ borderBottom: `1px solid ${rgba(UI.borderSoft, 0.5)}` }}>
                                        <td style={{ padding: '12px 16px', fontWeight: 600, color: UI.text }}>{s.name}</td>
                                        
                                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                            {s.xCount > 0 ? (
                                                <div style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 12, background: rgba(UI.danger, 0.1), color: UI.danger, fontWeight: 700, fontSize: 11 }}>
                                                    {s.xCount}
                                                </div>
                                            ) : <span style={{ color: UI.muted, fontSize: 16 }}>-</span>}
                                        </td>
                                        
                                        <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                {s.weakSkills.length > 0 ? s.weakSkills.map((ws, idx) => (
                                                    <div 
                                                        key={idx} 
                                                        style={{ 
                                                            display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: UI.text,
                                                            whiteSpace: 'normal', 
                                                            lineHeight: 1.3
                                                        }}
                                                    >
                                                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: ws.areaColor, flexShrink: 0, marginTop: 1 }} />
                                                        <span>{ws.name}</span>
                                                    </div>
                                                )) : <span style={{ color: UI.muted, fontSize: 12 }}>-</span>}
                                            </div>
                                        </td>
                                        
                                        <td style={{ padding: '12px 16px', fontWeight: 700, fontSize: 14, textAlign: 'right', color: UI.text }}>
                                            {s.avg !== null ? `${s.avg}%` : '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </ThemedCard>

              </div>
            ) : (
                <div style={{ padding: 40, textAlign: 'center', color: UI.muted }}>
                    <div style={{ marginBottom: 12 }}><LayoutDashboard size={40} strokeWidth={1} /></div>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>No assessment data found for this selection.</div>
                    <p style={{ fontSize: 13 }}>Select a different classroom or assessment, or go to the Grade Grid to add scores.</p>
                </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}