const assert = require("node:assert/strict");

const {
  REASON_CODES,
  CALENDAR_DAY_COLORS,
  parseShiftOccurrence,
  generateSevenDayWindowsAroundDate,
  checkRollingSevenDayRule,
  computeRestHoursBetweenShifts,
  checkShiftCompatibility,
  simulateExchange,
  validateSchedule,
  isExchangeAllowed,
  getCandidateAvailabilityType,
  getCalendarDayVisualState,
  explainValidationResult,
  EXAMPLE_SCHEDULES,
} = require("./shiftExchangeEngine");

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

function assertIncludes(array, value, message) {
  assert.ok(array.includes(value), message || `Expected array to include ${value}`);
}

test("parseShiftOccurrence handles night shifts across midnight", () => {
  const parsed = parseShiftOccurrence({ date: "2026-02-28", shiftType: "NUIT_19_7" });

  assert.equal(parsed.valid, true);
  assert.equal(parsed.startDateTime.getHours(), 19);
  assert.equal(parsed.endDateTime.getHours(), 7);
  assert.equal(parsed.endDateTime.getDate(), 1);
  assert.equal(parsed.endDateTime.getMonth(), 2);
});

test("generateSevenDayWindowsAroundDate returns 7 sliding windows", () => {
  const windows = generateSevenDayWindowsAroundDate("2026-03-15");

  assert.equal(windows.length, 7);
  assert.deepEqual(windows[0], { startDate: "2026-03-09", endDate: "2026-03-15" });
  assert.deepEqual(windows[6], { startDate: "2026-03-15", endDate: "2026-03-21" });
});

test("checkRollingSevenDayRule detects 5 worked days in a 7-day window", () => {
  const result = checkRollingSevenDayRule([
    { date: "2026-03-10", shiftType: "JOUR_10_22" },
    { date: "2026-03-11", shiftType: "JOUR_10_22" },
    { date: "2026-03-12", shiftType: "JOUR_10_22" },
    { date: "2026-03-13", shiftType: "JOUR_10_22" },
    { date: "2026-03-14", shiftType: "JOUR_11_23" },
  ]);

  assert.equal(result.valid, false);
  assertIncludes(result.reasonCodes, REASON_CODES.TOO_MANY_WORKED_DAYS_IN_7);
  assert.ok(result.blockingWindows.length >= 1);
});

test("computeRestHoursBetweenShifts returns exact rest duration", () => {
  const restHours = computeRestHoursBetweenShifts(
    { date: "2026-03-10", shiftType: "JOUR_10_22" },
    { date: "2026-03-11", shiftType: "JOUR_7_19" }
  );

  assert.equal(restHours, 9);
});

test("checkShiftCompatibility rejects incompatible night-to-day succession", () => {
  const result = checkShiftCompatibility(
    { date: "2026-03-12", shiftType: "NUIT_19_7" },
    { date: "2026-03-13", shiftType: "JOUR_7_19" }
  );

  assert.equal(result.valid, false);
  assertIncludes(result.reasonCodes, REASON_CODES.INSUFFICIENT_REST_HOURS);
  assertIncludes(result.reasonCodes, REASON_CODES.SHIFT_SEQUENCE_NOT_ALLOWED);
});

test("simulateExchange removes the old shift and inserts the candidate", () => {
  const result = simulateExchange(
    EXAMPLE_SCHEDULES.baseAllowed,
    { date: "2026-03-18", shiftType: "JOUR_7_19" },
    { date: "2026-03-17", shiftType: "JOUR_10_22" }
  );

  assert.equal(result.valid, true);
  assert.equal(result.simulatedSchedule.some((shift) => shift.date === "2026-03-18"), false);
  assert.equal(
    result.simulatedSchedule.some((shift) => shift.date === "2026-03-17" && shift.shiftType === "JOUR_10_22"),
    true
  );
});

test("simulateExchange refuses duplicate worked dates in simulated schedule", () => {
  const result = simulateExchange(
    EXAMPLE_SCHEDULES.baseAllowed,
    { date: "2026-03-18", shiftType: "JOUR_7_19" },
    { date: "2026-03-15", shiftType: "JOUR_10_22" }
  );

  assert.equal(result.valid, false);
  assertIncludes(result.reasonCodes, REASON_CODES.CANDIDATE_DATE_ALREADY_WORKED);
});

