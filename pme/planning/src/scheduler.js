const supabase = require('./db');

// Génère les shifts d'une semaine à partir d'un modèle de planning
async function generateWeeklySchedule(employeeId, weekStart, template) {
  const days = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
  const base = new Date(weekStart);
  const shifts = [];

  for (let i = 0; i < 7; i++) {
    const dayKey = days[i];
    const dayTemplate = template[dayKey];
    if (!dayTemplate || dayTemplate.off) continue;

    const date = new Date(base);
    date.setDate(base.getDate() + i);
    const dateStr = date.toISOString().slice(0, 10);

    shifts.push({
      employee_id: employeeId,
      date: dateStr,
      start_time: dayTemplate.start,
      end_time: dayTemplate.end,
      post: dayTemplate.post || null,
      note: dayTemplate.note || null
    });
  }

  if (shifts.length === 0) return { created: 0 };

  const { data, error } = await supabase
    .from('planning_schedules')
    .insert(shifts)
    .select();

  if (error) throw error;
  return { created: data.length, shifts: data };
}

// Calcule les heures travaillées sur une période
async function computeWorkedHours(employeeId, from, to) {
  const { data: entries } = await supabase
    .from('planning_timeclock')
    .select('*')
    .eq('employee_id', employeeId)
    .gte('clocked_at', from)
    .lte('clocked_at', to)
    .order('clocked_at', { ascending: true });

  if (!entries) return { total_minutes: 0, sessions: [] };

  const sessions = [];
  let i = 0;

  while (i < entries.length) {
    if (entries[i].type === 'in') {
      const clockIn = entries[i];
      const clockOut = entries[i + 1]?.type === 'out' ? entries[i + 1] : null;

      if (clockOut) {
        const minutes = (new Date(clockOut.clocked_at) - new Date(clockIn.clocked_at)) / 60000;
        sessions.push({
          date: clockIn.clocked_at.slice(0, 10),
          in: clockIn.clocked_at,
          out: clockOut.clocked_at,
          duration_minutes: Math.round(minutes),
          duration_formatted: formatDuration(minutes)
        });
        i += 2;
      } else {
        sessions.push({
          date: clockIn.clocked_at.slice(0, 10),
          in: clockIn.clocked_at,
          out: null,
          duration_minutes: null,
          duration_formatted: 'En cours'
        });
        i++;
      }
    } else {
      i++;
    }
  }

  const total = sessions.reduce((s, e) => s + (e.duration_minutes || 0), 0);
  return {
    total_minutes: total,
    total_formatted: formatDuration(total),
    sessions
  };
}

function formatDuration(minutes) {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}h${m.toString().padStart(2, '0')}`;
}

module.exports = { generateWeeklySchedule, computeWorkedHours };
