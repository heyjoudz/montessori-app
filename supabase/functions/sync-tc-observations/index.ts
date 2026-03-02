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
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Environment variables are not configured.');
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Fetch observations ordered by date ascending!
    // This ensures the NEWEST note is applied last and overwrites older ones.
    const { data: observations, error: obsError } = await supabaseClient
      .from('tc_observations')
      .select('text_content, date')
      .not('text_content', 'is', null)
      .order('date', { ascending: true }); 
    
    if (obsError) {
      throw new Error(`Database Error: Could not read tc_observations table. (${obsError.message})`);
    }

    if (!observations || observations.length === 0) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: "No observations found in your tc_observations table." 
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    }

    let updatedCardsCount = 0;
    const updatePromises = [];

    // 2. Parse each observation and prepare the update queries
    for (const obs of observations) {
      const text = obs.text_content || "";
      
      const childMatches = [...text.matchAll(/\[child_(\d+)\]/g)];
      const lessonMatches = [...text.matchAll(/\[lesson_(\d+)\]/g)];

      let cleanNote = text
        .replace(/\[child_\d+\]/g, '')
        .replace(/\[lesson_\d+\]/g, '')
        .replace(/introduced|practicing|mastered/gi, '')
        .replace(/and she wrote:/gi, '')
        .replace(/and he wrote:/gi, '')
        .replace(/،/g, '') // Arabic comma
        .replace(/,/g, '')  // English comma
        .trim();

      if (childMatches.length === 0 || lessonMatches.length === 0 || !cleanNote) continue;

      const childIds = childMatches.map(m => m[1]);
      const lessonIds = lessonMatches.map(m => m[1]);

      // Group all the tc_level_ids for THIS specific note
      const tcLevelIdsToUpdate = [];
      for (const cId of childIds) {
        for (const lId of lessonIds) {
          tcLevelIdsToUpdate.push(`${cId}_${lId}`);
        }
      }

      if (tcLevelIdsToUpdate.length > 0) {
        // Prepare the promise (but don't wait for it yet)
        const dbPromise = supabaseClient
          .from('tc_plan_items')
          .update({ notes: cleanNote })
          .in('tc_level_id', tcLevelIdsToUpdate) 
          .then(({ error }) => {
            if (!error) updatedCardsCount += tcLevelIdsToUpdate.length;
          });
          
        updatePromises.push(dbPromise);
      }
    }

    // 3. Fire the database updates concurrently in chunks of 50
    const chunkSize = 50;
    for (let i = 0; i < updatePromises.length; i += chunkSize) {
      const chunk = updatePromises.slice(i, i + chunkSize);
      await Promise.all(chunk);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: `Fast-scanned ${observations.length} database observations. Successfully attached the latest notes to ${updatedCardsCount} Kanban cards.` 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("Function Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
      status: 400 
    });
  }
})