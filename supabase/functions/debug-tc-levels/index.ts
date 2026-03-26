import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const TC_SCHOOL_PATH_ID = '4597';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const tcApiToken = Deno.env.get('TC_API_TOKEN');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!tcApiToken || !supabaseUrl || !supabaseServiceKey) {
      throw new Error('Environment variables are not configured.');
    }

    const body = await req.json().catch(() => ({}));
    const childTcId = String(body?.child_tc_id || body?.childTcId || '').trim();
    const lessonQuery = String(body?.lesson_query || body?.lessonQuery || '').trim().toLowerCase();

    if (!childTcId) {
      throw new Error('child_tc_id is required.');
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
    const headers = {
      'X-TransparentClassroomToken': tcApiToken,
      'Content-Type': 'application/json'
    };

    const levelsUrl = `https://www.transparentclassroom.com/s/${TC_SCHOOL_PATH_ID}/levels.json?child_ids[]=${encodeURIComponent(childTcId)}`;

    const [studentRes, lessonRes, categoryRes, areaRes, obsRes, levelsResponse] = await Promise.all([
      supabaseClient.from('students').select('id, tc_id, first_name, last_name, classroom_id').eq('tc_id', childTcId).maybeSingle(),
      supabaseClient.from('tc_curriculum_activities').select('id, tc_id, name, category_id'),
      supabaseClient.from('tc_curriculum_categories').select('id, name, area_id'),
      supabaseClient.from('tc_curriculum_areas').select('id, name'),
      supabaseClient.from('vw_tc_observations_expanded').select('tc_observation_id, observation_date, text_content').eq('child_tc_id', childTcId),
      fetch(levelsUrl, { method: 'GET', headers })
    ]);

    if (studentRes.error) throw studentRes.error;
    if (lessonRes.error) throw lessonRes.error;
    if (categoryRes.error) throw categoryRes.error;
    if (areaRes.error) throw areaRes.error;
    if (obsRes.error) throw obsRes.error;

    if (!levelsResponse.ok) {
      const errorText = await levelsResponse.text();
      throw new Error(`TC levels request failed (${levelsResponse.status}): ${errorText}`);
    }

    const payload = await levelsResponse.json();

    const lessonMap = new Map();
    (lessonRes.data || []).forEach((lesson) => lessonMap.set(String(lesson.tc_id), lesson));

    const categoryMap = new Map();
    (categoryRes.data || []).forEach((category) => categoryMap.set(String(category.id), category));

    const areaMap = new Map();
    (areaRes.data || []).forEach((area) => areaMap.set(String(area.id), area));

    const normalizeBucket = (entry) => {
      if (entry.planned) return 'PLANNED';
      if (entry.introduced) return 'INTRODUCED';
      if (entry.practicing || entry.mastered) return 'PRACTICED';
      if (entry.proficiency !== undefined && entry.proficiency !== null) {
        if (entry.proficiency >= 2) return 'PRACTICED';
        if (entry.proficiency === 1) return 'INTRODUCED';
        if (entry.proficiency === 0) return 'PLANNED';
      }
      return 'UNSET';
    };

    const latestActivityByLessonId = new Map();
    const activityCountsByLessonId = new Map();
    (obsRes.data || []).forEach((row) => {
      const textContent = String(row.text_content || '');
      const dateValue = row.observation_date || null;
      const obsId = row.tc_observation_id || null;
      const matches = textContent.matchAll(/\[lesson_(\d+)\]/g);
      for (const match of matches) {
        const lessonId = String(match[1]);
        const current = latestActivityByLessonId.get(lessonId);
        if (!current || String(dateValue || '') > String(current.observation_date || '')) {
          latestActivityByLessonId.set(lessonId, { tc_observation_id: obsId, observation_date: dateValue });
        }
        activityCountsByLessonId.set(lessonId, (activityCountsByLessonId.get(lessonId) || 0) + 1);
      }
    });

    const entries = Object.entries(payload || {});
    const rows = entries
      .filter(([key]) => key.endsWith(`,${childTcId}`))
      .map(([key, entry]) => {
        const [lessonId] = key.split(',');
        const lesson = lessonMap.get(String(lessonId));
        const category = lesson?.category_id ? categoryMap.get(String(lesson.category_id)) : null;
        const area = category?.area_id ? areaMap.get(String(category.area_id)) : null;
        const latestActivity = latestActivityByLessonId.get(String(lessonId)) || null;
        return {
          tc_level_id: key,
          child_tc_id: childTcId,
          lesson_id: String(lessonId),
          lesson_name: lesson?.name || `Lesson ${lessonId}`,
          category_name: category?.name || null,
          area_name: area?.name || null,
          planned: Boolean(entry?.planned),
          planned_by: entry?.planned_by ?? null,
          introduced: Boolean(entry?.introduced),
          practicing: Boolean(entry?.practicing),
          mastered: Boolean(entry?.mastered),
          proficiency: entry?.proficiency ?? null,
          derived_status: normalizeBucket(entry || {}),
          latest_activity_date: latestActivity?.observation_date || null,
          latest_activity_observation_id: latestActivity?.tc_observation_id || null,
          activity_count: activityCountsByLessonId.get(String(lessonId)) || 0,
        };
      })
      .sort((a, b) => {
        const areaCmp = String(a.area_name || '').localeCompare(String(b.area_name || ''));
        if (areaCmp !== 0) return areaCmp;
        const catCmp = String(a.category_name || '').localeCompare(String(b.category_name || ''));
        if (catCmp !== 0) return catCmp;
        return String(a.lesson_name || '').localeCompare(String(b.lesson_name || ''));
      });

    const filteredRows = lessonQuery
      ? rows.filter((row) => {
          const hay = `${row.lesson_name || ''} ${row.category_name || ''} ${row.area_name || ''} ${row.lesson_id || ''} ${row.tc_level_id || ''}`.toLowerCase();
          return hay.includes(lessonQuery);
        })
      : rows;

    const counts = filteredRows.reduce((acc, row) => {
      acc[row.derived_status] = (acc[row.derived_status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return new Response(JSON.stringify({
      success: true,
      source_url: levelsUrl,
      student: studentRes.data || null,
      total_levels: rows.length,
      filtered_levels: filteredRows.length,
      lesson_query: lessonQuery || null,
      counts,
      rows: filteredRows,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('debug-tc-levels error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
})
