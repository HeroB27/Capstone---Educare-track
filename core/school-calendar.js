import { supabase } from "./core.js";

export async function getNoClassesEvent({ dateStr, gradeLevel } = {}) {
  if (!dateStr) return null;
  // [Date Checked: 2026-02-11] | [Remarks: Fixed type mismatch bug - added 'shortened' to event types that block taps]
  // Note: grade_scope column doesn't exist in schema, removing scope filtering
  const { data, error } = await supabase
    .from("school_calendar")
    .select("id,type,title,start_date,end_date")
    .lte("start_date", dateStr)
    .gte("end_date", dateStr)
    .in("type", ["holiday", "break", "emergency", "shortened", "suspension"])
    .order("start_date", { ascending: false });
  if (error) throw error;
  const events = data ?? [];
  // Return first matching event (grade_scope filtering not available without column)
  return events.length > 0 ? events[0] : null;
}

