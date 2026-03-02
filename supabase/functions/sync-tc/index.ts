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
    const body = await req.json().catch(() => ({}));
    const { school_id } = body;

    if (!school_id) {
      return new Response(JSON.stringify({ error: "Missing school_id in request body" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const tcApiToken = Deno.env.get('TC_API_TOKEN');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!tcApiToken || !supabaseUrl || !supabaseServiceKey) {
      throw new Error('Environment variables are not configured.');
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Get fallback classroom
    const { data: classrooms } = await supabaseClient
      .from('classrooms')
      .select('id')
      .eq('school_id', school_id)
      .limit(1);
    const fallbackClassroomId = classrooms?.[0]?.id || 1;

    // 2. Fetch existing students mapping
    const { data: existingStudents } = await supabaseClient
      .from('students')
      .select('tc_id, classroom_id')
      .not('tc_id', 'is', null);
    const existingClassroomMap = new Map();
    existingStudents?.forEach(s => existingClassroomMap.set(s.tc_id, s.classroom_id));

    const headers = {
      'X-TransparentClassroomToken': tcApiToken,
      'Content-Type': 'application/json'
    };

    // 3. FETCH CHILDREN
    const tcChildrenUrl = `https://www.transparentclassroom.com/api/v1/children.json?classroom_id=19184`;
    const tcChildrenResponse = await fetch(tcChildrenUrl, { method: 'GET', headers });
    if (!tcChildrenResponse.ok) throw new Error(`TC API Error (Children): ${await tcChildrenResponse.text()}`);
    const tcStudents = await tcChildrenResponse.json();

    // 4. FETCH USERS
    const tcUsersUrl = `https://www.transparentclassroom.com/api/v1/users.json?classroom_id=19184`;
    const tcUsersResponse = await fetch(tcUsersUrl, { method: 'GET', headers });
    if (!tcUsersResponse.ok) throw new Error(`TC API Error (Users): ${await tcUsersResponse.text()}`);
    const tcUsers = await tcUsersResponse.json();

    const userLookup = new Map();
    tcUsers.forEach((user: any) => {
      userLookup.set(user.id, user);
    });

    const titleCase = (str: string) => {
      if (!str) return '';
      return str.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    };

    // 5. MAP DATA
    const formatted = tcStudents.map((child: any) => {
      const tcIdString = String(child.id);
      const parentIds = child.parent_ids || [];
      const p1 = parentIds.length > 0 ? userLookup.get(parentIds[0]) : null;
      const p2 = parentIds.length > 1 ? userLookup.get(parentIds[1]) : null;
      
      return {
        tc_id: tcIdString,
        first_name: titleCase(child.first_name),
        last_name: titleCase(child.last_name),
        birth_date: child.birth_date, 
        gender: child.gender,         
        notes: child.notes,           
        classroom_id: existingClassroomMap.get(tcIdString) || fallbackClassroomId, 
        school_id: school_id,
        parent1_full_name: p1 ? titleCase(`${p1.first_name || ''} ${p1.last_name || ''}`.trim()) : null,
        parent1_email: p1?.email || null,
        parent1_phone: p1?.mobile_number || p1?.home_number || null,
        parent2_full_name: p2 ? titleCase(`${p2.first_name || ''} ${p2.last_name || ''}`.trim()) : null,
        parent2_email: p2?.email || null,
        parent2_phone: p2?.mobile_number || p2?.home_number || null,
      };
    });

    // 6. UPSERT
    const { error: upsertError } = await supabaseClient
      .from('students')
      .upsert(formatted, { 
        onConflict: 'tc_id',
        ignoreDuplicates: false 
      });

    if (upsertError) {
      throw new Error(`Database Upsert Error: ${upsertError.message}`);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: `Successfully synced ${formatted.length} students with parent info.` 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('CRITICAL_FUNCTION_ERROR:', error.message);
    return new Response(JSON.stringify({ 
      error: error.message, 
      detail: "Check Supabase Function Logs for stack trace." 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
})