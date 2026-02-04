import { supabase } from "./core.js";

function matchesScope(scope, gradeLevel) {
  const s = String(scope ?? "all").trim().toLowerCase();
  if (!s || s === "all") return true;
  const g = gradeLevel ? String(gradeLevel).trim().toLowerCase() : "";
  if (!g) return false;
  return s === g;
}

export async function getNoClassesEvent({ dateStr, gradeLevel } = {}) {
  if (!dateStr) return null;
  const { data, error } = await supabase
    .from("school_calendar")
    .select("id,type,title,start_date,end_date,grade_scope,notes")
    .lte("start_date", dateStr)
    .gte("end_date", dateStr)
    .in("type", ["holiday", "break", "emergency"])
    .order("start_date", { ascending: false });
  if (error) throw error;
  const events = data ?? [];
  return events.find((e) => matchesScope(e.grade_scope, gradeLevel)) ?? null;
}

