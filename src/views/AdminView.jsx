import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { THEME } from '../ui/theme';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

export default function AdminView() {
  const [pendingUsers, setPendingUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [isSyncingStudents, setIsSyncingStudents] = useState(false);
  const [isSyncingLevels, setIsSyncingLevels] = useState(false);
  const [isSyncingActivity, setIsSyncingActivity] = useState(false);
  const [isSyncingNotes, setIsSyncingNotes] = useState(false);
  const [isSyncingGridStatuses, setIsSyncingGridStatuses] = useState(false);
  const [isDebuggingLevels, setIsDebuggingLevels] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');

  const [levelsDebugChildId, setLevelsDebugChildId] = useState('672583');
  const [levelsDebugQuery, setLevelsDebugQuery] = useState('Sound Game 2');
  const [levelsDebugResult, setLevelsDebugResult] = useState(null);

  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    fetchPending();
  }, []);

  const fetchPending = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('get_pending_users');
    if (error) console.error(error);
    else setPendingUsers(data || []);
    setLoading(false);
  };

  const handleApprove = async (userEmail, firstName) => {
    const confirm = window.confirm(`Approve ${firstName} and send email?`);
    if (!confirm) return;

    const { error } = await supabase.rpc('approve_user', { target_email: userEmail });
    if (error) {
      alert('Error approving: ' + error.message);
      return;
    }

    setPendingUsers(prev => prev.filter(u => u.email !== userEmail));

    const subject = 'Welcome to Montessori OS - Access Granted';
    const body = `Hello ${firstName},\n\nYour account has been approved by the school administration.\n\nYou can now log in to the portal here:\nhttps://montessori-app-eight.vercel.app\n\nIf you have any questions, please reply to this email.\n\nBest regards,\nMontessori Support Team`;

    window.location.href = `mailto:${userEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const handleSyncStudents = async () => {
    setIsSyncingStudents(true);
    setSyncMessage('Syncing students and parent info...');

    try {
      const { data, error } = await supabase.functions.invoke('sync-tc', {
        body: { school_id: 1 }
      });
      if (error) throw new Error(error.message || 'Failed to sync students');
      setSyncMessage(data.message || 'Students synced successfully!');
    } catch (err) {
      console.error('Sync Error:', err);
      setSyncMessage(`Error: ${err.message}`);
    } finally {
      setIsSyncingStudents(false);
    }
  };

  const handleSyncLevels = async () => {
    setIsSyncingLevels(true);
    setSyncMessage('Syncing Kanban levels from Transparent Classroom. This may take a moment...');

    try {
      const { data, error } = await supabase.functions.invoke('sync-tc-levels', {
        body: { school_id: 1 }
      });
      if (error) throw new Error(error.message || 'Failed to sync Kanban levels');
      setSyncMessage(data.message || 'Kanban levels synced successfully!');
    } catch (err) {
      console.error('Sync Error:', err);
      setSyncMessage(`Error: ${err.message}`);
    } finally {
      setIsSyncingLevels(false);
    }
  };

  const handleSyncActivity = async () => {
    setIsSyncingActivity(true);
    setSyncMessage('Syncing activity feed... This might take a few minutes for full history.');

    let currentPage = 1;
    let hasMore = true;
    let totalFetched = 0;

    try {
      while (hasMore) {
        setSyncMessage(`Syncing activity... (Fetching starting at page ${currentPage})`);

        const { data, error } = await supabase.functions.invoke('sync-tc-activity', {
          body: { school_id: 1, page: currentPage }
        });
        if (error) throw new Error(error.message || 'Failed to sync activity');

        totalFetched += data.count || 0;
        if (data.next_page) currentPage = data.next_page;
        else hasMore = false;
      }

      setSyncMessage(`✅ Activity synced successfully! Downloaded ${totalFetched} historical records.`);
    } catch (err) {
      console.error('Sync Error:', err);
      setSyncMessage(`❌ Error: ${err.message}`);
    } finally {
      setIsSyncingActivity(false);
    }
  };

  const handleSyncNotes = async () => {
    setIsSyncingNotes(true);
    setSyncMessage('Parsing observations and attaching notes to Kanban board...');

    try {
      const { data, error } = await supabase.functions.invoke('sync-tc-observations', {
        body: { school_id: 1 }
      });
      if (error) throw new Error(error.message || 'Failed to sync observation notes');
      setSyncMessage(data.message || 'Notes synced successfully!');
    } catch (err) {
      console.error('Sync Error:', err);
      setSyncMessage(`Error: ${err.message}`);
    } finally {
      setIsSyncingNotes(false);
    }
  };

  const handleSyncGridStatuses = async () => {
    setIsSyncingGridStatuses(true);
    setSyncMessage('Syncing TC grid statuses for all students in batches...');

    let offset = 0;
    let totalStudents = null;
    let syncedRows = 0;
    let syncedStudents = 0;
    const limit = 2;

    try {
      while (true) {
        setSyncMessage(`Syncing TC grid statuses... (${syncedStudents}${totalStudents ? ` / ${totalStudents}` : ''} students)`);
        const { data, error } = await supabase.functions.invoke('sync-tc-grid-statuses', {
          body: { offset, limit }
        });
        if (error) throw new Error(error.message || 'Failed to sync TC grid statuses');

        syncedRows += Number(data?.count || 0);
        syncedStudents += Number(data?.students || 0);
        totalStudents = Number(data?.total_students || totalStudents || 0);

        if (!data?.has_more || data?.next_offset == null) break;
        offset = Number(data.next_offset);
      }

      setSyncMessage(`✅ TC grid statuses synced successfully! ${syncedRows} rows across ${syncedStudents} students.`);
    } catch (err) {
      console.error('Sync Error:', err);
      setSyncMessage(`❌ Error: ${err.message}`);
    } finally {
      setIsSyncingGridStatuses(false);
    }
  };

  const handleDebugLevels = async () => {
    setIsDebuggingLevels(true);
    setLevelsDebugResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('debug-tc-levels', {
        body: {
          child_tc_id: levelsDebugChildId,
          lesson_query: levelsDebugQuery,
        }
      });
      if (error) throw new Error(error.message || 'Failed to inspect TC levels');
      setLevelsDebugResult(data || null);
    } catch (err) {
      console.error('TC Levels Debug Error:', err);
      setLevelsDebugResult({ error: err.message });
    } finally {
      setIsDebuggingLevels(false);
    }
  };

  const handleCurriculumUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsUploading(true);
    setSyncMessage('Parsing curriculum file...');

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const json = JSON.parse(e.target.result);

        let allAreas = [];
        let allCategories = [];
        let allLessons = [];

        const extractLessons = (node, currentAreaTcId = null, currentCategoryTcId = null) => {
          if (Array.isArray(node)) {
            node.forEach(child => extractLessons(child, currentAreaTcId, currentCategoryTcId));
            return;
          }

          let nextAreaTcId = currentAreaTcId;
          let nextCategoryTcId = currentCategoryTcId;

          if (node.id && node.type === 'group') {
            if (!currentAreaTcId) {
              nextAreaTcId = String(node.id);
              allAreas.push({ tc_id: String(node.id), name: node.name });
            } else {
              nextCategoryTcId = String(node.id);
              allCategories.push({
                tc_id: String(node.id),
                name: node.name,
                tc_area_id: currentAreaTcId
              });
            }
          }

          if (node.type === 'lesson' || node.type === 'material') {
            allLessons.push({
              tc_id: String(node.id),
              name: node.name,
              lesson_type: node.lesson_type || node.type,
              tc_category_id: currentCategoryTcId,
            });
          }

          if (node.children && Array.isArray(node.children)) {
            node.children.forEach(child => extractLessons(child, nextAreaTcId, nextCategoryTcId));
          }
        };

        extractLessons(json);

        const getUnique = (arr) => {
          const map = new Map();
          arr.forEach(item => map.set(item.tc_id, item));
          return Array.from(map.values());
        };

        const uniqueAreas = getUnique(allAreas);
        const uniqueCategories = getUnique(allCategories);
        const uniqueLessons = getUnique(allLessons);

        setSyncMessage(`Uploading ${uniqueAreas.length} Areas...`);
        const { error: areaUploadError } = await supabase
          .from('tc_curriculum_areas')
          .upsert(uniqueAreas, { onConflict: 'tc_id' });
        if (areaUploadError) throw areaUploadError;

        setSyncMessage('Mapping Area IDs to Categories...');
        const { data: dbAreas, error: areaFetchError } = await supabase
          .from('tc_curriculum_areas')
          .select('id, tc_id');
        if (areaFetchError) throw areaFetchError;

        const areaMap = {};
        dbAreas.forEach((a) => { areaMap[a.tc_id] = a.id; });

        const mappedCategories = uniqueCategories.map(cat => ({
          tc_id: cat.tc_id,
          name: cat.name,
          area_id: areaMap[cat.tc_area_id] || null,
        }));

        setSyncMessage(`Uploading ${mappedCategories.length} Categories...`);
        const { error: catUploadError } = await supabase
          .from('tc_curriculum_categories')
          .upsert(mappedCategories, { onConflict: 'tc_id' });
        if (catUploadError) throw catUploadError;

        setSyncMessage('Mapping Category IDs to Lessons...');
        const { data: dbCategories, error: catFetchError } = await supabase
          .from('tc_curriculum_categories')
          .select('id, tc_id');
        if (catFetchError) throw catFetchError;

        const categoryMap = {};
        dbCategories.forEach((c) => { categoryMap[c.tc_id] = c.id; });

        const mappedLessons = uniqueLessons.map(lesson => ({
          tc_id: lesson.tc_id,
          name: lesson.name,
          lesson_type: lesson.lesson_type,
          category_id: categoryMap[lesson.tc_category_id] || null,
        }));

        setSyncMessage(`Uploading ${mappedLessons.length} Lessons...`);
        const { error: lessonUploadError } = await supabase
          .from('tc_curriculum_activities')
          .upsert(mappedLessons, { onConflict: 'tc_id' });
        if (lessonUploadError) throw lessonUploadError;

        setSyncMessage(`✅ Success! Synced ${uniqueAreas.length} Areas, ${uniqueCategories.length} Categories, and ${mappedLessons.length} Lessons.`);
        alert('Success! Check your database.');
      } catch (err) {
        console.error('Upload failed:', err);
        setSyncMessage(`❌ Error: ${err.message}`);
        alert('Error parsing or uploading: ' + err.message);
      } finally {
        setIsUploading(false);
        event.target.value = null;
      }
    };

    reader.readAsText(file);
  };

  const isAnySyncRunning = isSyncingStudents || isSyncingLevels || isSyncingActivity || isSyncingNotes || isSyncingGridStatuses || isUploading || isDebuggingLevels;

  return (
    <div style={{ padding: 40, maxWidth: 800, margin: '0 auto' }}>
      <h1 style={{ fontFamily: THEME.serifFont, color: THEME.text, marginBottom: 20 }}>
        Admin Panel
      </h1>

      <Card style={{ padding: '24px', marginBottom: '24px' }}>
        <h2 style={{ marginTop: 0, marginBottom: '16px', fontSize: '1.2rem', color: THEME.text }}>
          System Integrations
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', color: THEME.text }}>Recommended Sync</h3>
            <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: THEME.textMuted }}>
              For normal daily use, sync these two: <b>Activity Log</b> pulls new observations from Transparent Classroom, and <b>Current Statuses</b> pulls the latest lesson status from the TC grid.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px' }}>
              <Button onClick={handleSyncActivity} disabled={isAnySyncRunning} style={{ backgroundColor: isSyncingActivity ? '#ccc' : THEME.primary }}>
                {isSyncingActivity ? 'Syncing...' : 'Sync Activity Log'}
              </Button>
              <Button onClick={handleSyncGridStatuses} disabled={isAnySyncRunning} style={{ backgroundColor: isSyncingGridStatuses ? '#ccc' : THEME.primary }}>
                {isSyncingGridStatuses ? 'Syncing...' : 'Sync Current Statuses'}
              </Button>
            </div>
          </div>

          <details style={{ padding: '16px', backgroundColor: '#fffaf0', borderRadius: '8px', border: '1px solid #f6ad55' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600, color: THEME.text }}>Advanced / Rare Syncs</summary>
            <p style={{ margin: '12px 0 12px 0', fontSize: '12px', color: THEME.textMuted }}>
              Use these only when needed. Students rarely change. The legacy Kanban/notes syncs are kept for safety and debugging, not for your normal daily workflow.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px' }}>
              <Button onClick={handleSyncStudents} disabled={isAnySyncRunning} style={{ backgroundColor: isSyncingStudents ? '#ccc' : THEME.primary }}>
                {isSyncingStudents ? 'Syncing...' : 'Sync Students'}
              </Button>

              <Button onClick={handleSyncLevels} disabled={isAnySyncRunning} style={{ backgroundColor: isSyncingLevels ? '#ccc' : THEME.primary }}>
                {isSyncingLevels ? 'Syncing...' : 'Legacy: Sync Kanban Levels'}
              </Button>

              <Button onClick={handleSyncNotes} disabled={isAnySyncRunning} style={{ backgroundColor: isSyncingNotes ? '#ccc' : THEME.primary }}>
                {isSyncingNotes ? 'Syncing...' : 'Legacy: Sync Observation Notes'}
              </Button>
            </div>
          </details>

          {syncMessage && (
            <span style={{ fontSize: '14px', color: syncMessage.includes('Error') ? '#e53e3e' : THEME.textMuted }}>
              {syncMessage}
            </span>
          )}

          <div style={{ padding: '16px', backgroundColor: '#fffaf0', borderRadius: '8px', border: '1px solid #f6ad55' }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', color: THEME.text }}>TC Levels Debug</h3>
            <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: THEME.textMuted }}>
              Read-only check of the live Transparent Classroom grid snapshot for one child. Use this to compare levels.json against observation-derived activity rows before changing any status logic.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'end' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '160px' }}>
                <label style={{ fontSize: '12px', color: THEME.textMuted }}>Child TC ID</label>
                <input
                  value={levelsDebugChildId}
                  onChange={(e) => setLevelsDebugChildId(e.target.value)}
                  placeholder="672583"
                  style={{ padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '14px' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '220px', flex: 1 }}>
                <label style={{ fontSize: '12px', color: THEME.textMuted }}>Lesson Filter</label>
                <input
                  value={levelsDebugQuery}
                  onChange={(e) => setLevelsDebugQuery(e.target.value)}
                  placeholder="Sound Game 2"
                  style={{ padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '14px' }}
                />
              </div>
              <Button
                onClick={handleDebugLevels}
                disabled={isAnySyncRunning || !levelsDebugChildId.trim()}
                style={{ backgroundColor: isDebuggingLevels ? '#ccc' : '#dd6b20' }}
              >
                {isDebuggingLevels ? 'Checking...' : 'Check Live Levels'}
              </Button>
            </div>

            {levelsDebugResult?.error && (
              <div style={{ marginTop: '12px', fontSize: '12px', color: '#c53030' }}>{levelsDebugResult.error}</div>
            )}

            {levelsDebugResult?.success && (
              <div style={{ marginTop: '16px', display: 'grid', gap: '12px' }}>
                <div style={{ fontSize: '12px', color: THEME.textMuted }}>
                  {levelsDebugResult.student
                    ? [levelsDebugResult.student.first_name, levelsDebugResult.student.last_name].filter(Boolean).join(' ') + ' (' + levelsDebugResult.student.tc_id + ')'
                    : 'Student record not found locally'}
                  {' · '}
                  {levelsDebugResult.filtered_levels} matching levels out of {levelsDebugResult.total_levels}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {Object.entries(levelsDebugResult.counts || {}).map(([key, value]) => (
                    <span key={key} style={{ padding: '4px 8px', borderRadius: '999px', background: '#fff', border: '1px solid #fbd38d', fontSize: '11px', fontWeight: 600, color: '#9c4221' }}>
                      {key}: {value}
                    </span>
                  ))}
                </div>
                <div style={{ overflowX: 'auto', border: '1px solid #fbd38d', borderRadius: '8px', background: '#fff' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ background: '#fff7ed', textAlign: 'left' }}>
                        <th style={{ padding: '10px', borderBottom: '1px solid #fbd38d' }}>Lesson</th>
                        <th style={{ padding: '10px', borderBottom: '1px solid #fbd38d' }}>Category</th>
                        <th style={{ padding: '10px', borderBottom: '1px solid #fbd38d' }}>Area</th>
                        <th style={{ padding: '10px', borderBottom: '1px solid #fbd38d' }}>Derived</th>
                        <th style={{ padding: '10px', borderBottom: '1px solid #fbd38d' }}>Flags</th>
                        <th style={{ padding: '10px', borderBottom: '1px solid #fbd38d' }}>Last Activity</th>
                        <th style={{ padding: '10px', borderBottom: '1px solid #fbd38d' }}>Activity Count</th>
                        <th style={{ padding: '10px', borderBottom: '1px solid #fbd38d' }}>Lesson ID</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(levelsDebugResult.rows || []).map((row) => (
                        <tr key={row.tc_level_id}>
                          <td style={{ padding: '10px', borderBottom: '1px solid #feebc8' }}>{row.lesson_name}</td>
                          <td style={{ padding: '10px', borderBottom: '1px solid #feebc8' }}>{row.category_name || '-'}</td>
                          <td style={{ padding: '10px', borderBottom: '1px solid #feebc8' }}>{row.area_name || '-'}</td>
                          <td style={{ padding: '10px', borderBottom: '1px solid #feebc8', fontWeight: 700 }}>{row.derived_status}</td>
                          <td style={{ padding: '10px', borderBottom: '1px solid #feebc8' }}>
                            p:{String(row.planned)} i:{String(row.introduced)} pr:{String(row.practicing)} m:{String(row.mastered)} prof:{row.proficiency ?? '-'}
                          </td>
                          <td style={{ padding: '10px', borderBottom: '1px solid #feebc8' }}>{row.latest_activity_date || '-'}</td>
                          <td style={{ padding: '10px', borderBottom: '1px solid #feebc8' }}>{row.activity_count ?? 0}</td>
                          <td style={{ padding: '10px', borderBottom: '1px solid #feebc8', fontFamily: 'monospace' }}>{row.lesson_id}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px dashed #e2e8f0' }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', color: THEME.text }}>Manual Curriculum Import</h3>
            <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: THEME.textMuted }}>
              If the API is blocked (403), upload the raw <b>11103.json</b> file directly from Transparent Classroom here.
            </p>
            <input
              type="file"
              accept=".json"
              onChange={handleCurriculumUpload}
              disabled={isUploading}
              style={{
                display: 'block',
                width: '100%',
                fontSize: '14px',
                color: THEME.textMuted,
                cursor: isUploading ? 'not-allowed' : 'pointer'
              }}
            />
          </div>
        </div>
      </Card>

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 24px', background: '#f9f9f9', borderBottom: '1px solid #eee', fontWeight: 600 }}>
          Pending Approvals ({pendingUsers.length})
        </div>

        {loading ? (
          <div style={{ padding: 24 }}>Loading...</div>
        ) : pendingUsers.length === 0 ? (
          <div style={{ padding: 24, color: THEME.textMuted }}>No pending requests.</div>
        ) : (
          <div>
            {pendingUsers.map(user => (
              <div
                key={user.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px 24px',
                  borderBottom: '1px solid #eee'
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 16 }}>
                    {user.first_name} {user.last_name}
                  </div>
                  <div style={{ color: THEME.textMuted, fontSize: 14 }}>
                    {user.email}
                  </div>
                </div>

                <Button onClick={() => handleApprove(user.email, user.first_name)}>
                  Approve & Email
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
