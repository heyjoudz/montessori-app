import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../supabaseClient';
import { THEME } from '../../ui/theme';

export default function RubricGrid({ assessmentId, templateId, readOnly = false }) {
  const [domains, setDomains] = useState([]);
  const [scores, setScores] = useState({}); // Map: skill_id -> { score_raw, comment }
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (assessmentId && templateId) fetchData();
  }, [assessmentId, templateId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Structure (Domains -> Skills) for this Template
      const { data: doms, error: domErr } = await supabase
        .from('assessment_domains')
        .select('id, name, sort_order, assessment_skills(id, name, sort_order)')
        .eq('template_id', templateId)
        .order('sort_order');

      if (domErr) throw domErr;
      
      // 2. Fetch Existing Scores for this Student's Assessment
      const { data: existScores, error: scoreErr } = await supabase
        .from('student_assessment_scores')
        .select('skill_id, score_raw, comment')
        .eq('assessment_id', assessmentId);

      if (scoreErr) throw scoreErr;

      // Map scores for O(1) lookup
      const scoreMap = {};
      (existScores || []).forEach(s => {
        scoreMap[s.skill_id] = { score_raw: s.score_raw, comment: s.comment };
      });

      // Sort skills within domains
      const sortedDomains = (doms || []).map(d => ({
        ...d,
        skills: (d.assessment_skills || []).sort((a,b) => (a.sort_order || 0) - (b.sort_order || 0))
      }));

      setDomains(sortedDomains);
      setScores(scoreMap);
    } catch (err) {
      console.error("Error loading rubric:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleScoreChange = async (skillId, val, field) => {
    // 1. Optimistic Update (Instant UI feedback)
    setScores(prev => ({
      ...prev,
      [skillId]: { ...prev[skillId], [field]: val }
    }));

    // 2. Prepare Payload
    const current = scores[skillId] || {};
    const payload = {
      assessment_id: assessmentId,
      skill_id: skillId,
      score_raw: field === 'score_raw' ? val : current.score_raw,
      comment: field === 'comment' ? val : current.comment,
      updated_at: new Date().toISOString()
    };

    // 3. Save to DB (Debounce could be added here for performance, but Upsert is fast enough for now)
    await supabase
      .from('student_assessment_scores')
      .upsert(payload, { onConflict: 'assessment_id, skill_id' });
  };

  if (loading) return <div style={{ padding: 20, color: THEME.textMuted }}>Loading rubric data...</div>;
  if (!domains.length) return <div style={{ padding: 20, color: THEME.textMuted, fontStyle: 'italic' }}>No rubric template found for this assessment.</div>;

  return (
    <div style={{ marginTop: 20 }}>
      {domains.map(domain => (
        <div key={domain.id} style={{ marginBottom: 24, border: '1px solid #e0e0e0', borderRadius: 12, overflow: 'hidden', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          {/* Domain Header */}
          <div style={{ padding: '12px 16px', background: '#f8f9fa', borderBottom: '1px solid #e0e0e0', display: 'flex', alignItems: 'center' }}>
            <div style={{ fontWeight: 800, color: THEME.text, fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {domain.name}
            </div>
          </div>

          {/* Skills Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#fff', borderBottom: '1px solid #eee' }}>
                <th style={{ textAlign: 'left', padding: '10px 16px', color: THEME.textMuted, fontWeight: 600, width: '40%' }}>Criteria / Skill</th>
                <th style={{ textAlign: 'left', padding: '10px 16px', color: THEME.textMuted, fontWeight: 600, width: '20%' }}>Score / Level</th>
                <th style={{ textAlign: 'left', padding: '10px 16px', color: THEME.textMuted, fontWeight: 600 }}>Teacher Note</th>
              </tr>
            </thead>
            <tbody>
              {domain.skills.map(skill => {
                const s = scores[skill.id] || {};
                return (
                  <tr key={skill.id} style={{ borderBottom: '1px solid #f4f4f4' }}>
                    <td style={{ padding: '12px 16px', verticalAlign: 'middle', fontWeight: 600, color: '#333' }}>
                      {skill.name}
                    </td>
                    <td style={{ padding: '8px 16px', verticalAlign: 'top' }}>
                      <input
                        value={s.score_raw || ''}
                        onChange={(e) => handleScoreChange(skill.id, e.target.value, 'score_raw')}
                        placeholder="e.g. 80%, Mastered"
                        readOnly={readOnly}
                        style={{
                          width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd',
                          fontWeight: 700, fontSize: 13, color: THEME.brandPrimary
                        }}
                      />
                    </td>
                    <td style={{ padding: '8px 16px', verticalAlign: 'top' }}>
                      <textarea
                        value={s.comment || ''}
                        onChange={(e) => handleScoreChange(skill.id, e.target.value, 'comment')}
                        placeholder="Observations..."
                        readOnly={readOnly}
                        style={{
                          width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd',
                          fontSize: 13, minHeight: 38, resize: 'vertical', fontFamily: 'inherit'
                        }}
                      />
                    </td>
                  </tr>
                );
              })}
              {domain.skills.length === 0 && (
                <tr>
                  <td colSpan={3} style={{ padding: 16, color: '#999', textAlign: 'center' }}>No skills defined for this domain.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}