const socket = io();

// State
let myPlayer = null;
let currentQuestionIndex = -1;
let selectedAnswer = null;
let myAnswersHistory = [];

// DOM Elements
const screens = {
  join: document.getElementById('screen-join'),
  lobby: document.getElementById('screen-lobby'),
  question: document.getElementById('screen-question'),
  review: document.getElementById('screen-review'),
  final: document.getElementById('screen-final')
};

function switchScreen(screenName) {
  Object.values(screens).forEach(s => s && s.classList.remove('active'));
  if (screens[screenName]) {
    screens[screenName].classList.add('active');
  }
}

// Audio Toggle & Volume Slider in Header
const btnAudioToggle = document.getElementById('btn-audio-toggle');
const volumeSlider = document.getElementById('volume-slider');

if (btnAudioToggle) {
  btnAudioToggle.addEventListener('click', () => {
    window.soundFX.init();
    const enabled = window.soundFX.toggleMute();
    btnAudioToggle.innerHTML = enabled ? '<i class="fa-solid fa-volume-high"></i>' : '<i class="fa-solid fa-volume-xmark"></i>';
    btnAudioToggle.classList.toggle('muted', !enabled);
    if (volumeSlider) {
      volumeSlider.value = enabled ? (window.soundFX.volume * 100) : 0;
    }
  });
}

if (volumeSlider) {
  volumeSlider.addEventListener('input', (e) => {
    window.soundFX.init();
    const val = Number(e.target.value);
    window.soundFX.setVolume(val);
    if (btnAudioToggle) {
      const isMuted = (val === 0);
      btnAudioToggle.innerHTML = isMuted ? '<i class="fa-solid fa-volume-xmark"></i>' : (val < 40 ? '<i class="fa-solid fa-volume-low"></i>' : '<i class="fa-solid fa-volume-high"></i>');
      btnAudioToggle.classList.toggle('muted', isMuted);
    }
  });
}

// Auto-fill saved credentials on page load
document.addEventListener('DOMContentLoaded', () => {
  const savedName = localStorage.getItem('eduquiz_name');
  const savedMSSV = localStorage.getItem('eduquiz_mssv');
  const savedPin = localStorage.getItem('eduquiz_pin');

  const inputName = document.getElementById('input-name');
  const inputMSSV = document.getElementById('input-mssv');
  const inputPin = document.getElementById('input-pin');

  if (savedName && inputName) inputName.value = savedName;
  if (savedMSSV && inputMSSV) inputMSSV.value = savedMSSV;
  if (savedPin && inputPin) inputPin.value = savedPin;
});

// Auto-reconnect if browser disconnected temporarily
socket.on('connect', () => {
  const activeSession = sessionStorage.getItem('eduquiz_active');
  const savedName = localStorage.getItem('eduquiz_name');
  const savedMSSV = localStorage.getItem('eduquiz_mssv');
  const savedPin = localStorage.getItem('eduquiz_pin') || '130105';

  if (activeSession === 'true' && savedName && savedMSSV) {
    console.log('[Socket] Reconnecting automatically as:', savedName);
    socket.emit('player_join', {
      name: savedName,
      studentId: savedMSSV,
      pin: savedPin,
      avatar: '🎓'
    });
  }
});

// Join Form Submit
const joinForm = document.getElementById('join-form');
if (joinForm) {
  joinForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('input-name').value.trim();
    const studentId = document.getElementById('input-mssv').value.trim().toUpperCase();
    const pin = document.getElementById('input-pin').value.trim();

    if (!name) {
      alert('Vui lòng nhập Họ và Tên của bạn!');
      document.getElementById('input-name').focus();
      return;
    }

    // Name Validation Rule: Must have at least 2 words (Full Name)
    const nameWords = name.split(/\s+/).filter(Boolean);
    if (nameWords.length < 2 || name.length < 4) {
      alert('⚠️ QUY ĐỊNH ĐĂNG NHẬP:\n\nBạn phải nhập ĐẦY ĐỦ CẢ HỌ VÀ TÊN (ví dụ: Trương Văn Huy, Nguyễn Văn An).\n\nKhông được nhập tên riêng 1 chữ (huy, an) hoặc biệt danh (Qiee, Pro...) để giảng viên ghi nhận điểm cộng chính xác!');
      document.getElementById('input-name').focus();
      return;
    }

    if (!studentId || studentId.length < 3) {
      alert('Vui lòng nhập Mã số sinh viên hợp lệ (ví dụ: 26TX810026 hoặc 23110001)!');
      document.getElementById('input-mssv').focus();
      return;
    }

    // Save to localStorage for convenience
    localStorage.setItem('eduquiz_name', name);
    localStorage.setItem('eduquiz_mssv', studentId);
    localStorage.setItem('eduquiz_pin', pin);

    window.soundFX.init();
    window.soundFX.playPop();

    socket.emit('player_join', {
      name,
      studentId,
      pin,
      avatar: '🎓'
    });
  });
}

