import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // 1. Handle CORS Preflight immediately
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 2. Ultra-safe body parsing (NO req.json() used here)
    let school_id = 1; // Default fallback
    if (req.method === 'POST') {
        const textBody = await req.text();
        // Only try to parse if the body actually has text
        if (textBody && textBody.trim().length > 0) {
            const jsonBody = JSON.parse(textBody);
            school_id = jsonBody.school_id || 1;
        }
    }

    console.log("Starting Curriculum Sync for School ID:", school_id);

    // 3. Check environment variables
    const tcApiToken = Deno.env.get('TC_API_TOKEN');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!tcApiToken || !supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing environment variables in Supabase.');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 4. Fetch Classrooms from TC
    const classroomsUrl = `https://www.transparentclassroom.com/api/v1/classrooms.json`;
    const classRes = await fetch(classroomsUrl, {
      headers: { 'X-TransparentClassroomToken': tcApiToken }
    });
    
    if (!classRes.ok) throw new Error("Failed to fetch classrooms from TC");
    const classrooms = await classRes.json();
    
    const targetClassroom = classrooms.find((c: any) => String(c.id) === '19184');
    if (!targetClassroom || !targetClassroom.lesson_set_id) {
        throw new Error("Could not find lesson_set_id for classroom 19184.");
    }
    
    // 5. Fetch the Curriculum (Lesson Set)
    // REMOVED ?format=long to see if the basic request succeeds
    const lessonSetUrl = `https://www.transparentclassroom.com/api/v1/lesson_sets/${targetClassroom.lesson_set_id}.json`;
    const lsRes = await fetch(lessonSetUrl, {
      headers: { 'X-TransparentClassroomToken': tcApiToken }
    });
    
    // THIS IS THE NEW ERROR LOGGING
    if (!lsRes.ok) {
        const errorText = await lsRes.text();
        throw new Error(`TC rejected lesson set fetch (Status ${lsRes.status}): ${errorText}`);
    }
    
    const lessonSet = await lsRes.json();

    let areasCount = 0;
    let categoriesCount = 0;
    let lessonsCount = 0;

    // 6. Unpack and Insert: Areas -> Categories -> Lessons
    for (const area of lessonSet.children || []) {
        const { data: areaData, error: areaErr } = await supabase
            .from('tc_curriculum_areas')
            .upsert({ tc_id: String(area.id), name: area.name, school_id: school_id }, { onConflict: 'tc_id' })
            .select('id')
            .single();
        
        if (areaErr) throw new Error(`Area Error: ${areaErr.message}`);
        areasCount++;

        for (const category of area.children || []) {
            const { data: catData, error: catErr } = await supabase
                .from('tc_curriculum_categories')
                .upsert({ 
                    tc_id: String(category.id), 
                    area_id: areaData.id, 
                    name: category.name 
                }, { onConflict: 'tc_id' })
                .select('id')
                .single();
            
            if (catErr) throw new Error(`Category Error: ${catErr.message}`);
            categoriesCount++;

            const lessonsToInsert = (category.lessons || []).map((lesson: any) => ({
                tc_id: String(lesson.id),
                category_id: catData.id,
                name: lesson.name,
                lesson_type: lesson.lesson_type
            }));

            if (lessonsToInsert.length > 0) {
                const { error: lessonErr } = await supabase
                    .from('tc_curriculum_activities')
                    .upsert(lessonsToInsert, { onConflict: 'tc_id' });
                
                if (lessonErr) throw new Error(`Lesson Error: ${lessonErr.message}`);
                lessonsCount += lessonsToInsert.length;
            }
        }
    }

    return new Response(JSON.stringify({ 
        success: true, 
        message: `Successfully synced ${areasCount} Areas, ${categoriesCount} Categories, and ${lessonsCount} Lessons.` 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error("SYNC ERROR:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
})