const RULES = {
  MAX_WORKED_DAYS_IN_WINDOW: 4,
  ROLLING_WINDOW_DAYS: 7,
  MIN_REST_HOURS: 12,
};

const REASON_CODES = {
  INVALID_SCHEDULE: "INVALID_SCHEDULE",
  TOO_MANY_WORKED_DAYS_IN_7: "TOO_MANY_WORKED_DAYS_IN_7",
  INSUFFICIENT_REST_HOURS: "INSUFFICIENT_REST_HOURS",
  SHIFT_SEQUENCE_NOT_ALLOWED: "SHIFT_SEQUENCE_NOT_ALLOWED",
  CANDIDATE_DATE_ALREADY_WORKED: "CANDIDATE_DATE_ALREADY_WORKED",
  CANDIDATE_DATE_IS_REMOVED_DATE: "CANDIDATE_DATE_IS_REMOVED_DATE",
  CANDIDATE_DATE_BLOCKED_BY_USER: "CANDIDATE_DATE_BLOCKED_BY_USER",
  UNKNOWN_SHIFT_TYPE: "UNKNOWN_SHIFT_TYPE",
  REMOVED_SHIFT_NOT_FOUND: "REMOVED_SHIFT_NOT_FOUND",
  DUPLICATE_WORKED_DATE: "DUPLICATE_WORKED_DATE",
  INVALID_SHIFT: "INVALID_SHIFT",
};

const CALENDAR_DAY_COLORS = {
  WORKED_DAY: "#2E86AB",
  AVAILABLE_DAY: "#7FB069",
  BLOCKED_REST_DAY: "#D1495B",
  UNAVAILABLE_DAY: "#9E9E9E",
};

const SHIFT_TYPES = {
  JOUR_7_19: {
    label: "Jour 7h-19h",
    start: "07:00",
    end: "19:00",
    crossesMidnight: false,
    family: "day",
  },
  NUIT_19_7: {
    label: "Nuit 19h-7h",
    start: "19:00",
    end: "07:00",
    crossesMidnight: true,
    family: "night",
  },
  JOUR_10_22: {
    label: "Jour 10h-22h",
    start: "10:00",
    end: "22:00",
    crossesMidnight: false,
    family: "day",
  },
  JOUR_11_23: {
    label: "Jour 11h-23h",
    start: "11:00",
    end: "23:00",
    crossesMidnight: false,
    family: "day",
  },
  FO: {
    label: "FO",
    start: "09:00",
    end: "17:00",
    crossesMidnight: false,
    family: "day",
  },
  CA: {
    label: "Congé annuel",
    start: "00:00",
    end: "00:00",
    crossesMidnight: false,
    family: "leave",
  },
};

const DAY_SHIFT_TYPES = ["JOUR_7_19", "JOUR_10_22", "JOUR_11_23"];
const NIGHT_SHIFT_TYPES = ["NUIT_19_7"];

function isWorkedShiftType(shiftType) {
  const family = SHIFT_TYPES[shiftType] ? SHIFT_TYPES[shiftType].family : null;
  return family === "day" || family === "night";
}

function isWorkedShift(shift) {
  return Boolean(shift && isWorkedShiftType(shift.shiftType));
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function parseLocalDate(dateString) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString);
  if (!match) {
    throw new Error(`Invalid date string: ${dateString}`);
  }
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  return new Date(year, monthIndex, day, 0, 0, 0, 0);
}