test("validateSchedule rejects duplicate worked dates", () => {
  const result = validateSchedule([
    { date: "2026-03-10", shiftType: "JOUR_10_22" },
    { date: "2026-03-10", shiftType: "JOUR_11_23" },
  ]);

  assert.equal(result.valid, false);
  assertIncludes(result.reasonCodes, REASON_CODES.DUPLICATE_WORKED_DATE);
  assert.equal(result.structuralRule.duplicateWorkedDates.length, 1);
});

test("validateSchedule rejects invalid schedule input", () => {
  const result = validateSchedule("not-an-array");

  assert.equal(result.valid, false);
  assertIncludes(result.reasonCodes, REASON_CODES.INVALID_SCHEDULE);
});

test("isExchangeAllowed accepts a valid exchange", () => {
  const result = isExchangeAllowed(
    EXAMPLE_SCHEDULES.baseAllowed,
    { date: "2026-03-18", shiftType: "JOUR_7_19" },
    { date: "2026-03-17", shiftType: "JOUR_10_22" }
  );

  assert.equal(result.allowed, true);
  assert.deepEqual(result.reasonCodes, []);
});

test("1. echange autorise simple", () => {
  const result = isExchangeAllowed(
    EXAMPLE_SCHEDULES.baseAllowed,
    { date: "2026-03-18", shiftType: "JOUR_7_19" },
    { date: "2026-03-17", shiftType: "JOUR_10_22" }
  );

  assert.equal(result.allowed, true, "L'echange simple devrait etre autorise.");
  assert.equal(result.rollingRule.valid, true, "La regle des 4 jours sur 7 devrait etre respectee.");
  assert.equal(result.restRule.valid, true, "Le repos minimum devrait etre respecte.");
  assert.equal(result.compatibilityRule.valid, true, "Les successions de postes devraient etre compatibles.");
  assert.deepEqual(result.reasonCodes, [], "Aucun reasonCode ne devrait etre remonte.");
});

test("2. refus pour depassement de 4 jours sur 7", () => {
  const result = isExchangeAllowed(
    EXAMPLE_SCHEDULES.rollingOverflow,
    { date: "2026-03-20", shiftType: "JOUR_10_22" },
    { date: "2026-03-14", shiftType: "JOUR_11_23" }
  );

  assert.equal(result.allowed, false, "L'echange devrait etre refuse si une fenetre atteint 5 jours travailles.");
  assert.equal(result.rollingRule.valid, false, "La regle glissante devrait detecter un blocage.");
  assert.ok(result.rollingRule.blockingWindows.length > 0, "Au moins une fenetre bloquante devrait etre fournie.");
  assertIncludes(result.reasonCodes, REASON_CODES.TOO_MANY_WORKED_DAYS_IN_7);
});

test("3. refus pour repos insuffisant", () => {
  const result = isExchangeAllowed(
    EXAMPLE_SCHEDULES.restConflict,
    { date: "2026-03-15", shiftType: "JOUR_7_19" },
    { date: "2026-03-11", shiftType: "JOUR_7_19" }
  );

  assert.equal(result.allowed, false, "L'echange devrait etre refuse si le repos est inferieur a 12h.");
  assert.equal(result.restRule.valid, false, "La regle de repos devrait etre invalide.");
  assert.equal(result.restRule.conflicts.length, 1, "Un conflit de repos devrait etre detecte.");
  assert.equal(result.restRule.conflicts[0].restHours, 9, "Le repos detecte devrait etre de 9h.");
  assertIncludes(result.reasonCodes, REASON_CODES.INSUFFICIENT_REST_HOURS);
});

test("4. refus pour incompatibilite jour/nuit", () => {
  const result = isExchangeAllowed(
    EXAMPLE_SCHEDULES.baseAllowed,
    { date: "2026-03-18", shiftType: "JOUR_7_19" },
    { date: "2026-03-13", shiftType: "JOUR_7_19" }
  );

  assert.equal(result.allowed, false, "L'echange devrait etre refuse pour une succession nuit puis jour immediate.");
  assert.equal(result.compatibilityRule.valid, false, "La compatibilite des postes devrait etre invalide.");
  assert.ok(result.compatibilityRule.conflicts.length > 0, "Un conflit de compatibilite devrait etre present.");
  assertIncludes(result.reasonCodes, REASON_CODES.SHIFT_SEQUENCE_NOT_ALLOWED);
});

