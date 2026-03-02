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

    // --- THE FIX IS HERE ---
    // Read the page number from the POST body sent by React
    let startPage = 1;
    try {
      const reqBody = await req.json();
      if (reqBody.page) startPage = reqBody.page;
    } catch (e) {
      // If the body is empty or fails to parse, it just defaults to 1
    }
    
    // Safety limit: Only process 5 pages (500 items) per run
    const maxPagesPerRun = 5; 

    let allActivities = [];
    let page = startPage;
    let keepFetching = true;
    let pagesFetched = 0;

    // Loop through pages safely
    while (keepFetching && pagesFetched < maxPagesPerRun) {
      const tcUrl = `https://www.transparentclassroom.com/api/v1/activity.json?classroom_id=19184&page=${page}&per_page=100`;
      const res = await fetch(tcUrl, { headers: { 'X-TransparentClassroomToken': tcApiToken } });
      const data = await res.json();

      if (data.length === 0) {
        keepFetching = false; // We reached the end of the history!
      } else {
        allActivities = [...allActivities, ...data];
        page++;
        pagesFetched++;
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
      pages_fetched: pagesFetched,
      next_page: keepFetching ? page : null, 
      message: `Fetched ${formatted.length} observations from page ${startPage} to ${page - 1}.` 
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 400, headers: corsHeaders });
  }
})