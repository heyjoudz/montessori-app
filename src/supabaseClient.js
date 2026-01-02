import { createClient } from '@supabase/supabase-js'

// We are hardcoding these to bypass the .env issue
const supabaseUrl = 'https://bsgscntldgeqlmnybpnj.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzZ3NjbnRsZGdlcWxtbnlicG5qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyMTM5OTQsImV4cCI6MjA4MDc4OTk5NH0.q701HzeEJFnc9Ldl6HnGUNLQahQEtFiJGm7KoPuLtaQ'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)