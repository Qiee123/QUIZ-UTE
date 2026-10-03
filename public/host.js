const socket = io();

// State
let hostQuiz = null;
let currentQIndex = -1;
let totalQ = 20;

// Screens
const hostScreens = {
  lobby: document.getElementById('host-screen-lobby'),
  question: document.getElementById('host-screen-question'),
  review: document.getElementById('host-screen-review'),
  final: document.getElementById('host-screen-final')
};

function switchHostScreen(screenName) {
  Object.values(hostScreens).forEach(s => s && s.classList.remove('active'));
  if (hostScreens[screenName]) {
    hostScreens[screenName].classList.add('active');
  }
}

// Audio Toggle & Volume Slider in Host Header
const btnHostAudioToggle = document.getElementById('btn-host-audio-toggle');
const hostVolumeSlider = document.getElementById('host-volume-slider');

if (btnHostAudioToggle) {
  btnHostAudioToggle.addEventListener('click', () => {
    window.soundFX.init();
    const enabled = window.soundFX.toggleMute();
    btnHostAudioToggle.innerHTML = enabled ? '<i class="fa-solid fa-volume-high"></i>' : '<i class="fa-solid fa-volume-xmark"></i>';
    btnHostAudioToggle.classList.toggle('muted', !enabled);
    if (hostVolumeSlider) {
      hostVolumeSlider.value = enabled ? (window.soundFX.volume * 100) : 0;
    }
  });
}

if (hostVolumeSlider) {
  hostVolumeSlider.addEventListener('input', (e) => {
    window.soundFX.init();
    const val = Number(e.target.value);
    window.soundFX.setVolume(val);
    if (btnHostAudioToggle) {
      const isMuted = (val === 0);
      btnHostAudioToggle.innerHTML = isMuted ? '<i class="fa-solid fa-volume-xmark"></i>' : (val < 40 ? '<i class="fa-solid fa-volume-low"></i>' : '<i class="fa-solid fa-volume-high"></i>');
      btnHostAudioToggle.classList.toggle('muted', isMuted);
    }
  });
}

// Display URL & Load QR Code using dynamic browser origin
const currentOrigin = window.location.origin;
const hostJoinUrlEl = document.getElementById('host-join-url');
if (hostJoinUrlEl) hostJoinUrlEl.textContent = currentOrigin;

fetch('/api/info')
  .then(res => res.json())
  .then(info => {
    const pinEl = document.getElementById('host-pin-val');
    if (pinEl && info.pin) pinEl.textContent = info.pin;

    // Fetch QR Code for the current public web URL
    return fetch(`/api/qrcode?url=${encodeURIComponent(currentOrigin)}`);
  })
  .then(res => res ? res.json() : null)
  .then(qrData => {
    if (qrData && qrData.qrDataUrl) {
      const qrImg = document.getElementById('host-qr-img');
      if (qrImg) qrImg.src = qrData.qrDataUrl;
    }
  })
  .catch(err => {
    console.error('Error loading QR code:', err);
    if (hostJoinUrlEl) hostJoinUrlEl.textContent = window.location.origin;
  });

// Register as host
socket.emit('register_host');

socket.on('host_registered', (data) => {
  if (data.activeQuiz) {
    hostQuiz = data.activeQuiz;
    totalQ = data.activeQuiz.questions.length;
  }
  updatePlayerList(data.players || []);
  window.soundFX.startLobbyBGM();
});

// Update player list in lobby
socket.on('player_list_update', ({ count, players }) => {
  updatePlayerList(players);
});

function updatePlayerList(players) {
  const countEl = document.getElementById('host-lobby-count');
  if (countEl) countEl.textContent = players.length;

  const grid = document.getElementById('host-players-grid');
  if (grid) {
    if (players.length === 0) {
      grid.innerHTML = `<div style="grid-column: 1/-1; text-align:center; color:var(--text-muted); padding:16px; font-size:0.88rem;">Đang đợi sinh viên tham gia phòng thi...</div>`;
      return;
    }
    grid.innerHTML = players.map(p => `
      <div class="host-player-card">
        <div class="name">${escapeHtml(p.name)}</div>
        <div class="mssv">${escapeHtml(p.studentId || '')}</div>
      </div>
    `).join('');
  }
}

