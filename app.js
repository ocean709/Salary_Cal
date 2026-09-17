/**
 * Real-Time Salary Tracker & Evaluator (월루 계산기)
 * Author: Antigravity AI
 * Core Logic & Live Rendering Engine with Full Schedule Customization
 */

// Global State & Settings
const state = {
  annualSalary: 100000000,
  workStart: "08:30",
  lunchStart: "11:30",
  lunchEnd: "13:00",
  workEnd: "18:00",
  hasLunch: true,
  workDays: [1, 2, 3, 4, 5], // 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat, 0=Sun
  currentTab: "monthly", // 'monthly' | 'annual' | 'daily'
  simMode: false,
  simTimeSeconds: 0, // Used for simulation tick
};

// Load saved settings from LocalStorage if available
function loadSettings() {
  const saved = localStorage.getItem("salaryTrackerSettings");
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      const savedSalary = Number(parsed.annualSalary);
      state.annualSalary = (savedSalary && savedSalary !== 67400000) ? savedSalary : 100000000;
      state.workStart = parsed.workStart || "08:30";
      state.lunchStart = parsed.lunchStart || "11:30";
      state.lunchEnd = parsed.lunchEnd || "13:00";
      state.workEnd = parsed.workEnd || "18:00";
      state.hasLunch = parsed.hasLunch !== undefined ? Boolean(parsed.hasLunch) : true;
      if (Array.isArray(parsed.workDays) && parsed.workDays.length > 0) {
        state.workDays = parsed.workDays.map(Number);
      }
    } catch (e) {
      console.error("Failed to load settings from storage", e);
    }
  }
}

function saveSettings() {
  localStorage.setItem("salaryTrackerSettings", JSON.stringify({
    annualSalary: state.annualSalary,
    workStart: state.workStart,
    lunchStart: state.lunchStart,
    lunchEnd: state.lunchEnd,
    workEnd: state.workEnd,
    hasLunch: state.hasLunch,
    workDays: state.workDays,
  }));
}

// Utility: Time String "HH:MM" to seconds from midnight
function parseTimeToSeconds(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(":").map(Number);
  return h * 3600 + m * 60;
}

// Calculate Helper Rates based on current state
function getRates() {
  const annual = state.annualSalary;
  const monthly = annual / 12;
  const daysPerWeek = Math.max(1, state.workDays.length);
  const workDaysPerYear = daysPerWeek * 52; // e.g. 5 days * 52 = 260 days
  const daily = annual / workDaysPerYear;

  const startSec = parseTimeToSeconds(state.workStart);
  const lunchStartSec = parseTimeToSeconds(state.lunchStart);
  const lunchEndSec = parseTimeToSeconds(state.lunchEnd);
  const endSec = parseTimeToSeconds(state.workEnd);

  let morningWorkSec = 0;
  let afternoonWorkSec = 0;
  let totalDailyWorkSec = 0;

  if (state.hasLunch && lunchStartSec > startSec && lunchEndSec > lunchStartSec) {
    morningWorkSec = Math.max(0, lunchStartSec - startSec);
    afternoonWorkSec = Math.max(0, endSec - lunchEndSec);
    totalDailyWorkSec = morningWorkSec + afternoonWorkSec;
  } else {
    morningWorkSec = Math.max(0, endSec - startSec);
    afternoonWorkSec = 0;
    totalDailyWorkSec = morningWorkSec;
  }

  const hourly = totalDailyWorkSec > 0 ? daily / (totalDailyWorkSec / 3600) : 0;
  const perMin = hourly / 60;
  const perSec = totalDailyWorkSec > 0 ? daily / totalDailyWorkSec : 0;

  return {
    annual,
    monthly,
    daily,
    hourly,
    perMin,
    perSec,
    startSec,
    lunchStartSec,
    lunchEndSec,
    endSec,
    morningWorkSec,
    afternoonWorkSec,
    totalDailyWorkSec,
    daysPerWeek,
    workDaysPerYear,
  };
}

