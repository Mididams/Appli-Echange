(function initExchangeApp() {
  const engine = window.shiftExchangeEngine;
  if (!engine) {
    throw new Error("Le moteur shiftExchangeEngine n'est pas disponible.");
  }

  const STORAGE_KEY = "hospital-shift-exchange-v1";
  const XLSX_IMPORT_SUPPORTED_EXTENSIONS = [".xlsx", ".xls", ".xlsm", ".xlsb", ".ods", ".fods"];
  const SHIFT_TYPE_LABELS = {
    JOUR_7_19: "7h-19h",
    NUIT_19_7: "19h-7h",
    JOUR_10_22: "10h-22h",
    JOUR_11_23: "11h-23h",
    FO: "FO",
    CA: "CA",
  };
  const SHIFT_TYPE_BADGES = {
    JOUR_7_19: "J7-19",
    NUIT_19_7: "N19-7",
    JOUR_10_22: "J10-22",
    JOUR_11_23: "J11-23",
    FO: "FO",
    CA: "CA",
  };
  const EXCHANGE_SHIFT_TYPES = ["JOUR_7_19", "NUIT_19_7", "JOUR_10_22", "JOUR_11_23"];
  const EXCHANGE_MODE_LABELS = {
    ANY: "Jour\u00A0ou\u00A0nuit",
    DAY: "Jour\u00A0uniquement",
    NIGHT: "Nuit\u00A0uniquement",
  };
  const SEARCH_VIEW_LABELS = {
    EXCHANGE: "Echange",
    HSP: "Heures supplementaires",
  };
  const ROLLING_LIMIT_REASON_CODE = "TOO_MANY_WORKED_DAYS_IN_7";
  const MONTH_FORMATTER = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" });
  const REQUEST_DATE_FORMATTER = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  const DAY_DETAILS_DATE_FORMATTER = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const WEEKDAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
  const MOBILE_LAYOUT_MEDIA_QUERY = window.matchMedia("(max-width: 820px)");
  const MOBILE_INTERACTION_MEDIA_QUERY = window.matchMedia("(max-width: 820px), (pointer: coarse)");
  const LONG_PRESS_DURATION_MS = 450;
  const DOUBLE_TAP_DURATION_MS = 320;
  const EXCEL_MONTH_INDEX_BY_NAME = {
    janvier: 0,
    fevrier: 1,
    mars: 2,
    avril: 3,
    mai: 4,
    juin: 5,
    juillet: 6,
    aout: 7,
    septembre: 8,
    octobre: 9,
    novembre: 10,
    decembre: 11,
  };
  const EXCEL_SHIFT_CODE_TO_TYPE = {
    CA: "CA",
    FO: "FO",
    N0: "NUIT_19_7",
    M2: "JOUR_7_19",
    M2T: "JOUR_7_19",
    M5: "JOUR_10_22",
    M6: "JOUR_11_23",
    W2: "JOUR_7_19",
  };
  const EXCEL_POST_LABEL_CODES = new Set(["N0", "M2", "M2T", "M5", "M6", "W2"]);
  const EXCEL_REST_CODES = new Set(["RH", "RC", "FE"]);

  const state = {
    schedule: [],
    removedShift: null,
    exchangeMode: "ANY",
    searchView: "EXCHANGE",
    blockedRestDates: [],
    dayNotes: {},
    visibleMonthStart: getMonthStart(new Date()),
    selectedDate: null,
    selectedDateStatus: null,
    debugMode: false,
    pickerDate: null,
    lastSelectedShiftType: "JOUR_7_19",
  };
  let longPressTimer = null;
  let longPressTriggeredDate = null;
  let lastTappedDate = null;
  let lastTapTimestamp = 0;

  const calendarContainer = document.getElementById("calendar-container");
  const summaryContent = document.getElementById("summary-content");
  const legendContent = document.getElementById("legend-content");
  const dayDetailsTitle = document.getElementById("day-details-title");
  const dayDetailsOutput = document.getElementById("day-details-output");
  const helpButton = document.getElementById("help-button");
  const prevMonthButton = document.getElementById("prev-month-button");
  const nextMonthButton = document.getElementById("next-month-button");
  const requestExchangeButton = document.getElementById("request-exchange-button");
  const clearRemovedButton = document.getElementById("clear-removed-button");
  const mobileHspButton = document.getElementById("mobile-hsp-button");
  const settingsButton = document.getElementById("settings-button");
  const settingsPanelBackdrop = document.getElementById("settings-panel-backdrop");
  const settingsPanel = document.getElementById("settings-panel");
  const toggleDebugButton = document.getElementById("toggle-debug-button");
  const resetButton = document.getElementById("reset-button");
  const exportButton = document.getElementById("export-button");
  const importButton = document.getElementById("import-button");
  const importFileInput = document.getElementById("import-file-input");
  const excelImportButton = document.getElementById("excel-import-button");
  const excelImportFileInput = document.getElementById("excel-import-file-input");
  const shiftPickerBackdrop = document.getElementById("shift-picker-backdrop");
  const shiftPickerTitle = document.getElementById("shift-picker-title");
  const shiftPickerDateLabel = document.getElementById("shift-picker-date-label");
  const shiftPickerHelp = document.getElementById("shift-picker-help");
  const shiftTypeSelect = document.getElementById("shift-type-select");
  const blockedRestToggleButton = document.getElementById("blocked-rest-toggle-button");
  const freeNoteCheckbox = document.getElementById("free-note-checkbox");
  const editFreeNoteButton = document.getElementById("edit-free-note-button");
  const saveShiftButton = document.getElementById("save-shift-button");
  const deleteShiftButton = document.getElementById("delete-shift-button");
  const selectRemovedButton = document.getElementById("select-removed-button");
  const closePickerButton = document.getElementById("close-picker-button");
  const freeNoteModalBackdrop = document.getElementById("free-note-modal-backdrop");
  const freeNoteDateLabel = document.getElementById("free-note-date-label");
  const freeNoteInput = document.getElementById("free-note-input");
  const saveFreeNoteButton = document.getElementById("save-free-note-button");
  const removeFreeNoteButton = document.getElementById("remove-free-note-button");
  const closeFreeNoteButton = document.getElementById("close-free-note-button");
  const detailsEditButton = document.getElementById("details-edit-button");
  const detailsRemoveButton = document.getElementById("details-remove-button");
  const detailsSelectRemovedButton = document.getElementById("details-select-removed-button");
  const detailsHspButton = document.getElementById("details-hsp-button");
  const detailsToggleBlockedButton = document.getElementById("details-toggle-blocked-button");
  const exchangeModeInputs = document.querySelectorAll("input[name='exchange-mode']");
  const requestModalBackdrop = document.getElementById("request-modal-backdrop");
  const requestStartDateInput = document.getElementById("request-start-date-input");
  const requestEndDateInput = document.getElementById("request-end-date-input");
  const requestTextOutput = document.getElementById("request-text-output");
  const copyRequestButton = document.getElementById("copy-request-button");
  const closeRequestButton = document.getElementById("close-request-button");
  const requestRangeButtons = document.querySelectorAll(".request-range-button");
  const include1022Checkbox = document.getElementById("include-10-22-checkbox");
  const include1123Checkbox = document.getElementById("include-11-23-checkbox");
  const requestModeAnyCheckbox = document.getElementById("request-mode-any-checkbox");
  const requestModeDayCheckbox = document.getElementById("request-mode-day-checkbox");
  const requestModeNightCheckbox = document.getElementById("request-mode-night-checkbox");
  const helpModalBackdrop = document.getElementById("help-modal-backdrop");
  const closeHelpButton = document.getElementById("close-help-button");
  const resetConfirmBackdrop = document.getElementById("reset-confirm-backdrop");
  const confirmResetButton = document.getElementById("confirm-reset-button");
  const cancelResetButton = document.getElementById("cancel-reset-button");

  function getMonthStart(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
  }

  function isMobileLayout() {
    return MOBILE_LAYOUT_MEDIA_QUERY.matches;
  }

  function isMobileInteractionMode() {
    return MOBILE_INTERACTION_MEDIA_QUERY.matches;
  }

  function clearLongPressState() {
    if (longPressTimer) {
      window.clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  }

  function startDayLongPress(date) {
    if (!isMobileInteractionMode()) {
      return;
    }

    clearLongPressState();
    longPressTriggeredDate = null;
    longPressTimer = window.setTimeout(() => {
      longPressTimer = null;
      longPressTriggeredDate = date;
      state.selectedDate = date;
      openShiftTypePicker(date);
      renderAll();
    }, LONG_PRESS_DURATION_MS);
  }

  function cancelDayLongPress() {
    clearLongPressState();
  }

  function resetDoubleTapState() {
    lastTappedDate = null;
    lastTapTimestamp = 0;
  }

  function isMobileDoubleTap(date) {
    if (!isMobileInteractionMode()) {
      return false;
    }

    const now = Date.now();
    const isDoubleTap = lastTappedDate === date && now - lastTapTimestamp <= DOUBLE_TAP_DURATION_MS;
    lastTappedDate = date;
    lastTapTimestamp = now;

    if (isDoubleTap) {
      resetDoubleTapState();
    }

    return isDoubleTap;
  }

  function setSettingsPanelOpen(isOpen) {
    settingsPanelBackdrop.classList.toggle("hidden", !isOpen);
    settingsButton.setAttribute("aria-expanded", isOpen ? "true" : "false");
  }

  function formatDateString(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(
      2,
      "0"
    )}`;
  }

  function parseDateString(dateString) {
    return engine.parseLocalDate(dateString);
  }

  function getTodayDateString() {
    return formatDateString(new Date());
  }

  function addDays(dateString, days) {
    return engine.addDays(dateString, days);
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function normalizeFreeNote(value) {
    return String(value || "").replace(/\s+/g, " ").trim().slice(0, 28);
  }

  function limitFreeNoteLength(value) {
    return String(value || "").slice(0, 28);
  }

  function sanitizeDayNotes(dayNotes) {
    if (!dayNotes || typeof dayNotes !== "object") {
      return {};
    }

    return Object.fromEntries(
      Object.entries(dayNotes)
        .map(([date, note]) => [date, normalizeFreeNote(note)])
        .filter(([date, note]) => /^\d{4}-\d{2}-\d{2}$/.test(date) && note)
    );
  }

  function stripDiacritics(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function normalizeExcelItemLabel(value) {
    return stripDiacritics(value)
      .replace(/[’']/g, "")
      .replace(/\./g, "")
      .replace(/\s+/g, "")
      .toLowerCase();
  }

  function normalizeExcelCode(value) {
    return stripDiacritics(value)
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .trim();
  }

  function parseExcelMonthYearLabel(value) {
    const normalized = stripDiacritics(value).toLowerCase().trim().replace(/\s+/g, " ");
    const match = /^([a-z]+)\s+(\d{4})$/.exec(normalized);
    if (!match) {
      return null;
    }

    const monthIndex = EXCEL_MONTH_INDEX_BY_NAME[match[1]];
    const year = Number(match[2]);
    if (!Number.isInteger(monthIndex) || !Number.isInteger(year)) {
      return null;
    }

    return { monthIndex, year };
  }

  function parseExcelDayNumber(value) {
    if (value === null || value === undefined || value === "") {
      return null;
    }

    const raw = String(value).trim();
    if (!/^\d{1,2}$/.test(raw)) {
      return null;
    }

    const day = Number(raw);
    return day >= 1 && day <= 31 ? day : null;
  }

  function getImportedShiftTypeFromExcelCode(rawCode) {
    const code = normalizeExcelCode(rawCode);
    if (!code) {
      return null;
    }

    if (EXCEL_REST_CODES.has(code)) {
      return null;
    }

    return EXCEL_SHIFT_CODE_TO_TYPE[code] || null;
  }

  function getImportedPostLabel(rawCode, rawPostLabel) {
    const code = normalizeExcelCode(rawCode);
    const postLabel = String(rawPostLabel || "").trim();
    if (!postLabel || !EXCEL_POST_LABEL_CODES.has(code)) {
      return null;
    }

    return postLabel;
  }

  function findExcelRowByItemLabel(rows, startIndex, targetLabel) {
    for (let index = startIndex; index < rows.length; index += 1) {
      const row = rows[index] || [];
      const itemLabel = normalizeExcelItemLabel(row[1]);
      if (itemLabel === targetLabel) {
        return index;
      }

      if (index > startIndex && parseExcelMonthYearLabel(row[0])) {
        break;
      }
    }

    return -1;
  }

  function findExcelDayHeaderRow(rows, startIndex) {
    for (let index = startIndex; index >= 0; index -= 1) {
      const row = rows[index] || [];
      const hasDayNumbers = row.some((cell, cellIndex) => cellIndex >= 2 && parseExcelDayNumber(cell));
      if (hasDayNumbers) {
        return row;
      }
    }

    return [];
  }

  function parseExcelPlanningWorkbook(workbook) {
    if (!workbook || !Array.isArray(workbook.SheetNames) || workbook.SheetNames.length === 0) {
      throw new Error("Le fichier Excel ne contient aucune feuille exploitable.");
    }

    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows = window.XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "", blankrows: false });
    const importedShiftsByDate = new Map();
    const touchedDates = new Set();
    const resolvedDates = new Set();
    const unknownCodes = [];
    let currentMonth = null;

    rows.forEach((row, rowIndex) => {
      const parsedMonth = parseExcelMonthYearLabel(row[0]);
      if (parsedMonth) {
        currentMonth = parsedMonth;
      }

      if (normalizeExcelItemLabel(row[1]) !== "infojour") {
        return;
      }

      if (!currentMonth) {
        throw new Error(`Mois introuvable avant la ligne ${rowIndex + 1}.`);
      }

      const horRowIndex = findExcelRowByItemLabel(rows, rowIndex + 1, "hor");
      if (horRowIndex === -1) {
        return;
      }
      const posteRowIndex = findExcelRowByItemLabel(rows, horRowIndex + 1, "poste");

      const horRow = rows[horRowIndex] || [];
      const posteRow = posteRowIndex === -1 ? [] : rows[posteRowIndex] || [];
      const hasDayNumbersOnCurrentRow = row.some((cell, cellIndex) => cellIndex >= 2 && parseExcelDayNumber(cell));
      const dayRow = hasDayNumbersOnCurrentRow ? row : findExcelDayHeaderRow(rows, rowIndex - 1);
      const maxColumnCount = Math.max(dayRow.length, horRow.length, posteRow.length);

      for (let columnIndex = 2; columnIndex < maxColumnCount; columnIndex += 1) {
        const day = parseExcelDayNumber(dayRow[columnIndex]);
        if (!day) {
          continue;
        }

        const lastDayOfMonth = new Date(currentMonth.year, currentMonth.monthIndex + 1, 0).getDate();
        if (day > lastDayOfMonth) {
          continue;
        }

        const dateString = formatDateString(new Date(currentMonth.year, currentMonth.monthIndex, day));
        const rawCode = horRow[columnIndex];
        const normalizedCode = normalizeExcelCode(rawCode);
        if (!normalizedCode) {
          continue;
        }

        touchedDates.add(dateString);

        if (EXCEL_REST_CODES.has(normalizedCode)) {
          resolvedDates.add(dateString);
          importedShiftsByDate.delete(dateString);
          continue;
        }

        const shiftType = getImportedShiftTypeFromExcelCode(rawCode);
        if (!shiftType) {
          unknownCodes.push(`${dateString} (${rawCode || "vide"})`);
          continue;
        }

        resolvedDates.add(dateString);
        const postLabel = getImportedPostLabel(rawCode, posteRow[columnIndex]);
        importedShiftsByDate.set(dateString, postLabel ? { date: dateString, shiftType, postLabel } : { date: dateString, shiftType });
      }
    });

    if (touchedDates.size === 0) {
      throw new Error("Structure du planning non reconnue. Les lignes 'Info. jour' / 'Hor.' sont introuvables.");
    }

    return {
      sheetName,
      touchedDates: Array.from(touchedDates).sort(),
      resolvedDates: Array.from(resolvedDates).sort(),
      schedule: engine.sortSchedule(Array.from(importedShiftsByDate.values())),
      unknownCodes,
    };
  }

  function applyImportedExcelPlanning(parsedPlanning) {
    const resolvedDateSet = new Set(parsedPlanning.resolvedDates);
    const importedWorkedDateSet = new Set(parsedPlanning.schedule.map((shift) => shift.date));

    state.schedule = engine.sortSchedule([
      ...state.schedule.filter((shift) => !resolvedDateSet.has(shift.date)),
      ...parsedPlanning.schedule,
    ]);
    state.blockedRestDates = state.blockedRestDates.filter((date) => !importedWorkedDateSet.has(date));
    state.selectedDate = null;

    if (state.removedShift && resolvedDateSet.has(state.removedShift.date)) {
      const replacementShift = state.schedule.find((shift) => shift.date === state.removedShift.date) || null;
      state.removedShift = isExchangeableWorkedShift(replacementShift) ? replacementShift : null;
    }

    const referenceDate = parsedPlanning.schedule[0] ? parsedPlanning.schedule[0].date : parsedPlanning.resolvedDates[0];
    if (referenceDate) {
      state.visibleMonthStart = getMonthStart(parseDateString(referenceDate));
    }

    saveToLocalStorage();
    renderAll();
  }

  async function importExcelPlanningFile(file) {
    if (!window.XLSX) {
      throw new Error("Le lecteur Excel n'est pas disponible dans l'application.");
    }

    const fileName = String(file.name || "").toLowerCase();
    const hasSupportedExtension = XLSX_IMPORT_SUPPORTED_EXTENSIONS.some((extension) => fileName.endsWith(extension));
    if (!hasSupportedExtension) {
      throw new Error(`Format non pris en charge. Utilise ${XLSX_IMPORT_SUPPORTED_EXTENSIONS.join(", ")}.`);
    }

    const arrayBuffer = await file.arrayBuffer();
    const workbook = window.XLSX.read(arrayBuffer, { type: "array" });
    const parsedPlanning = parseExcelPlanningWorkbook(workbook);
    applyImportedExcelPlanning(parsedPlanning);

    const importedCount = parsedPlanning.schedule.length;
    const unknownCount = parsedPlanning.unknownCodes.length;
    const clearedCount = Math.max(parsedPlanning.resolvedDates.length - importedCount, 0);
    const unknownCodesMessage =
      unknownCount > 0
        ? `\nCodes ignorés : ${parsedPlanning.unknownCodes.slice(0, 8).join(", ")}${
            unknownCount > 8 ? "..." : ""
          }`
        : "";

    window.alert(
      `Import Excel terminé.\n${importedCount} jour(s) importé(s), ${clearedCount} jour(s) laissé(s) en repos.${unknownCodesMessage}`
    );
  }

  function getMonthDateStrings(year, monthIndex) {
    const firstDay = new Date(year, monthIndex, 1);
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const dates = [];
    for (let day = 1; day <= daysInMonth; day += 1) {
      dates.push(formatDateString(new Date(year, monthIndex, day)));
    }
    return dates;
  }

  function getMondayFirstIndex(date) {
    return (date.getDay() + 6) % 7;
  }

  function compareShifts(left, right) {
    return engine.sortSchedule([left, right])[0] === left ? -1 : 1;
  }

  function getShiftByDate(dateString) {
    return state.schedule.find((shift) => shift.date === dateString) || null;
  }

  function isAnnualLeaveShift(shift) {
    return Boolean(shift && shift.shiftType === "CA");
  }

  function isTrainingShift(shift) {
    return Boolean(shift && shift.shiftType === "FO");
  }

  function isRegularWorkedShift(shift) {
    return Boolean(shift && shift.shiftType !== "CA");
  }

  function isExchangeableWorkedShift(shift) {
    return Boolean(shift && shift.shiftType !== "CA" && shift.shiftType !== "FO");
  }

  function getPreferredPickerShiftType() {
    return state.lastSelectedShiftType === "FO" ? "JOUR_7_19" : state.lastSelectedShiftType;
  }

  function setSchedule(nextSchedule) {
    state.schedule = engine.sortSchedule(nextSchedule);
  }

  function removeBlockedRestDate(dateString) {
    state.blockedRestDates = state.blockedRestDates.filter((date) => date !== dateString);
  }

  function getDayNote(dateString) {
    return state.dayNotes[dateString] || "";
  }

  function updateFreeNoteControls(dateString) {
    const note = dateString ? getDayNote(dateString) : "";
    freeNoteCheckbox.checked = Boolean(note);
    editFreeNoteButton.disabled = !dateString;
    editFreeNoteButton.textContent = note ? "Modifier le texte" : "Saisir / modifier le texte";
  }

  function setDayNote(dateString, noteText) {
    const normalizedNote = normalizeFreeNote(noteText);
    if (normalizedNote) {
      state.dayNotes = {
        ...state.dayNotes,
        [dateString]: normalizedNote,
      };
    } else {
      const nextDayNotes = { ...state.dayNotes };
      delete nextDayNotes[dateString];
      state.dayNotes = nextDayNotes;
    }

    updateFreeNoteControls(state.pickerDate);
    saveToLocalStorage();
    renderAll();
  }

  function saveWorkedShift(date, shiftType) {
    const nextSchedule = state.schedule.filter((shift) => shift.date !== date);
    nextSchedule.push({ date, shiftType });
    setSchedule(nextSchedule);
    removeBlockedRestDate(date);
    state.lastSelectedShiftType = shiftType === "FO" ? "JOUR_7_19" : shiftType;

    if (state.removedShift && state.removedShift.date === date) {
      state.removedShift = isExchangeableWorkedShift({ date, shiftType }) ? { date, shiftType } : null;
    }

    saveToLocalStorage();
    renderAll();
  }

  function removeWorkedShift(date) {
    const existingShift = getShiftByDate(date);
    if (!existingShift) {
      return;
    }

    setSchedule(state.schedule.filter((shift) => shift.date !== date));

    if (state.removedShift && state.removedShift.date === date) {
      state.removedShift = null;
    }

    saveToLocalStorage();
    renderAll();
  }

  function toggleBlockedRest(dateString, shouldBlock) {
    state.blockedRestDates = shouldBlock
      ? [...new Set([...state.blockedRestDates, dateString])].sort()
      : state.blockedRestDates.filter((date) => date !== dateString);

    if (shouldBlock) {
      removeWorkedShift(dateString);
    }

    saveToLocalStorage();
    renderAll();
  }

  function selectRemovedShift(date) {
    const shift = getShiftByDate(date);
    if (!isExchangeableWorkedShift(shift)) {
      return;
    }

    state.removedShift = { ...shift };
    state.searchView = "EXCHANGE";
    state.selectedDate = date;
    saveToLocalStorage();
    renderAll();
  }

  function clearRemovedShift() {
    state.removedShift = null;
    state.searchView = "EXCHANGE";
    saveToLocalStorage();
    renderAll();
  }

  function canUsePickerRemovedAction(date, shift) {
    const isCurrentRemovedShift = Boolean(state.removedShift && state.removedShift.date === date);
    return isCurrentRemovedShift || isExchangeableWorkedShift(shift);
  }

  function getRemovedActionLabel(date) {
    if (state.removedShift && state.removedShift.date === date) {
      return "Annuler le jour à enlever";
    }

    if (state.removedShift) {
      return "Remplacer le jour à échanger";
    }

    return "Choisir comme jour à échanger";
  }

  function updatePickerRemovedActionButton(date, shift) {
    if (isHspViewActive()) {
      selectRemovedButton.textContent = "Jour à échanger indisponible en HSP";
      selectRemovedButton.disabled = true;
      return;
    }

    selectRemovedButton.textContent = getRemovedActionLabel(date);
    selectRemovedButton.disabled = !canUsePickerRemovedAction(date, shift);
  }

  function setExchangeMode(mode) {
    state.exchangeMode = mode;
    saveToLocalStorage();
    renderAll();
  }

  function isHspViewActive() {
    return state.searchView === "HSP";
  }

  function toggleHspView() {
    const nextIsHspView = !isHspViewActive();
    state.searchView = nextIsHspView ? "HSP" : "EXCHANGE";
    if (nextIsHspView) {
      state.removedShift = null;
    }
    detailsHspButton.textContent = isHspViewActive() ? "Quitter HSP" : "HSP";
    detailsHspButton.classList.toggle("is-active", isHspViewActive());
    mobileHspButton.textContent = isHspViewActive() ? "Quitter HSP" : "HSP";
    mobileHspButton.classList.toggle("is-active", isHspViewActive());
    saveToLocalStorage();
    renderAll();
  }

  function getModeAdjustedStatus(availability) {
    if (!availability) {
      return "NONE";
    }

    if (state.exchangeMode === "DAY") {
      return availability.dayAllowed ? "DAY_ONLY" : "NONE";
    }

    if (state.exchangeMode === "NIGHT") {
      return availability.nightAllowed ? "NIGHT_ONLY" : "NONE";
    }

    return availability.availabilityType;
  }

  function getVisibleMonthRange() {
    const firstMonth = getMonthStart(state.visibleMonthStart);
    const secondMonth = getMonthStart(new Date(firstMonth.getFullYear(), firstMonth.getMonth() + 1, 1));
    return [firstMonth, secondMonth];
  }

  function getVisibleDateStrings() {
    return getVisibleMonthRange().flatMap((monthStart) => {
      return getMonthDateStrings(monthStart.getFullYear(), monthStart.getMonth());
    });
  }

  function computeVisibleCandidateStatuses() {
    const statuses = {};
    const options = { blockedRestDates: state.blockedRestDates };

    getVisibleDateStrings().forEach((dateString) => {
      if (!state.removedShift && !isHspViewActive()) {
        statuses[dateString] = {
          status: "NONE",
          availability: null,
          resultByShiftType: {},
        };
        return;
      }

      const availability = isHspViewActive()
        ? engine.getExtraShiftAvailabilityType(state.schedule, dateString, options)
        : engine.getCandidateAvailabilityType(state.schedule, state.removedShift, dateString, options);
      const resultEntries = availability && availability.details
        ? [...(availability.details.dayResults || []), ...(availability.details.nightResults || [])]
        : [];
      const resultByShiftType = {};
      resultEntries.forEach((entry) => {
        resultByShiftType[entry.shiftType] = entry.result;
      });

      statuses[dateString] = {
        status: getModeAdjustedStatus(availability),
        availability,
        resultByShiftType,
      };
    });

    state.visibleStatuses = statuses;
    return statuses;
  }

  function getDayCellState(date) {
    const shift = getShiftByDate(date);
    const isRemoved = Boolean(state.removedShift && state.removedShift.date === date);
    const isBlockedRest = state.blockedRestDates.includes(date);
    const availabilityData = state.visibleStatuses ? state.visibleStatuses[date] : null;
    const availabilityStatus = availabilityData ? availabilityData.status : "NONE";

    if (isRemoved) {
      return "removed";
    }
    if (isAnnualLeaveShift(shift)) {
      return "blocked-rest";
    }
    if (shift) {
      return "worked";
    }
    if (isBlockedRest) {
      return "blocked-rest";
    }
    if (!state.removedShift && !isHspViewActive()) {
      return "empty";
    }
    if (availabilityStatus === "DAY_ONLY") {
      return "day-only";
    }
    if (availabilityStatus === "NIGHT_ONLY") {
      return "night-only";
    }
    if (availabilityStatus === "BOTH") {
      return "both";
    }
    return "none";
  }

  function getDayCellBadges(date) {
    const badges = [];
    const shift = getShiftByDate(date);
    if (shift) {
      badges.push(SHIFT_TYPE_BADGES[shift.shiftType] || shift.shiftType);
      if (shift.postLabel && isRegularWorkedShift(shift)) {
        badges.push(shift.postLabel);
      }
    }
    if (state.removedShift && state.removedShift.date === date) {
      badges.push("À retirer");
    }
    if (state.blockedRestDates.includes(date)) {
      badges.push("Repos bloqué");
    }
    const freeNote = getDayNote(date);
    if (freeNote) {
      badges.push(freeNote);
    }
    return badges;
  }

  function formatDayCellBadgeLabel(label) {
    if (label.includes(":")) {
      return label.replace(":", "\n");
    }

    if (label.includes(" ")) {
      const parts = label.split(" ");
      return `${parts.slice(0, -1).join(" ")}\n${parts[parts.length - 1]}`;
    }

    return label;
  }

  function shouldHideDetailedShiftResult(shiftType, result) {
    if (!result || result.allowed) {
      return false;
    }

    if (!["JOUR_10_22", "JOUR_11_23"].includes(shiftType)) {
      return false;
    }

    return Array.isArray(result.reasonCodes) && result.reasonCodes.includes(ROLLING_LIMIT_REASON_CODE);
  }

  function getDayDetailsShiftLabel(shiftType, result) {
    if (shiftType === "JOUR_7_19") {
      return "Jour";
    }

    if (shiftType === "NUIT_19_7") {
      return "Nuit";
    }

    return SHIFT_TYPE_LABELS[shiftType] || shiftType;
  }

  function shouldDisplayShiftInDayDetails(shiftType) {
    if (state.exchangeMode === "DAY") {
      return shiftType !== "NUIT_19_7";
    }

    if (state.exchangeMode === "NIGHT") {
      return shiftType === "NUIT_19_7";
    }

    return true;
  }

  function shouldUseGenericWorkedDayDetails(shift) {
    if (!shift) {
      return false;
    }

    return isTrainingShift(shift) || ["JOUR_7_19", "JOUR_10_22", "JOUR_11_23", "NUIT_19_7"].includes(shift.shiftType);
  }

  function getMiniSummaryItems(date) {
    const statusEntry = state.visibleStatuses ? state.visibleStatuses[date] : null;
    if ((!state.removedShift && !isHspViewActive()) || !statusEntry || getShiftByDate(date) || state.blockedRestDates.includes(date)) {
      return [];
    }

    return EXCHANGE_SHIFT_TYPES.map((shiftType) => {
      const result = statusEntry.resultByShiftType[shiftType];
      return {
        label: SHIFT_TYPE_BADGES[shiftType] || shiftType,
        allowed: result ? result.allowed : false,
      };
    });
  }

  function renderMonth(year, month) {
    const monthCard = document.createElement("section");
    monthCard.className = "month-card";

    const monthHeader = document.createElement("div");
    monthHeader.className = "month-header";

    const title = document.createElement("h2");
    title.className = "month-title";
    title.textContent = MONTH_FORMATTER.format(new Date(year, month, 1));
    monthHeader.appendChild(title);
    monthCard.appendChild(monthHeader);

    const monthGrid = document.createElement("div");
    monthGrid.className = "month-grid";

    WEEKDAY_LABELS.forEach((label) => {
      const weekday = document.createElement("div");
      weekday.className = "weekday";
      weekday.textContent = label;
      monthGrid.appendChild(weekday);
    });

    const firstDay = new Date(year, month, 1);
    const offset = getMondayFirstIndex(firstDay);
    for (let index = 0; index < offset; index += 1) {
      const emptyCell = document.createElement("div");
      emptyCell.className = "day-cell empty";
      monthGrid.appendChild(emptyCell);
    }

    getMonthDateStrings(year, month).forEach((dateString) => {
      const button = document.createElement("button");
      const cellState = getDayCellState(dateString);
      button.type = "button";
      button.className = `day-cell state-${cellState}`;
      button.dataset.date = dateString;
      if (dateString === getTodayDateString()) {
        button.classList.add("today");
      }
      if (state.selectedDate === dateString) {
        button.classList.add("selected-detail");
      }

      const number = document.createElement("div");
      number.className = "day-number";
      if (dateString === getTodayDateString()) {
        number.classList.add("today");
      }
      number.textContent = String(parseDateString(dateString).getDate());
      button.appendChild(number);

      const badgeContainer = document.createElement("div");
      badgeContainer.className = "day-badges";
      getDayCellBadges(dateString).forEach((badgeLabel) => {
        const badge = document.createElement("span");
        badge.className = "badge";
        badge.textContent = formatDayCellBadgeLabel(badgeLabel);
        badgeContainer.appendChild(badge);
      });
      button.appendChild(badgeContainer);

      const miniSummary = getMiniSummaryItems(dateString);
      if (miniSummary.length > 0) {
        const summaryContainer = document.createElement("div");
        summaryContainer.className = "day-mini-summary";
        miniSummary.forEach((item) => {
          const badge = document.createElement("span");
          badge.className = `badge ${item.allowed ? "badge-candidate-ok" : "badge-candidate-no"} ${
            state.debugMode ? "debug" : ""
          }`;
          badge.textContent = formatDayCellBadgeLabel(`${item.label}:${item.allowed ? "OK" : "NON"}`);
          summaryContainer.appendChild(badge);
        });
        button.appendChild(summaryContainer);
      }

      button.addEventListener("click", () => handleDayClick(dateString));
      button.addEventListener("dblclick", () => handleDayDoubleClick(dateString));
      button.addEventListener("pointerdown", (event) => {
        if (event.pointerType === "mouse") {
          return;
        }
        startDayLongPress(dateString);
      });
      button.addEventListener("pointerup", cancelDayLongPress);
      button.addEventListener("pointercancel", cancelDayLongPress);
      button.addEventListener("pointerleave", cancelDayLongPress);
      button.addEventListener("contextmenu", (event) => {
        if (isMobileInteractionMode()) {
          event.preventDefault();
        }
      });
      monthGrid.appendChild(button);
    });

    monthCard.appendChild(monthGrid);
    return monthCard;
  }

  function renderCalendar(startMonth) {
    const monthScrollPositions = Array.from(calendarContainer.querySelectorAll(".month-card"), (monthCard) => monthCard.scrollLeft);
    calendarContainer.innerHTML = "";
    const monthStart = startMonth ? getMonthStart(startMonth) : getMonthStart(state.visibleMonthStart);
    calendarContainer.appendChild(renderMonth(monthStart.getFullYear(), monthStart.getMonth()));
    const secondMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);
    calendarContainer.appendChild(renderMonth(secondMonth.getFullYear(), secondMonth.getMonth()));
    Array.from(calendarContainer.querySelectorAll(".month-card")).forEach((monthCard, index) => {
      monthCard.scrollLeft = monthScrollPositions[index] || 0;
    });
  }

  function renderSelectedDayState(previousDate, nextDate) {
    if (previousDate) {
      const previousButton = calendarContainer.querySelector(`.day-cell[data-date="${previousDate}"]`);
      if (previousButton) {
        previousButton.classList.remove("selected-detail");
      }
    }

    if (nextDate) {
      const nextButton = calendarContainer.querySelector(`.day-cell[data-date="${nextDate}"]`);
      if (nextButton) {
        nextButton.classList.add("selected-detail");
      }
    }

    renderDetailsActions();
    renderDayDetails(nextDate);
  }

  function isPickerBlockedRestActive() {
    return blockedRestToggleButton.getAttribute("aria-pressed") === "true";
  }

  function updateBlockedRestToggleButton(isBlockedRest) {
    blockedRestToggleButton.setAttribute("aria-pressed", isBlockedRest ? "true" : "false");
    blockedRestToggleButton.classList.toggle("is-active", isBlockedRest);
    blockedRestToggleButton.textContent = isBlockedRest
      ? "Debloquer ce jour comme repos indisponible"
      : "Bloquer ce jour comme repos indisponible";
    shiftTypeSelect.disabled = isBlockedRest;
  }

  function openShiftTypePicker(date) {
    state.pickerDate = date;
    state.selectedDate = date;

    const existingShift = getShiftByDate(date);
    const isBlockedRest = state.blockedRestDates.includes(date);

    shiftPickerTitle.textContent = existingShift ? "Modifier le jour" : "Ajouter un jour";
    shiftPickerDateLabel.textContent = formatDisplayDate(date);
    shiftPickerHelp.textContent = existingShift
      ? "Tu peux modifier l'horaire ou supprimer cette saisie."
      : "Choisis un horaire pour marquer ce jour comme travaille, ou utilise le bouton de repos bloque si tu ne veux pas travailler ce jour.";
    shiftTypeSelect.value = existingShift ? existingShift.shiftType : getPreferredPickerShiftType();
    updateBlockedRestToggleButton(isBlockedRest);
    updateFreeNoteControls(date);
    deleteShiftButton.disabled = !existingShift;
    updatePickerRemovedActionButton(date, existingShift);
    shiftPickerBackdrop.classList.remove("hidden");

    renderDayDetails(date);
  }

  function closeShiftTypePicker() {
    shiftPickerBackdrop.classList.add("hidden");
    state.pickerDate = null;
  }

  function openFreeNoteModal(date) {
    if (!date) {
      return;
    }

    freeNoteDateLabel.textContent = formatDisplayDate(date);
    freeNoteInput.value = getDayNote(date);
    removeFreeNoteButton.disabled = !getDayNote(date);
    freeNoteModalBackdrop.classList.remove("hidden");
    window.setTimeout(() => {
      freeNoteInput.focus();
      freeNoteInput.select();
    }, 0);
  }

  function closeFreeNoteModal() {
    freeNoteModalBackdrop.classList.add("hidden");
  }

  function closeFreeNoteAndShiftPickers() {
    closeFreeNoteModal();
    closeShiftTypePicker();
  }

  function handleDayClick(date) {
    if (longPressTriggeredDate === date) {
      longPressTriggeredDate = null;
      resetDoubleTapState();
      return;
    }

    if (isMobileDoubleTap(date)) {
      state.selectedDate = date;
      openShiftTypePicker(date);
      return;
    }

    const previousDate = state.selectedDate;
    state.selectedDate = date;
    renderSelectedDayState(previousDate, date);
  }

  function handleDayDoubleClick(date) {
    resetDoubleTapState();
    state.selectedDate = date;
    openShiftTypePicker(date);
    renderAll();
  }

  function getVisiblePossibleDayCount() {
    if ((!state.removedShift && !isHspViewActive()) || !state.visibleStatuses) {
      return 0;
    }

    return getVisibleDateStrings().filter((date) => {
      if (getShiftByDate(date) || (state.removedShift && date === state.removedShift.date) || state.blockedRestDates.includes(date)) {
        return false;
      }
      const entry = state.visibleStatuses[date];
      return entry && entry.status !== "NONE";
    }).length;
  }

  function renderSummary() {
    summaryContent.innerHTML = "";
    const lines = [
      ["Jours travaillés saisis", String(state.schedule.filter(isRegularWorkedShift).length)],
      [
        "Jour à enlever",
        state.removedShift ? `${formatDisplayDate(state.removedShift.date)} - ${SHIFT_TYPE_LABELS[state.removedShift.shiftType]}` : "Aucun",
      ],
      ["Vue active", SEARCH_VIEW_LABELS[state.searchView] || SEARCH_VIEW_LABELS.EXCHANGE],
      ["Mode de recherche", EXCHANGE_MODE_LABELS[state.exchangeMode]],
      ["Jours possibles visibles", String(getVisiblePossibleDayCount())],
      ["Repos bloqués", String(state.blockedRestDates.length)],
      ["Congés annuels", String(state.schedule.filter(isAnnualLeaveShift).length)],
    ];

    const list = document.createElement("div");
    list.className = "summary-list";
    lines.forEach(([label, value]) => {
      const line = document.createElement("div");
      line.className = "summary-line";
      line.innerHTML = `<strong>${label} :</strong> <span>${value}</span>`;
      list.appendChild(line);
    });
    summaryContent.appendChild(list);
  }

  function renderDetailsActions() {
    const date = state.selectedDate;
    const shift = date ? getShiftByDate(date) : null;
    const isBlocked = date ? state.blockedRestDates.includes(date) : false;
    const isAnnualLeave = isAnnualLeaveShift(shift);
    const isHspView = isHspViewActive();

    detailsEditButton.disabled = !date;
    detailsRemoveButton.disabled = !shift;
    detailsSelectRemovedButton.disabled = isHspView || !isExchangeableWorkedShift(shift);
    detailsSelectRemovedButton.textContent = isHspView
      ? "Jour à échanger indisponible en HSP"
      : date
        ? getRemovedActionLabel(date)
        : "Choisir comme jour à échanger";
    detailsHspButton.disabled = !date;
    detailsHspButton.textContent = isHspViewActive() ? "Quitter HSP" : "HSP";
    detailsHspButton.classList.toggle("is-active", isHspViewActive());
    mobileHspButton.disabled = !date;
    mobileHspButton.textContent = isHspViewActive() ? "Quitter HSP" : "HSP";
    mobileHspButton.classList.toggle("is-active", isHspViewActive());
    detailsToggleBlockedButton.disabled = !date || isAnnualLeave;
    detailsToggleBlockedButton.textContent = isBlocked ? "Débloquer le repos" : "Bloquer en repos";
  }

  function renderLegend() {
    legendContent.innerHTML = "";
    const items = [
      ["var(--color-worked)", "Jour travaillé"],
      ["var(--color-removed)", "Jour à enlever"],
      ["var(--color-day-only)", "Possible en jour"],
      ["var(--color-night-only)", "Possible en nuit"],
      ["var(--color-both)", "Possible en jour ou en nuit"],
      ["var(--color-none)", "Impossible"],
      ["var(--color-blocked-rest)", "Repos bloqué"],
      ["var(--color-blocked-rest)", "Congé annuel (CA)"],
    ];

    const list = document.createElement("div");
    list.className = "legend-list";
    items.forEach(([color, label]) => {
      const row = document.createElement("div");
      row.className = "legend-line";
      const swatchClass = label === "Jour travaillé" ? "legend-swatch legend-swatch-worked" : "legend-swatch";
      row.innerHTML = `<span class="${swatchClass}" style="background:${color}"></span><span>${label}</span>`;
      list.appendChild(row);
    });
    legendContent.appendChild(list);
  }

  function formatJson(value) {
    return JSON.stringify(value, null, 2);
  }

  function formatDisplayDate(dateString) {
    const date = parseDateString(dateString);
    return `${String(date.getDate()).padStart(2, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${date.getFullYear()}`;
  }

  function formatDisplayDateShort(dateString) {
    const date = parseDateString(dateString);
    return `${String(date.getDate()).padStart(2, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }

  function formatDisplayDateWithWeekday(dateString) {
    const formatted = DAY_DETAILS_DATE_FORMATTER.format(parseDateString(dateString));
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  }

  function formatBlockingWindowRange(window) {
    const startDate = parseDateString(window.startDate);
    const endDate = parseDateString(window.endDate);
    const shouldIncludeYear = startDate.getFullYear() !== endDate.getFullYear();
    const startLabel = shouldIncludeYear ? formatDisplayDate(window.startDate) : formatDisplayDateShort(window.startDate);
    const endLabel = shouldIncludeYear ? formatDisplayDate(window.endDate) : formatDisplayDateShort(window.endDate);
    return `${startLabel} -> ${endLabel}`;
  }

  function formatBlockingWindowsSummary(blockingWindows) {
    if (!Array.isArray(blockingWindows) || blockingWindows.length === 0) {
      return [];
    }

    if (blockingWindows.length === 1) {
      const window = blockingWindows[0];
      return [
        `Période bloquante\u00A0: ${formatDisplayDate(window.startDate)} -> ${formatDisplayDate(window.endDate)} (${window.workedDaysCount} jours travaillés)`,
      ];
    }

    const ranges = blockingWindows.map((window) => formatBlockingWindowRange(window));
    const workedDaysCount = blockingWindows[0].workedDaysCount;
    const hasSameWorkedDaysCount = blockingWindows.every((window) => window.workedDaysCount === workedDaysCount);
    const suffix = hasSameWorkedDaysCount ? ` (${workedDaysCount} jours travaillés)` : "";

    return [`Périodes bloquantes${suffix}\u00A0:`, ...ranges];
  }

  function formatRequestDate(dateString) {
    return REQUEST_DATE_FORMATTER.format(parseDateString(dateString));
  }

  function formatRequestShiftLabel(shiftType) {
    if (shiftType === "JOUR_7_19") {
      return "jour";
    }

    if (shiftType === "NUIT_19_7") {
      return "nuit";
    }

    return SHIFT_TYPE_LABELS[shiftType] || shiftType;
  }

  function getAllowedShiftTypesForEntry(statusEntry) {
    if (!statusEntry || !statusEntry.availability) {
      return [];
    }

    if (state.exchangeMode === "DAY") {
      return statusEntry.availability.allowedDayShiftTypes;
    }

    if (state.exchangeMode === "NIGHT") {
      return statusEntry.availability.allowedNightShiftTypes;
    }

    return [...statusEntry.availability.allowedDayShiftTypes, ...statusEntry.availability.allowedNightShiftTypes];
  }

  function getShiftFamilyLabel(shiftType) {
    const shiftConfig = engine.SHIFT_TYPES[shiftType];
    if (!shiftConfig) {
      return "Poste";
    }

    if (shiftConfig.family === "night") {
      return "Nuit";
    }

    if (shiftConfig.family === "day") {
      return "Jour";
    }

    return shiftConfig.label || "Poste";
  }

  function getShiftRoleLabel(shiftType, isCandidate) {
    const familyLabel = getShiftFamilyLabel(shiftType);
    const workedLabel = familyLabel === "Nuit" ? "travaillée" : "travaillé";
    return `${familyLabel} ${isCandidate ? "à échanger" : workedLabel}`;
  }

  function isSameShiftIdentity(shift, referenceShift) {
    return Boolean(
      shift &&
        referenceShift &&
        shift.date === referenceShift.date &&
        shift.shiftType === referenceShift.shiftType
    );
  }

  function getRestConflictDirectionLabel(result, candidateShift) {
    if (!result || !result.restRule || !Array.isArray(result.restRule.conflicts) || !candidateShift) {
      return "";
    }

    const matchingConflict = result.restRule.conflicts.find((conflict) => {
      return (
        isSameShiftIdentity(conflict.previousShift, candidateShift) ||
        isSameShiftIdentity(conflict.nextShift, candidateShift)
      );
    });

    if (!matchingConflict) {
      return "";
    }

    const previousIsCandidate = isSameShiftIdentity(matchingConflict.previousShift, candidateShift);
    const nextIsCandidate = isSameShiftIdentity(matchingConflict.nextShift, candidateShift);
    const previousLabel = getShiftRoleLabel(matchingConflict.previousShift && matchingConflict.previousShift.shiftType, previousIsCandidate);
    const nextLabel = getShiftRoleLabel(matchingConflict.nextShift && matchingConflict.nextShift.shiftType, nextIsCandidate);

    return `${previousLabel} => ${nextLabel}`;
  }

  function formatDetailedExplanation(result, candidateShift) {
    const reasonCodes = Array.isArray(result && result.reasonCodes) ? result.reasonCodes : [];

    if (reasonCodes.includes("CANDIDATE_DATE_BLOCKED_BY_USER")) {
      return [escapeHtml("La date candidate est marquée comme repos indisponible par l'utilisateur.")];
    }

    const lines = [];
    if (reasonCodes.includes("CANDIDATE_DATE_ALREADY_WORKED")) {
      if (candidateShift && candidateShift.shiftType === "NUIT_19_7") {
        lines.push("Tu travailles déjà cette nuit là !");
      } else {
        lines.push("Tu travailles déjà ce jour là !");
      }

      return lines.map((line) => escapeHtml(line));
    }
    if (reasonCodes.includes("CANDIDATE_DATE_IS_REMOVED_DATE")) {
      lines.push("La date candidate est identique au poste retiré.");
    }
    if (reasonCodes.includes("INSUFFICIENT_REST_HOURS")) {
      const restConflictDirection = getRestConflictDirectionLabel(result, candidateShift);
      lines.push(
        restConflictDirection
          ? `Le repos minimum de 12 heures entre deux postes consécutifs n'est pas respecté\u00A0: ${restConflictDirection}.`
          : "Le repos minimum de 12 heures entre deux postes consécutifs n'est pas respecté."
      );
    }
    if (reasonCodes.includes("TOO_MANY_WORKED_DAYS_IN_7")) {
      lines.push("Tu ferais plus de 4 jours travaillés sur 7 jours glissants.");
    }

    if (lines.length === 0) {
      lines.push(engine.explainValidationResult(result));
    }

    return lines.map((line) => escapeHtml(line));
  }

  function setRequestExchangeMode(mode) {
    requestModeAnyCheckbox.checked = mode === "ANY";
    requestModeDayCheckbox.checked = mode === "DAY";
    requestModeNightCheckbox.checked = mode === "NIGHT";
  }

  function getRequestExchangeMode() {
    if (requestModeDayCheckbox.checked) {
      return "DAY";
    }

    if (requestModeNightCheckbox.checked) {
      return "NIGHT";
    }

    return "ANY";
  }

  function getSelectedRequestShiftTypes() {
    const requestMode = getRequestExchangeMode();

    if (requestMode === "NIGHT") {
      return ["NUIT_19_7"];
    }

    if (requestMode === "DAY") {
      const selectedShiftTypes = ["JOUR_7_19"];
      if (include1022Checkbox.checked) {
        selectedShiftTypes.push("JOUR_10_22");
      }
      if (include1123Checkbox.checked) {
        selectedShiftTypes.push("JOUR_11_23");
      }
      return selectedShiftTypes;
    }

    const selectedShiftTypes = ["JOUR_7_19", "NUIT_19_7"];
    if (include1022Checkbox.checked) {
      selectedShiftTypes.push("JOUR_10_22");
    }
    if (include1123Checkbox.checked) {
      selectedShiftTypes.push("JOUR_11_23");
    }

    return selectedShiftTypes;
  }

  function syncRequestOptionStates() {
    const isNightMode = getRequestExchangeMode() === "NIGHT";

    if (isNightMode) {
      include1022Checkbox.checked = false;
      include1123Checkbox.checked = false;
    }

    include1022Checkbox.disabled = isNightMode;
    include1123Checkbox.disabled = isNightMode;
  }

  function getAllowedShiftTypesForRequestEntry(statusEntry) {
    if (!statusEntry || !statusEntry.availability) {
      return [];
    }

    return [
      ...statusEntry.availability.allowedDayShiftTypes,
      ...statusEntry.availability.allowedNightShiftTypes,
    ];
  }

  function getExchangeRequestCandidates() {
    if (!state.removedShift || !state.visibleStatuses) {
      return [];
    }

    return getVisibleDateStrings()
      .filter((date) => !getShiftByDate(date) && date !== state.removedShift.date && !state.blockedRestDates.includes(date))
      .map((date) => {
        const statusEntry = state.visibleStatuses[date];
        const selectedShiftTypes = new Set(getSelectedRequestShiftTypes());
        const allowedShiftTypes = [...new Set(getAllowedShiftTypesForRequestEntry(statusEntry))].filter((shiftType) =>
          selectedShiftTypes.has(shiftType)
        );
        return {
          date,
          allowedShiftTypes,
        };
      })
      .filter((entry) => entry.allowedShiftTypes.length > 0);
  }

  function getExchangeRequestCandidatesInRange(startDate, endDate) {
    return getExchangeRequestCandidates().filter((candidate) => {
      if (startDate && candidate.date < startDate) {
        return false;
      }
      if (endDate && candidate.date > endDate) {
        return false;
      }
      return true;
    });
  }

  function buildExchangeRequestText(startDate, endDate) {
    if (!state.removedShift) {
      return "";
    }

    const candidates = getExchangeRequestCandidatesInRange(startDate, endDate);
    if (candidates.length === 0) {
      return "";
    }

    const selectedShiftTypes = getSelectedRequestShiftTypes();
    const isOnlyStandardDayRequest = selectedShiftTypes.length === 1 && selectedShiftTypes[0] === "JOUR_7_19";
    const isOnlyNightRequest = selectedShiftTypes.length === 1 && selectedShiftTypes[0] === "NUIT_19_7";

    const candidateText = candidates
      .map((candidate) => {
        const formattedShifts = candidate.allowedShiftTypes.map((shiftType) => formatRequestShiftLabel(shiftType));
        if (isOnlyStandardDayRequest || isOnlyNightRequest) {
          return formatRequestDate(candidate.date);
        }

        if (formattedShifts.length === 1) {
          return `${formatRequestDate(candidate.date)} ${formattedShifts[0]}`;
        }

        return `${formatRequestDate(candidate.date)} (${formattedShifts.join(", ")})`;
      })
      .join(", ");

    const removedShiftLabel = formatRequestShiftLabel(state.removedShift.shiftType);
    if (isOnlyStandardDayRequest) {
      return `Bonjour, je souhaite échanger le ${formatRequestDate(state.removedShift.date)} ${removedShiftLabel} contre en jour : ${candidateText}.`;
    }

    if (isOnlyNightRequest) {
      return `Bonjour, je souhaite échanger le ${formatRequestDate(state.removedShift.date)} ${removedShiftLabel} contre en nuit : ${candidateText}.`;
    }

    return `Bonjour, je souhaite échanger le ${formatRequestDate(state.removedShift.date)} ${removedShiftLabel} contre : ${candidateText}.`;
  }

  function canOpenExchangeRequest() {
    return !isHspViewActive() && Boolean(state.removedShift) && getExchangeRequestCandidates().length > 0;
  }

  function getRequestRangeValues() {
    return {
      startDate: requestStartDateInput.value || "",
      endDate: requestEndDateInput.value || "",
    };
  }

  function setActiveRequestRangeButton(activeButton) {
    requestRangeButtons.forEach((button) => {
      button.classList.toggle("is-active", button === activeButton);
    });
  }

  function clearActiveRequestRangeButtons() {
    setActiveRequestRangeButton(null);
  }

  function clampDateString(dateString, minDate, maxDate) {
    if (!dateString) {
      return minDate;
    }
    if (dateString < minDate) {
      return minDate;
    }
    if (dateString > maxDate) {
      return maxDate;
    }
    return dateString;
  }

  function addMonths(dateString, monthCount) {
    const date = parseDateString(dateString);
    date.setMonth(date.getMonth() + monthCount);
    return formatDateString(date);
  }

  function getDefaultRequestRange(candidates) {
    const visibleDates = getVisibleDateStrings();
    const minDate = visibleDates[0];
    const maxDate = visibleDates[visibleDates.length - 1];
    const removedDate = state.removedShift ? state.removedShift.date : candidates[0].date;

    return {
      startDate: clampDateString(addDays(removedDate, -5), minDate, maxDate),
      endDate: clampDateString(addDays(removedDate, 5), minDate, maxDate),
    };
  }

  function applyRequestRange(days, useMonth, activeButton) {
    const minDate = requestStartDateInput.min;
    const maxDate = requestEndDateInput.max;
    const startDate = clampDateString(requestStartDateInput.value || minDate, minDate, maxDate);
    const rawEndDate = useMonth ? addDays(addMonths(startDate, 1), -1) : addDays(startDate, days - 1);
    const endDate = clampDateString(rawEndDate, minDate, maxDate);

    requestStartDateInput.value = startDate;
    requestEndDateInput.value = endDate;
    setActiveRequestRangeButton(activeButton);
    refreshRequestText();
  }

  function refreshRequestText() {
    const { startDate, endDate } = getRequestRangeValues();

    if (startDate && endDate && startDate > endDate) {
      requestTextOutput.value = "La date de fin doit être postérieure ou égale à la date de début.";
      copyRequestButton.disabled = true;
      return;
    }

    const text = buildExchangeRequestText(startDate, endDate);
    requestTextOutput.value =
      text || "Aucun créneau possible dans cette plage de dates. Modifie les dates pour élargir la recherche.";
    copyRequestButton.disabled = !text;
  }

  function openRequestModal() {
    if (!canOpenExchangeRequest()) {
      return;
    }

    const candidates = getExchangeRequestCandidates();
    const visibleDates = getVisibleDateStrings();
    requestStartDateInput.min = visibleDates[0];
    requestStartDateInput.max = visibleDates[visibleDates.length - 1];
    requestEndDateInput.min = visibleDates[0];
    requestEndDateInput.max = visibleDates[visibleDates.length - 1];
    include1022Checkbox.checked = false;
    include1123Checkbox.checked = false;
    setRequestExchangeMode(state.exchangeMode);
    syncRequestOptionStates();
    const defaultRange = getDefaultRequestRange(candidates);
    requestStartDateInput.value = defaultRange.startDate;
    requestEndDateInput.value = defaultRange.endDate;
    clearActiveRequestRangeButtons();
    refreshRequestText();
    requestModalBackdrop.classList.remove("hidden");
  }

  function closeRequestModal() {
    requestModalBackdrop.classList.add("hidden");
  }

  function openHelpModal() {
    helpModalBackdrop.classList.remove("hidden");
  }

  function closeHelpModal() {
    helpModalBackdrop.classList.add("hidden");
  }

  function openResetConfirmModal() {
    resetConfirmBackdrop.classList.remove("hidden");
  }

  function closeResetConfirmModal() {
    resetConfirmBackdrop.classList.add("hidden");
  }

  async function copyRequestText() {
    const text = requestTextOutput.value;
    if (!text) {
      return;
    }

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        requestTextOutput.focus();
        requestTextOutput.select();
        document.execCommand("copy");
      }
      copyRequestButton.textContent = "Texte copié";
      window.setTimeout(() => {
        copyRequestButton.textContent = "Copier le texte";
      }, 1600);
    } catch (error) {
      window.alert("Copie impossible automatiquement. Le texte est déjà sélectionné, tu peux faire Ctrl+C.");
      requestTextOutput.focus();
      requestTextOutput.select();
    }
  }

  function renderDayDetails(date) {
    if (!date) {
      dayDetailsTitle.textContent = "Détails du jour";
      dayDetailsOutput.textContent = "Clique sur un jour pour afficher ses détails.";
      return;
    }

    dayDetailsTitle.textContent = `Détails du ${formatDisplayDateWithWeekday(date)}`;

    const shift = getShiftByDate(date);
    const lines = [`<strong>Date\u00A0: ${escapeHtml(formatDisplayDateWithWeekday(date))}</strong>`];

    if (isAnnualLeaveShift(shift)) {
      lines.push(`Congé annuel\u00A0: ${escapeHtml("oui")}`);
    } else if (isTrainingShift(shift)) {
      lines.push(`Horaire\u00A0: ${escapeHtml("FO (9h-17h)")}`);
    } else if (shift) {
      lines.push(`Horaire\u00A0: ${escapeHtml(SHIFT_TYPE_LABELS[shift.shiftType])}`);
      if (shift.postLabel) {
        lines.push(`Poste\u00A0: ${escapeHtml(shift.postLabel)}`);
      }
    }

    const freeNote = getDayNote(date);
    if (freeNote) {
      lines.push(`Texte libre\u00A0: ${escapeHtml(freeNote)}`);
    }

    if (!state.removedShift && !isHspViewActive()) {
      lines.push("");
      lines.push(escapeHtml("Sélectionne d'abord un jour à enlever pour calculer les disponibilités."));
      dayDetailsOutput.innerHTML = lines.join("\n");
      return;
    }

    const availabilityEntry = state.visibleStatuses ? state.visibleStatuses[date] : null;
    const availability = availabilityEntry ? availabilityEntry.availability : null;
    lines.push("");
    lines.push(`Vue active\u00A0: ${escapeHtml(SEARCH_VIEW_LABELS[state.searchView] || SEARCH_VIEW_LABELS.EXCHANGE)}`);
    lines.push(`Mode actif\u00A0: ${escapeHtml(EXCHANGE_MODE_LABELS[state.exchangeMode])}`);

    if (availability) {
      lines.push(
        `Horaires jour autorisés\u00A0: ${escapeHtml(
          availability.allowedDayShiftTypes.map((shiftType) => SHIFT_TYPE_LABELS[shiftType] || shiftType).join(", ") || "aucun"
        )}`
      );
      lines.push(
        `Horaires nuit autorisés\u00A0: ${escapeHtml(
          availability.allowedNightShiftTypes.map((shiftType) => SHIFT_TYPE_LABELS[shiftType] || shiftType).join(", ") || "aucun"
        )}`
      );
    }

    const resultsForDate = availabilityEntry ? availabilityEntry.resultByShiftType : {};
    const useGenericWorkedDayDetails = shouldUseGenericWorkedDayDetails(shift);
    let detailShiftTypes = EXCHANGE_SHIFT_TYPES;
    if (shift && shift.shiftType === "NUIT_19_7") {
      detailShiftTypes = ["NUIT_19_7"];
    } else if (shift && ["JOUR_7_19", "JOUR_10_22", "JOUR_11_23"].includes(shift.shiftType)) {
      detailShiftTypes = ["JOUR_7_19"];
    } else if (isTrainingShift(shift)) {
      detailShiftTypes = ["JOUR_7_19"];
    }
    detailShiftTypes.forEach((shiftType) => {
      if (!shouldDisplayShiftInDayDetails(shiftType)) {
        return;
      }

      const result = resultsForDate[shiftType];
      if (!result || shouldHideDetailedShiftResult(shiftType, result)) {
        return;
      }

      lines.push("");
      const statusLabel = result.allowed ? "possible" : "impossible";
      const statusClass = result.allowed ? "detail-status-possible" : "detail-status-impossible";
      const explanationLines = formatDetailedExplanation(result, { date, shiftType });
      const isBlockedByUser =
        Array.isArray(result.reasonCodes) && result.reasonCodes.includes("CANDIDATE_DATE_BLOCKED_BY_USER");
      const hasAlreadyWorkedReason =
        Array.isArray(result.reasonCodes) && result.reasonCodes.includes("CANDIDATE_DATE_ALREADY_WORKED");
      if (useGenericWorkedDayDetails && hasAlreadyWorkedReason) {
        lines.push(`<strong><span class="${statusClass}">${escapeHtml("Impossible")}</span></strong>`);
      } else {
        lines.push(
          `<strong>${escapeHtml(getDayDetailsShiftLabel(shiftType, result))}\u00A0: <span class="${statusClass}">${escapeHtml(statusLabel)}</span></strong>`
        );
      }
      lines.push(`<strong>Explication</strong>\u00A0: ${explanationLines[0]}`);
      explanationLines.slice(1).forEach((line) => {
        lines.push(line);
      });

      if (!isBlockedByUser) {
        if (result.rollingRule && Array.isArray(result.rollingRule.blockingWindows) && result.rollingRule.blockingWindows.length > 0) {
          formatBlockingWindowsSummary(result.rollingRule.blockingWindows).forEach((line) => {
            lines.push(escapeHtml(line));
          });
        }
      }

      if (state.debugMode) {
        lines.push(`Debug - reasonCodes : ${escapeHtml(result.reasonCodes.join(", ") || "NONE")}`);
        lines.push(`Debug - rolling : ${escapeHtml(formatJson(result.rollingRule))}`);
        lines.push(`Debug - repos : ${escapeHtml(formatJson(result.restRule))}`);
        lines.push(`Debug - compatibilité : ${escapeHtml(formatJson(result.compatibilityRule))}`);
      }
    });

    dayDetailsOutput.innerHTML = lines.join("\n");
  }

  function saveToLocalStorage() {
    const payload = {
      schedule: state.schedule,
      removedShift: state.removedShift,
      exchangeMode: state.exchangeMode,
      searchView: state.searchView,
      blockedRestDates: state.blockedRestDates,
      dayNotes: state.dayNotes,
      visibleMonthStart: formatDateString(state.visibleMonthStart),
      selectedDate: state.selectedDate,
      debugMode: state.debugMode,
      lastSelectedShiftType: state.lastSelectedShiftType,
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }

  function loadFromLocalStorage() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      state.schedule = Array.isArray(parsed.schedule) ? engine.sortSchedule(parsed.schedule) : [];
      state.removedShift = isExchangeableWorkedShift(parsed.removedShift) ? parsed.removedShift : null;
      state.exchangeMode = parsed.exchangeMode || "ANY";
      state.searchView = parsed.searchView === "HSP" ? "HSP" : "EXCHANGE";
      state.blockedRestDates = Array.isArray(parsed.blockedRestDates) ? parsed.blockedRestDates : [];
      state.dayNotes = sanitizeDayNotes(parsed.dayNotes);
      state.visibleMonthStart = parsed.visibleMonthStart ? parseDateString(parsed.visibleMonthStart) : getMonthStart(new Date());
      state.selectedDate = parsed.selectedDate || null;
      state.debugMode = Boolean(parsed.debugMode);
      state.lastSelectedShiftType =
        typeof parsed.lastSelectedShiftType === "string" && SHIFT_TYPE_LABELS[parsed.lastSelectedShiftType]
          ? parsed.lastSelectedShiftType
          : "JOUR_7_19";
    } catch (error) {
      console.error("Impossible de charger le localStorage :", error);
    }
  }

  function exportData() {
    const payload = {
      version: 1,
      schedule: state.schedule,
      removedShift: state.removedShift,
      exchangeMode: state.exchangeMode,
      searchView: state.searchView,
      blockedRestDates: state.blockedRestDates,
      dayNotes: state.dayNotes,
      visibleMonthStart: formatDateString(state.visibleMonthStart),
      debugMode: state.debugMode,
      lastSelectedShiftType: state.lastSelectedShiftType,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "echange-postes-export.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  function importData(payload) {
    if (!payload || typeof payload !== "object") {
      throw new Error("Fichier JSON invalide.");
    }

    state.schedule = Array.isArray(payload.schedule) ? engine.sortSchedule(payload.schedule) : [];
    state.removedShift = isExchangeableWorkedShift(payload.removedShift) ? payload.removedShift : null;
    state.exchangeMode = payload.exchangeMode || "ANY";
    state.searchView = payload.searchView === "HSP" ? "HSP" : "EXCHANGE";
    state.blockedRestDates = Array.isArray(payload.blockedRestDates) ? payload.blockedRestDates : [];
    state.dayNotes = sanitizeDayNotes(payload.dayNotes);
    state.visibleMonthStart = payload.visibleMonthStart ? parseDateString(payload.visibleMonthStart) : getMonthStart(new Date());
    state.selectedDate = null;
    state.debugMode = Boolean(payload.debugMode);
    state.lastSelectedShiftType =
      typeof payload.lastSelectedShiftType === "string" && SHIFT_TYPE_LABELS[payload.lastSelectedShiftType]
        ? payload.lastSelectedShiftType
        : "JOUR_7_19";

    saveToLocalStorage();
    renderAll();
  }

  function resetApplication() {
    state.schedule = [];
    state.removedShift = null;
    state.exchangeMode = "ANY";
    state.searchView = "EXCHANGE";
    state.blockedRestDates = [];
    state.dayNotes = {};
    state.selectedDate = null;
    state.debugMode = false;
    state.lastSelectedShiftType = "JOUR_7_19";
    state.visibleMonthStart = getMonthStart(new Date());
    closeShiftTypePicker();
    saveToLocalStorage();
    renderAll();
  }

  function renderAll() {
    exchangeModeInputs.forEach((input) => {
      input.checked = input.value === state.exchangeMode;
    });
    toggleDebugButton.textContent = `Mode debug : ${state.debugMode ? "ON" : "OFF"}`;
    computeVisibleCandidateStatuses();
    requestExchangeButton.disabled = !canOpenExchangeRequest();
    renderCalendar(state.visibleMonthStart);
    renderSummary();
    renderLegend();
    renderDetailsActions();
    renderDayDetails(state.selectedDate);
  }

  function populateShiftTypeSelect() {
    shiftTypeSelect.innerHTML = "";
    Object.keys(SHIFT_TYPE_LABELS).forEach((shiftType) => {
      const option = document.createElement("option");
      option.value = shiftType;
      option.textContent = SHIFT_TYPE_LABELS[shiftType];
      shiftTypeSelect.appendChild(option);
    });
  }

  prevMonthButton.addEventListener("click", () => {
    state.visibleMonthStart = new Date(
      state.visibleMonthStart.getFullYear(),
      state.visibleMonthStart.getMonth() - 1,
      1
    );
    saveToLocalStorage();
    renderAll();
  });

  nextMonthButton.addEventListener("click", () => {
    state.visibleMonthStart = new Date(
      state.visibleMonthStart.getFullYear(),
      state.visibleMonthStart.getMonth() + 1,
      1
    );
    saveToLocalStorage();
    renderAll();
  });

  helpButton.addEventListener("click", openHelpModal);
  requestExchangeButton.addEventListener("click", openRequestModal);
  clearRemovedButton.addEventListener("click", clearRemovedShift);
  mobileHspButton.addEventListener("click", () => {
    if (!state.selectedDate) {
      return;
    }
    toggleHspView();
  });

  settingsButton.addEventListener("click", (event) => {
    event.stopPropagation();
    setSettingsPanelOpen(settingsPanelBackdrop.classList.contains("hidden"));
  });

  settingsPanel.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  settingsPanelBackdrop.addEventListener("click", (event) => {
    if (event.target === settingsPanelBackdrop) {
      setSettingsPanelOpen(false);
    }
  });

  toggleDebugButton.addEventListener("click", () => {
    state.debugMode = !state.debugMode;
    setSettingsPanelOpen(false);
    saveToLocalStorage();
    renderAll();
  });

  resetButton.addEventListener("click", openResetConfirmModal);
  exportButton.addEventListener("click", () => {
    setSettingsPanelOpen(false);
    exportData();
  });

  importButton.addEventListener("click", () => {
    setSettingsPanelOpen(false);
    importFileInput.click();
  });
  importFileInput.addEventListener("change", async (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      importData(JSON.parse(text));
    } catch (error) {
      window.alert(`Import impossible : ${error.message}`);
    }
    importFileInput.value = "";
  });

  excelImportButton.addEventListener("click", () => {
    setSettingsPanelOpen(false);
    excelImportFileInput.click();
  });
  excelImportFileInput.addEventListener("change", async (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) {
      return;
    }

    try {
      importFileInput.value = "";
      await importExcelPlanningFile(file);
    } catch (error) {
      window.alert(`Import Excel impossible : ${error.message}`);
    }
    excelImportFileInput.value = "";
  });

  exchangeModeInputs.forEach((input) => {
    input.addEventListener("change", (event) => {
      setExchangeMode(event.target.value);
    });
  });

  saveShiftButton.addEventListener("click", () => {
    if (!state.pickerDate) {
      return;
    }

    if (isPickerBlockedRestActive()) {
      toggleBlockedRest(state.pickerDate, true);
      closeShiftTypePicker();
      return;
    }

    saveWorkedShift(state.pickerDate, shiftTypeSelect.value);
    closeShiftTypePicker();
  });

  deleteShiftButton.addEventListener("click", () => {
    if (!state.pickerDate) {
      return;
    }
    removeWorkedShift(state.pickerDate);
    closeShiftTypePicker();
  });

  selectRemovedButton.addEventListener("click", () => {
    if (!state.pickerDate) {
      return;
    }

    if (state.removedShift && state.removedShift.date === state.pickerDate) {
      clearRemovedShift();
      closeShiftTypePicker();
      return;
    }

    selectRemovedShift(state.pickerDate);
    closeShiftTypePicker();
  });

  blockedRestToggleButton.addEventListener("click", () => {
    if (!state.pickerDate) {
      return;
    }

    const nextBlockedState = !isPickerBlockedRestActive();
    toggleBlockedRest(state.pickerDate, nextBlockedState);
    closeShiftTypePicker();
  });

  freeNoteCheckbox.addEventListener("change", () => {
    if (!state.pickerDate) {
      return;
    }

    if (freeNoteCheckbox.checked) {
      openFreeNoteModal(state.pickerDate);
      return;
    }

    setDayNote(state.pickerDate, "");
  });

  editFreeNoteButton.addEventListener("click", () => {
    if (!state.pickerDate) {
      return;
    }
    openFreeNoteModal(state.pickerDate);
  });

  closePickerButton.addEventListener("click", closeShiftTypePicker);
  shiftPickerBackdrop.addEventListener("click", (event) => {
    if (event.target === shiftPickerBackdrop) {
      closeShiftTypePicker();
    }
  });

  copyRequestButton.addEventListener("click", () => {
    copyRequestText();
  });

  requestStartDateInput.addEventListener("change", refreshRequestText);
  requestEndDateInput.addEventListener("change", refreshRequestText);
  requestStartDateInput.addEventListener("change", clearActiveRequestRangeButtons);
  requestEndDateInput.addEventListener("change", clearActiveRequestRangeButtons);
  include1022Checkbox.addEventListener("change", refreshRequestText);
  include1123Checkbox.addEventListener("change", refreshRequestText);
  [
    ["ANY", requestModeAnyCheckbox],
    ["DAY", requestModeDayCheckbox],
    ["NIGHT", requestModeNightCheckbox],
  ].forEach(([mode, checkbox]) => {
    checkbox.addEventListener("change", () => {
      if (!checkbox.checked) {
        setRequestExchangeMode("ANY");
      } else {
        setRequestExchangeMode(mode);
      }
      syncRequestOptionStates();
      refreshRequestText();
    });
  });
  requestRangeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const days = Number(button.dataset.rangeDays);
      const useMonth = button.dataset.rangeMonth === "true";
      applyRequestRange(days, useMonth, button);
    });
  });

  closeRequestButton.addEventListener("click", closeRequestModal);
  requestModalBackdrop.addEventListener("click", (event) => {
    if (event.target === requestModalBackdrop) {
      closeRequestModal();
    }
  });
  closeHelpButton.addEventListener("click", closeHelpModal);
  helpModalBackdrop.addEventListener("click", (event) => {
    if (event.target === helpModalBackdrop) {
      closeHelpModal();
    }
  });
  confirmResetButton.addEventListener("click", () => {
    closeResetConfirmModal();
    resetApplication();
  });
  cancelResetButton.addEventListener("click", closeResetConfirmModal);
  resetConfirmBackdrop.addEventListener("click", (event) => {
    if (event.target === resetConfirmBackdrop) {
      closeResetConfirmModal();
    }
  });

  detailsEditButton.addEventListener("click", () => {
    if (!state.selectedDate) {
      return;
    }
    openShiftTypePicker(state.selectedDate);
  });

  detailsRemoveButton.addEventListener("click", () => {
    if (!state.selectedDate) {
      return;
    }
    removeWorkedShift(state.selectedDate);
  });

  detailsSelectRemovedButton.addEventListener("click", () => {
    if (!state.selectedDate) {
      return;
    }
    selectRemovedShift(state.selectedDate);
  });

  detailsHspButton.addEventListener("click", () => {
    if (!state.selectedDate) {
      return;
    }
    toggleHspView();
  });

  detailsToggleBlockedButton.addEventListener("click", () => {
    if (!state.selectedDate) {
      return;
    }
    const isBlocked = state.blockedRestDates.includes(state.selectedDate);
    toggleBlockedRest(state.selectedDate, !isBlocked);
  });

  saveFreeNoteButton.addEventListener("click", () => {
    if (!state.pickerDate) {
      return;
    }

    setDayNote(state.pickerDate, freeNoteInput.value);
    closeFreeNoteAndShiftPickers();
  });

  removeFreeNoteButton.addEventListener("click", () => {
    if (!state.pickerDate) {
      return;
    }

    setDayNote(state.pickerDate, "");
    closeFreeNoteModal();
  });

  closeFreeNoteButton.addEventListener("click", () => {
    updateFreeNoteControls(state.pickerDate);
    closeFreeNoteModal();
  });

  freeNoteModalBackdrop.addEventListener("click", (event) => {
    if (event.target === freeNoteModalBackdrop) {
      updateFreeNoteControls(state.pickerDate);
      closeFreeNoteModal();
    }
  });

  freeNoteInput.addEventListener("input", () => {
    const limitedValue = limitFreeNoteLength(freeNoteInput.value);
    if (freeNoteInput.value !== limitedValue) {
      freeNoteInput.value = limitedValue;
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (!shiftPickerBackdrop.classList.contains("hidden")) {
        closeShiftTypePicker();
      }
      if (!freeNoteModalBackdrop.classList.contains("hidden")) {
        updateFreeNoteControls(state.pickerDate);
        closeFreeNoteModal();
      }
      if (!requestModalBackdrop.classList.contains("hidden")) {
        closeRequestModal();
      }
      if (!helpModalBackdrop.classList.contains("hidden")) {
        closeHelpModal();
      }
      if (!resetConfirmBackdrop.classList.contains("hidden")) {
        closeResetConfirmModal();
      }
      if (!settingsPanelBackdrop.classList.contains("hidden")) {
        setSettingsPanelOpen(false);
      }
    }
  });

  document.addEventListener("click", () => {
    if (!settingsPanelBackdrop.classList.contains("hidden")) {
      setSettingsPanelOpen(false);
    }
  });

  const handleViewportChange = () => {
    renderAll();
  };
  MOBILE_LAYOUT_MEDIA_QUERY.addEventListener("change", handleViewportChange);
  MOBILE_INTERACTION_MEDIA_QUERY.addEventListener("change", handleViewportChange);

  populateShiftTypeSelect();
  loadFromLocalStorage();
  computeVisibleCandidateStatuses();
  renderAll();

  window.exchangeApp = {
    renderCalendar,
    renderMonth,
    getDayCellState,
    handleDayClick,
    openShiftTypePicker,
    saveWorkedShift,
    removeWorkedShift,
    selectRemovedShift,
    clearRemovedShift,
    setExchangeMode,
    toggleHspView,
    computeVisibleCandidateStatuses,
    renderDayDetails,
    renderLegend,
    renderSummary,
    saveToLocalStorage,
    loadFromLocalStorage,
    exportData,
    importData,
    importExcelPlanningFile,
    parseExcelPlanningWorkbook,
  };
})();