// Start Quiz Button
const btnStart = document.getElementById('btn-admin-start');
if (btnStart) {
  btnStart.addEventListener('click', () => {
    window.soundFX.init();
    window.soundFX.playPop();
    socket.emit('admin_start_quiz');
  });
}

socket.on('host_error', ({ message }) => {
  alert(message);
});

// Countdown
socket.on('countdown_start', ({ count }) => {
  window.soundFX.stopBGM();
  window.soundFX.playCountdown(count);
});

socket.on('countdown_tick', ({ count }) => {
  window.soundFX.playCountdown(count);
});

// Question Start
socket.on('question_start', (data) => {
  switchHostScreen('question');
  window.soundFX.startQuizBGM();
  currentQIndex = data.index;
  totalQ = data.total;

  document.getElementById('host-q-current').textContent = data.index + 1;
  document.getElementById('host-q-total').textContent = data.total;
  document.getElementById('host-time-left').textContent = data.timeLimit;
  document.getElementById('host-timer-box').classList.remove('warning');
  document.getElementById('host-submission-ticker').textContent = '0 / ' + (document.getElementById('host-lobby-count')?.textContent || '0') + ' đã nộp bài';

  // Animate Host Duolingo Progress Bar
  const hostProgress = document.getElementById('host-progress-fill');
  if (hostProgress && data.total) {
    const pct = Math.min(100, Math.round(((data.index + 1) / data.total) * 100));
    hostProgress.style.width = pct + '%';
  }

  document.getElementById('host-question-text').textContent = data.question;

  // Image handling
  const imgWrap = document.getElementById('host-question-img-wrap');
  const imgEl = document.getElementById('host-question-img');
  if (data.image) {
    imgEl.src = data.image;
    imgWrap.style.display = 'flex';
  } else {
    imgWrap.style.display = 'none';
  }

  // Answer options
  const opt0 = document.getElementById('host-opt-0');
  const opt1 = document.getElementById('host-opt-1');
  const opt2 = document.getElementById('host-opt-2');
  const opt3 = document.getElementById('host-opt-3');

  opt0.textContent = data.options[0] || '';
  opt1.textContent = data.options[1] || '';
  
  if (data.options[2]) {
    opt2.parentElement.style.display = 'flex';
    opt2.textContent = data.options[2];
  } else {
    opt2.parentElement.style.display = 'none';
  }

  if (data.options[3]) {
    opt3.parentElement.style.display = 'flex';
    opt3.textContent = data.options[3];
  } else {
    opt3.parentElement.style.display = 'none';
  }
});

// Answer Progress Ticker
socket.on('answer_progress', ({ answeredCount, totalCount }) => {
  const ticker = document.getElementById('host-submission-ticker');
  if (ticker) {
    ticker.textContent = `${answeredCount} / ${totalCount} đã nộp bài`;
  }
});

// Timer Tick
socket.on('timer_tick', ({ timeRemaining }) => {
  const timerBox = document.getElementById('host-timer-box');
  const timeLeft = document.getElementById('host-time-left');
  if (timeLeft) timeLeft.textContent = timeRemaining;

  if (timeRemaining <= 5) {
    if (timerBox) timerBox.classList.add('warning');
    window.soundFX.playUrgentTick();
  }
});

// Question Ended & Review
socket.on('question_ended', (data) => {
  switchHostScreen('review');
  window.soundFX.stopBGM();

  const btnNextLabel = document.getElementById('btn-next-label');
  if (data.isLastQuestion) {
    btnNextLabel.textContent = 'XEM KẾT QUẢ CHUNG CUỘC';
  } else {
    btnNextLabel.textContent = 'CÂU TIẾP THEO';
  }

  // Update Stat Bars
  const maxVotes = Math.max(1, ...data.stats);
  for (let i = 0; i < 4; i++) {
    const barEl = document.getElementById(`stat-bar-${i}`);
    const votes = data.stats[i] || 0;
    const heightPct = Math.round((votes / maxVotes) * 140) + 16; // 16px to 156px
    barEl.style.height = `${heightPct}px`;
    barEl.textContent = votes;

    if (i === data.correctAnswer) {
      barEl.parentElement.style.borderColor = '#10b981';
      barEl.parentElement.style.background = '#ecfdf5';
    } else {
      barEl.parentElement.style.borderColor = 'var(--border-light)';
      barEl.parentElement.style.background = '#ffffff';
    }
  }

  // Correct Text & Explanation
  document.getElementById('host-review-correct-text').textContent = `Đáp án ${String.fromCharCode(65 + data.correctAnswer)}`;
  document.getElementById('host-review-explanation').textContent = data.explanation;

  // Top 5 List
  const top5List = document.getElementById('host-top5-list');
  top5List.innerHTML = data.top5.map((p, idx) => `
    <div style="display:flex; justify-content:space-between; align-items:center; background:#ffffff; border:1px solid var(--border-light); padding:8px 14px; border-radius:6px;">
      <div style="display:flex; align-items:center; gap:8px;">
        <span style="font-weight:800; color:var(--primary-navy); width:24px;">#${idx + 1}</span>
        <strong style="color:var(--text-primary); font-size:0.92rem;">${escapeHtml(p.name)}</strong>
        <span style="color:var(--text-muted); font-size:0.8rem;">(${escapeHtml(p.studentId || '')})</span>
      </div>
      <div style="font-weight:700; color:var(--primary-blue); font-size:0.92rem;">${p.score} điểm</div>
    </div>
  `).join('');
});

