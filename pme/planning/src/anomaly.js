const supabase = require('./db');

const TOLERANCE = parseInt(process.env.CLOCK_TOLERANCE_MINUTES || '15', 10);
const UNUSUAL_START = parseInt(process.env.UNUSUAL_HOUR_START || '6', 10);
const UNUSUAL_END = parseInt(process.env.UNUSUAL_HOUR_END || '22', 10);

// Types d'anomalies et leur niveau de sévérité
const ANOMALY_TYPES = {
  early_clock_in:    { label: 'Pointage entrée anticipé',        severity: 'low' },
  late_clock_in:     { label: 'Pointage entrée en retard',       severity: 'medium' },
  early_clock_out:   { label: 'Départ anticipé',                 severity: 'medium' },
  late_clock_out:    { label: 'Départ tardif',                   severity: 'low' },
  missed_clock_in:   { label: 'Absence de pointage entrée',      severity: 'high' },
  missed_clock_out:  { label: 'Absence de pointage sortie',      severity: 'medium' },
  no_schedule:       { label: 'Pointage sans planning prévu',    severity: 'high' },
  unusual_hour:      { label: 'Pointage heure inhabituelle',     severity: 'high' },
  overtime_excess:   { label: 'Dépassement heures excessif',     severity: 'medium' },
  duplicate_clock:   { label: 'Double pointage suspect',         severity: 'high' },
};

async function detectAnomalies(employeeId, clockEntry) {
  const detected = [];
  const clockedAt = new Date(clockEntry.clocked_at);
  const hour = clockedAt.getHours();

  // Heure inhabituelle
  if (hour < UNUSUAL_START || hour >= UNUSUAL_END) {
    detected.push(buildAnomaly('unusual_hour', employeeId, clockEntry, {
      hour,
      plage_normale: `${UNUSUAL_START}h-${UNUSUAL_END}h`
    }));
  }

  // Double pointage (même type dans les 5 dernières minutes)
  const fiveMinAgo = new Date(clockedAt.getTime() - 5 * 60 * 1000).toISOString();
  const { data: recent } = await supabase
    .from('planning_timeclock')
    .select('id, clocked_at')
    .eq('employee_id', employeeId)
    .eq('type', clockEntry.type)
    .gte('clocked_at', fiveMinAgo)
    .neq('id', clockEntry.id);

  if (recent && recent.length > 0) {
    detected.push(buildAnomaly('duplicate_clock', employeeId, clockEntry, {
      doublon_id: recent[0].id,
      doublon_at: recent[0].clocked_at
    }));
  }

  // Vérifier par rapport au planning prévu
  const today = clockedAt.toISOString().slice(0, 10);
  const { data: shifts } = await supabase
    .from('planning_schedules')
    .select('*')
    .eq('employee_id', employeeId)
    .eq('date', today);

  if (!shifts || shifts.length === 0) {
    detected.push(buildAnomaly('no_schedule', employeeId, clockEntry, { date: today }));
  } else {
    const shift = shifts[0];
    const shiftStart = new Date(`${today}T${shift.start_time}`);
    const shiftEnd = new Date(`${today}T${shift.end_time}`);
    const diffMin = (clockedAt - shiftStart) / 60000;

    if (clockEntry.type === 'in') {
      if (diffMin < -TOLERANCE) {
        detected.push(buildAnomaly('early_clock_in', employeeId, clockEntry, {
          avance_minutes: Math.abs(Math.round(diffMin)),
          shift_start: shift.start_time
        }));
      } else if (diffMin > TOLERANCE) {
        detected.push(buildAnomaly('late_clock_in', employeeId, clockEntry, {
          retard_minutes: Math.round(diffMin),
          shift_start: shift.start_time
        }));
      }
    }

    if (clockEntry.type === 'out') {
      const diffEndMin = (clockedAt - shiftEnd) / 60000;
      if (diffEndMin < -TOLERANCE) {
        detected.push(buildAnomaly('early_clock_out', employeeId, clockEntry, {
          depart_anticipe_minutes: Math.abs(Math.round(diffEndMin)),
          shift_end: shift.end_time
        }));
      } else if (diffEndMin > 60) {
        detected.push(buildAnomaly('late_clock_out', employeeId, clockEntry, {
          depassement_minutes: Math.round(diffEndMin),
          shift_end: shift.end_time
        }));
      }
    }
  }

  // Persister les anomalies détectées
  if (detected.length > 0) {
    await supabase.from('planning_anomalies').insert(detected);
  }

  return detected;
}

// Scan quotidien : cherche les shifts sans pointage
async function runDailyAnomalyScan(focusType = null) {
  const today = new Date().toISOString().slice(0, 10);
  const detected = [];

  const { data: shifts } = await supabase
    .from('planning_schedules')
    .select('*, planning_employees(first_name, last_name)')
    .eq('date', today);

  if (!shifts) return { detected: 0 };

  for (const shift of shifts) {
    if (!focusType || focusType === 'missed_clock_in') {
      const { data: clockIns } = await supabase
        .from('planning_timeclock')
        .select('id')
        .eq('employee_id', shift.employee_id)
        .eq('type', 'in')
        .gte('clocked_at', `${today}T00:00:00`)
        .lte('clocked_at', `${today}T23:59:59`);

      if (!clockIns || clockIns.length === 0) {
        const anomaly = buildAnomaly('missed_clock_in', shift.employee_id, null, {
          date: today,
          shift_start: shift.start_time,
          shift_end: shift.end_time
        });
        detected.push(anomaly);
      }
    }

    if (!focusType || focusType === 'missed_clock_out') {
      const { data: clockOuts } = await supabase
        .from('planning_timeclock')
        .select('id')
        .eq('employee_id', shift.employee_id)
        .eq('type', 'out')
        .gte('clocked_at', `${today}T00:00:00`)
        .lte('clocked_at', `${today}T23:59:59`);

      if (!clockOuts || clockOuts.length === 0) {
        const anomaly = buildAnomaly('missed_clock_out', shift.employee_id, null, {
          date: today,
          shift_end: shift.end_time
        });
        detected.push(anomaly);
      }
    }
  }

  if (detected.length > 0) {
    await supabase.from('planning_anomalies').insert(detected);
  }

  return { detected: detected.length, anomalies: detected };
}

function buildAnomaly(type, employeeId, clockEntry, detail = {}) {
  const meta = ANOMALY_TYPES[type] || { label: type, severity: 'medium' };
  return {
    type,
    label: meta.label,
    severity: meta.severity,
    employee_id: employeeId,
    timeclock_id: clockEntry?.id || null,
    detail,
    detected_at: new Date().toISOString(),
    resolved: false
  };
}

module.exports = { detectAnomalies, runDailyAnomalyScan, ANOMALY_TYPES };
