import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://pxefmsrvkrvhyauaycby.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB4ZWZtc3J2a3J2aHlhdWF5Y2J5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk2OTc4MDAsImV4cCI6MjEwNTI3MzgwMH0.jBPCD2IL55d4irHSzm008dZaBqhX0TuVUF28OWuqn_4'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)