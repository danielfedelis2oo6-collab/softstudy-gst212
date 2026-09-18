/**
 * GST 212: Philosophy, Logic, and Human Existence - Core App Engine
 * Handles Study Mode, Exam Mode, Flashcards, Question Bank, LocalStorage, and Navigation.
 */

(() => {
  'use strict';

  // --- GLOBAL STATE ---
  const STATE = {
    allQuestions: (typeof GST_QUESTIONS !== 'undefined') ? GST_QUESTIONS : [],
    currentMode: 'study', // 'study' | 'exam' | 'flashcards'
    activeView: 'home',   // 'home' | 'study' | 'exam' | 'results' | 'flashcards' | 'bank'
    selectedModule: 'all',
    questionCountOption: 25, // number or 'all'
    shuffleEnabled: true,
    examTimerMinutes: 30,    // 0 = untimed

    // Active Session Data
    sessionQuestions: [],
    currentIndex: 0,

    // Study Mode Session State
    study: {
      passes: 0,
      fails: 0,
      userAnswers: {}, // { [index]: { selected: 'A', isCorrect: bool } }
      explainerOpen: false
    },

    // Exam Mode Session State
    exam: {
      answers: {},     // { [index]: 'A' | 'B' | 'C' | 'D' }
      flagged: {},     // { [index]: true }
      timeRemaining: 0,// in seconds
      timerInterval: null,
      startTime: null,
      endTime: null,
      results: null
    },

    // Flashcards Session State
    flashcards: {
      deck: [],
      currentIndex: 0,
      isFlipped: false,
      mastered: new Set(), // Set of question IDs
    },

    // Persistent Storage
    bookmarks: new Set(),
    examHistory: [],
    theme: 'dark'
  };

  // --- LOCAL STORAGE HELPERS ---
  const STORAGE_KEYS = {
    THEME: 'gst212_theme',
    BOOKMARKS: 'gst212_bookmarks',
    EXAM_HISTORY: 'gst212_exam_history',
    FLASHCARD_MASTERY: 'gst212_fc_mastery'
  };

  function loadSavedStorage() {
    try {
      const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME);
      if (savedTheme) {
        STATE.theme = savedTheme;
        document.documentElement.setAttribute('data-theme', savedTheme);
      }

      const savedBookmarks = localStorage.getItem(STORAGE_KEYS.BOOKMARKS);
      if (savedBookmarks) {
        STATE.bookmarks = new Set(JSON.parse(savedBookmarks));
      }

      const savedHistory = localStorage.getItem(STORAGE_KEYS.EXAM_HISTORY);
      if (savedHistory) {
        STATE.examHistory = JSON.parse(savedHistory);
      }

      const savedFcMastery = localStorage.getItem(STORAGE_KEYS.FLASHCARD_MASTERY);
      if (savedFcMastery) {
        STATE.flashcards.mastered = new Set(JSON.parse(savedFcMastery));
      }
    } catch (e) {
      console.warn('LocalStorage not accessible or error loading:', e);
    }
  }

  function saveStorage(key, value) {
    try {
      if (value instanceof Set) {
        localStorage.setItem(key, JSON.stringify(Array.from(value)));
      } else {
        localStorage.setItem(key, JSON.stringify(value));
      }
    } catch (e) {
      console.warn('Error saving to LocalStorage:', e);
    }
  }

  // --- DOM ELEMENTS ---
  const DOM = {
    // Nav
    navBrand: document.getElementById('nav-brand'),
    navBankBtn: document.getElementById('nav-bank-btn'),
    navBookmarksBtn: document.getElementById('nav-bookmarks-btn'),
    themeToggleBtn: document.getElementById('theme-toggle-btn'),
    totalQBadge: document.getElementById('total-q-badge'),
    bookmarksCountBadge: document.getElementById('bookmarks-count-badge'),

    // Views
    views: {
      home: document.getElementById('view-home'),
      study: document.getElementById('view-study'),
      exam: document.getElementById('view-exam'),
      results: document.getElementById('view-results'),
      flashcards: document.getElementById('view-flashcards'),
      bank: document.getElementById('view-bank')
    },

    // Home Configuration
    modeCards: document.querySelectorAll('.mode-card'),
    moduleSelect: document.getElementById('module-select'),
    countPresets: document.getElementById('count-presets'),
    customCountWrapper: document.getElementById('custom-count-wrapper'),
    customCountInput: document.getElementById('custom-count-input'),
    shuffleToggle: document.getElementById('shuffle-toggle'),
    timerConfigGroup: document.getElementById('timer-config-group'),
    timerPresets: document.getElementById('timer-presets'),
    customTimeWrapper: document.getElementById('custom-time-wrapper'),
    customTimeInput: document.getElementById('custom-time-input'),
    poolSummaryText: document.getElementById('pool-summary-text'),
    startSessionBtn: document.getElementById('start-session-btn'),
    historyListContainer: document.getElementById('history-list-container'),
    clearHistoryBtn: document.getElementById('clear-history-btn'),

    // Study View
    studyExitBtn: document.getElementById('study-exit-btn'),
    studyProgressText: document.getElementById('study-progress-text'),
    studyModuleBadge: document.getElementById('study-module-badge'),
    studyPassCount: document.getElementById('study-pass-count'),
    studyFailCount: document.getElementById('study-fail-count'),
    studyBookmarkBtn: document.getElementById('study-bookmark-btn'),
    studyProgressBar: document.getElementById('study-progress-bar'),
    studySourceTag: document.getElementById('study-source-tag'),
    studyQuestionPrompt: document.getElementById('study-question-prompt'),
    studyOptionsList: document.getElementById('study-options-list'),
    studyExplainerToggle: document.getElementById('study-explainer-toggle'),
    studyExplainerDrawer: document.getElementById('study-explainer-drawer'),
    studyExplainerText: document.getElementById('study-explainer-text'),
    studyPrevBtn: document.getElementById('study-prev-btn'),
    studyNextBtn: document.getElementById('study-next-btn'),
    studyFinishBtn: document.getElementById('study-finish-btn'),

    // Exam View
    examExitBtn: document.getElementById('exam-exit-btn'),
    examProgressText: document.getElementById('exam-progress-text'),
    examModuleBadge: document.getElementById('exam-module-badge'),
    examTimerBox: document.getElementById('exam-timer-box'),
    examTimerDisplay: document.getElementById('exam-timer-display'),
    examFlagBtn: document.getElementById('exam-flag-btn'),
    examPaletteToggle: document.getElementById('exam-palette-toggle'),
    answeredCountMini: document.getElementById('answered-count-mini'),
    totalCountMini: document.getElementById('total-count-mini'),
    examSourceTag: document.getElementById('exam-source-tag'),
    examFlaggedIndicator: document.getElementById('exam-flagged-indicator'),
    examQuestionPrompt: document.getElementById('exam-question-prompt'),
    examOptionsList: document.getElementById('exam-options-list'),
    examPrevBtn: document.getElementById('exam-prev-btn'),
    examNextBtn: document.getElementById('exam-next-btn'),
    examSubmitBtn: document.getElementById('exam-submit-btn'),
    examPaletteSidebar: document.getElementById('exam-palette-sidebar'),
    examPaletteGrid: document.getElementById('exam-palette-grid'),

    // Results View
    resultsGradeBadge: document.getElementById('results-grade-badge'),
    resultsScoreSummary: document.getElementById('results-score-summary'),
    resAccuracy: document.getElementById('res-accuracy'),
    resCorrect: document.getElementById('res-correct'),
    resIncorrect: document.getElementById('res-incorrect'),
    resTime: document.getElementById('res-time'),
    resRetakeMissedBtn: document.getElementById('res-retake-missed-btn'),
    resRetakeAllBtn: document.getElementById('res-retake-all-btn'),
    resHomeBtn: document.getElementById('res-home-btn'),
    reviewFilterChips: document.getElementById('review-filter-chips'),
    resultsReviewList: document.getElementById('results-review-list'),
    revCountAll: document.getElementById('rev-count-all'),
    revCountWrong: document.getElementById('rev-count-wrong'),
    revCountCorrect: document.getElementById('rev-count-correct'),
    revCountFlagged: document.getElementById('rev-count-flagged'),

    // Flashcards View
    fcExitBtn: document.getElementById('fc-exit-btn'),
    fcProgressText: document.getElementById('fc-progress-text'),
    fcModuleBadge: document.getElementById('fc-module-badge'),
    fcMasteredCount: document.getElementById('fc-mastered-count'),
    fcLearningCount: document.getElementById('fc-learning-count'),
    fcProgressBar: document.getElementById('fc-progress-bar'),
    flashcardScene: document.getElementById('flashcard-scene'),
    flashcardElement: document.getElementById('flashcard-element'),
    fcFrontTopic: document.getElementById('fc-front-topic'),
    fcFrontQuestion: document.getElementById('fc-front-question'),
    fcBackSource: document.getElementById('fc-back-source'),
    fcBackLetter: document.getElementById('fc-back-letter'),
    fcBackAnswer: document.getElementById('fc-back-answer'),
    fcBackExplainer: document.getElementById('fc-back-explainer'),
    fcHardBtn: document.getElementById('fc-hard-btn'),
    fcFlipBtn: document.getElementById('fc-flip-btn'),
    fcEasyBtn: document.getElementById('fc-easy-btn'),
    fcPrevBtn: document.getElementById('fc-prev-btn'),
    fcNextBtn: document.getElementById('fc-next-btn'),
    fcShuffleBtn: document.getElementById('fc-shuffle-btn'),
    fcResetBtn: document.getElementById('fc-reset-btn'),

    // Question Bank View
    bankExitBtn: document.getElementById('bank-exit-btn'),
    bankSearchInput: document.getElementById('bank-search-input'),
    clearSearchBtn: document.getElementById('clear-search-btn'),
    bankModuleFilter: document.getElementById('bank-module-filter'),
    bankBookmarksFilterBtn: document.getElementById('bank-bookmarks-filter-btn'),
    bankMatchedCount: document.getElementById('bank-matched-count'),
    bankQuestionsList: document.getElementById('bank-questions-list'),

    // Submit Modal
    submitModal: document.getElementById('submit-modal'),
    submitModalMsg: document.getElementById('submit-modal-msg'),
    modalCancelBtn: document.getElementById('modal-cancel-btn'),
    modalConfirmBtn: document.getElementById('modal-confirm-btn')
  };

  // --- INITIALIZATION ---
  function init() {
    loadSavedStorage();
    updateBookmarksBadge();
    renderExamHistory();
    attachEventListeners();
    updatePoolSummary();

    // Set Total Questions in badge
    if (DOM.totalQBadge) {
      DOM.totalQBadge.textContent = STATE.allQuestions.length;
    }
  }

  // --- VIEW SWITCHING ---
  function switchView(viewName) {
    STATE.activeView = viewName;
    Object.keys(DOM.views).forEach(key => {
      if (DOM.views[key]) {
        if (key === viewName) {
          DOM.views[key].classList.add('active');
        } else {
          DOM.views[key].classList.remove('active');
        }
      }
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // --- THEME TOGGLE ---
  function toggleTheme() {
    const nextTheme = STATE.theme === 'dark' ? 'light' : 'dark';
    STATE.theme = nextTheme;
    document.documentElement.setAttribute('data-theme', nextTheme);
    localStorage.setItem(STORAGE_KEYS.THEME, nextTheme);
  }

  // --- BOOKMARKS MANAGEMENT ---
  function toggleBookmark(questionId) {
    if (STATE.bookmarks.has(questionId)) {
      STATE.bookmarks.delete(questionId);
    } else {
      STATE.bookmarks.add(questionId);
    }
    saveStorage(STORAGE_KEYS.BOOKMARKS, STATE.bookmarks);
    updateBookmarksBadge();

    // Update study bookmark button if active
    if (STATE.activeView === 'study' && STATE.sessionQuestions[STATE.currentIndex]) {
      const currentQ = STATE.sessionQuestions[STATE.currentIndex];
      if (currentQ.id === questionId) {
        DOM.studyBookmarkBtn.classList.toggle('bookmarked', STATE.bookmarks.has(questionId));
      }
    }
  }

  function updateBookmarksBadge() {
    if (DOM.bookmarksCountBadge) {
      DOM.bookmarksCountBadge.textContent = STATE.bookmarks.size;
    }
  }

  // --- SESSION CONFIGURATION & LAUNCH ---
  function updatePoolSummary() {
    const filtered = getFilteredQuestions(STATE.selectedModule);
    let count = STATE.questionCountOption;
    if (count === 'all' || count > filtered.length) {
      count = filtered.length;
    }
    const modeName = STATE.currentMode === 'study' ? 'Study Mode' : STATE.currentMode === 'exam' ? 'Exam Mode' : 'Flashcards';
    DOM.poolSummaryText.textContent = `Ready to launch ${modeName} with ${count} questions (from ${filtered.length} available)`;
  }

  function getFilteredQuestions(moduleFilter) {
    if (!moduleFilter || moduleFilter === 'all') {
      return [...STATE.allQuestions];
    }
    return STATE.allQuestions.filter(q => q.module === moduleFilter || q.topic === moduleFilter);
  }

  function shuffleArray(array) {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function startSession() {
    let pool = getFilteredQuestions(STATE.selectedModule);
    if (pool.length === 0) {
      alert('No questions found for the selected module.');
      return;
    }

    if (STATE.shuffleEnabled) {
      pool = shuffleArray(pool);
    }

    let targetCount = STATE.questionCountOption;
    if (targetCount === 'all' || targetCount > pool.length) {
      targetCount = pool.length;
    }
    const sessionSet = pool.slice(0, targetCount);

    STATE.sessionQuestions = sessionSet;
    STATE.currentIndex = 0;

    if (STATE.currentMode === 'study') {
      launchStudyMode(sessionSet);
    } else if (STATE.currentMode === 'exam') {
      launchExamMode(sessionSet);
    } else if (STATE.currentMode === 'flashcards') {
      launchFlashcardsMode(sessionSet);
    }
  }

  // =========================================================================
  // 1. STUDY MODE ENGINE
  // =========================================================================
  function launchStudyMode(questions) {
    STATE.study = {
      passes: 0,
      fails: 0,
      userAnswers: {},
      explainerOpen: false
    };

    DOM.studyPassCount.textContent = '0';
    DOM.studyFailCount.textContent = '0';
    switchView('study');
    renderStudyQuestion();
  }

  function renderStudyQuestion() {
    const q = STATE.sessionQuestions[STATE.currentIndex];
    if (!q) return;

    // Header info
    DOM.studyProgressText.textContent = `Question ${STATE.currentIndex + 1} of ${STATE.sessionQuestions.length}`;
    DOM.studyModuleBadge.textContent = q.module || q.topic;
    DOM.studySourceTag.textContent = q.source || 'GST 212 Past Q&A';

    // Progress bar
    const percent = ((STATE.currentIndex + 1) / STATE.sessionQuestions.length) * 100;
    DOM.studyProgressBar.style.width = `${percent}%`;

    // Bookmark state
    DOM.studyBookmarkBtn.classList.toggle('bookmarked', STATE.bookmarks.has(q.id));

    // Prompt
    DOM.studyQuestionPrompt.textContent = q.question;

    // Explainer content
    DOM.studyExplainerText.textContent = q.explainer;
    closeStudyExplainer();

    // Check if already answered
    const existing = STATE.study.userAnswers[STATE.currentIndex];

    // Render Options A, B, C, D
    DOM.studyOptionsList.innerHTML = '';
    const optionKeys = ['A', 'B', 'C', 'D'];

    optionKeys.forEach(letter => {
      const optText = q.options[letter];
      if (!optText) return;

      const optBtn = document.createElement('div');
      optBtn.className = 'option-item';
      optBtn.setAttribute('data-letter', letter);

      optBtn.innerHTML = `
        <span class="option-letter">${letter}</span>
        <span class="option-text">${escapeHtml(optText)}</span>
        <span class="option-status-icon"></span>
      `;

      if (existing) {
        optBtn.classList.add('locked');
        if (existing.selected === letter) {
          if (existing.isCorrect) {
            optBtn.classList.add('state-correct');
            optBtn.querySelector('.option-status-icon').innerHTML = '✓';
          } else {
            optBtn.classList.add('state-wrong');
            optBtn.querySelector('.option-status-icon').innerHTML = '✕';
          }
        } else if (!existing.isCorrect && letter === q.correct_option) {
          // Highlight correct option in ORANGE when user got it wrong
          optBtn.classList.add('state-correct-highlight');
          optBtn.querySelector('.option-status-icon').innerHTML = '★ (Correct Answer)';
        }
      } else {
        optBtn.addEventListener('click', () => handleStudyOptionClick(letter, q));
      }

      DOM.studyOptionsList.appendChild(optBtn);
    });

    // If already answered, highlight explainer button to encourage learning
    if (existing) {
      DOM.studyExplainerToggle.classList.add('highlight-pulse');
    } else {
      DOM.studyExplainerToggle.classList.remove('highlight-pulse');
    }

    // Prev/Next Navigation state
    DOM.studyPrevBtn.disabled = STATE.currentIndex === 0;
    DOM.studyNextBtn.disabled = STATE.currentIndex === STATE.sessionQuestions.length - 1;
  }

  function handleStudyOptionClick(selectedLetter, question) {
    if (STATE.study.userAnswers[STATE.currentIndex]) return; // already answered

    const isCorrect = (selectedLetter === question.correct_option);
    STATE.study.userAnswers[STATE.currentIndex] = {
      selected: selectedLetter,
      isCorrect: isCorrect
    };

    if (isCorrect) {
      STATE.study.passes++;
      DOM.studyPassCount.textContent = STATE.study.passes;
    } else {
      STATE.study.fails++;
      DOM.studyFailCount.textContent = STATE.study.fails;
    }

    // Highlight options
    const optionItems = DOM.studyOptionsList.querySelectorAll('.option-item');
    optionItems.forEach(item => {
      item.classList.add('locked');
      const letter = item.getAttribute('data-letter');

      if (letter === selectedLetter) {
        if (isCorrect) {
          item.classList.add('state-correct');
          item.querySelector('.option-status-icon').innerHTML = '✓';
        } else {
          item.classList.add('state-wrong');
          item.querySelector('.option-status-icon').innerHTML = '✕';
        }
      } else if (!isCorrect && letter === question.correct_option) {
        // Orange highlight for correct answer on mistake
        item.classList.add('state-correct-highlight');
        item.querySelector('.option-status-icon').innerHTML = '★ (Correct Answer)';
      }
    });

    // Highlight explainer button
    DOM.studyExplainerToggle.classList.add('highlight-pulse');
  }

  function toggleStudyExplainer() {
    STATE.study.explainerOpen = !STATE.study.explainerOpen;
    if (STATE.study.explainerOpen) {
      DOM.studyExplainerToggle.classList.add('open');
      DOM.studyExplainerDrawer.classList.add('open');
    } else {
      DOM.studyExplainerToggle.classList.remove('open');
      DOM.studyExplainerDrawer.classList.remove('open');
    }
  }

  function closeStudyExplainer() {
    STATE.study.explainerOpen = false;
    DOM.studyExplainerToggle.classList.remove('open');
    DOM.studyExplainerDrawer.classList.remove('open');
  }

  // =========================================================================
  // 2. EXAM MODE ENGINE
  // =========================================================================
  function launchExamMode(questions) {
    STATE.exam = {
      answers: {},
      flagged: {},
      timeRemaining: STATE.examTimerMinutes * 60,
      timerInterval: null,
      startTime: Date.now(),
      endTime: null,
      results: null
    };

    clearInterval(STATE.exam.timerInterval);

    // Setup Timer
    if (STATE.examTimerMinutes > 0) {
      DOM.examTimerBox.classList.remove('hidden', 'warning', 'critical');
      updateExamTimerDisplay();
      STATE.exam.timerInterval = setInterval(() => {
        STATE.exam.timeRemaining--;
        updateExamTimerDisplay();

        if (STATE.exam.timeRemaining <= 300 && STATE.exam.timeRemaining > 60) {
          DOM.examTimerBox.classList.add('warning');
        } else if (STATE.exam.timeRemaining <= 60 && STATE.exam.timeRemaining > 0) {
          DOM.examTimerBox.classList.remove('warning');
          DOM.examTimerBox.classList.add('critical');
        } else if (STATE.exam.timeRemaining <= 0) {
          clearInterval(STATE.exam.timerInterval);
          alert('Time has expired! Submitting your examination automatically.');
          submitExam();
        }
      }, 1000);
    } else {
      DOM.examTimerBox.classList.add('hidden');
    }

    switchView('exam');
    renderExamPalette();
    renderExamQuestion();
  }

  function updateExamTimerDisplay() {
    const secs = Math.max(0, STATE.exam.timeRemaining);
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    DOM.examTimerDisplay.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function renderExamPalette() {
    DOM.examPaletteGrid.innerHTML = '';
    STATE.sessionQuestions.forEach((q, idx) => {
      const btn = document.createElement('button');
      btn.className = 'palette-btn';
      btn.textContent = idx + 1;
      btn.setAttribute('data-idx', idx);

      if (idx === STATE.currentIndex) btn.classList.add('current');
      if (STATE.exam.answers[idx]) btn.classList.add('answered');
      if (STATE.exam.flagged[idx]) btn.classList.add('flagged');

      btn.addEventListener('click', () => {
        STATE.currentIndex = idx;
        renderExamQuestion();
        renderExamPalette();
      });

      DOM.examPaletteGrid.appendChild(btn);
    });

    const answeredCount = Object.keys(STATE.exam.answers).length;
    DOM.answeredCountMini.textContent = answeredCount;
    DOM.totalCountMini.textContent = STATE.sessionQuestions.length;
  }

  function renderExamQuestion() {
    const q = STATE.sessionQuestions[STATE.currentIndex];
    if (!q) return;

    DOM.examProgressText.textContent = `Question ${STATE.currentIndex + 1} of ${STATE.sessionQuestions.length}`;
    DOM.examModuleBadge.textContent = q.module || q.topic;
    DOM.examSourceTag.textContent = `Q${STATE.currentIndex + 1} • CBT Format`;

    // Flag state
    const isFlagged = Boolean(STATE.exam.flagged[STATE.currentIndex]);
    DOM.examFlagBtn.classList.toggle('flagged', isFlagged);
    DOM.examFlaggedIndicator.classList.toggle('hidden', !isFlagged);

    // Prompt
    DOM.examQuestionPrompt.textContent = q.question;

    // Render Neutral Options
    DOM.examOptionsList.innerHTML = '';
    const optionKeys = ['A', 'B', 'C', 'D'];
    const currentSelected = STATE.exam.answers[STATE.currentIndex];

    optionKeys.forEach(letter => {
      const optText = q.options[letter];
      if (!optText) return;

      const optBtn = document.createElement('div');
      optBtn.className = 'option-item';
      if (currentSelected === letter) {
        optBtn.classList.add('exam-selected');
      }

      optBtn.innerHTML = `
        <span class="option-letter">${letter}</span>
        <span class="option-text">${escapeHtml(optText)}</span>
      `;

      optBtn.addEventListener('click', () => {
        STATE.exam.answers[STATE.currentIndex] = letter;
        renderExamQuestion();
        renderExamPalette();
      });

      DOM.examOptionsList.appendChild(optBtn);
    });

    DOM.examPrevBtn.disabled = STATE.currentIndex === 0;
    DOM.examNextBtn.disabled = STATE.currentIndex === STATE.sessionQuestions.length - 1;
  }

  function toggleExamFlag() {
    const current = Boolean(STATE.exam.flagged[STATE.currentIndex]);
    STATE.exam.flagged[STATE.currentIndex] = !current;
    renderExamQuestion();
    renderExamPalette();
  }

  function promptSubmitExam() {
    const total = STATE.sessionQuestions.length;
    const answered = Object.keys(STATE.exam.answers).length;
    const unanswered = total - answered;

    DOM.submitModalMsg.textContent = `You have answered ${answered} of ${total} questions (${unanswered} unanswered). Are you sure you want to submit your examination and view your results?`;
    DOM.submitModal.classList.remove('hidden');
  }

  function submitExam() {
    DOM.submitModal.classList.add('hidden');
    clearInterval(STATE.exam.timerInterval);
    STATE.exam.endTime = Date.now();

    // Calculate Scores
    let correctCount = 0;
    let incorrectCount = 0;
    let skippedCount = 0;

    const breakdown = STATE.sessionQuestions.map((q, idx) => {
      const userChoice = STATE.exam.answers[idx] || null;
      const isCorrect = (userChoice === q.correct_option);
      const isFlagged = Boolean(STATE.exam.flagged[idx]);

      if (!userChoice) {
        skippedCount++;
      } else if (isCorrect) {
        correctCount++;
      } else {
        incorrectCount++;
      }

      return {
        index: idx,
        question: q,
        userChoice: userChoice,
        correctOption: q.correct_option,
        isCorrect: isCorrect,
        isFlagged: isFlagged,
        explainer: q.explainer
      };
    });

    const total = STATE.sessionQuestions.length;
    const accuracy = Math.round((correctCount / total) * 100);

    // Calculate Grade
    let grade = 'F';
    if (accuracy >= 70) grade = 'A';
    else if (accuracy >= 60) grade = 'B';
    else if (accuracy >= 50) grade = 'C';
    else if (accuracy >= 45) grade = 'D';
    else grade = 'F';

    // Calculate time taken
    const durationMs = STATE.exam.endTime - STATE.exam.startTime;
    const durationMins = Math.floor(durationMs / 60000);
    const durationSecs = Math.floor((durationMs % 60000) / 1000);
    const timeFormatted = `${durationMins}m ${durationSecs}s`;

    const resultData = {
      id: Date.now(),
      date: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      total: total,
      correct: correctCount,
      incorrect: incorrectCount,
      skipped: skippedCount,
      accuracy: accuracy,
      grade: grade,
      timeSpent: timeFormatted,
      module: STATE.selectedModule,
      breakdown: breakdown
    };

    STATE.exam.results = resultData;

    // Save to Exam History
    STATE.examHistory.unshift({
      date: resultData.date,
      score: `${correctCount}/${total}`,
      accuracy: `${accuracy}%`,
      grade: grade,
      timeSpent: timeFormatted,
      module: STATE.selectedModule === 'all' ? 'All Modules' : STATE.selectedModule
    });
    // Keep last 10
    STATE.examHistory = STATE.examHistory.slice(0, 10);
    saveStorage(STORAGE_KEYS.EXAM_HISTORY, STATE.examHistory);
    renderExamHistory();

    renderExamResults(resultData);
  }

  // =========================================================================
  // 3. EXAM RESULTS & DETAILED REVIEW
  // =========================================================================
  function renderExamResults(results) {
    DOM.resultsGradeBadge.textContent = results.grade;
    DOM.resultsScoreSummary.textContent = `You scored ${results.correct} out of ${results.total} (${results.accuracy}%)`;
    DOM.resAccuracy.textContent = `${results.accuracy}%`;
    DOM.resCorrect.textContent = results.correct;
    DOM.resIncorrect.textContent = results.incorrect + results.skipped;
    DOM.resTime.textContent = results.timeSpent;

    DOM.revCountAll.textContent = results.total;
    DOM.revCountWrong.textContent = results.incorrect + results.skipped;
    DOM.revCountCorrect.textContent = results.correct;
    DOM.revCountFlagged.textContent = results.breakdown.filter(b => b.isFlagged).length;

    renderReviewList('all');
    switchView('results');
  }

  function renderReviewList(filter) {
    const results = STATE.exam.results;
    if (!results) return;

    let items = results.breakdown;
    if (filter === 'wrong') {
      items = items.filter(b => !b.isCorrect);
    } else if (filter === 'correct') {
      items = items.filter(b => b.isCorrect);
    } else if (filter === 'flagged') {
      items = items.filter(b => b.isFlagged);
    }

    DOM.resultsReviewList.innerHTML = '';

    if (items.length === 0) {
      DOM.resultsReviewList.innerHTML = `<p class="empty-state">No questions in this filter.</p>`;
      return;
    }

    items.forEach(item => {
      const q = item.question;
      const card = document.createElement('div');
      card.className = 'review-card';

      const statusBadge = item.isCorrect 
        ? `<span class="score-pill pass">✓ Correct</span>`
        : `<span class="score-pill fail">✕ ${item.userChoice ? 'Incorrect' : 'Skipped'}</span>`;

      const flaggedBadge = item.isFlagged ? `<span class="score-pill" style="background:var(--color-flag-bg);color:var(--color-flag);border:1px solid var(--color-flag)">🚩 Flagged</span>` : '';

      const optionRows = ['A', 'B', 'C', 'D'].map(letter => {
        const text = q.options[letter];
        if (!text) return '';

        let rowClass = 'review-option-row';
        let marker = '';

        if (letter === q.correct_option) {
          rowClass += ' correct-ans';
          marker = '✓ (Correct Answer)';
        } else if (letter === item.userChoice && !item.isCorrect) {
          rowClass += ' user-wrong';
          marker = '✕ (Your Choice)';
        }

        return `
          <div class="${rowClass}">
            <span class="option-letter" style="width:24px;height:24px;font-size:0.75rem;">${letter}</span>
            <span class="option-text">${escapeHtml(text)}</span>
            <span style="font-weight:700;font-size:0.75rem;margin-left:auto;">${marker}</span>
          </div>
        `;
      }).join('');

      card.innerHTML = `
        <div class="review-card-header">
          <span class="q-source-tag">Q#${item.index + 1} • ${escapeHtml(q.module || q.topic)}</span>
          <div style="display:flex;gap:0.5rem;align-items:center;">
            ${flaggedBadge}
            ${statusBadge}
          </div>
        </div>
        <h4 class="review-q-title">${escapeHtml(q.question)}</h4>
        <div class="review-options">${optionRows}</div>
        <div class="review-explainer-box">
          <strong style="display:block;margin-bottom:0.25rem;color:var(--text-primary);">Concept Explainer & Rationale:</strong>
          ${escapeHtml(q.explainer)}
        </div>
      `;

      DOM.resultsReviewList.appendChild(card);
    });
  }

  // =========================================================================
  // 4. FLASHCARDS ENGINE
  // =========================================================================
  function launchFlashcardsMode(questions) {
    STATE.flashcards.deck = [...questions];
    STATE.flashcards.currentIndex = 0;
    STATE.flashcards.isFlipped = false;

    updateFlashcardsStats();
    switchView('flashcards');
    renderFlashcard();
  }

  function updateFlashcardsStats() {
    let masteredCount = 0;
    STATE.flashcards.deck.forEach(card => {
      if (STATE.flashcards.mastered.has(card.id)) {
        masteredCount++;
      }
    });

    const total = STATE.flashcards.deck.length;
    DOM.fcMasteredCount.textContent = masteredCount;
    DOM.fcLearningCount.textContent = total - masteredCount;

    const percent = total > 0 ? (masteredCount / total) * 100 : 0;
    DOM.fcProgressBar.style.width = `${percent}%`;
  }

  function renderFlashcard() {
    const card = STATE.flashcards.deck[STATE.flashcards.currentIndex];
    if (!card) return;

    STATE.flashcards.isFlipped = false;
    DOM.flashcardElement.classList.remove('is-flipped');

    // Header
    DOM.fcProgressText.textContent = `Card ${STATE.flashcards.currentIndex + 1} of ${STATE.flashcards.deck.length}`;
    DOM.fcModuleBadge.textContent = card.module || card.topic;

    // Front
    DOM.fcFrontTopic.textContent = card.topic;
    DOM.fcFrontQuestion.textContent = card.question;

    // Back
    DOM.fcBackSource.textContent = card.source || 'GST 212 Past Q&A';
    DOM.fcBackLetter.textContent = card.correct_option;
    DOM.fcBackAnswer.textContent = card.options[card.correct_option] || card.answer_text;
    DOM.fcBackExplainer.textContent = card.explainer;

    // Navigation buttons
    DOM.fcPrevBtn.disabled = STATE.flashcards.currentIndex === 0;
    DOM.fcNextBtn.disabled = STATE.flashcards.currentIndex === STATE.flashcards.deck.length - 1;
  }

  function flipFlashcard() {
    STATE.flashcards.isFlipped = !STATE.flashcards.isFlipped;
    DOM.flashcardElement.classList.toggle('is-flipped', STATE.flashcards.isFlipped);
  }

  function rateFlashcard(isMastered) {
    const card = STATE.flashcards.deck[STATE.flashcards.currentIndex];
    if (!card) return;

    if (isMastered) {
      STATE.flashcards.mastered.add(card.id);
    } else {
      STATE.flashcards.mastered.delete(card.id);
    }
    saveStorage(STORAGE_KEYS.FLASHCARD_MASTERY, STATE.flashcards.mastered);
    updateFlashcardsStats();

    // Auto advance to next card
    if (STATE.flashcards.currentIndex < STATE.flashcards.deck.length - 1) {
      STATE.flashcards.currentIndex++;
      renderFlashcard();
    }
  }

  // =========================================================================
  // 5. QUESTION BANK REPOSITORY & SEARCH
  // =========================================================================
  function launchQuestionBank() {
    switchView('bank');
    renderQuestionBank();
  }

  function renderQuestionBank() {
    const searchVal = (DOM.bankSearchInput.value || '').trim().toLowerCase();
    const moduleVal = DOM.bankModuleFilter.value;
    const bookmarksOnly = DOM.bankBookmarksFilterBtn.classList.contains('selected');

    let filtered = STATE.allQuestions.filter(q => {
      // Search keyword filter
      if (searchVal) {
        const inQ = q.question.toLowerCase().includes(searchVal);
        const inAns = (q.options[q.correct_option] || '').toLowerCase().includes(searchVal);
        const inExp = q.explainer.toLowerCase().includes(searchVal);
        const inTopic = q.topic.toLowerCase().includes(searchVal);
        if (!inQ && !inAns && !inExp && !inTopic) return false;
      }

      // Module filter
      if (moduleVal !== 'all' && q.module !== moduleVal && q.topic !== moduleVal) {
        return false;
      }

      // Bookmarks filter
      if (bookmarksOnly && !STATE.bookmarks.has(q.id)) {
        return false;
      }

      return true;
    });

    DOM.bankMatchedCount.textContent = filtered.length;
    DOM.bankQuestionsList.innerHTML = '';

    if (filtered.length === 0) {
      DOM.bankQuestionsList.innerHTML = `<p class="empty-state">No questions found matching your filter criteria.</p>`;
      return;
    }

    // Render first 100 to keep UI extremely fast, with load more if needed
    const renderLimit = Math.min(filtered.length, 100);
    for (let i = 0; i < renderLimit; i++) {
      const q = filtered[i];
      const card = document.createElement('div');
      card.className = 'bank-item-card';

      const isBookmarked = STATE.bookmarks.has(q.id);

      const optionsHtml = ['A', 'B', 'C', 'D'].map(letter => {
        const text = q.options[letter];
        if (!text) return '';
        const isCorr = (letter === q.correct_option);
        return `
          <div class="bank-opt ${isCorr ? 'is-correct' : ''}">
            <strong>${letter}.</strong> ${escapeHtml(text)}
          </div>
        `;
      }).join('');

      card.innerHTML = `
        <div class="bank-item-header">
          <span class="q-source-tag">#${q.id} • ${escapeHtml(q.module || q.topic)}</span>
          <button class="bookmark-btn ${isBookmarked ? 'bookmarked' : ''}" data-qid="${q.id}" title="Toggle Bookmark">
            <svg class="star-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          </button>
        </div>
        <h3 class="bank-item-question">${escapeHtml(q.question)}</h3>
        <div class="bank-item-options">${optionsHtml}</div>
        <div class="bank-explainer-accordion">
          <button class="bank-exp-toggle">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
            <span>View Concept Explainer</span>
          </button>
          <div class="bank-exp-body hidden">
            ${escapeHtml(q.explainer)}
          </div>
        </div>
      `;

      // Event: Bookmark toggle
      const bBtn = card.querySelector('.bookmark-btn');
      bBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleBookmark(q.id);
        bBtn.classList.toggle('bookmarked', STATE.bookmarks.has(q.id));
      });

      // Event: Explainer Accordion
      const expToggle = card.querySelector('.bank-exp-toggle');
      const expBody = card.querySelector('.bank-exp-body');
      expToggle.addEventListener('click', () => {
        const isHidden = expBody.classList.contains('hidden');
        expBody.classList.toggle('hidden', !isHidden);
        expToggle.querySelector('span').textContent = isHidden ? 'Hide Concept Explainer' : 'View Concept Explainer';
      });

      DOM.bankQuestionsList.appendChild(card);
    }

    if (filtered.length > renderLimit) {
      const moreMsg = document.createElement('div');
      moreMsg.className = 'empty-state';
      moreMsg.textContent = `Showing first ${renderLimit} of ${filtered.length} matched questions. Refine your search keyword to narrow results.`;
      DOM.bankQuestionsList.appendChild(moreMsg);
    }
  }

  // =========================================================================
  // 6. EXAM HISTORY RENDERING
  // =========================================================================
  function renderExamHistory() {
    if (!DOM.historyListContainer) return;
    DOM.historyListContainer.innerHTML = '';

    if (STATE.examHistory.length === 0) {
      DOM.historyListContainer.innerHTML = `<p class="empty-state">No exams completed yet. Take an exam to track your performance!</p>`;
      return;
    }

    STATE.examHistory.forEach(item => {
      const div = document.createElement('div');
      div.className = 'history-item';
      div.innerHTML = `
        <div>
          <strong>${escapeHtml(item.module)}</strong>
          <span style="display:block;font-size:0.75rem;color:var(--text-muted);">${item.date} • ${item.timeSpent}</span>
        </div>
        <div style="display:flex;align-items:center;gap:0.75rem;">
          <span style="font-family:var(--font-mono);font-weight:700;">${item.score} (${item.accuracy})</span>
          <span class="grade-badge" style="width:28px;height:28px;font-size:0.85rem;margin:0;">${item.grade}</span>
        </div>
      `;
      DOM.historyListContainer.appendChild(div);
    });
  }

  // =========================================================================
  // 7. EVENT LISTENERS & WIRING
  // =========================================================================
  function attachEventListeners() {
    // Navigation Brand -> Home
    DOM.navBrand.addEventListener('click', () => switchView('home'));

    // Question Bank Navigation Button
    DOM.navBankBtn.addEventListener('click', launchQuestionBank);

    // Bookmarks Navigation Button
    DOM.navBookmarksBtn.addEventListener('click', () => {
      launchQuestionBank();
      DOM.bankBookmarksFilterBtn.classList.add('selected');
      renderQuestionBank();
    });

    // Theme Toggle
    DOM.themeToggleBtn.addEventListener('click', toggleTheme);

    // Mode Cards Selection (Home)
    DOM.modeCards.forEach(card => {
      card.addEventListener('click', () => {
        DOM.modeCards.forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        STATE.currentMode = card.getAttribute('data-mode');

        // Show/Hide Timer settings based on mode
        if (STATE.currentMode === 'exam') {
          DOM.timerConfigGroup.classList.remove('hidden');
        } else {
          DOM.timerConfigGroup.classList.add('hidden');
        }
        updatePoolSummary();
      });
    });

    // Module Selector (Home)
    DOM.moduleSelect.addEventListener('change', (e) => {
      STATE.selectedModule = e.target.value;
      updatePoolSummary();
    });

    // Question Count Presets (Home)
    DOM.countPresets.querySelectorAll('.btn-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        DOM.countPresets.querySelectorAll('.btn-chip').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        const countVal = btn.getAttribute('data-count');

        if (countVal === 'custom') {
          DOM.customCountWrapper.classList.remove('hidden');
          STATE.questionCountOption = parseInt(DOM.customCountInput.value, 10) || 25;
        } else if (countVal === 'all') {
          DOM.customCountWrapper.classList.add('hidden');
          STATE.questionCountOption = 'all';
        } else {
          DOM.customCountWrapper.classList.add('hidden');
          STATE.questionCountOption = parseInt(countVal, 10);
        }
        updatePoolSummary();
      });
    });

    DOM.customCountInput.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      if (val > 0) {
        STATE.questionCountOption = val;
        updatePoolSummary();
      }
    });

    // Shuffle Toggle
    DOM.shuffleToggle.addEventListener('change', (e) => {
      STATE.shuffleEnabled = e.target.checked;
    });

    // Timer Presets (Home)
    DOM.timerPresets.querySelectorAll('.btn-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        DOM.timerPresets.querySelectorAll('.btn-chip').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        const timeVal = btn.getAttribute('data-time');

        if (timeVal === 'custom') {
          DOM.customTimeWrapper.classList.remove('hidden');
          STATE.examTimerMinutes = parseInt(DOM.customTimeInput.value, 10) || 30;
        } else {
          DOM.customTimeWrapper.classList.add('hidden');
          STATE.examTimerMinutes = parseInt(timeVal, 10);
        }
      });
    });

    DOM.customTimeInput.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      if (val > 0) {
        STATE.examTimerMinutes = val;
      }
    });

    // Start Session Button
    DOM.startSessionBtn.addEventListener('click', startSession);

    // Clear History Button
    DOM.clearHistoryBtn.addEventListener('click', () => {
      if (confirm('Clear all exam history records?')) {
        STATE.examHistory = [];
        saveStorage(STORAGE_KEYS.EXAM_HISTORY, []);
        renderExamHistory();
      }
    });

    // --- Study Mode Events ---
    DOM.studyExitBtn.addEventListener('click', () => {
      if (confirm('Exit current study session and return to home?')) switchView('home');
    });
    DOM.studyFinishBtn.addEventListener('click', () => switchView('home'));
    DOM.studyBookmarkBtn.addEventListener('click', () => {
      const q = STATE.sessionQuestions[STATE.currentIndex];
      if (q) toggleBookmark(q.id);
    });
    DOM.studyExplainerToggle.addEventListener('click', toggleStudyExplainer);
    DOM.studyPrevBtn.addEventListener('click', () => {
      if (STATE.currentIndex > 0) {
        STATE.currentIndex--;
        renderStudyQuestion();
      }
    });
    DOM.studyNextBtn.addEventListener('click', () => {
      if (STATE.currentIndex < STATE.sessionQuestions.length - 1) {
        STATE.currentIndex++;
        renderStudyQuestion();
      }
    });

    // --- Exam Mode Events ---
    DOM.examExitBtn.addEventListener('click', () => {
      if (confirm('Are you sure you want to exit the exam? Your progress will be discarded.')) {
        clearInterval(STATE.exam.timerInterval);
        switchView('home');
      }
    });
    DOM.examFlagBtn.addEventListener('click', toggleExamFlag);
    DOM.examPaletteToggle.addEventListener('click', () => {
      DOM.examPaletteSidebar.classList.toggle('hidden');
    });
    DOM.examPrevBtn.addEventListener('click', () => {
      if (STATE.currentIndex > 0) {
        STATE.currentIndex--;
        renderExamQuestion();
        renderExamPalette();
      }
    });
    DOM.examNextBtn.addEventListener('click', () => {
      if (STATE.currentIndex < STATE.sessionQuestions.length - 1) {
        STATE.currentIndex++;
        renderExamQuestion();
        renderExamPalette();
      }
    });
    DOM.examSubmitBtn.addEventListener('click', promptSubmitExam);
    DOM.modalCancelBtn.addEventListener('click', () => DOM.submitModal.classList.add('hidden'));
    DOM.modalConfirmBtn.addEventListener('click', submitExam);

    // --- Results Mode Events ---
    DOM.resHomeBtn.addEventListener('click', () => switchView('home'));
    DOM.resRetakeAllBtn.addEventListener('click', () => {
      launchExamMode(STATE.sessionQuestions);
    });
    DOM.resRetakeMissedBtn.addEventListener('click', () => {
      const missed = STATE.exam.results.breakdown
        .filter(b => !b.isCorrect)
        .map(b => b.question);

      if (missed.length === 0) {
        alert('Congratulations! You scored 100% — no missed questions to retake!');
        return;
      }
      STATE.sessionQuestions = missed;
      launchExamMode(missed);
    });

    DOM.reviewFilterChips.querySelectorAll('.btn-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        DOM.reviewFilterChips.querySelectorAll('.btn-chip').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        renderReviewList(btn.getAttribute('data-filter'));
      });
    });

    // --- Flashcards Events ---
    DOM.fcExitBtn.addEventListener('click', () => switchView('home'));
    DOM.flashcardScene.addEventListener('click', flipFlashcard);
    DOM.fcFlipBtn.addEventListener('click', flipFlashcard);
    DOM.fcHardBtn.addEventListener('click', () => rateFlashcard(false));
    DOM.fcEasyBtn.addEventListener('click', () => rateFlashcard(true));
    DOM.fcPrevBtn.addEventListener('click', () => {
      if (STATE.flashcards.currentIndex > 0) {
        STATE.flashcards.currentIndex--;
        renderFlashcard();
      }
    });
    DOM.fcNextBtn.addEventListener('click', () => {
      if (STATE.flashcards.currentIndex < STATE.flashcards.deck.length - 1) {
        STATE.flashcards.currentIndex++;
        renderFlashcard();
      }
    });
    DOM.fcShuffleBtn.addEventListener('click', () => {
      STATE.flashcards.deck = shuffleArray(STATE.flashcards.deck);
      STATE.flashcards.currentIndex = 0;
      renderFlashcard();
    });
    DOM.fcResetBtn.addEventListener('click', () => {
      if (confirm('Reset mastery progress for this deck?')) {
        STATE.flashcards.mastered.clear();
        saveStorage(STORAGE_KEYS.FLASHCARD_MASTERY, STATE.flashcards.mastered);
        updateFlashcardsStats();
        renderFlashcard();
      }
    });

    // --- Question Bank Events ---
    DOM.bankExitBtn.addEventListener('click', () => switchView('home'));
    DOM.bankSearchInput.addEventListener('input', () => {
      const hasText = DOM.bankSearchInput.value.length > 0;
      DOM.clearSearchBtn.classList.toggle('hidden', !hasText);
      renderQuestionBank();
    });
    DOM.clearSearchBtn.addEventListener('click', () => {
      DOM.bankSearchInput.value = '';
      DOM.clearSearchBtn.classList.add('hidden');
      renderQuestionBank();
    });
    DOM.bankModuleFilter.addEventListener('change', renderQuestionBank);
    DOM.bankBookmarksFilterBtn.addEventListener('click', () => {
      DOM.bankBookmarksFilterBtn.classList.toggle('selected');
      renderQuestionBank();
    });

    // --- Keyboard Shortcuts ---
    document.addEventListener('keydown', (e) => {
      // Flashcard shortcuts
      if (STATE.activeView === 'flashcards') {
        if (e.code === 'Space') {
          e.preventDefault();
          flipFlashcard();
        } else if (e.code === 'ArrowLeft') {
          e.preventDefault();
          if (STATE.flashcards.currentIndex > 0) {
            STATE.flashcards.currentIndex--;
            renderFlashcard();
          }
        } else if (e.code === 'ArrowRight') {
          e.preventDefault();
          if (STATE.flashcards.currentIndex < STATE.flashcards.deck.length - 1) {
            STATE.flashcards.currentIndex++;
            renderFlashcard();
          }
        } else if (e.key === '1') {
          rateFlashcard(false);
        } else if (e.key === '2') {
          rateFlashcard(true);
        }
      }

      // Study Mode keyboard shortcuts (A, B, C, D to answer, N for next, P for prev, E for explainer)
      if (STATE.activeView === 'study') {
        const key = e.key.toUpperCase();
        if (['A', 'B', 'C', 'D'].includes(key)) {
          const q = STATE.sessionQuestions[STATE.currentIndex];
          if (q) handleStudyOptionClick(key, q);
        } else if (e.code === 'ArrowRight' || key === 'N') {
          if (STATE.currentIndex < STATE.sessionQuestions.length - 1) {
            STATE.currentIndex++;
            renderStudyQuestion();
          }
        } else if (e.code === 'ArrowLeft' || key === 'P') {
          if (STATE.currentIndex > 0) {
            STATE.currentIndex--;
            renderStudyQuestion();
          }
        } else if (key === 'E') {
          toggleStudyExplainer();
        }
      }

      // Exam Mode shortcuts (A, B, C, D to select, ArrowLeft/Right for nav)
      if (STATE.activeView === 'exam') {
        const key = e.key.toUpperCase();
        if (['A', 'B', 'C', 'D'].includes(key)) {
          STATE.exam.answers[STATE.currentIndex] = key;
          renderExamQuestion();
          renderExamPalette();
        } else if (e.code === 'ArrowRight') {
          if (STATE.currentIndex < STATE.sessionQuestions.length - 1) {
            STATE.currentIndex++;
            renderExamQuestion();
            renderExamPalette();
          }
        } else if (e.code === 'ArrowLeft') {
          if (STATE.currentIndex > 0) {
            STATE.currentIndex--;
            renderExamQuestion();
            renderExamPalette();
          }
        } else if (key === 'F') {
          toggleExamFlag();
        }
      }
    });
  }

  // --- HTML ESCAPER HELPER ---
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Boot on DOM Ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
