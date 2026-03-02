import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const tcApiToken = Deno.env.get('TC_API_TOKEN');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // DAILY SYNC LIMIT: Only process the 3 most recent pages (300 items)
    const maxPagesToFetch = 3; 

    let allActivities = [];
    let page = 1;
    let keepFetching = true;

    // Loop through just the first 3 pages
    while (keepFetching && page <= maxPagesToFetch) {
      const tcUrl = `https://www.transparentclassroom.com/api/v1/activity.json?classroom_id=19184&page=${page}&per_page=100`;
      const res = await fetch(tcUrl, { headers: { 'X-TransparentClassroomToken': tcApiToken } });
      const data = await res.json();

      if (data.length === 0) {
        keepFetching = false;
      } else {
        allActivities = [...allActivities, ...data];
        page++;
      }
    }

    const formatted = allActivities.map(act => ({
      tc_observation_id: String(act.id),
      date: act.date,
      text_content: act.normalized_text,
      html_content: act.html
    }));

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