// Determine Current Work Status for a given time
function getWorkStatus(nowDate, rates) {
  if (state.simMode) {
    return {
      status: "WORKING",
      text: `🎮 시뮬레이션 근무 중 (+${rates.perSec.toFixed(2)}원/초 적립 중)`,
      badgeClass: "status-sim",
      isWorking: true,
    };
  }

  const dayOfWeek = nowDate.getDay(); // 0 = Sun, 6 = Sat
  if (!state.workDays.includes(dayOfWeek)) {
    return {
      status: "WEEKEND",
      text: "🏖️ 휴무일 (오늘 수익 적립 완료)",
      badgeClass: "status-offwork",
      isWorking: false,
    };
  }

  const currentSec = nowDate.getHours() * 3600 + nowDate.getMinutes() * 60 + nowDate.getSeconds() + nowDate.getMilliseconds() / 1000;

  if (currentSec < rates.startSec) {
    return {
      status: "BEFORE_WORK",
      text: "🌙 출근 전 (근무 대기 중)",
      badgeClass: "status-offwork",
      isWorking: false,
    };
  } else if (state.hasLunch && currentSec >= rates.lunchStartSec && currentSec < rates.lunchEndSec) {
    return {
      status: "LUNCH_BREAK",
      text: "🍱 점심 & 휴식 시간 (적립 일시정지)",
      badgeClass: "status-break",
      isWorking: false,
    };
  } else if (currentSec >= rates.startSec && currentSec < rates.endSec) {
    return {
      status: "WORKING",
      text: `🟢 근무 중 (초당 ${rates.perSec.toFixed(2)}원 적립 중)`,
      badgeClass: "status-working",
      isWorking: true,
    };
  } else {
    return {
      status: "AFTER_WORK",
      text: "🌙 퇴근! (오늘 일급 100% 적립 완료)",
      badgeClass: "status-offwork",
      isWorking: false,
    };
  }
}

// Compute Elapsed Work Seconds for today
function getElapsedWorkSecondsToday(nowDate, rates) {
  if (state.simMode) {
    return rates.totalDailyWorkSec > 0 ? (state.simTimeSeconds % rates.totalDailyWorkSec) : 0;
  }

  const dayOfWeek = nowDate.getDay();
  if (!state.workDays.includes(dayOfWeek)) {
    return rates.totalDailyWorkSec; // Full day earned on non-work days
  }

  const currentSec = nowDate.getHours() * 3600 + nowDate.getMinutes() * 60 + nowDate.getSeconds() + nowDate.getMilliseconds() / 1000;

  if (currentSec <= rates.startSec) {
    return 0;
  } else if (currentSec >= rates.endSec) {
    return rates.totalDailyWorkSec;
  }

  if (!state.hasLunch) {
    return Math.min(rates.totalDailyWorkSec, currentSec - rates.startSec);
  }

  if (currentSec > rates.startSec && currentSec <= rates.lunchStartSec) {
    return currentSec - rates.startSec;
  } else if (currentSec > rates.lunchStartSec && currentSec <= rates.lunchEndSec) {
    return rates.morningWorkSec;
  } else if (currentSec > rates.lunchEndSec && currentSec <= rates.endSec) {
    return rates.morningWorkSec + (currentSec - rates.lunchEndSec);
  } else {
    return rates.totalDailyWorkSec;
  }
}

// Calculate work days in a specific month based on selected state.workDays
function getWorkDaysInMonth(year, month) {
  const totalDays = new Date(year, month + 1, 0).getDate();
  let workDays = 0;
  for (let day = 1; day <= totalDays; day++) {
    const d = new Date(year, month, day).getDay();
    if (state.workDays.includes(d)) workDays++;
  }
  return workDays;
}

// Calculate work days elapsed in current month up to yesterday
function getPastWorkDaysInMonth(nowDate) {
  const year = nowDate.getFullYear();
  const month = nowDate.getMonth();
  const currentDay = nowDate.getDate();
  let pastDays = 0;
  for (let day = 1; day < currentDay; day++) {
    const d = new Date(year, month, day).getDay();
    if (state.workDays.includes(d)) pastDays++;
  }
  return pastDays;
}