test("5. refus si la date candidate est deja travaillee", () => {
  const result = isExchangeAllowed(
    EXAMPLE_SCHEDULES.baseAllowed,
    { date: "2026-03-18", shiftType: "JOUR_7_19" },
    { date: "2026-03-15", shiftType: "JOUR_10_22" }
  );

  assert.equal(result.allowed, false, "La date candidate ne doit pas deja etre travaillee.");
  assertIncludes(result.reasonCodes, REASON_CODES.CANDIDATE_DATE_ALREADY_WORKED);
});

test("6. refus si la date candidate est identique a la date retiree", () => {
  const result = isExchangeAllowed(
    EXAMPLE_SCHEDULES.baseAllowed,
    { date: "2026-03-18", shiftType: "JOUR_7_19" },
    { date: "2026-03-18", shiftType: "JOUR_7_19" }
  );

  assert.equal(result.allowed, false, "Le moteur doit refuser un candidat identique au poste retire.");
  assertIncludes(result.reasonCodes, REASON_CODES.CANDIDATE_DATE_IS_REMOVED_DATE);
});

test("isExchangeAllowed rejects unknown shift types", () => {
  const result = isExchangeAllowed(
    EXAMPLE_SCHEDULES.baseAllowed,
    { date: "2026-03-18", shiftType: "JOUR_7_19" },
    { date: "2026-03-17", shiftType: "SHIFT_INCONNU" }
  );

  assert.equal(result.allowed, false);
  assertIncludes(result.reasonCodes, REASON_CODES.UNKNOWN_SHIFT_TYPE);
});

test("isExchangeAllowed rejects user-blocked rest days", () => {
  const result = isExchangeAllowed(
    EXAMPLE_SCHEDULES.baseAllowed,
    { date: "2026-03-18", shiftType: "JOUR_7_19" },
    { date: "2026-03-17", shiftType: "JOUR_10_22" },
    { blockedRestDates: ["2026-03-17"] }
  );

  assert.equal(result.allowed, false);
  assertIncludes(result.reasonCodes, REASON_CODES.CANDIDATE_DATE_BLOCKED_BY_USER);
});

test("7. cas ou seule une option jour est possible", () => {
  const result = getCandidateAvailabilityType(
    EXAMPLE_SCHEDULES.dayOnlyAvailability,
    { date: "2026-03-18", shiftType: "JOUR_11_23" },
    "2026-03-12"
  );

  assert.equal(result.availabilityType, "DAY_ONLY", "La date devrait n'autoriser qu'une option jour.");
  assert.equal(result.dayAllowed, true);
  assert.equal(result.nightAllowed, false);
  assert.deepEqual(result.allowedDayShiftTypes, ["JOUR_7_19"]);
});

test("8. cas ou seule une option nuit est possible", () => {
  const result = getCandidateAvailabilityType(
    EXAMPLE_SCHEDULES.nightOnlyAvailability,
    { date: "2026-03-18", shiftType: "JOUR_11_23" },
    "2026-03-12"
  );

  assert.equal(result.availabilityType, "NIGHT_ONLY", "La date devrait n'autoriser qu'une option nuit.");
  assert.equal(result.dayAllowed, false);
  assert.equal(result.nightAllowed, true);
  assert.deepEqual(result.allowedNightShiftTypes, ["NUIT_19_7"]);
});

test("9. cas ou jour et nuit sont possibles", () => {
  const result = getCandidateAvailabilityType(
    EXAMPLE_SCHEDULES.bothAvailability,
    { date: "2026-03-20", shiftType: "NUIT_19_7" },
    "2026-03-18"
  );

  assert.equal(result.availabilityType, "BOTH", "La date devrait autoriser jour et nuit.");
  assert.equal(result.dayAllowed, true);
  assert.equal(result.nightAllowed, true);
});

