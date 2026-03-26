import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const TC_SCHOOL_PATH_ID = '4597';
const CHILD_BATCH_SIZE = 20;
const STUDENT_PAGE_SIZE = 2;

type TcGridEntry = {
  proficiency?: number | string | null;
  planned?: boolean | null;
  planned_by?: number | string | null;
  introduced?: boolean | null;
  practicing?: boolean | null;
  mastered?: boolean | null;
};

type StudentRow = {
  id: number | null;
  tc_id: string | null;
  classroom_id: number | null;
};

type LessonRow = {
  id: number;
  tc_id: string;
  name: string | null;
  category_id: number | null;
};

type CategoryRow = {
  id: number;
  name: string | null;
  area_id: number | null;
};

type AreaRow = {
  id: number;
  name: string | null;
};

const toBool = (value: unknown) => value === true;

const toNum = (value: unknown) => {
  if (typeof value === 'number') return value;
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const deriveStatus = (entry: TcGridEntry) => {
  if (toBool(entry.planned)) return 'PLANNED';
  if (toBool(entry.introduced)) return 'INTRODUCED';
  if (toBool(entry.practicing) || toBool(entry.mastered)) return 'PRACTICED';

  const proficiency = toNum(entry.proficiency);
  if (proficiency !== null) {
    if (proficiency >= 2) return 'PRACTICED';
    if (proficiency === 1) return 'INTRODUCED';
    if (proficiency === 0) return 'PLANNED';
  }

  return 'UNSET';
};

const resolveFallbackCategoryName = (lessonName: string | null | undefined) => {
  const name = String(lessonName || '').trim().toLowerCase();
  if (!name) return null;

  if (name === 'my family') return 'My Family';
  if (name === 'my home') return 'My Home';
  if (name.includes('neighborhood') || name.includes('community helper')) return 'Neighborhood & Careers';
  if (name.includes('independence day flag') || name.includes('lebanese flag') || name.includes('soldier')) return 'My Country';
  if (name.includes('bus') || name.includes('airplane') || name.includes('train') || name.includes(' car')) return 'Tranportation';
  if (name.includes('planet') || name.includes('earth') || name.includes('sun') || name.includes('moon') || name.includes('mars') || name.includes('space')) return 'Geography';
  if (name.includes('mammal') || name.includes('reptile') || name.includes('fish') || name.includes('frog') || name.includes('snail') || name.includes('butterfly') || name.includes('chick') || name.includes('bean') || name.includes('flower') || name.includes('plant')) return 'Biology';
  if (name.includes('winter') || name.includes('snowman') || name.includes('snowflake')) return 'Winter';
  if (name.includes('fall') || name.includes('autumn') || name.includes(' leaf') || name.includes('leaves')) return 'Fall';
  if (name.includes('five senses') || name.includes('5 senses') || name.includes('eye activity') || name.includes('flashlight')) return '5 Senses';
  if (name.includes('emotion') || name.includes('happy/sad') || name.includes('face expressions')) return 'Emotions';
  if (name.includes('washing hands')) return 'Care of Self';
  if (name.includes('letter') && (name.includes('drawing') || name.includes('collage') || name.includes('art') || name.includes('sound'))) return 'Letter formation Art';
  if (name.includes('number') || name.includes('pattern making')) return 'Numbers 1-10';
  if (name.includes('draw') || name.includes('paint') || name.includes('rubbing') || name.includes('dot painting') || name.includes('van gogh')) return 'Drawing';
  if (name.includes('color')) return 'Coloring';
  if (name.includes('trace')) return 'Tracing lines';
  if (name.includes('cut') || name.includes('tearing') || name.includes('lacing')) return 'Cutting';
  if (name.includes('community art')) return 'Pasting';
  if (name.includes('paste') || name.includes('collage') || name.includes('craft') || name.includes('mobile') || name.includes('windsock') || name.includes('windwheel') || name.includes('bracelet') || name.includes('puppet') || name.includes('popsicle') || name.includes('paper roll') || name.includes('lantern') || name.includes('design') || name.includes('theme activities') || name.includes('art shelf')) return 'Pasting';

  return null;
};

const resolveFallbackAreaName = (categoryName: string | null) => {
  switch (categoryName) {
    case 'Care of Self':
      return 'Practical Life';
    case 'My Country':
    case 'Tranportation':
    case 'Geography':
    case 'Biology':
      return 'Geography';
    case 'Numbers 1-10':
      return 'Mathematics';
    case 'Drawing':
    case 'Coloring':
    case 'Tracing lines':
    case 'Cutting':
    case 'Pasting':
      return 'Art';
    case 'My Family':
    case 'My Home':
    case 'Neighborhood & Careers':
    case 'Winter':
    case 'Fall':
    case '5 Senses':
    case 'Emotions':
    case 'Letter formation Art':
      return 'Language';
    default:
      return null;
  }
};

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
    const requestedChildId = String(body?.child_tc_id || '').trim();
    const requestedChildIds = Array.isArray(body?.child_tc_ids)
      ? body.child_tc_ids.map((value: unknown) => String(value || '').trim()).filter(Boolean)
      : [];
    const requestedOffset = Math.max(0, toNum(body?.offset) || 0);
    const requestedLimit = Math.max(1, Math.min(200, toNum(body?.limit) || STUDENT_PAGE_SIZE));

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
    const headers = {
      'X-TransparentClassroomToken': tcApiToken,
      'Content-Type': 'application/json'
    };

    let studentsQuery = supabaseClient
      .from('students')
      .select('id, tc_id, classroom_id', { count: 'exact' })
      .not('tc_id', 'is', null);

    if (requestedChildId) {
      studentsQuery = studentsQuery.eq('tc_id', requestedChildId);
    } else if (requestedChildIds.length > 0) {
      studentsQuery = studentsQuery.in('tc_id', requestedChildIds);
    }

    if (!requestedChildId && requestedChildIds.length === 0) {
      studentsQuery = studentsQuery.order('tc_id', { ascending: true }).range(requestedOffset, requestedOffset + requestedLimit - 1);
    }

    const { data: students, error: studentsError, count: totalStudents } = await studentsQuery;
    if (studentsError) throw studentsError;
    if (!students || students.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No students with tc_id found.', count: 0, students: 0, offset: requestedOffset, limit: requestedLimit, total_students: totalStudents || 0, has_more: false, next_offset: null }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const studentMap = new Map((students as StudentRow[]).map((student) => [String(student.tc_id), student]));
    const childIds = Array.from(studentMap.keys());
    const rowsToUpsert: Record<string, unknown>[] = [];

    for (let i = 0; i < childIds.length; i += CHILD_BATCH_SIZE) {
      const batch = childIds.slice(i, i + CHILD_BATCH_SIZE);
      const params = batch.map((id) => `child_ids[]=${encodeURIComponent(id)}`).join('&');
      const url = `https://www.transparentclassroom.com/s/${TC_SCHOOL_PATH_ID}/levels.json?${params}`;
      const response = await fetch(url, { method: 'GET', headers });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`TC grid levels request failed (${response.status}): ${errorText}`);
      }

      const payload = await response.json();
      const entries = Object.entries(payload || {}) as Array<[string, TcGridEntry]>;
      const lessonIds = Array.from(new Set(entries.map(([key]) => String(key).split(',')[0]).filter(Boolean)));

      let lessonMap = new Map<string, LessonRow>();
      let categoryMap = new Map<string, CategoryRow>();
      let areaMap = new Map<string, AreaRow>();

      if (lessonIds.length > 0) {
        const { data: lessons, error: lessonError } = await supabaseClient
          .from('tc_curriculum_activities')
          .select('id, tc_id, name, category_id')
          .in('tc_id', lessonIds);
        if (lessonError) throw lessonError;

        lessonMap = new Map((lessons as LessonRow[] || []).map((lesson) => [String(lesson.tc_id), lesson]));

        const categoryIds = Array.from(new Set((lessons as LessonRow[] || []).map((lesson) => lesson.category_id).filter(Boolean).map(String)));
        if (categoryIds.length > 0) {
          const { data: categories, error: categoryError } = await supabaseClient
            .from('tc_curriculum_categories')
            .select('id, name, area_id')
            .in('id', categoryIds);
          if (categoryError) throw categoryError;

          categoryMap = new Map((categories as CategoryRow[] || []).map((category) => [String(category.id), category]));

          const areaIds = Array.from(new Set((categories as CategoryRow[] || []).map((category) => category.area_id).filter(Boolean).map(String)));
          if (areaIds.length > 0) {
            const { data: areas, error: areaError } = await supabaseClient
              .from('tc_curriculum_areas')
              .select('id, name')
              .in('id', areaIds);
            if (areaError) throw areaError;

            areaMap = new Map((areas as AreaRow[] || []).map((area) => [String(area.id), area]));
          }
        }
      }

      entries.forEach(([key, entry]) => {
        const [lessonTcId, childTcId] = String(key).split(',');
        if (!lessonTcId || !childTcId) return;

        const student = studentMap.get(String(childTcId));
        const lesson = lessonMap.get(String(lessonTcId));
        const category = lesson?.category_id ? categoryMap.get(String(lesson.category_id)) : null;
        const area = category?.area_id ? areaMap.get(String(category.area_id)) : null;
        const fallbackCategoryName = category?.name || resolveFallbackCategoryName(lesson?.name);
        const fallbackAreaName = area?.name || resolveFallbackAreaName(fallbackCategoryName);

        rowsToUpsert.push({
          tc_level_key: key,
          child_tc_id: String(childTcId),
          lesson_tc_id: String(lessonTcId),
          student_id: student?.id || null,
          classroom_id: student?.classroom_id || null,
          curriculum_activity_id: lesson?.id || null,
          curriculum_category_id: category?.id || null,
          curriculum_area_id: area?.id || null,
          lesson_name: lesson?.name || `Lesson ${lessonTcId}`,
          category_name: fallbackCategoryName || null,
          area_name: fallbackAreaName || null,
          proficiency: toNum(entry?.proficiency),
          derived_status: deriveStatus(entry || {}),
          planned: toBool(entry?.planned),
          planned_by: toNum(entry?.planned_by),
          introduced: toBool(entry?.introduced),
          practicing: toBool(entry?.practicing),
          mastered: toBool(entry?.mastered),
          synced_at: new Date().toISOString(),
        });
      });
    }

    if (rowsToUpsert.length > 0) {
      const { error: upsertError } = await supabaseClient
        .from('tc_grid_statuses')
        .upsert(rowsToUpsert, { onConflict: 'tc_level_key', ignoreDuplicates: false });

      if (upsertError) throw upsertError;
    }

    const hasMore = !requestedChildId && requestedChildIds.length === 0
      ? (requestedOffset + childIds.length) < Number(totalStudents || 0)
      : false;

    return new Response(JSON.stringify({
      success: true,
      message: `Synced ${rowsToUpsert.length} grid status rows for ${childIds.length} students.`,
      count: rowsToUpsert.length,
      students: childIds.length,
      requested_child_id: requestedChildId || null,
      requested_child_ids: requestedChildIds,
      offset: requestedOffset,
      limit: requestedLimit,
      total_students: Number(totalStudents || childIds.length),
      has_more: hasMore,
      next_offset: hasMore ? requestedOffset + childIds.length : null,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('sync-tc-grid-statuses error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
})