// Admin Next Question Button
const btnNext = document.getElementById('btn-admin-next');
if (btnNext) {
  btnNext.addEventListener('click', () => {
    window.soundFX.playPop();
    socket.emit('admin_next_question');
  });
}

// Quiz Finished Grand Finale
socket.on('quiz_finished', ({ sessionId, podium, top20Players, top20Count, totalCount, fullLeaderboard }) => {
  switchHostScreen('final');
  window.soundFX.playFanfare();

  // Update Podium
  if (podium[0]) {
    document.getElementById('podium-1-name').textContent = podium[0].name;
    document.getElementById('podium-1-score').textContent = `${podium[0].score} pts`;
  }
  if (podium[1]) {
    document.getElementById('podium-2-name').textContent = podium[1].name;
    document.getElementById('podium-2-score').textContent = `${podium[1].score} pts`;
  }
  if (podium[2]) {
    document.getElementById('podium-3-name').textContent = podium[2].name;
    document.getElementById('podium-3-score').textContent = `${podium[2].score} pts`;
  }

  // Top 20 Cards
  document.getElementById('host-top20-num').textContent = top20Count;
  const top20Grid = document.getElementById('host-final-top20-grid');
  top20Grid.innerHTML = top20Players.map(p => `
    <div class="top20-card">
      <h4>Hạng ${p.rank}: ${escapeHtml(p.name)}</h4>
      <p>MSSV: ${escapeHtml(p.studentId || 'N/A')} • ${p.score} điểm</p>
      <span class="top20-badge-tag">+1.0 Điểm Chuyên Cần</span>
    </div>
  `).join('');

  // Full Leaderboard Table
  const tbody = document.getElementById('host-full-leaderboard-body');
  tbody.innerHTML = fullLeaderboard.map(r => `
    <tr class="${r.isTop20 ? 'top20-row' : ''}">
      <td style="font-weight:800; color:var(--primary-navy);">#${r.rank}</td>
      <td>${escapeHtml(r.studentId || 'N/A')}</td>
      <td style="font-weight:700;">${escapeHtml(r.name)}</td>
      <td style="font-weight:700; color:var(--primary-blue);">${r.score}</td>
      <td>${r.correctCount}/20</td>
      <td>${r.accuracy}%</td>
      <td>
        ${r.isTop20 ? '<span style="color:#b45309; font-weight:700;">🏆 +1.0 Điểm Cộng</span>' : '<span style="color:var(--text-muted);">Hoàn thành</span>'}
      </td>
    </tr>
  `).join('');

  // Excel Button
  const excelBtn = document.getElementById('host-btn-export-excel');
  if (excelBtn) {
    excelBtn.href = `/api/export-excel/${sessionId}`;
  }
});

// Reset Room Button
const btnReset = document.getElementById('btn-host-reset-room');
if (btnReset) {
  btnReset.addEventListener('click', () => {
    if (confirm('Bạn có chắc muốn đặt lại phòng thi và xóa kết quả hiện tại?')) {
      window.soundFX.stopBGM();
      socket.emit('admin_reset_room');
      switchHostScreen('lobby');
      window.soundFX.startLobbyBGM();
    }
  });
}

socket.on('room_reset', () => {
  switchHostScreen('lobby');
  window.soundFX.startLobbyBGM();
});

// Escape HTML utility
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
