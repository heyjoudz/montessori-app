import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { THEME } from '../ui/theme';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

export default function AdminView() {
  const [pendingUsers, setPendingUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // States for Transparent Classroom Syncing
  const [isSyncingStudents, setIsSyncingStudents] = useState(false);
  const [isSyncingLevels, setIsSyncingLevels] = useState(false);
  const [isSyncingActivity, setIsSyncingActivity] = useState(false);
  const [isSyncingNotes, setIsSyncingNotes] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  
  // State for Manual Curriculum Upload
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

    const subject = "Welcome to Montessori OS - Access Granted";
    const body = `Hello ${firstName},\n\nYour account has been approved by the school administration.\n\nYou can now log in to the portal here:\nhttps://montessori-app-eight.vercel.app\n\nIf you have any questions, please reply to this email.\n\nBest regards,\nMontessori Support Team`;
    
    window.location.href = `mailto:${userEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  // --- 1. Sync Students & Parent Info ---
  const handleSyncStudents = async () => {
    setIsSyncingStudents(true);
    setSyncMessage('Syncing students and parent info...');

    try {
      const { data, error } = await supabase.functions.invoke('sync-tc', {
        body: { school_id: 1 } 
      });

      if (error) throw new Error(error.message || "Failed to sync students");
      setSyncMessage(data.message || 'Students synced successfully!');
    } catch (err) {
      console.error("Sync Error:", err);
      setSyncMessage(`Error: ${err.message}`);
    } finally {
      setIsSyncingStudents(false);
    }
  };

  // --- 2. Sync Kanban Levels ---
  const handleSyncLevels = async () => {
    setIsSyncingLevels(true);
    setSyncMessage('Syncing Kanban levels from Transparent Classroom. This may take a moment...');

    try {
      const { data, error } = await supabase.functions.invoke('sync-tc-levels', {
        body: { school_id: 1 } 
      });

      if (error) throw new Error(error.message || "Failed to sync Kanban levels");
      setSyncMessage(data.message || 'Kanban levels synced successfully!');
    } catch (err) {
      console.error("Sync Error:", err);
      setSyncMessage(`Error: ${err.message}`);
    } finally {
      setIsSyncingLevels(false);
    }
  };

  // --- 3. Sync Activity Feed (NOW WITH PAGINATION LOOP) ---
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
          body: { school_id: 1, page: currentPage } // Pass the page to the backend
        });

        if (error) throw new Error(error.message || "Failed to sync activity");

        totalFetched += data.count || 0;

        // Check if the backend told us there's another page
        if (data.next_page) {
          currentPage = data.next_page;
        } else {
          hasMore = false; // Reached the end
        }
      }
      setSyncMessage(`✅ Activity synced successfully! Downloaded ${totalFetched} historical records.`);
    } catch (err) {
      console.error("Sync Error:", err);
      setSyncMessage(`❌ Error: ${err.message}`);
    } finally {
      setIsSyncingActivity(false);
    }
  };

  // --- 4. Sync Observation Notes ---
  const handleSyncNotes = async () => {
    setIsSyncingNotes(true);
    setSyncMessage('Parsing observations and attaching notes to Kanban board...');

    try {
      const { data, error } = await supabase.functions.invoke('sync-tc-observations', {
        body: { school_id: 1 } 
      });

      if (error) throw new Error(error.message || "Failed to sync observation notes");
      setSyncMessage(data.message || 'Notes synced successfully!');
    } catch (err) {
      console.error("Sync Error:", err);
      setSyncMessage(`Error: ${err.message}`);
    } finally {
      setIsSyncingNotes(false);
    }
  };

  // --- EXISTING: 3-Tier Curriculum JSON Upload ---
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
              tc_category_id: currentCategoryTcId,
              lesson_type: node.lesson_type || node.type
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

        setSyncMessage(`Mapping Area IDs to Categories...`);
        const { data: dbAreas, error: areaFetchError } = await supabase
          .from('tc_curriculum_areas')
          .select('id, tc_id');
        if (areaFetchError) throw areaFetchError;

        const areaMap = {};
        dbAreas.forEach(a => { areaMap[a.tc_id] = a.id; });

        const mappedCategories = uniqueCategories.map(cat => ({
          tc_id: cat.tc_id,
          name: cat.name,
          area_id: areaMap[cat.tc_area_id] || null
        }));

        setSyncMessage(`Uploading ${mappedCategories.length} Categories...`);
        const { error: catUploadError } = await supabase
          .from('tc_curriculum_categories')
          .upsert(mappedCategories, { onConflict: 'tc_id' });
        if (catUploadError) throw catUploadError;

        setSyncMessage(`Mapping Category IDs to Lessons...`);
        const { data: dbCategories, error: catFetchError } = await supabase
          .from('tc_curriculum_categories')
          .select('id, tc_id');
        if (catFetchError) throw catFetchError;

        const categoryMap = {};
        dbCategories.forEach(c => { categoryMap[c.tc_id] = c.id; });

        const mappedLessons = uniqueLessons.map(lesson => ({
          tc_id: lesson.tc_id,
          name: lesson.name,
          lesson_type: lesson.lesson_type,
          category_id: categoryMap[lesson.tc_category_id] || null
        }));

        setSyncMessage(`Uploading ${mappedLessons.length} Lessons...`);
        const { error: lessonUploadError } = await supabase
          .from('tc_curriculum_activities')
          .upsert(mappedLessons, { onConflict: 'tc_id' });
        if (lessonUploadError) throw lessonUploadError;
        
        setSyncMessage(`✅ Success! Synced ${uniqueAreas.length} Areas, ${uniqueCategories.length} Categories, and ${mappedLessons.length} Lessons.`);
        alert(`Success! Check your database.`);
        
      } catch (err) {
        console.error("Upload failed:", err);
        setSyncMessage(`❌ Error: ${err.message}`);
        alert("Error parsing or uploading: " + err.message);
      } finally {
        setIsUploading(false);
        event.target.value = null; 
      }
    };
    
    reader.readAsText(file);
  };

  const isAnySyncRunning = isSyncingStudents || isSyncingLevels || isSyncingActivity || isSyncingNotes || isUploading;

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
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '16px' }}>
              
              <Button 
                onClick={handleSyncStudents} 
                disabled={isAnySyncRunning}
                style={{ backgroundColor: isSyncingStudents ? '#ccc' : THEME.primary }}
              >
                {isSyncingStudents ? 'Syncing...' : '1. Sync Students'}
              </Button>

              <Button 
                onClick={handleSyncLevels} 
                disabled={isAnySyncRunning}
                style={{ backgroundColor: isSyncingLevels ? '#ccc' : THEME.primary }}
              >
                {isSyncingLevels ? 'Syncing...' : '2. Sync Kanban Levels'}
              </Button>

              {/* REORDERED: Activity now comes before Notes */}
              <Button 
                onClick={handleSyncActivity} 
                disabled={isAnySyncRunning}
                style={{ backgroundColor: isSyncingActivity ? '#ccc' : THEME.primary }}
              >
                {isSyncingActivity ? 'Syncing...' : '3. Sync TC Activity'}
              </Button>

              <Button 
                onClick={handleSyncNotes} 
                disabled={isAnySyncRunning}
                style={{ backgroundColor: isSyncingNotes ? '#ccc' : THEME.primary }}
              >
                {isSyncingNotes ? 'Syncing...' : '4. Sync Observation Notes'}
              </Button>

            </div>
            
            {syncMessage && (
              <span style={{ fontSize: '14px', color: syncMessage.includes('Error') ? '#e53e3e' : THEME.textMuted }}>
                {syncMessage}
              </span>
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