test("10. cas totalement impossible", () => {
  const result = getCandidateAvailabilityType(
    EXAMPLE_SCHEDULES.noneAvailability,
    { date: "2026-03-16", shiftType: "JOUR_11_23" },
    "2026-03-14"
  );

  assert.equal(result.availabilityType, "NONE", "La date ne devrait autoriser aucun poste.");
  assert.equal(result.dayAllowed, false);
  assert.equal(result.nightAllowed, false);
  assertIncludes(result.reasonCodes, REASON_CODES.TOO_MANY_WORKED_DAYS_IN_7);
});

test("11. cas avec nuit qui se termine le lendemain", () => {
  const parsed = parseShiftOccurrence({ date: "2026-02-28", shiftType: "NUIT_19_7" });
  const result = isExchangeAllowed(
    EXAMPLE_SCHEDULES.endOfMonthNight,
    { date: "2026-03-03", shiftType: "JOUR_11_23" },
    { date: "2026-03-01", shiftType: "JOUR_10_22" }
  );

  assert.equal(parsed.valid, true, "La nuit de fin de mois devrait etre parsee correctement.");
  assert.equal(parsed.endDateTime.getDate(), 1, "La fin du poste de nuit devrait tomber le lendemain.");
  assert.equal(parsed.endDateTime.getMonth(), 2, "La fin du poste devrait passer sur mars.");
  assert.equal(result.allowed, false, "L'echange devrait etre refuse si la nuit deborde et casse le repos.");
  assertIncludes(result.reasonCodes, REASON_CODES.INSUFFICIENT_REST_HOURS);
});

test("12. refus si shiftType inconnu", () => {
  const result = isExchangeAllowed(
    EXAMPLE_SCHEDULES.baseAllowed,
    { date: "2026-03-18", shiftType: "JOUR_7_19" },
    { date: "2026-03-17", shiftType: "SHIFT_INCONNU" }
  );

  assert.equal(result.allowed, false, "Un shiftType inconnu doit etre refuse.");
  assertIncludes(result.reasonCodes, REASON_CODES.UNKNOWN_SHIFT_TYPE);
});

test("getCandidateAvailabilityType exposes systematic reasonCodes", () => {
  const result = getCandidateAvailabilityType(
    EXAMPLE_SCHEDULES.noneAvailability,
    { date: "2026-03-16", shiftType: "JOUR_11_23" },
    "2026-03-14"
  );

  assert.equal(result.availabilityType, "NONE");
  assert.ok(Array.isArray(result.reasonCodes));
  assertIncludes(result.reasonCodes, REASON_CODES.TOO_MANY_WORKED_DAYS_IN_7);
});

test("getCalendarDayVisualState prioritizes blocked rest days with dedicated color", () => {
  const state = getCalendarDayVisualState(
    EXAMPLE_SCHEDULES.baseAllowed,
    "2026-03-17",
    { date: "2026-03-18", shiftType: "JOUR_7_19" },
    { blockedRestDates: ["2026-03-17"] }
  );

  assert.equal(state.state, "BLOCKED_REST_DAY");
  assert.equal(state.color, CALENDAR_DAY_COLORS.BLOCKED_REST_DAY);
});

test("explainValidationResult returns a readable success message", () => {
  const result = isExchangeAllowed(
    EXAMPLE_SCHEDULES.baseAllowed,
    { date: "2026-03-18", shiftType: "JOUR_7_19" },
    { date: "2026-03-17", shiftType: "JOUR_10_22" }
  );

  assert.match(explainValidationResult(result), /Echange autorise/i);
});

test("explainValidationResult returns a readable failure message", () => {
  const result = isExchangeAllowed(
    EXAMPLE_SCHEDULES.baseAllowed,
    { date: "2026-03-18", shiftType: "JOUR_7_19" },
    { date: "2026-03-17", shiftType: "SHIFT_INCONNU" }
  );

  assert.match(explainValidationResult(result), /type de poste est inconnu/i);
});

async function run() {
  let passed = 0;
  let failed = 0;

  for (const { name, fn } of tests) {
    try {
      await fn();
      passed += 1;
      console.log(`PASS ${name}`);
    } catch (error) {
      failed += 1;
      console.error(`FAIL ${name}`);
      console.error(error.stack);
      process.exitCode = 1;
    }
  }

  console.log(`\nResume: ${passed} passes, ${failed} echoues, ${tests.length} total.`);
}

run();