function formatLocalDate(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function addDays(dateString, daysToAdd) {
  const date = parseLocalDate(dateString);
  date.setDate(date.getDate() + daysToAdd);
  return formatLocalDate(date);
}

function compareDateStrings(a, b) {
  if (a === b) {
    return 0;
  }
  return a < b ? -1 : 1;
}

function combineDateAndTime(dateString, timeString) {
  const [hours, minutes] = timeString.split(":").map(Number);
  const date = parseLocalDate(dateString);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

function differenceInHours(startDateTime, endDateTime) {
  return (endDateTime.getTime() - startDateTime.getTime()) / (1000 * 60 * 60);
}

function isSameShift(a, b) {
  return Boolean(a && b && a.date === b.date && a.shiftType === b.shiftType);
}

function cloneShift(shift) {
  return { date: shift.date, shiftType: shift.shiftType };
}

function isValidDateString(dateString) {
  if (typeof dateString !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return false;
  }

  try {
    return formatLocalDate(parseLocalDate(dateString)) === dateString;
  } catch (error) {
    return false;
  }
}

function validateShiftInput(shift, label = "shift") {
  const reasonCodes = [];

  if (!shift || typeof shift !== "object") {
    return {
      valid: false,
      reasonCodes: [REASON_CODES.INVALID_SHIFT],
      details: [`${label} must be an object with date and shiftType.`],
    };
  }

  if (!isValidDateString(shift.date)) {
    reasonCodes.push(REASON_CODES.INVALID_SHIFT);
  }

  if (typeof shift.shiftType !== "string" || !SHIFT_TYPES[shift.shiftType]) {
    reasonCodes.push(
      typeof shift.shiftType === "string" ? REASON_CODES.UNKNOWN_SHIFT_TYPE : REASON_CODES.INVALID_SHIFT
    );
  }

  return {
    valid: reasonCodes.length === 0,
    reasonCodes: [...new Set(reasonCodes)],
    details: reasonCodes.map((code) => `${label}: ${code}`),
  };
}

function validateScheduleInput(schedule) {
  if (!Array.isArray(schedule)) {
    return {
      valid: false,
      reasonCodes: [REASON_CODES.INVALID_SCHEDULE],
      details: ["schedule must be an array of shifts."],
    };
  }

  const details = [];
  const reasonCodes = [];

  schedule.forEach((shift, index) => {
    const validation = validateShiftInput(shift, `schedule[${index}]`);
    if (!validation.valid) {
      reasonCodes.push(...validation.reasonCodes);
      details.push(...validation.details);
    }
  });

  return {
    valid: reasonCodes.length === 0,
    reasonCodes: [...new Set(reasonCodes)],
    details,
  };
}

function normalizeValidationOptions(options = {}) {
  const blockedRestDates = Array.isArray(options.blockedRestDates) ? options.blockedRestDates : [];

  return {
    blockedRestDates: blockedRestDates.filter(isValidDateString).filter((date, index, array) => {
      return array.indexOf(date) === index;
    }).sort(compareDateStrings),
  };
}

function parseShiftOccurrence(shift) {
  const inputValidation = validateShiftInput(shift);
  if (!inputValidation.valid) {
    return {
      valid: false,
      reasonCodes: inputValidation.reasonCodes,
      details: inputValidation.details,
      shift,
    };
  }

  const config = SHIFT_TYPES[shift.shiftType];
  const startDateTime = combineDateAndTime(shift.date, config.start);
  const endDate = config.crossesMidnight ? addDays(shift.date, 1) : shift.date;
  const endDateTime = combineDateAndTime(endDate, config.end);

  return {
    valid: true,
    date: shift.date,
    shiftType: shift.shiftType,
    label: config.label,
    family: config.family,
    crossesMidnight: config.crossesMidnight,
    startDateTime,
    endDateTime,
    start: config.start,
    end: config.end,
    originalShift: cloneShift(shift),
  };
}

function sortSchedule(schedule) {
  if (!Array.isArray(schedule)) {
    return [];
  }

  return [...schedule].sort((left, right) => {
    const leftParsed = parseShiftOccurrence(left);
    const rightParsed = parseShiftOccurrence(right);

    if (!leftParsed.valid && !rightParsed.valid) {
      return 0;
    }
    if (!leftParsed.valid) {
      return 1;
    }
    if (!rightParsed.valid) {
      return -1;
    }

    const startDiff = leftParsed.startDateTime.getTime() - rightParsed.startDateTime.getTime();
    if (startDiff !== 0) {
      return startDiff;
    }

    return left.shiftType.localeCompare(right.shiftType);
  });
}

function getUniqueWorkedDates(schedule) {
  if (!Array.isArray(schedule)) {
    return [];
  }

  return [...new Set(schedule.filter(isWorkedShift).map((shift) => shift.date))].sort(compareDateStrings);
}

function countWorkedDaysInWindow(schedule, windowStartDate, windowEndDate) {
  const workedDates = getUniqueWorkedDates(schedule).filter((date) => {
    return compareDateStrings(date, windowStartDate) >= 0 && compareDateStrings(date, windowEndDate) <= 0;
  });

  return {
    workedDaysCount: workedDates.length,
    workedDates,
  };
}

function generateSevenDayWindowsAroundDate(date) {
  const windows = [];
  for (let offset = RULES.ROLLING_WINDOW_DAYS - 1; offset >= 0; offset -= 1) {
    const startDate = addDays(date, -offset);
    const endDate = addDays(startDate, RULES.ROLLING_WINDOW_DAYS - 1);
    windows.push({ startDate, endDate });
  }
  return windows;
}

function getAllRelevantSevenDayWindows(schedule) {
  const uniqueDates = getUniqueWorkedDates(schedule);
  const seen = new Set();
  const windows = [];

  uniqueDates.forEach((date) => {
    generateSevenDayWindowsAroundDate(date).forEach((window) => {
      const key = `${window.startDate}_${window.endDate}`;
      if (!seen.has(key)) {
        seen.add(key);
        windows.push(window);
      }
    });
  });

  return windows.sort((left, right) => compareDateStrings(left.startDate, right.startDate));
}

function checkRollingSevenDayRule(schedule) {
  const scheduleValidation = validateScheduleInput(schedule);
  if (!scheduleValidation.valid) {
    return {
      valid: false,
      blockingWindows: [],
      reasonCodes: scheduleValidation.reasonCodes,
    };
  }

  const blockingWindows = getAllRelevantSevenDayWindows(schedule)
    .map((window) => {
      const count = countWorkedDaysInWindow(schedule, window.startDate, window.endDate);
      return {
        startDate: window.startDate,
        endDate: window.endDate,
        workedDaysCount: count.workedDaysCount,
        workedDates: count.workedDates,
      };
    })
    .filter((window) => window.workedDaysCount > RULES.MAX_WORKED_DAYS_IN_WINDOW);

  return {
    valid: blockingWindows.length === 0,
    blockingWindows,
    reasonCodes: blockingWindows.length === 0 ? [] : [REASON_CODES.TOO_MANY_WORKED_DAYS_IN_7],
  };
}

function getPreviousAndNextShifts(schedule, targetDate) {
  const sorted = sortSchedule(schedule).filter(isWorkedShift);
  const targetIndex = sorted.findIndex((shift) => shift.date === targetDate);

  return {
    previousShift: targetIndex > 0 ? sorted[targetIndex - 1] : null,
    nextShift: targetIndex >= 0 && targetIndex < sorted.length - 1 ? sorted[targetIndex + 1] : null,
  };
}

function computeRestHoursBetweenShifts(previousShift, nextShift) {
  if (!previousShift || !nextShift) {
    return null;
  }

  const previousOccurrence = parseShiftOccurrence(previousShift);
  const nextOccurrence = parseShiftOccurrence(nextShift);

  if (!previousOccurrence.valid || !nextOccurrence.valid) {
    return null;
  }

  return differenceInHours(previousOccurrence.endDateTime, nextOccurrence.startDateTime);
}

function checkShiftCompatibility(previousShift, nextShift) {
  if (!previousShift || !nextShift) {
    return {
      valid: true,
      reasonCodes: [],
      restHours: null,
    };
  }

  const previousOccurrence = parseShiftOccurrence(previousShift);
  const nextOccurrence = parseShiftOccurrence(nextShift);

  const reasonCodes = [];

  if (!previousOccurrence.valid) {
    reasonCodes.push(...previousOccurrence.reasonCodes);
  }
  if (!nextOccurrence.valid) {
    reasonCodes.push(...nextOccurrence.reasonCodes);
  }

  if (reasonCodes.length > 0) {
    return {
      valid: false,
      reasonCodes: [...new Set(reasonCodes)],
      restHours: null,
    };
  }

  const restHours = differenceInHours(previousOccurrence.endDateTime, nextOccurrence.startDateTime);

  if (restHours < RULES.MIN_REST_HOURS) {
    reasonCodes.push(REASON_CODES.INSUFFICIENT_REST_HOURS);
  }

  if (previousOccurrence.family !== nextOccurrence.family && restHours < RULES.MIN_REST_HOURS) {
    reasonCodes.push(REASON_CODES.SHIFT_SEQUENCE_NOT_ALLOWED);
  }

  return {
    valid: reasonCodes.length === 0,
    reasonCodes: [...new Set(reasonCodes)],
    restHours,
  };
}

function checkRestPeriodRule(schedule) {
  const scheduleValidation = validateScheduleInput(schedule);
  if (!scheduleValidation.valid) {
    return {
      valid: false,
      conflicts: [],
      reasonCodes: scheduleValidation.reasonCodes,
    };
  }

  const sorted = sortSchedule(schedule).filter(isWorkedShift);
  const conflicts = [];

  for (let index = 1; index < sorted.length; index += 1) {
    const previousShift = sorted[index - 1];
    const nextShift = sorted[index];
    const restHours = computeRestHoursBetweenShifts(previousShift, nextShift);

    if (restHours !== null && restHours < RULES.MIN_REST_HOURS) {
      conflicts.push({ previousShift, nextShift, restHours });
    }
  }

  return {
    valid: conflicts.length === 0,
    conflicts,
    reasonCodes: conflicts.length === 0 ? [] : [REASON_CODES.INSUFFICIENT_REST_HOURS],
  };
}

function checkCompatibilityRule(schedule) {
  const scheduleValidation = validateScheduleInput(schedule);
  if (!scheduleValidation.valid) {
    return {
      valid: false,
      conflicts: [],
      reasonCodes: scheduleValidation.reasonCodes,
    };
  }

  const sorted = sortSchedule(schedule).filter(isWorkedShift);
  const conflicts = [];

  for (let index = 1; index < sorted.length; index += 1) {
    const previousShift = sorted[index - 1];
    const nextShift = sorted[index];
    const compatibility = checkShiftCompatibility(previousShift, nextShift);

    if (!compatibility.valid) {
      conflicts.push({
        previousShift,
        nextShift,
        restHours: compatibility.restHours,
        reasonCodes: compatibility.reasonCodes,
      });
    }
  }

  return {
    valid: conflicts.length === 0,
    conflicts,
    reasonCodes: [...new Set(conflicts.flatMap((conflict) => conflict.reasonCodes))],
  };
}

function getBlockingWindowKey(window) {
  return `${window.startDate}_${window.endDate}`;
}

function getConflictKey(conflict) {
  const previous = conflict.previousShift || {};
  const next = conflict.nextShift || {};
  return `${previous.date || "?"}:${previous.shiftType || "?"}->${next.date || "?"}:${next.shiftType || "?"}`;
}

function getWorsenedRollingWindows(baselineRule, simulatedRule) {
  const baselineCounts = new Map(
    (baselineRule && Array.isArray(baselineRule.blockingWindows) ? baselineRule.blockingWindows : []).map((window) => {
      return [getBlockingWindowKey(window), window.workedDaysCount];
    })
  );

  return (simulatedRule && Array.isArray(simulatedRule.blockingWindows) ? simulatedRule.blockingWindows : []).filter((window) => {
    const baselineCount = baselineCounts.get(getBlockingWindowKey(window));
    return baselineCount === undefined || window.workedDaysCount > baselineCount;
  });
}

function getNewConflicts(baselineRule, simulatedRule) {
  const baselineKeys = new Set(
    (baselineRule && Array.isArray(baselineRule.conflicts) ? baselineRule.conflicts : []).map(getConflictKey)
  );

  return (simulatedRule && Array.isArray(simulatedRule.conflicts) ? simulatedRule.conflicts : []).filter((conflict) => {
    return !baselineKeys.has(getConflictKey(conflict));
  });
}

function getEffectiveValidationResult(baselineValidation, simulatedValidation) {
  const worsenedRollingWindows = getWorsenedRollingWindows(
    baselineValidation ? baselineValidation.rollingRule : null,
    simulatedValidation ? simulatedValidation.rollingRule : null
  );
  const newRestConflicts = getNewConflicts(
    baselineValidation ? baselineValidation.restRule : null,
    simulatedValidation ? simulatedValidation.restRule : null
  );
  const newCompatibilityConflicts = getNewConflicts(
    baselineValidation ? baselineValidation.compatibilityRule : null,
    simulatedValidation ? simulatedValidation.compatibilityRule : null
  );

  const structuralRule = simulatedValidation
    ? simulatedValidation.structuralRule
    : { valid: false, invalidShifts: [], duplicateWorkedDates: [], details: [], reasonCodes: [] };
  const rollingRule = {
    valid: worsenedRollingWindows.length === 0,
    blockingWindows: worsenedRollingWindows,
    reasonCodes: worsenedRollingWindows.length === 0 ? [] : [REASON_CODES.TOO_MANY_WORKED_DAYS_IN_7],
  };
  const restRule = {
    valid: newRestConflicts.length === 0,
    conflicts: newRestConflicts,
    reasonCodes: newRestConflicts.length === 0 ? [] : [REASON_CODES.INSUFFICIENT_REST_HOURS],
  };
  const compatibilityReasonCodes = [...new Set(newCompatibilityConflicts.flatMap((conflict) => conflict.reasonCodes || []))];
  const compatibilityRule = {
    valid: newCompatibilityConflicts.length === 0,
    conflicts: newCompatibilityConflicts,
    reasonCodes: compatibilityReasonCodes,
  };

  const reasonCodes = [
    ...(structuralRule && Array.isArray(structuralRule.reasonCodes) ? structuralRule.reasonCodes : []),
    ...rollingRule.reasonCodes,
    ...restRule.reasonCodes,
    ...compatibilityRule.reasonCodes,
  ];

  return {
    valid: Boolean(structuralRule.valid) && rollingRule.valid && restRule.valid && compatibilityRule.valid,
    structuralRule,
    rollingRule,
    restRule,
    compatibilityRule,
    reasonCodes: [...new Set(reasonCodes)],
  };
}

function simulateExchange(schedule, removedShift, candidateShift) {
  const scheduleValidation = validateScheduleInput(schedule);
  const removedShiftValidation = validateShiftInput(removedShift, "removedShift");
  const candidateShiftValidation = validateShiftInput(candidateShift, "candidateShift");
  const reasonCodes = [
    ...scheduleValidation.reasonCodes,
    ...removedShiftValidation.reasonCodes,
    ...candidateShiftValidation.reasonCodes,
  ];

  if (!scheduleValidation.valid || !removedShiftValidation.valid || !candidateShiftValidation.valid) {
    return {
      valid: false,
      simulatedSchedule: Array.isArray(schedule) ? sortSchedule(schedule) : [],
      reasonCodes: [...new Set(reasonCodes)],
    };
  }

  let removed = false;
  const simulated = [];

  schedule.forEach((shift) => {
    if (!removed && isSameShift(shift, removedShift)) {
      removed = true;
      return;
    }
    simulated.push(cloneShift(shift));
  });

  if (!removed) {
    return {
      valid: false,
      simulatedSchedule: sortSchedule(simulated),
      reasonCodes: [...new Set([...reasonCodes, REASON_CODES.REMOVED_SHIFT_NOT_FOUND])],
    };
  }

  if (simulated.some((shift) => isWorkedShift(shift) && shift.date === candidateShift.date)) {
    return {
      valid: false,
      simulatedSchedule: sortSchedule(simulated),
      reasonCodes: [...new Set([...reasonCodes, REASON_CODES.CANDIDATE_DATE_ALREADY_WORKED])],
    };
  }

  simulated.push(cloneShift(candidateShift));

  return {
    valid: true,
    simulatedSchedule: sortSchedule(simulated),
    reasonCodes: [...new Set(reasonCodes)],
  };
}

function collectStructuralIssues(schedule) {
  const reasonCodes = [];
  const invalidShifts = [];
  const duplicateWorkedDates = [];
  const seenDates = new Map();
  const scheduleValidation = validateScheduleInput(schedule);

  if (!scheduleValidation.valid) {
    reasonCodes.push(...scheduleValidation.reasonCodes);
  }

  schedule.forEach((shift) => {
    const parsed = parseShiftOccurrence(shift);
    if (!parsed.valid) {
      invalidShifts.push({ shift, reasonCodes: parsed.reasonCodes });
      reasonCodes.push(...parsed.reasonCodes);
    }

    if (seenDates.has(shift.date)) {
      duplicateWorkedDates.push({ date: shift.date, shifts: [seenDates.get(shift.date), shift] });
      reasonCodes.push(REASON_CODES.DUPLICATE_WORKED_DATE);
    } else {
      seenDates.set(shift.date, shift);
    }
  });

  return {
    valid: reasonCodes.length === 0,
    invalidShifts,
    duplicateWorkedDates,
    details: scheduleValidation.details,
    reasonCodes: [...new Set(reasonCodes)],
  };
}

function validateSchedule(schedule) {
  const scheduleValidation = validateScheduleInput(schedule);
  if (!scheduleValidation.valid) {
    return {
      valid: false,
      structuralRule: {
        valid: false,
        invalidShifts: [],
        duplicateWorkedDates: [],
        details: scheduleValidation.details,
        reasonCodes: scheduleValidation.reasonCodes,
      },
      rollingRule: {
        valid: false,
        blockingWindows: [],
        reasonCodes: scheduleValidation.reasonCodes,
      },
      restRule: {
        valid: false,
        conflicts: [],
        reasonCodes: scheduleValidation.reasonCodes,
      },
      compatibilityRule: {
        valid: false,
        conflicts: [],
        reasonCodes: scheduleValidation.reasonCodes,
      },
      reasonCodes: scheduleValidation.reasonCodes,
    };
  }

  const structuralRule = collectStructuralIssues(schedule);
  const rollingRule = checkRollingSevenDayRule(schedule);
  const restRule = checkRestPeriodRule(schedule);
  const compatibilityRule = checkCompatibilityRule(schedule);
  const compatibilityReasonCodes = [
    ...new Set(compatibilityRule.conflicts.flatMap((conflict) => conflict.reasonCodes)),
  ];

  const reasonCodes = [
    ...structuralRule.reasonCodes,
    ...(!rollingRule.valid ? [REASON_CODES.TOO_MANY_WORKED_DAYS_IN_7] : []),
    ...(!restRule.valid ? [REASON_CODES.INSUFFICIENT_REST_HOURS] : []),
    ...compatibilityReasonCodes,
  ];

  return {
    valid: structuralRule.valid && rollingRule.valid && restRule.valid && compatibilityRule.valid,
    structuralRule: {
      ...structuralRule,
      reasonCodes: structuralRule.reasonCodes,
    },
    rollingRule: {
      ...rollingRule,
      reasonCodes: !rollingRule.valid ? [REASON_CODES.TOO_MANY_WORKED_DAYS_IN_7] : [],
    },
    restRule: {
      ...restRule,
      reasonCodes: !restRule.valid ? [REASON_CODES.INSUFFICIENT_REST_HOURS] : [],
    },
    compatibilityRule: {
      ...compatibilityRule,
      reasonCodes: compatibilityReasonCodes,
    },
    reasonCodes: [...new Set(reasonCodes)],
  };
}

function isBlockedRestDate(candidateDate, options = {}) {
  const normalizedOptions = normalizeValidationOptions(options);
  return normalizedOptions.blockedRestDates.includes(candidateDate);
}

function checkUserBlockedRestRule(candidateShift, options = {}) {
  const normalizedOptions = normalizeValidationOptions(options);
  const shiftValidation = validateShiftInput(candidateShift, "candidateShift");
  if (!shiftValidation.valid) {
    return {
      valid: false,
      blockedDates: [],
      reasonCodes: shiftValidation.reasonCodes,
    };
  }

  const isBlocked = normalizedOptions.blockedRestDates.includes(candidateShift.date);

  return {
    valid: !isBlocked,
    blockedDates: isBlocked ? [candidateShift.date] : [],
    reasonCodes: isBlocked ? [REASON_CODES.CANDIDATE_DATE_BLOCKED_BY_USER] : [],
  };
}

function isExchangeAllowed(schedule, removedShift, candidateShift, options = {}) {
  const scheduleValidation = validateScheduleInput(schedule);
  const removedShiftValidation = validateShiftInput(removedShift, "removedShift");
  const candidateShiftValidation = validateShiftInput(candidateShift, "candidateShift");
  const reasonCodes = [
    ...scheduleValidation.reasonCodes,
    ...removedShiftValidation.reasonCodes,
    ...candidateShiftValidation.reasonCodes,
  ];
  const normalizedOptions = normalizeValidationOptions(options);

  if (scheduleValidation.valid && removedShiftValidation.valid && candidateShiftValidation.valid && isSameShift(removedShift, candidateShift)) {
    reasonCodes.push(REASON_CODES.CANDIDATE_DATE_IS_REMOVED_DATE);
  }

  const remainingSchedule = scheduleValidation.valid
    ? schedule.filter((shift) => !isSameShift(shift, removedShift))
    : [];
  if (candidateShiftValidation.valid && remainingSchedule.some((shift) => isWorkedShift(shift) && shift.date === candidateShift.date)) {
    reasonCodes.push(REASON_CODES.CANDIDATE_DATE_ALREADY_WORKED);
  }

  const blockedRestRule = checkUserBlockedRestRule(candidateShift, normalizedOptions);
  reasonCodes.push(...blockedRestRule.reasonCodes);

  const simulation = simulateExchange(schedule, removedShift, candidateShift);
  const baselineValidation = validateSchedule(scheduleValidation.valid ? schedule : []);
  const simulatedValidation = validateSchedule(simulation.simulatedSchedule);
  const validation = getEffectiveValidationResult(baselineValidation, simulatedValidation);

  return {
    allowed: reasonCodes.length === 0 && simulation.valid && validation.valid,
    simulatedSchedule: simulation.simulatedSchedule,
    reasonCodes: [...new Set([...reasonCodes, ...simulation.reasonCodes, ...validation.reasonCodes])],
    rollingRule: validation.rollingRule || { valid: false, blockingWindows: [], reasonCodes: [] },
    restRule: validation.restRule || { valid: false, conflicts: [], reasonCodes: [] },
    compatibilityRule: validation.compatibilityRule || { valid: false, conflicts: [], reasonCodes: [] },
    structuralRule: validation.structuralRule || { valid: false, reasonCodes: [] },
    blockedRestRule,
    blockedRestDates: normalizedOptions.blockedRestDates,
  };
}

function getAvailabilityType(dayAllowed, nightAllowed) {
  if (dayAllowed && nightAllowed) {
    return "BOTH";
  }
  if (dayAllowed) {
    return "DAY_ONLY";
  }
  if (nightAllowed) {
    return "NIGHT_ONLY";
  }
  return "NONE";
}

function getCandidateAvailabilityType(schedule, removedShift, candidateDate, options = {}) {
  const normalizedOptions = normalizeValidationOptions(options);
  if (!isValidDateString(candidateDate)) {
    return {
      candidateDate,
      dayAllowed: false,
      allowedDayShiftTypes: [],
      nightAllowed: false,
      allowedNightShiftTypes: [],
      availabilityType: "NONE",
      blockedByUser: false,
      reasonCodes: [REASON_CODES.INVALID_SHIFT],
      details: {
        dayResults: [],
        nightResults: [],
      },
    };
  }

  const dayResults = DAY_SHIFT_TYPES.map((shiftType) => {
    const candidateShift = { date: candidateDate, shiftType };
    const result = isExchangeAllowed(schedule, removedShift, candidateShift, normalizedOptions);
    return { shiftType, result };
  });

  const nightResults = NIGHT_SHIFT_TYPES.map((shiftType) => {
    const candidateShift = { date: candidateDate, shiftType };
    const result = isExchangeAllowed(schedule, removedShift, candidateShift, normalizedOptions);
    return { shiftType, result };
  });

  const allowedDayShiftTypes = dayResults.filter((entry) => entry.result.allowed).map((entry) => entry.shiftType);
  const allowedNightShiftTypes = nightResults.filter((entry) => entry.result.allowed).map((entry) => entry.shiftType);

  return {
    candidateDate,
    dayAllowed: allowedDayShiftTypes.length > 0,
    allowedDayShiftTypes,
    nightAllowed: allowedNightShiftTypes.length > 0,
    allowedNightShiftTypes,
    availabilityType: getAvailabilityType(allowedDayShiftTypes.length > 0, allowedNightShiftTypes.length > 0),
    blockedByUser: isBlockedRestDate(candidateDate, normalizedOptions),
    reasonCodes: [
      ...new Set(
        [...dayResults, ...nightResults].flatMap((entry) => entry.result.reasonCodes)
      ),
    ],
    details: {
      dayResults,
      nightResults,
    },
  };
}

function getCalendarDayVisualState(schedule, candidateDate, removedShift, options = {}) {
  const normalizedOptions = normalizeValidationOptions(options);
  const remainingSchedule = schedule.filter((shift) => !isSameShift(shift, removedShift));

  if (remainingSchedule.some((shift) => shift.date === candidateDate)) {
    return {
      date: candidateDate,
      state: "WORKED_DAY",
      color: CALENDAR_DAY_COLORS.WORKED_DAY,
    };
  }

  if (isBlockedRestDate(candidateDate, normalizedOptions)) {
    return {
      date: candidateDate,
      state: "BLOCKED_REST_DAY",
      color: CALENDAR_DAY_COLORS.BLOCKED_REST_DAY,
    };
  }

  const availability = getCandidateAvailabilityType(schedule, removedShift, candidateDate, normalizedOptions);

  if (availability.availabilityType !== "NONE") {
    return {
      date: candidateDate,
      state: "AVAILABLE_DAY",
      color: CALENDAR_DAY_COLORS.AVAILABLE_DAY,
      availabilityType: availability.availabilityType,
    };
  }

  return {
    date: candidateDate,
    state: "UNAVAILABLE_DAY",
    color: CALENDAR_DAY_COLORS.UNAVAILABLE_DAY,
    availabilityType: availability.availabilityType,
  };
}

function formatShift(shift) {
  if (!shift) {
    return "none";
  }
  return `${shift.date} ${shift.shiftType}`;
}

function printSchedule(title, schedule) {
  console.log(title);
  sortSchedule(schedule).forEach((shift) => {
    const parsed = parseShiftOccurrence(shift);
    if (!parsed.valid) {
      console.log(`  - ${formatShift(shift)} [invalid: ${parsed.reasonCodes.join(", ")}]`);
      return;
    }

    console.log(
      `  - ${shift.date} ${shift.shiftType} (${parsed.start} -> ${parsed.end}${parsed.crossesMidnight ? ", J+1" : ""})`
    );
  });
}

function printValidationSummary(result) {
  console.log(`  allowed: ${result.allowed}`);
  console.log(`  reasonCodes: ${result.reasonCodes.length ? result.reasonCodes.join(", ") : "NONE"}`);
  if (!result.blockedRestRule.valid) {
    console.log(`  blocked rest dates: ${result.blockedRestRule.blockedDates.join(", ")}`);
  }

  if (!result.rollingRule.valid) {
    console.log("  rolling conflicts:");
    result.rollingRule.blockingWindows.forEach((window) => {
      console.log(
        `    - ${window.startDate} -> ${window.endDate}: ${window.workedDaysCount} jours (${window.workedDates.join(", ")})`
      );
    });
  }

  if (!result.restRule.valid) {
    console.log("  rest conflicts:");
    result.restRule.conflicts.forEach((conflict) => {
      console.log(
        `    - ${formatShift(conflict.previousShift)} -> ${formatShift(conflict.nextShift)}: ${conflict.restHours}h`
      );
    });
  }

  if (!result.compatibilityRule.valid) {
    console.log("  compatibility conflicts:");
    result.compatibilityRule.conflicts.forEach((conflict) => {
      console.log(
        `    - ${formatShift(conflict.previousShift)} -> ${formatShift(conflict.nextShift)}: ${conflict.reasonCodes.join(
          ", "
        )}`
      );
    });
  }
}

function printAvailabilitySummary(result) {
  console.log(`  candidateDate: ${result.candidateDate}`);
  console.log(`  blockedByUser: ${result.blockedByUser}`);
  console.log(`  dayAllowed: ${result.dayAllowed} (${result.allowedDayShiftTypes.join(", ") || "NONE"})`);
  console.log(`  nightAllowed: ${result.nightAllowed} (${result.allowedNightShiftTypes.join(", ") || "NONE"})`);
  console.log(`  availabilityType: ${result.availabilityType}`);
  console.log(`  reasonCodes: ${result.reasonCodes.length ? result.reasonCodes.join(", ") : "NONE"}`);
}

function explainValidationResult(result) {
  if (!result || typeof result !== "object") {
    return "Résultat de validation invalide.";
  }

  if (result.allowed === true || result.valid === true) {
    return "Échange autorisé. Toutes les règles du planning simulé sont respectées.";
  }

  const messages = [];
  const reasonCodes = Array.isArray(result.reasonCodes) ? result.reasonCodes : [];

  if (reasonCodes.includes(REASON_CODES.CANDIDATE_DATE_BLOCKED_BY_USER)) {
    messages.push("La date candidate est marquée comme repos indisponible par l'utilisateur.");
  }
  if (reasonCodes.includes(REASON_CODES.CANDIDATE_DATE_ALREADY_WORKED)) {
    messages.push("Tu travailles déjà ce jour là !");
  }
  if (reasonCodes.includes(REASON_CODES.CANDIDATE_DATE_IS_REMOVED_DATE)) {
    messages.push("La date candidate est identique au poste retiré.");
  }
  if (reasonCodes.includes(REASON_CODES.TOO_MANY_WORKED_DAYS_IN_7)) {
    messages.push("Tu ferais plus de 4 jours travaillés sur 7 jours glissants !");
  }
  if (reasonCodes.includes(REASON_CODES.INSUFFICIENT_REST_HOURS)) {
    messages.push("Le repos minimum de 12 heures entre deux postes consécutifs n'est pas respecté.");
  }
  if (reasonCodes.includes(REASON_CODES.UNKNOWN_SHIFT_TYPE)) {
    messages.push("Au moins un type de poste est inconnu.");
  }
  if (reasonCodes.includes(REASON_CODES.INVALID_SHIFT)) {
    messages.push("Au moins un poste fourni en entrée est incomplet ou mal formaté.");
  }
  if (reasonCodes.includes(REASON_CODES.INVALID_SCHEDULE)) {
    messages.push("Le planning fourni en entrée est invalide.");
  }
  if (reasonCodes.includes(REASON_CODES.DUPLICATE_WORKED_DATE)) {
    messages.push("Le planning contient plusieurs postes sur une même date de travail.");
  }
  if (reasonCodes.includes(REASON_CODES.REMOVED_SHIFT_NOT_FOUND)) {
    messages.push("Le poste à retirer n'existe pas dans le planning.");
  }

  if (messages.length === 0) {
    return "Échange refusé. Le planning simulé ne respecte pas les validations attendues.";
  }

  return messages.join(" ");
}

const EXAMPLE_SCHEDULES = {
  baseAllowed: [
    { date: "2026-03-10", shiftType: "JOUR_10_22" },
    { date: "2026-03-12", shiftType: "NUIT_19_7" },
    { date: "2026-03-15", shiftType: "JOUR_11_23" },
    { date: "2026-03-18", shiftType: "JOUR_7_19" },
  ],
  rollingOverflow: [
    { date: "2026-03-10", shiftType: "JOUR_10_22" },
    { date: "2026-03-11", shiftType: "JOUR_10_22" },
    { date: "2026-03-12", shiftType: "JOUR_10_22" },
    { date: "2026-03-13", shiftType: "JOUR_10_22" },
    { date: "2026-03-20", shiftType: "JOUR_10_22" },
  ],
  restConflict: [
    { date: "2026-03-10", shiftType: "JOUR_10_22" },
    { date: "2026-03-12", shiftType: "JOUR_11_23" },
    { date: "2026-03-15", shiftType: "JOUR_7_19" },
  ],
  dayOnlyAvailability: [
    { date: "2026-03-10", shiftType: "JOUR_10_22" },
    { date: "2026-03-13", shiftType: "JOUR_7_19" },
    { date: "2026-03-18", shiftType: "JOUR_11_23" },
  ],
  nightOnlyAvailability: [
    { date: "2026-03-11", shiftType: "NUIT_19_7" },
    { date: "2026-03-15", shiftType: "JOUR_10_22" },
    { date: "2026-03-18", shiftType: "JOUR_11_23" },
  ],
  bothAvailability: [
    { date: "2026-03-10", shiftType: "JOUR_10_22" },
    { date: "2026-03-16", shiftType: "JOUR_11_23" },
    { date: "2026-03-20", shiftType: "NUIT_19_7" },
  ],
  noneAvailability: [
    { date: "2026-03-10", shiftType: "JOUR_10_22" },
    { date: "2026-03-11", shiftType: "JOUR_10_22" },
    { date: "2026-03-12", shiftType: "JOUR_10_22" },
    { date: "2026-03-13", shiftType: "JOUR_10_22" },
    { date: "2026-03-16", shiftType: "JOUR_11_23" },
  ],
  endOfMonthNight: [
    { date: "2026-02-26", shiftType: "JOUR_10_22" },
    { date: "2026-02-28", shiftType: "NUIT_19_7" },
    { date: "2026-03-03", shiftType: "JOUR_11_23" },
  ],
};

function runExchangeTest(testName, schedule, removedShift, candidateShift) {
  console.log(`\n${testName}`);
  printSchedule("Planning initial:", schedule);
  console.log(`Poste retire: ${formatShift(removedShift)}`);
  console.log(`Poste candidat: ${formatShift(candidateShift)}`);
  const result = isExchangeAllowed(schedule, removedShift, candidateShift);
  printSchedule("Planning simule:", result.simulatedSchedule);
  printValidationSummary(result);
}

function runAvailabilityTest(testName, schedule, removedShift, candidateDate, options = {}) {
  console.log(`\n${testName}`);
  printSchedule("Planning initial:", schedule);
  console.log(`Poste retire: ${formatShift(removedShift)}`);
  console.log(`Date candidate: ${candidateDate}`);
  const result = getCandidateAvailabilityType(schedule, removedShift, candidateDate, options);
  printAvailabilitySummary(result);
}

function runBlockedRestDayTest(testName, schedule, removedShift, candidateShift, options = {}) {
  console.log(`\n${testName}`);
  printSchedule("Planning initial:", schedule);
  console.log(`Poste retire: ${formatShift(removedShift)}`);
  console.log(`Poste candidat: ${formatShift(candidateShift)}`);
  console.log(`Jours de repos bloques: ${normalizeValidationOptions(options).blockedRestDates.join(", ") || "NONE"}`);
  const result = isExchangeAllowed(schedule, removedShift, candidateShift, options);
  printValidationSummary(result);
  const visualState = getCalendarDayVisualState(schedule, candidateShift.date, removedShift, options);
  console.log(`  calendarState: ${visualState.state} (${visualState.color})`);
}

function runDemoTests() {
  runExchangeTest(
    "TEST 1 - Echange autorise simple",
    EXAMPLE_SCHEDULES.baseAllowed,
    { date: "2026-03-18", shiftType: "JOUR_7_19" },
    { date: "2026-03-17", shiftType: "JOUR_10_22" }
  );

  runExchangeTest(
    "TEST 2 - Refus pour 5 jours travailles sur 7",
    EXAMPLE_SCHEDULES.rollingOverflow,
    { date: "2026-03-20", shiftType: "JOUR_10_22" },
    { date: "2026-03-14", shiftType: "JOUR_11_23" }
  );

  runExchangeTest(
    "TEST 3 - Refus pour repos insuffisant",
    EXAMPLE_SCHEDULES.restConflict,
    { date: "2026-03-15", shiftType: "JOUR_7_19" },
    { date: "2026-03-11", shiftType: "JOUR_7_19" }
  );

  runExchangeTest(
    "TEST 4 - Refus pour incompatibilite jour/nuit",
    EXAMPLE_SCHEDULES.baseAllowed,
    { date: "2026-03-18", shiftType: "JOUR_7_19" },
    { date: "2026-03-13", shiftType: "JOUR_7_19" }
  );

  runAvailabilityTest(
    "TEST 5 - Date candidate avec jour seulement",
    EXAMPLE_SCHEDULES.dayOnlyAvailability,
    { date: "2026-03-18", shiftType: "JOUR_11_23" },
    "2026-03-12"
  );

  runAvailabilityTest(
    "TEST 6 - Date candidate avec nuit seulement",
    EXAMPLE_SCHEDULES.nightOnlyAvailability,
    { date: "2026-03-18", shiftType: "JOUR_11_23" },
    "2026-03-12"
  );

  runAvailabilityTest(
    "TEST 7 - Date candidate avec jour et nuit possibles",
    EXAMPLE_SCHEDULES.bothAvailability,
    { date: "2026-03-20", shiftType: "NUIT_19_7" },
    "2026-03-18"
  );

  runAvailabilityTest(
    "TEST 8 - Date candidate totalement impossible",
    EXAMPLE_SCHEDULES.noneAvailability,
    { date: "2026-03-16", shiftType: "JOUR_11_23" },
    "2026-03-14"
  );

  runExchangeTest(
    "TEST 9 - Nuit en fin de mois",
    EXAMPLE_SCHEDULES.endOfMonthNight,
    { date: "2026-03-03", shiftType: "JOUR_11_23" },
    { date: "2026-03-01", shiftType: "JOUR_10_22" }
  );

  runBlockedRestDayTest(
    "TEST 10 - Refus sur jour de repos bloque par l'utilisateur",
    EXAMPLE_SCHEDULES.baseAllowed,
    { date: "2026-03-18", shiftType: "JOUR_7_19" },
    { date: "2026-03-17", shiftType: "JOUR_10_22" },
    { blockedRestDates: ["2026-03-17"] }
  );
}

if (typeof require !== "undefined" && typeof module !== "undefined" && require.main === module) {
  runDemoTests();
}

const exportedApi = {
  RULES,
  REASON_CODES,
  CALENDAR_DAY_COLORS,
  SHIFT_TYPES,
  DAY_SHIFT_TYPES,
  NIGHT_SHIFT_TYPES,
  parseLocalDate,
  addDays,
  compareDateStrings,
  combineDateAndTime,
  parseShiftOccurrence,
  sortSchedule,
  getUniqueWorkedDates,
  countWorkedDaysInWindow,
  generateSevenDayWindowsAroundDate,
  checkRollingSevenDayRule,
  getPreviousAndNextShifts,
  computeRestHoursBetweenShifts,
  checkShiftCompatibility,
  checkRestPeriodRule,
  simulateExchange,
  validateSchedule,
  normalizeValidationOptions,
  isBlockedRestDate,
  checkUserBlockedRestRule,
  isExchangeAllowed,
  getCandidateAvailabilityType,
  getCalendarDayVisualState,
  explainValidationResult,
  EXAMPLE_SCHEDULES,
  runDemoTests,
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = exportedApi;
}

if (typeof window !== "undefined") {
  window.shiftExchangeEngine = exportedApi;
}