// Socket Listeners
socket.on('join_error', ({ message }) => {
  alert(message);
});

socket.on('join_success', ({ player, status, quizTitle }) => {
  myPlayer = player;
  sessionStorage.setItem('eduquiz_active', 'true');

  const nameEl = document.getElementById('lobby-player-name');
  const mssvEl = document.getElementById('lobby-player-mssv');
  if (nameEl) nameEl.textContent = player.name;
  if (mssvEl) mssvEl.textContent = `(${player.studentId})`;

  // Update header points if reconnecting mid-quiz
  const scoreBadge = document.getElementById('player-score-badge');
  if (scoreBadge && player.score !== undefined) {
    scoreBadge.textContent = `${player.score} XP`;
  }

  if (status === 'LOBBY' || status === 'STARTING') {
    switchScreen('lobby');
    window.soundFX.startLobbyBGM();
  }
});

socket.on('player_list_update', ({ count, players }) => {
  const countEl = document.getElementById('lobby-peer-count');
  if (countEl) countEl.textContent = count;

  const peersGrid = document.getElementById('lobby-peers-grid');
  if (peersGrid) {
    peersGrid.innerHTML = players.map(p => `
      <div class="peer-chip">
        <span>${escapeHtml(p.name)}</span>
        <span style="opacity:0.65; font-size:0.75rem;">(${escapeHtml(p.studentId || '')})</span>
      </div>
    `).join('');
  }
});

// Reset Handler (When host resets the room)
socket.on('room_reset', () => {
  window.soundFX.stopBGM();
  myPlayer = null;
  sessionStorage.removeItem('eduquiz_active');
  myAnswersHistory = [];
  currentQuestionIndex = -1;
  selectedAnswer = null;

  switchScreen('join');
  alert('Chủ phòng đã đặt lại lượt thi mới! Vui lòng bấm Vào Phòng Chờ để tham gia lượt thi mới.');
});

// Countdown Overlay
const countdownOverlay = document.getElementById('countdown-overlay');
const countdownNum = document.getElementById('countdown-num');

socket.on('countdown_start', ({ count }) => {
  window.soundFX.stopBGM();
  if (countdownOverlay) countdownOverlay.classList.add('active');
  if (countdownNum) countdownNum.textContent = count;
  window.soundFX.playCountdown(count);
});

socket.on('countdown_tick', ({ count }) => {
  if (countdownNum) countdownNum.textContent = count;
  window.soundFX.playCountdown(count);
});

// Question Start
socket.on('question_start', (data) => {
  if (countdownOverlay) countdownOverlay.classList.remove('active');
  switchScreen('question');
  window.soundFX.startQuizBGM();

  currentQuestionIndex = data.index;
  selectedAnswer = null;

  // Header info
  document.getElementById('q-current').textContent = data.index + 1;
  document.getElementById('q-total').textContent = data.total;
  document.getElementById('time-left').textContent = data.timeLimit;
  document.getElementById('timer-box').classList.remove('warning');
  document.getElementById('submit-notice').style.display = 'none';

  // Animate Duolingo Progress Bar
  const progressFill = document.getElementById('duo-progress-fill');
  if (progressFill && data.total) {
    const pct = Math.min(100, Math.round(((data.index + 1) / data.total) * 100));
    progressFill.style.width = pct + '%';
  }

  // Question content
  document.getElementById('question-text').textContent = data.question;

  // Image handling
  const imgWrap = document.getElementById('question-img-wrap');
  const imgEl = document.getElementById('question-img');
  if (data.image) {
    imgEl.src = data.image;
    imgWrap.style.display = 'flex';
  } else {
    imgWrap.style.display = 'none';
  }

  // Answer options
  const answersGrid = document.getElementById('answers-grid');
  answersGrid.innerHTML = '';

  const letters = ['A', 'B', 'C', 'D'];
  data.options.forEach((optText, idx) => {
    const btn = document.createElement('button');
    btn.className = `answer-card ans-${idx}`;
    btn.setAttribute('data-idx', idx);
    btn.innerHTML = `
      <span class="opt-letter">${letters[idx]}</span>
      <span class="ans-label">${escapeHtml(optText)}</span>
    `;

    btn.addEventListener('click', () => {
      if (selectedAnswer !== null) return; // already selected
      selectedAnswer = idx;
      window.soundFX.playPop();

      btn.classList.add('selected');

      // Disable all buttons
      const allBtns = answersGrid.querySelectorAll('.answer-card');
      allBtns.forEach(b => {
        b.disabled = true;
        if (b !== btn) b.classList.add('disabled-unselected');
      });

      document.getElementById('submit-notice').style.display = 'block';

      // Send answer to server
      socket.emit('submit_answer', {
        questionIndex: currentQuestionIndex,
        answerIndex: idx
      });
    });

    answersGrid.appendChild(btn);
  });
});

