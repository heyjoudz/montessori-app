import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
    const headers = {
      'X-TransparentClassroomToken': tcApiToken,
      'Content-Type': 'application/json'
    };

    // 1. Fetch Students
    const { data: dbStudents } = await supabaseClient
      .from('students')
      .select('id, tc_id, classroom_id')
      .not('tc_id', 'is', null);

    if (!dbStudents || dbStudents.length === 0) {
      return new Response(JSON.stringify({ success: false, message: "No students found." }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
    }

    // 2. Fetch Lessons mapping from DB
    const { data: dbLessons } = await supabaseClient
      .from('tc_curriculum_activities')
      .select('tc_id, name');
      
    const lessonMap = new Map();
    dbLessons?.forEach(lesson => {
      lessonMap.set(String(lesson.tc_id), lesson.name);
    });

    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1; 
    const currentDay = currentDate.getDate();

    const planItemsToInsert = [];
    let failedFetches = 0;
    let totalRawLevelsFound = 0;

    // 3. Process each student's levels
    for (const student of dbStudents) {
      const tcLevelsUrl = `https://www.transparentclassroom.com/api/v1/levels.json?child_id=${student.tc_id}`;
      const tcLevelsResponse = await fetch(tcLevelsUrl, { method: 'GET', headers });
      
      if (tcLevelsResponse.ok) {
        const levels = await tcLevelsResponse.json();
        totalRawLevelsFound += levels.length;
        
        levels.forEach((level) => {
          let kanbanStatus = 'NOT_STARTED';
          
          // --- CORRECTED MAPPING LOGIC ---
          if (level.mastered) {
            kanbanStatus = 'm';
          } else if (level.practicing) {
            kanbanStatus = 'p';
          } else if (level.introduced) {
            kanbanStatus = 'i';
          } else if (level.planned) {
            kanbanStatus = 'pl'; 
          } 
          else if (level.proficiency !== undefined && level.proficiency !== null) {
            if (level.proficiency >= 3) kanbanStatus = 'm';
            else if (level.proficiency === 2) kanbanStatus = 'p';
            else if (level.proficiency === 1) kanbanStatus = 'i';
            else if (level.proficiency === 0) kanbanStatus = 'pl';
          }

          if (kanbanStatus === 'NOT_STARTED') return;

          const realLessonName = lessonMap.get(String(level.lesson_id)) || `Lesson ${level.lesson_id}`;

          planItemsToInsert.push({
            tc_level_id: `${student.tc_id}_${level.lesson_id}`, 
            classroom_id: student.classroom_id,
            student_id: student.id,
            area: "TC Import", 
            activity: realLessonName,
            raw_area: "TC Import",
            raw_activity: realLessonName,
            status: kanbanStatus,
            year: currentYear,
            month: currentMonth,
            day: currentDay,
            planning_date: currentDate.toISOString().split('T')[0],
            entry_type: 'tc_import',
            step_progress: 'NOT_STARTED',
            notes: null 
          });
        });
      } else {
        failedFetches++;
      }

      await new Promise(resolve => setTimeout(resolve, 50));
    }

    // 4. Upsert everything into Supabase
    if (planItemsToInsert.length > 0) {
      const { error: upsertError } = await supabaseClient
        .from('tc_plan_items')
        .upsert(planItemsToInsert, { onConflict: 'tc_level_id', ignoreDuplicates: false });

      if (upsertError) {
        // 🚨 ADDED LOGGING HERE TO CATCH THE EXACT UPSERT REJECTION
        console.error("🚨 DATABASE UPSERT ERROR:", upsertError);
        throw new Error(`Database Upsert Error: ${upsertError.message}`);
      }
    }

    const debugMessage = `Success! Scanned ${dbStudents.length} students. Found ${totalRawLevelsFound} raw levels, and synced ${planItemsToInsert.length} cards to the database.`;

    return new Response(JSON.stringify({ 
      success: true, 
      message: debugMessage 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    // 🚨 ADDED LOGGING HERE TO CATCH ANY OTHER CRASHES
    console.error("🚨 FATAL FUNCTION ERROR:", error);
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
  }
})