// Format numbers with commas and decimals
function formatCurrencyParts(val) {
  const num = Math.max(0, val);
  const intPart = Math.floor(num).toLocaleString("ko-KR");
  const decPart = (num % 1).toFixed(2).substring(2);
  return { intPart, decPart, full: intPart + "." + decPart };
}

// Format Time Seconds to HH:MM:SS
function formatTimeHMS(dateObj) {
  const h = String(dateObj.getHours()).padStart(2, "0");
  const m = String(dateObj.getMinutes()).padStart(2, "0");
  const s = String(dateObj.getSeconds()).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

// Primary Render Loop
function updateUI() {
  const now = new Date();
  const rates = getRates();

  if (state.simMode) {
    state.simTimeSeconds += 0.05; // 20 updates/sec -> +1 sec per real sec
  }

  // 1. Clock & Rates Update
  const timeDisplay = document.getElementById("currentTimeDisplay");
  if (timeDisplay) timeDisplay.textContent = formatTimeHMS(now);

  const rateDisplay = document.getElementById("perSecondRateDisplay");
  if (rateDisplay) rateDisplay.textContent = `+${rates.perSec.toFixed(2)} 원 / 초`;

  // 2. Schedule Banner Update
  const scheduleDisplay = document.getElementById("scheduleStatusDisplay");
  if (scheduleDisplay) {
    const totalDailyHours = (rates.totalDailyWorkSec / 3600).toFixed(1);
    const breakHoursText = state.hasLunch 
      ? `, 휴식 ${((rates.lunchEndSec - rates.lunchStartSec) / 3600).toFixed(1)}h`
      : "";
    scheduleDisplay.textContent = `주${rates.daysPerWeek}일 (${state.workStart} ~ ${state.workEnd}${breakHoursText} | 일 ${totalDailyHours}시간)`;
  }

  // 3. Status Badge Update
  const statusInfo = getWorkStatus(now, rates);
  const badgeEl = document.getElementById("liveStatusBadge");
  const statusTextEl = document.getElementById("statusText");
  if (badgeEl && statusTextEl) {
    badgeEl.className = `status-badge ${statusInfo.badgeClass}`;
    statusTextEl.textContent = statusInfo.text;
  }

  // 4. Calculate Today's Work Earnings
  const elapsedSecToday = getElapsedWorkSecondsToday(now, rates);
  const todayEarned = elapsedSecToday * rates.perSec;

  // 5. Update Main Counter & Progress Bar based on Active Tab
  let mainVal = 0;
  let targetVal = 0;
  let percent = 0;
  let heroBadgeText = "";
  let heroTitleText = "";
  let progressTitleText = "";
  let startLabelText = "";
  let targetLabelText = "";

  if (state.currentTab === "monthly") {
    heroBadgeText = "월급 (Monthly)";
    heroTitleText = "이번 달 현재까지의 실시간 적립 월급";
    progressTitleText = "이번 달 근무 달성률";

    const totalWorkDaysInMonth = Math.max(1, getWorkDaysInMonth(now.getFullYear(), now.getMonth()));
    const pastWorkDays = getPastWorkDaysInMonth(now);
    const todayFraction = rates.totalDailyWorkSec > 0 ? Math.min(1, elapsedSecToday / rates.totalDailyWorkSec) : 0;

    targetVal = rates.monthly;
    mainVal = (pastWorkDays + todayFraction) * rates.daily;
    percent = (mainVal / targetVal) * 100;

    startLabelText = `${now.getMonth() + 1}월 1일 (0원)`;
    targetLabelText = `목표 월급: ₩${Math.round(targetVal).toLocaleString()}`;
  } else if (state.currentTab === "annual") {
    heroBadgeText = "연봉 (Annual)";
    heroTitleText = "올해 현재까지의 실시간 적립 연봉";
    progressTitleText = "올해 연봉 목표 달성률";

    const startOfYear = new Date(now.getFullYear(), 0, 1);
    let pastWorkDaysYear = 0;
    const tempDate = new Date(startOfYear);
    while (tempDate < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
      const d = tempDate.getDay();
      if (state.workDays.includes(d)) pastWorkDaysYear++;
      tempDate.setDate(tempDate.getDate() + 1);
    }
    const todayFraction = rates.totalDailyWorkSec > 0 ? Math.min(1, elapsedSecToday / rates.totalDailyWorkSec) : 0;

    targetVal = rates.annual;
    mainVal = (pastWorkDaysYear + todayFraction) * rates.daily;
    percent = (mainVal / targetVal) * 100;

    startLabelText = `${now.getFullYear()}년 1월 1일 (0원)`;
    targetLabelText = `기준 연봉: ₩${Math.round(targetVal).toLocaleString()}`;
  } else { // 'daily'
    heroBadgeText = "일급 (Daily)";
    heroTitleText = `오늘 ${(rates.totalDailyWorkSec/3600).toFixed(1)}시간 근무 동안 실시간 적립 일급`;
    progressTitleText = `오늘 하루 ${(rates.totalDailyWorkSec/3600).toFixed(1)}시간 근무 진행률`;

    targetVal = rates.daily;
    mainVal = todayEarned;
    percent = rates.totalDailyWorkSec > 0 ? (elapsedSecToday / rates.totalDailyWorkSec) * 100 : 0;

    startLabelText = `출근 (${state.workStart})`;
    targetLabelText = `오늘 목표 일급: ₩${Math.round(targetVal).toLocaleString()}`;
  }

  // Render Counter Numbers
  const mainParts = formatCurrencyParts(mainVal);
  const intEl = document.getElementById("mainCounterInt");
  const decEl = document.getElementById("mainCounterDec");
  if (intEl) intEl.textContent = mainParts.intPart;
  if (decEl) decEl.textContent = mainParts.decPart;

  // Render Today Sub-counter
  const todayEarnedEl = document.getElementById("todayEarnedDisplay");
  if (todayEarnedEl) {
    todayEarnedEl.textContent = `+₩ ${formatCurrencyParts(todayEarned).full}`;
  }

  // Render Hero Header Badges
  const heroBadgeEl = document.getElementById("heroBadge");
  const heroTitleEl = document.getElementById("heroTitle");
  if (heroBadgeEl) heroBadgeEl.textContent = heroBadgeText;
  if (heroTitleEl) heroTitleEl.textContent = heroTitleText;

  // Render Progress Bar
  const clampPercent = Math.min(100, Math.max(0, percent));
  const progressFillEl = document.getElementById("progressBarFill");
  const progressPercentEl = document.getElementById("progressPercent");
  const progressTitleEl = document.getElementById("progressTitle");
  const startLabelEl = document.getElementById("progressStartLabel");
  const targetLabelEl = document.getElementById("progressTargetLabel");

  if (progressFillEl) progressFillEl.style.width = `${clampPercent.toFixed(2)}%`;
  if (progressPercentEl) progressPercentEl.textContent = `${clampPercent.toFixed(2)}%`;
  if (progressTitleEl) progressTitleEl.textContent = progressTitleText;
  if (startLabelEl) startLabelEl.textContent = startLabelText;
  if (targetLabelEl) targetLabelEl.textContent = targetLabelText;

  // 6. Update Rates Breakdown Card
  const ratePerSecEl = document.getElementById("ratePerSec");
  const ratePerMinEl = document.getElementById("ratePerMin");
  const ratePerHourEl = document.getElementById("ratePerHour");
  const ratePerDayEl = document.getElementById("ratePerDay");

  if (ratePerSecEl) ratePerSecEl.textContent = `₩ ${rates.perSec.toFixed(2)} 원`;
  if (ratePerMinEl) ratePerMinEl.textContent = `₩ ${rates.perMin.toFixed(2)} 원`;
  if (ratePerHourEl) ratePerHourEl.textContent = `₩ ${Math.round(rates.hourly).toLocaleString()} 원`;
  if (ratePerDayEl) ratePerDayEl.textContent = `₩ ${Math.round(rates.daily).toLocaleString()} 원`;

  // 7. Dynamic Timeline Card Step Updates
  const stepStart = document.getElementById("stepStart");
  const stepLunch = document.getElementById("stepLunch");
  const stepEnd = document.getElementById("stepEnd");

  if (stepStart) {
    stepStart.querySelector(".step-time").textContent = state.workStart;
  }
  if (stepLunch) {
    if (state.hasLunch) {
      stepLunch.style.display = "flex";
      stepLunch.querySelector(".step-time").textContent = `${state.lunchStart} ~ ${state.lunchEnd}`;
    } else {
      stepLunch.style.display = "none";
    }
  }
  if (stepEnd) {
    stepEnd.querySelector(".step-time").textContent = state.workEnd;
    stepEnd.querySelector(".step-name").textContent = `퇴근 (총 ${(rates.totalDailyWorkSec/3600).toFixed(1)}시간 소요)`;
  }

  // 8. Update Timeline Summary Box
  const todayEarnedSumEl = document.getElementById("todayEarnedSum");
  if (todayEarnedSumEl) todayEarnedSumEl.textContent = `₩ ${Math.round(todayEarned).toLocaleString()}`;

  const remainingSec = Math.max(0, rates.totalDailyWorkSec - elapsedSecToday);
  const remHours = Math.floor(remainingSec / 3600);
  const remMins = Math.floor((remainingSec % 3600) / 60);
  const remTimeEl = document.getElementById("remainingTimeText");
  if (remTimeEl) {
    if (remainingSec <= 0) {
      remTimeEl.textContent = "퇴근 완료 🎉";
    } else {
      remTimeEl.textContent = `${remHours}시간 ${remMins}분`;
    }
  }

  // 9. Update Milestones
  updateMilestone("Coffee", 4500, todayEarned, rates);
  updateMilestone("Lunch", 12000, todayEarned, rates);
  updateMilestone("Chicken", 22000, todayEarned, rates);
  updateMilestone("Airpods", 250000, todayEarned, rates);

  // Loop next frame
  requestAnimationFrame(updateUI);
}

// Milestone Helper
function updateMilestone(key, cost, currentEarnedToday, rates) {
  const timeEl = document.getElementById(`timeFor${key}`);
  const statusEl = document.getElementById(`statusFor${key}`);

  if (!timeEl || !statusEl) return;
  if (rates.perSec <= 0) {
    timeEl.textContent = "설정 필요";
    statusEl.innerHTML = `<span class="status-badge-mini">대기</span>`;
    return;
  }

  const reqSeconds = cost / rates.perSec;
  const mins = Math.floor(reqSeconds / 60);
  const secs = Math.floor(reqSeconds % 60);

  let timeText = "";
  if (mins >= 60) {
    const hrs = (mins / 60).toFixed(1);
    timeText = `약 ${hrs}시간 근무`;
  } else {
    timeText = `약 ${mins}분 ${secs}초 근무`;
  }
  timeEl.textContent = timeText;

  if (currentEarnedToday >= cost) {
    statusEl.innerHTML = `<span class="status-badge-mini" style="background: rgba(16,185,129,0.2); color: #10b981;">✓ 달성 완료</span>`;
  } else {
    const needMore = cost - currentEarnedToday;
    statusEl.innerHTML = `<span class="status-badge-mini" style="background: rgba(255,255,255,0.06); color: #94a3b8;">차액 ₩${Math.round(needMore).toLocaleString()}</span>`;
  }
}

// Recalculate and update the live summary inside the settings modal
function updateModalSummary() {
  const startStr = document.getElementById("inputWorkStart").value;
  const endStr = document.getElementById("inputWorkEnd").value;
  const hasLunch = document.getElementById("inputHasLunch").checked;
  const lunchStartStr = document.getElementById("inputLunchStart").value;
  const lunchEndStr = document.getElementById("inputLunchEnd").value;

  const startSec = parseTimeToSeconds(startStr);
  const endSec = parseTimeToSeconds(endStr);
  const lunchStartSec = parseTimeToSeconds(lunchStartStr);
  const lunchEndSec = parseTimeToSeconds(lunchEndStr);

  let totalSec = 0;
  if (hasLunch && lunchStartSec > startSec && lunchEndSec > lunchStartSec) {
    totalSec = Math.max(0, lunchStartSec - startSec) + Math.max(0, endSec - lunchEndSec);
  } else {
    totalSec = Math.max(0, endSec - startSec);
  }

  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);

  const activeDays = document.querySelectorAll(".day-pill.active").length;
  const weeklyHours = (totalSec / 3600 * activeDays).toFixed(1);

  const summaryEl = document.getElementById("modalCalcSummary");
  if (summaryEl) {
    summaryEl.textContent = `일일 실근무 ${hrs}시간 ${mins}분 (주 ${activeDays}일, 총 ${weeklyHours}시간/주)`;
  }
}

