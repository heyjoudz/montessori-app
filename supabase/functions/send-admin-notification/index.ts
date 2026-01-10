// supabase/functions/send-admin-notification/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const handler = async (req: Request): Promise<Response> => {
  try {
    const payload = await req.json();
    const { record } = payload; // 'record' is the new user data from Supabase
    const newUserEmail = record.email;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Montessori App <onboarding@resend.dev>", // Use this exact email for testing
        to: ["joudchamoun@gmail.com"], // <--- CHANGE THIS to your email for now
        subject: "🔔 New User Awaiting Approval",
        html: `
          <h1>New Signup</h1>
          <p><strong>${newUserEmail}</strong> has just signed up.</p>
          <p>Go to your app to approve them.</p>
        `,
      }),
    });

    const data = await res.json();
    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json" },
      status: 400,
    });
  }
};

serve(handler);