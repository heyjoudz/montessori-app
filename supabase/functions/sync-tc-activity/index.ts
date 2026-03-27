import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const toTeacherName = (candidate) => {
  if (!candidate) return null;
  if (typeof candidate === 'string') return candidate.trim() || null;
  const fullName = String(candidate.name || candidate.full_name || '').trim();
  if (fullName) return fullName;
  const first = String(candidate.first_name || candidate.firstName || '').trim();
  const last = String(candidate.last_name || candidate.lastName || '').trim();
  return `${first} ${last}`.trim() || null;
}

const toUserMap = (rows) => {
  const map = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const id = row?.id != null ? String(row.id) : '';
    if (!id) return;
    const name = toTeacherName(row);
    if (!name) return;
    map.set(id, name);
  });
  return map;
}

const pickTeacherMeta = (act) => {
  const teacherCandidate =
    act.teacher ||
    act.user ||
    act.author ||
    act.staff ||
    act.recorded_by ||
    act.created_by ||
    act.updated_by ||
    null;

  const teacherTcId =
    teacherCandidate?.id ??
    teacherCandidate?.tc_id ??
    act.teacher_id ??
    act.user_id ??
    act.author_id ??
    act.staff_id ??
    null;

  return {
    teacher_name: toTeacherName(teacherCandidate) || null,
    teacher_tc_id: teacherTcId != null ? String(teacherTcId) : null,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const tcApiToken = Deno.env.get('TC_API_TOKEN');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const classroomId = 19184;

    // DAILY SYNC LIMIT: Only process the 3 most recent pages (300 items)
    const maxPagesToFetch = 3; 

    let allActivities = [];
    let page = 1;
    let keepFetching = true;

    // Loop through just the first 3 pages
    while (keepFetching && page <= maxPagesToFetch) {
      const tcUrl = `https://www.transparentclassroom.com/api/v1/activity.json?classroom_id=${classroomId}&page=${page}&per_page=100`;
      const res = await fetch(tcUrl, { headers: { 'X-TransparentClassroomToken': tcApiToken } });
      const data = await res.json();

      if (data.length === 0) {
        keepFetching = false;
      } else {
        allActivities = [...allActivities, ...data];
        page++;
      }
    }

    const usersUrl = `https://www.transparentclassroom.com/api/v1/users.json?classroom_id=${classroomId}`;
    const usersRes = await fetch(usersUrl, { headers: { 'X-TransparentClassroomToken': tcApiToken } });
    const usersData = usersRes.ok ? await usersRes.json() : [];
    const userNameById = toUserMap(usersData);

    const formatted = allActivities.map(act => {
      const teacherMeta = pickTeacherMeta(act);
      const authorId = act?.author_id != null ? String(act.author_id) : null;
      const teacherTcId = teacherMeta.teacher_tc_id || authorId;
      const teacherName = teacherMeta.teacher_name || (teacherTcId ? userNameById.get(String(teacherTcId)) || null : null);

      return ({
      tc_observation_id: String(act.id),
      date: act.date,
      text_content: act.normalized_text,
      html_content: act.html,
      teacher_name: teacherName,
      teacher_tc_id: teacherTcId,
    })});

    if (formatted.length > 0) {
      const { error } = await supabase
        .from('tc_observations')
        .upsert(formatted, { onConflict: 'tc_observation_id' });

      if (error) throw error;
    }

    return new Response(JSON.stringify({ 
      success: true, 
      count: formatted.length,
      message: `Daily Sync: Fetched the ${formatted.length} most recent observations.` 
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 400, headers: corsHeaders });
  }
})