// Timer Tick
socket.on('timer_tick', ({ timeRemaining }) => {
  const timerBox = document.getElementById('timer-box');
  const timeLeft = document.getElementById('time-left');
  if (timeLeft) {
    timeLeft.textContent = timeRemaining;
  }
  if (timeRemaining <= 5) {
    if (timerBox) timerBox.classList.add('warning');
    window.soundFX.playUrgentTick();
  }
});

// Individual Question Result
socket.on('player_question_result', (result) => {
  switchScreen('review');

  const statusEl = document.getElementById('review-feedback-status');
  const titleEl = document.getElementById('review-feedback-title');
  const ptsBadge = document.getElementById('review-points-badge');

  if (result.isCorrect) {
    statusEl.className = 'feedback-status correct';
    statusEl.innerHTML = '<i class="fa-solid fa-circle-check"></i> <span id="review-feedback-title">CHÍNH XÁC!</span>';
    ptsBadge.innerHTML = `<i class="fa-solid fa-bolt" style="color:var(--duo-yellow-dark);"></i> +${result.pointsAwarded} XP`;
    window.soundFX.playCorrect();
  } else {
    statusEl.className = 'feedback-status incorrect';
    statusEl.innerHTML = '<i class="fa-solid fa-circle-xmark"></i> <span id="review-feedback-title">CHƯA CHÍNH XÁC!</span>';
    ptsBadge.innerHTML = `<i class="fa-solid fa-bolt" style="color:var(--text-light);"></i> +0 XP`;
    window.soundFX.playIncorrect();
  }

  // Update Live Rank Display
  const rankValEl = document.getElementById('review-rank');
  const rankTotalEl = document.getElementById('review-rank-total');
  const scoreEl = document.getElementById('review-total-score');
  const top20Pill = document.getElementById('review-top20-pill');
  const top20Text = document.getElementById('review-top20-text');

  if (rankValEl) rankValEl.textContent = `#${result.rank}`;
  if (rankTotalEl) rankTotalEl.textContent = `/ ${result.totalPlayers || 0} bạn`;
  if (scoreEl) scoreEl.textContent = result.totalScore;

  if (top20Pill && top20Text) {
    if (result.isTop20) {
      top20Pill.className = 'live-rank-pill top20';
      top20Text.innerHTML = `⭐ Đang trong Top 20% Nhận Điểm Cộng (Top ${result.top20Threshold} bạn)`;
    } else {
      top20Pill.className = 'live-rank-pill';
      top20Text.innerHTML = `Cần thêm điểm để vào Top 20% (Top ${result.top20Threshold} bạn)`;
    }
  }

  document.getElementById('review-explanation-text').textContent = result.explanation;

  // Save into player's local history
  myAnswersHistory.push({
    questionIndex: currentQuestionIndex,
    isCorrect: result.isCorrect,
    points: result.pointsAwarded,
    chosenAnswer: result.chosenAnswer,
    correctAnswer: result.correctAnswer,
    explanation: result.explanation
  });

  // Update top bar score & rank
  const scoreBadge = document.getElementById('player-score-badge');
  if (scoreBadge) scoreBadge.textContent = `Hạng #${result.rank} • ${result.totalScore} XP`;
});

