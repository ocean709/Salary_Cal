/**
 * Real-Time Salary Tracker & Evaluator
 * Author: Antigravity AI
 * Core Logic & Live Rendering Engine
 */

// Global State & Settings
const state = {
  annualSalary: 100000000,
  workStart: "08:30",
  lunchStart: "11:30",
  lunchEnd: "13:00",
  workEnd: "18:00",
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
  }));
}

// Utility: Time String "HH:MM" to seconds from midnight
function parseTimeToSeconds(timeStr) {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 3600 + m * 60;
}

// Calculate Helper Rates
function getRates() {
  const annual = state.annualSalary;
  const monthly = annual / 12;
  const workDaysPerYear = 260; // 52 weeks * 5 days
  const daily = annual / workDaysPerYear; // 259,230.77 KRW

  const startSec = parseTimeToSeconds(state.workStart);
  const lunchStartSec = parseTimeToSeconds(state.lunchStart);
  const lunchEndSec = parseTimeToSeconds(state.lunchEnd);
  const endSec = parseTimeToSeconds(state.workEnd);

  // Active work seconds in one day
  const morningWorkSec = Math.max(0, lunchStartSec - startSec);
  const afternoonWorkSec = Math.max(0, endSec - lunchEndSec);
  const totalDailyWorkSec = morningWorkSec + afternoonWorkSec; // Default 28,800 sec (8 hours)

  const hourly = daily / (totalDailyWorkSec / 3600); // Daily / 8h
  const perMin = hourly / 60;
  const perSec = totalDailyWorkSec > 0 ? daily / totalDailyWorkSec : 0; // ~9.001 KRW/sec

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
  };
}

// Determine Current Work Status for a given time
function getWorkStatus(nowDate, rates) {
  if (state.simMode) {
    return {
      status: "WORKING",
      text: "🎮 시뮬레이션 근무 중 (+9.00원/초 적립 중)",
      badgeClass: "status-sim",
      isWorking: true,
    };
  }

  const dayOfWeek = nowDate.getDay(); // 0 = Sun, 6 = Sat
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return {
      status: "WEEKEND",
      text: "🏖️ 주말 (휴무일 - 오늘 수익 적립 완료)",
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
  } else if (currentSec >= rates.startSec && currentSec < rates.lunchStartSec) {
    return {
      status: "MORNING_WORK",
      text: "🟢 오전 근무 중 (초당 수익 적립 중)",
      badgeClass: "status-working",
      isWorking: true,
    };
  } else if (currentSec >= rates.lunchStartSec && currentSec < rates.lunchEndSec) {
    return {
      status: "LUNCH_BREAK",
      text: "🍱 점심 & 휴식 시간 (적립 일시정지)",
      badgeClass: "status-break",
      isWorking: false,
    };
  } else if (currentSec >= rates.lunchEndSec && currentSec < rates.endSec) {
    return {
      status: "AFTERNOON_WORK",
      text: "🟢 오후 근무 중 (초당 수익 적립 중)",
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
    // In simulation mode, cycle through a work day (0 to totalDailyWorkSec)
    return state.simTimeSeconds % rates.totalDailyWorkSec;
  }

  const dayOfWeek = nowDate.getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return rates.totalDailyWorkSec; // Full day earned for weekend display
  }

  const currentSec = nowDate.getHours() * 3600 + nowDate.getMinutes() * 60 + nowDate.getSeconds() + nowDate.getMilliseconds() / 1000;

  if (currentSec <= rates.startSec) {
    return 0;
  } else if (currentSec > rates.startSec && currentSec <= rates.lunchStartSec) {
    return currentSec - rates.startSec;
  } else if (currentSec > rates.lunchStartSec && currentSec <= rates.lunchEndSec) {
    return rates.morningWorkSec; // Cap at end of morning
  } else if (currentSec > rates.lunchEndSec && currentSec <= rates.endSec) {
    return rates.morningWorkSec + (currentSec - rates.lunchEndSec);
  } else {
    return rates.totalDailyWorkSec; // 100% finished
  }
}