// Event Listeners Initialization
function initEvents() {
  // Tabs Navigation
  const tabs = document.querySelectorAll(".tab-btn");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      state.currentTab = tab.dataset.tab;
    });
  });

  // Simulation Mode Toggle Button
  const simBtn = document.getElementById("simModeBtn");
  const simBtnText = document.getElementById("simBtnText");
  if (simBtn) {
    simBtn.addEventListener("click", () => {
      state.simMode = !state.simMode;
      if (state.simMode) {
        simBtn.classList.add("btn-primary");
        simBtn.classList.remove("btn-glass");
        if (simBtnText) simBtnText.textContent = "시뮬레이션 ON";
      } else {
        simBtn.classList.remove("btn-primary");
        simBtn.classList.add("btn-glass");
        if (simBtnText) simBtnText.textContent = "시뮬레이션 모드 OFF";
      }
    });
  }

  // Modal Open / Close
  const settingsModal = document.getElementById("settingsModal");
  const openModalBtn = document.getElementById("openSettingsBtn");
  const closeModalBtn = document.getElementById("closeSettingsBtn");
  const settingsForm = document.getElementById("settingsForm");
  const resetBtn = document.getElementById("resetSettingsBtn");

  if (openModalBtn && settingsModal) {
    openModalBtn.addEventListener("click", () => {
      document.getElementById("inputAnnualSalary").value = state.annualSalary;
      document.getElementById("inputWorkStart").value = state.workStart;
      document.getElementById("inputWorkEnd").value = state.workEnd;
      document.getElementById("inputLunchStart").value = state.lunchStart;
      document.getElementById("inputLunchEnd").value = state.lunchEnd;
      document.getElementById("inputHasLunch").checked = state.hasLunch;

      // Update lunch row visibility
      const lunchRow = document.getElementById("lunchRow");
      if (lunchRow) lunchRow.style.display = state.hasLunch ? "grid" : "none";

      // Set Day Pills active state
      const dayPills = document.querySelectorAll(".day-pill");
      dayPills.forEach((pill) => {
        const d = Number(pill.dataset.day);
        if (state.workDays.includes(d)) {
          pill.classList.add("active");
        } else {
          pill.classList.remove("active");
        }
      });

      updateModalSummary();
      settingsModal.classList.add("open");
    });
  }

  if (closeModalBtn && settingsModal) {
    closeModalBtn.addEventListener("click", () => {
      settingsModal.classList.remove("open");
    });
  }

  if (settingsModal) {
    settingsModal.addEventListener("click", (e) => {
      if (e.target === settingsModal) {
        settingsModal.classList.remove("open");
      }
    });
  }

  // Lunch Checkbox Toggle
  const hasLunchCheckbox = document.getElementById("inputHasLunch");
  if (hasLunchCheckbox) {
    hasLunchCheckbox.addEventListener("change", (e) => {
      const lunchRow = document.getElementById("lunchRow");
      if (lunchRow) lunchRow.style.display = e.target.checked ? "grid" : "none";
      updateModalSummary();
    });
  }

  // Day Pills Click Listener
  const dayPills = document.querySelectorAll(".day-pill");
  dayPills.forEach((pill) => {
    pill.addEventListener("click", () => {
      pill.classList.toggle("active");
      updateModalSummary();
    });
  });

  // Time Inputs Change Listener
  const timeInputs = ["inputWorkStart", "inputWorkEnd", "inputLunchStart", "inputLunchEnd"];
  timeInputs.forEach((id) => {
    const input = document.getElementById(id);
    if (input) input.addEventListener("input", updateModalSummary);
  });

  // Preset Buttons Click Listener
  const presetBtns = document.querySelectorAll(".preset-btn");
  presetBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      presetBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      const preset = btn.dataset.preset;
      if (preset === "standard") {
        document.getElementById("inputWorkStart").value = "08:30";
        document.getElementById("inputWorkEnd").value = "18:00";
        document.getElementById("inputLunchStart").value = "11:30";
        document.getElementById("inputLunchEnd").value = "13:00";
        document.getElementById("inputHasLunch").checked = true;
      } else if (preset === "nine6") {
        document.getElementById("inputWorkStart").value = "09:00";
        document.getElementById("inputWorkEnd").value = "18:00";
        document.getElementById("inputLunchStart").value = "12:00";
        document.getElementById("inputLunchEnd").value = "13:00";
        document.getElementById("inputHasLunch").checked = true;
      } else if (preset === "eight5") {
        document.getElementById("inputWorkStart").value = "08:00";
        document.getElementById("inputWorkEnd").value = "17:00";
        document.getElementById("inputLunchStart").value = "12:00";
        document.getElementById("inputLunchEnd").value = "13:00";
        document.getElementById("inputHasLunch").checked = true;
      } else if (preset === "ten7") {
        document.getElementById("inputWorkStart").value = "10:00";
        document.getElementById("inputWorkEnd").value = "19:00";
        document.getElementById("inputLunchStart").value = "13:00";
        document.getElementById("inputLunchEnd").value = "14:00";
        document.getElementById("inputHasLunch").checked = true;
      }

      const lunchRow = document.getElementById("lunchRow");
      if (lunchRow) lunchRow.style.display = "grid";

      updateModalSummary();
    });
  });

  // Save Settings
  if (settingsForm) {
    settingsForm.addEventListener("submit", (e) => {
      e.preventDefault();
      state.annualSalary = Number(document.getElementById("inputAnnualSalary").value) || 100000000;
      state.workStart = document.getElementById("inputWorkStart").value;
      state.workEnd = document.getElementById("inputWorkEnd").value;
      state.lunchStart = document.getElementById("inputLunchStart").value;
      state.lunchEnd = document.getElementById("inputLunchEnd").value;
      state.hasLunch = document.getElementById("inputHasLunch").checked;

      const activePills = document.querySelectorAll(".day-pill.active");
      const selectedDays = Array.from(activePills).map((p) => Number(p.dataset.day));
      state.workDays = selectedDays.length > 0 ? selectedDays : [1, 2, 3, 4, 5];

      saveSettings();
      settingsModal.classList.remove("open");
    });
  }

  // Reset Settings
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      state.annualSalary = 100000000;
      state.workStart = "08:30";
      state.lunchStart = "11:30";
      state.lunchEnd = "13:00";
      state.workEnd = "18:00";
      state.hasLunch = true;
      state.workDays = [1, 2, 3, 4, 5];

      document.getElementById("inputAnnualSalary").value = state.annualSalary;
      document.getElementById("inputWorkStart").value = state.workStart;
      document.getElementById("inputWorkEnd").value = state.workEnd;
      document.getElementById("inputLunchStart").value = state.lunchStart;
      document.getElementById("inputLunchEnd").value = state.lunchEnd;
      document.getElementById("inputHasLunch").checked = true;

      const dayPills = document.querySelectorAll(".day-pill");
      dayPills.forEach((p) => {
        const d = Number(p.dataset.day);
        if ([1, 2, 3, 4, 5].includes(d)) p.classList.add("active");
        else p.classList.remove("active");
      });

      const lunchRow = document.getElementById("lunchRow");
      if (lunchRow) lunchRow.style.display = "grid";

      updateModalSummary();
      saveSettings();
    });
  }
}

// Initialize Application
document.addEventListener("DOMContentLoaded", () => {
  loadSettings();
  initEvents();

  // Start Animation Loop
  requestAnimationFrame(updateUI);
});