// Quiz Finished Grand Finale
socket.on('quiz_finished', ({ sessionId, podium, top20Players, top20Count, totalCount, fullLeaderboard }) => {
  switchScreen('final');
  window.soundFX.playFanfare();
  window.confettiCannon.fire(5000);

  // Check if current player is in Top 20%
  const isMeTop20 = top20Players.some(p => p.id === socket.id || (myPlayer && p.studentId === myPlayer.studentId));
  const myRecord = fullLeaderboard.find(r => myPlayer && (r.studentId === myPlayer.studentId || r.name === myPlayer.name));

  const userBanner = document.getElementById('user-top20-banner');
  const userBonusStatus = document.getElementById('user-bonus-status');
  const userRankBadge = document.getElementById('user-personal-rank-badge');

  if (isMeTop20) {
    userBanner.style.borderColor = 'var(--accent-amber)';
    userBanner.style.background = '#fffbeb';
    userBonusStatus.innerHTML = `<strong>XUẤT SẮC! BẠN ĐÃ LỌT VÀO TOP 20% ĐẠT ĐIỂM CAO NHẤT!</strong><br>Được đề xuất cộng <strong>+1.0 điểm</strong> chuyên cần môn Triết học Mác - Lênin.`;
  } else {
    userBonusStatus.innerHTML = `Bạn đã hoàn thành tốt 20 câu hỏi trắc nghiệm!`;
  }

  if (myRecord) {
    userRankBadge.innerHTML = `Hạng của bạn: <strong style="color:var(--primary-navy); font-size:1.2rem;">#${myRecord.rank}</strong> / ${totalCount} • Điểm: <strong>${myRecord.score}</strong> (${myRecord.correctCount}/20 câu đúng)`;
  }

  document.getElementById('final-top20-count').textContent = top20Count;

  // Render Top 20 Cards
  const top20Grid = document.getElementById('final-top20-list');
  top20Grid.innerHTML = top20Players.map(p => `
    <div class="top20-card">
      <h4>Hạng ${p.rank}: ${escapeHtml(p.name)}</h4>
      <p>MSSV: ${escapeHtml(p.studentId || 'N/A')} • ${p.score} điểm</p>
      <span class="top20-badge-tag">+1.0 Điểm Chuyên Cần</span>
    </div>
  `).join('');
});

// Modal History Handling
const historyModal = document.getElementById('history-modal');
const btnViewHistory = document.getElementById('btn-view-my-history');
const modalCloseBtn = document.getElementById('modal-close-btn');

if (btnViewHistory) {
  btnViewHistory.addEventListener('click', () => {
    renderMyHistoryModal();
    if (historyModal) historyModal.classList.add('active');
  });
}

if (modalCloseBtn) {
  modalCloseBtn.addEventListener('click', () => {
    if (historyModal) historyModal.classList.remove('active');
  });
}

if (historyModal) {
  historyModal.addEventListener('click', (e) => {
    if (e.target === historyModal) {
      historyModal.classList.remove('active');
    }
  });
}

// Modal QR Share Handling
const qrModal = document.getElementById('qr-modal');
const btnShowPlayerQr = document.getElementById('btn-show-player-qr');
const qrModalCloseBtn = document.getElementById('qr-modal-close-btn');

if (btnShowPlayerQr) {
  btnShowPlayerQr.addEventListener('click', () => {
    window.soundFX.playPop();
    const currentUrl = window.location.origin;
    fetch(`/api/qrcode?url=${encodeURIComponent(currentUrl)}`)
      .then(res => res.json())
      .then(data => {
        if (data && data.qrDataUrl) {
          document.getElementById('player-qr-img').src = data.qrDataUrl;
          if (qrModal) qrModal.classList.add('active');
        }
      })
      .catch(err => console.error('Error fetching player QR code:', err));
  });
}

if (qrModalCloseBtn) {
  qrModalCloseBtn.addEventListener('click', () => {
    if (qrModal) qrModal.classList.remove('active');
  });
}

if (qrModal) {
  qrModal.addEventListener('click', (e) => {
    if (e.target === qrModal) {
      qrModal.classList.remove('active');
    }
  });
}

function renderMyHistoryModal() {
  const modalBody = document.getElementById('history-modal-body');
  if (!modalBody) return;
  if (myAnswersHistory.length === 0) {
    modalBody.innerHTML = `<p style="text-align:center; color:var(--text-muted);">Chưa có dữ liệu lịch sử làm bài.</p>`;
    return;
  }

  modalBody.innerHTML = myAnswersHistory.map((item, idx) => `
    <div class="history-item ${item.isCorrect ? 'correct' : ''}">
      <div class="history-item-top">
        <span style="color:${item.isCorrect ? '#065f46' : '#991b1b'}">
          ${item.isCorrect ? '✔ Đúng (+ ' + item.points + ' điểm)' : '✖ Chưa đúng (+0 điểm)'}
        </span>
        <span style="color:var(--text-muted)">Câu ${idx + 1}/20</span>
      </div>
      <div class="history-ans-detail">
        ${item.explanation ? `<strong>Giải thích:</strong> ${escapeHtml(item.explanation)}` : ''}
      </div>
    </div>
  `).join('');
}

// Utility HTML escape
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