// Calculate work days in a specific month
function getWorkDaysInMonth(year, month) {
  const totalDays = new Date(year, month + 1, 0).getDate();
  let workDays = 0;
  for (let day = 1; day <= totalDays; day++) {
    const d = new Date(year, month, day).getDay();
    if (d !== 0 && d !== 6) workDays++;
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
    if (d !== 0 && d !== 6) pastDays++;
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

  // If simulation mode, advance simTimeSeconds
  if (state.simMode) {
    state.simTimeSeconds += 0.05; // 20 updates/sec -> +1 sec per real sec
  }

  // 1. Banner Clock & Rates Update
  const timeDisplay = document.getElementById("currentTimeDisplay");
  if (timeDisplay) timeDisplay.textContent = formatTimeHMS(now);

  const rateDisplay = document.getElementById("perSecondRateDisplay");
  if (rateDisplay) rateDisplay.textContent = `+${rates.perSec.toFixed(2)} 원 / 초`;

  // 2. Status Badge Update
  const statusInfo = getWorkStatus(now, rates);
  const badgeEl = document.getElementById("liveStatusBadge");
  const statusTextEl = document.getElementById("statusText");
  if (badgeEl && statusTextEl) {
    badgeEl.className = `status-badge ${statusInfo.badgeClass}`;
    statusTextEl.textContent = statusInfo.text;
  }

  // 3. Calculate Today's Work Earnings
  const elapsedSecToday = getElapsedWorkSecondsToday(now, rates);
  const todayEarned = elapsedSecToday * rates.perSec;

  // 4. Update Main Counter & Progress Bar based on Active Tab
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

    const totalWorkDaysInMonth = getWorkDaysInMonth(now.getFullYear(), now.getMonth());
    const pastWorkDays = getPastWorkDaysInMonth(now);
    const todayFraction = Math.min(1, elapsedSecToday / rates.totalDailyWorkSec);

    targetVal = rates.monthly;
    // Earned = (past work days + today fraction) * daily rate
    mainVal = (pastWorkDays + todayFraction) * rates.daily;
    percent = (mainVal / targetVal) * 100;

    startLabelText = `${now.getMonth() + 1}월 1일 (0원)`;
    targetLabelText = `목표 월급: ₩${Math.round(targetVal).toLocaleString()}`;
  } else if (state.currentTab === "annual") {
    heroBadgeText = "연봉 (Annual)";
    heroTitleText = "올해 현재까지의 실시간 적립 연봉";
    progressTitleText = "올해 연봉 목표 달성률";

    // Estimate elapsed work days in year
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    let pastWorkDaysYear = 0;
    const tempDate = new Date(startOfYear);
    while (tempDate < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
      const d = tempDate.getDay();
      if (d !== 0 && d !== 6) pastWorkDaysYear++;
      tempDate.setDate(tempDate.getDate() + 1);
    }
    const todayFraction = Math.min(1, elapsedSecToday / rates.totalDailyWorkSec);

    targetVal = rates.annual;
    mainVal = (pastWorkDaysYear + todayFraction) * rates.daily;
    percent = (mainVal / targetVal) * 100;

    startLabelText = `${now.getFullYear()}년 1월 1일 (0원)`;
    targetLabelText = `기준 연봉: ₩${Math.round(targetVal).toLocaleString()}`;
  } else { // 'daily'
    heroBadgeText = "일급 (Daily)";
    heroTitleText = "오늘 8시간 근무 동안 실시간 적립 일급";
    progressTitleText = "오늘 하루 8시간 근무 진행률";

    targetVal = rates.daily;
    mainVal = todayEarned;
    percent = (elapsedSecToday / rates.totalDailyWorkSec) * 100;

    startLabelText = `출근 (08:30)`;
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

  // 5. Update Rates Breakdown Card
  const ratePerSecEl = document.getElementById("ratePerSec");
  const ratePerMinEl = document.getElementById("ratePerMin");
  const ratePerHourEl = document.getElementById("ratePerHour");
  const ratePerDayEl = document.getElementById("ratePerDay");

  if (ratePerSecEl) ratePerSecEl.textContent = `₩ ${rates.perSec.toFixed(2)} 원`;
  if (ratePerMinEl) ratePerMinEl.textContent = `₩ ${rates.perMin.toFixed(2)} 원`;
  if (ratePerHourEl) ratePerHourEl.textContent = `₩ ${Math.round(rates.hourly).toLocaleString()} 원`;
  if (ratePerDayEl) ratePerDayEl.textContent = `₩ ${Math.round(rates.daily).toLocaleString()} 원`;

  // 6. Update Timeline & Summary Card
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

  // 7. Update Milestone Items
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
      settingsModal.classList.add("open");
    });
  }

  if (closeModalBtn && settingsModal) {
    closeModalBtn.addEventListener("click", () => {
      settingsModal.classList.remove("open");
    });
  }

  // Close modal when clicking backdrop
  if (settingsModal) {
    settingsModal.addEventListener("click", (e) => {
      if (e.target === settingsModal) {
        settingsModal.classList.remove("open");
      }
    });
  }

  // Save Settings
  if (settingsForm) {
    settingsForm.addEventListener("submit", (e) => {
      e.preventDefault();
      state.annualSalary = Number(document.getElementById("inputAnnualSalary").value) || 100000000;
      state.workStart = document.getElementById("inputWorkStart").value;
      state.workEnd = document.getElementById("inputWorkEnd").value;
      state.lunchStart = document.getElementById("inputLunchStart").value;
      state.lunchEnd = document.getElementById("inputLunchEnd").value;

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

      document.getElementById("inputAnnualSalary").value = state.annualSalary;
      document.getElementById("inputWorkStart").value = state.workStart;
      document.getElementById("inputWorkEnd").value = state.workEnd;
      document.getElementById("inputLunchStart").value = state.lunchStart;
      document.getElementById("inputLunchEnd").value = state.lunchEnd;

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
