const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const XLSX = require('xlsx');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'data', 'database.json');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Healthcheck endpoints for Cloud Deployment (Render, Railway, Fly)
app.get(['/healthz', '/health'], (req, res) => {
  res.status(200).json({ status: 'healthy', uptime: process.uptime() });
});

// Database Helpers
function getDB() {
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading database:', err);
    return { system: {}, subjects: [], quizzes: [], sessions: [] };
  }
}

function saveDB(db) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving database:', err);
  }
}

// In-Memory Game Session State
let gameState = {
  status: 'LOBBY', // 'LOBBY', 'STARTING', 'QUESTION', 'REVIEW', 'FINISHED'
  quizId: 'triet-hoc-nguyen-nhan-ket-qua',
  roomPin: '130105',
  currentQuestionIndex: -1,
  totalQuestions: 20,
  timeRemaining: 0,
  timerInterval: null,
  players: {}, // socketId -> { id, name, studentId, avatar, score, streak, correctCount, answers: { [qIdx]: { answer, isCorrect, points, timeTaken } } }
  hostSocketId: null,
  activeQuiz: null,
  completedSessionId: null
};

// Initialize Active Quiz from DB
function loadActiveQuiz() {
  const db = getDB();
  const quiz = db.quizzes.find(q => q.id === (db.system.activeQuizId || 'triet-hoc-nguyen-nhan-ket-qua'));
  if (quiz) {
    gameState.activeQuiz = quiz;
    gameState.totalQuestions = quiz.questions.length;
    gameState.roomPin = db.system.roomPin || '130105';
  }
}
loadActiveQuiz();

// Helper: Calculate Points
function calculateScore(isCorrect, timeRemaining, timeLimit, streak) {
  if (!isCorrect) return 0;
  // Base 500 pts + up to 500 speed bonus + streak bonus (up to 200)
  const speedRatio = Math.max(0, timeRemaining / timeLimit);
  const basePoints = 500;
  const speedBonus = Math.round(500 * speedRatio);
  const streakBonus = Math.min(200, (streak - 1) * 50);
  return basePoints + speedBonus + Math.max(0, streakBonus);
}

// Helper: Get Player List Array Sorted by Score
function getSortedPlayers() {
  return Object.values(gameState.players).sort((a, b) => b.score - a.score);
}

// Socket.io Game Logic
io.on('connection', (socket) => {
  console.log(`[Socket] Connected: ${socket.id}`);

  // Send initial room state
  socket.emit('room_info', {
    status: gameState.status,
    roomPin: gameState.roomPin,
    quizTitle: gameState.activeQuiz ? gameState.activeQuiz.title : 'Trắc nghiệm Triết học',
    totalQuestions: gameState.totalQuestions
  });

  // Host registers
  socket.on('register_host', () => {
    gameState.hostSocketId = socket.id;
    socket.emit('host_registered', {
      players: getSortedPlayers(),
      status: gameState.status,
      currentQuestionIndex: gameState.currentQuestionIndex,
      activeQuiz: gameState.activeQuiz
    });
    console.log(`[Host] Host registered on socket ${socket.id}`);
  });

  // Player joins lobby or reconnects
  socket.on('player_join', ({ name, studentId, pin, avatar }) => {
    if (pin && pin.trim().toLowerCase() !== gameState.roomPin.toLowerCase()) {
      socket.emit('join_error', { message: 'Mã PIN phòng không chính xác!' });
      return;
    }
    if (!name || !name.trim()) {
      socket.emit('join_error', { message: 'Vui lòng nhập họ và tên của bạn!' });
      return;
    }

    const cleanName = name.trim();
    const cleanMSSV = (studentId || '').trim().toUpperCase();
    const playerAvatar = avatar || '🎓';

    // Full name rule: Must contain at least 2 words
    const words = cleanName.split(/\s+/).filter(Boolean);
    if (words.length < 2 || cleanName.length < 4) {
      socket.emit('join_error', { 
        message: 'Quy định: Vui lòng nhập đầy đủ Họ và Tên (ví dụ: Trương Văn Huy), không nhập tên riêng 1 chữ hoặc biệt danh!' 
      });
      return;
    }

    if (!cleanMSSV || cleanMSSV.length < 3) {
      socket.emit('join_error', { 
        message: 'Vui lòng nhập Mã số sinh viên hợp lệ (ví dụ: 26TX810026 hoặc 23110001)!' 
      });
      return;
    }

    // Check if player is reconnecting with same studentId or name
    let existingKey = Object.keys(gameState.players).find(k => {
      const p = gameState.players[k];
      if (cleanMSSV && p.studentId && p.studentId.toUpperCase() === cleanMSSV) return true;
      if (p.name.toLowerCase() === cleanName.toLowerCase()) return true;
      return false;
    });

    let player;
    if (existingKey) {
      player = gameState.players[existingKey];
      delete gameState.players[existingKey];
      player.id = socket.id;
      player.name = cleanName;
      if (cleanMSSV) player.studentId = cleanMSSV;
      player.disconnected = false;
      gameState.players[socket.id] = player;
      console.log(`[Player Reconnect] ${cleanName} (${cleanMSSV}) reconnected on socket ${socket.id}`);
    } else {
      player = {
        id: socket.id,
        name: cleanName,
        studentId: cleanMSSV,
        avatar: playerAvatar,
        score: 0,
        streak: 0,
        correctCount: 0,
        answers: {},
        disconnected: false
      };
      gameState.players[socket.id] = player;
      console.log(`[Lobby] Player joined: ${cleanName} (${cleanMSSV}) - Total: ${Object.keys(gameState.players).length}`);
    }

    // Acknowledge join success
    socket.emit('join_success', {
      player: gameState.players[socket.id],
      status: gameState.status,
      quizTitle: gameState.activeQuiz ? gameState.activeQuiz.title : 'Trắc nghiệm Triết học',
      currentQuestionIndex: gameState.currentQuestionIndex,
      totalQuestions: gameState.totalQuestions
    });

    // Notify Host and all players of updated player list
    io.emit('player_list_update', {
      count: Object.keys(gameState.players).length,
      players: getSortedPlayers()
    });

    // Sync game state if player joins/reconnects mid-game
    if (gameState.status === 'QUESTION' && gameState.currentQuestionIndex >= 0) {
      const q = gameState.activeQuiz.questions[gameState.currentQuestionIndex];
      socket.emit('question_start', {
        index: gameState.currentQuestionIndex,
        total: gameState.totalQuestions,
        question: q.question,
        type: q.type,
        options: q.options,
        timeLimit: Math.max(1, gameState.timeRemaining),
        image: q.image,
        points: q.points
      });

      // If already answered, acknowledge
      if (player.answers && player.answers[gameState.currentQuestionIndex] !== undefined) {
        socket.emit('answer_received', {
          questionIndex: gameState.currentQuestionIndex,
          submitted: true,
          timeRemaining: gameState.timeRemaining
        });
      }
    } else if (gameState.status === 'REVIEW' && gameState.currentQuestionIndex >= 0) {
      const q = gameState.activeQuiz.questions[gameState.currentQuestionIndex];
      const playerAns = player.answers[gameState.currentQuestionIndex] || {
        isCorrect: false,
        points: 0,
        answer: -1
      };
      const sortedPlayers = getSortedPlayers();
      const myRank = sortedPlayers.findIndex(x => x.id === socket.id) + 1;
      const top20Threshold = Math.max(1, Math.ceil(sortedPlayers.length * 0.20));

      socket.emit('player_question_result', {
        isCorrect: playerAns.isCorrect,
        pointsAwarded: playerAns.points,
        totalScore: player.score,
        correctAnswer: q.correctAnswer,
        chosenAnswer: playerAns.answer,
        streak: player.streak || 0,
        explanation: q.explanation,
        rank: myRank || 1,
        totalPlayers: sortedPlayers.length,
        isTop20: myRank <= top20Threshold,
        top20Threshold: top20Threshold
      });
    } else if (gameState.status === 'FINISHED') {
      const sortedPlayers = getSortedPlayers();
      const top20Count = Math.max(1, Math.ceil(sortedPlayers.length * 0.20));
      const top20Players = sortedPlayers.slice(0, top20Count);
      const podium = sortedPlayers.slice(0, 3);
      socket.emit('quiz_finished', {
        sessionId: gameState.completedSessionId,
        podium,
        top20Players,
        top20Count,
        totalCount: sortedPlayers.length,
        fullLeaderboard: sortedPlayers
      });
    }
  });

  // Host starts quiz
  socket.on('admin_start_quiz', () => {
    if (Object.keys(gameState.players).length === 0) {
      socket.emit('host_error', { message: 'Chưa có sinh viên nào tham gia phòng!' });
      return;
    }

    console.log('[Game] Admin triggered start quiz!');
    gameState.status = 'STARTING';
    gameState.currentQuestionIndex = 0;

    // Reset scores & answers for all players
    for (const pid in gameState.players) {
      gameState.players[pid].score = 0;
      gameState.players[pid].streak = 0;
      gameState.players[pid].correctCount = 0;
      gameState.players[pid].answers = {};
    }

    io.emit('countdown_start', { count: 3 });

    let countdown = 3;
    const cdInterval = setInterval(() => {
      countdown--;
      if (countdown > 0) {
        io.emit('countdown_tick', { count: countdown });
      } else {
        clearInterval(cdInterval);
        startQuestion(0);
      }
    }, 1000);
  });

  // Player submits answer
  socket.on('submit_answer', ({ questionIndex, answerIndex }) => {
    const player = gameState.players[socket.id];
    if (!player || gameState.status !== 'QUESTION') return;
    if (gameState.currentQuestionIndex !== questionIndex) return;
    if (player.answers[questionIndex] !== undefined) return; // already answered

    const question = gameState.activeQuiz.questions[questionIndex];
    const isCorrect = (answerIndex === question.correctAnswer);
    const timeTaken = question.timeLimit - gameState.timeRemaining;

    if (isCorrect) {
      player.streak++;
      player.correctCount++;
    } else {
      player.streak = 0;
    }

    const pointsAwarded = calculateScore(isCorrect, gameState.timeRemaining, question.timeLimit, player.streak);
    player.score += pointsAwarded;

    player.answers[questionIndex] = {
      answer: answerIndex,
      isCorrect,
      points: pointsAwarded,
      timeTaken: Math.max(0.5, timeTaken)
    };

    // Acknowledge submission to this player
    socket.emit('answer_received', {
      questionIndex,
      submitted: true,
      timeRemaining: gameState.timeRemaining
    });

    // Notify host of submission progress
    const activePlayers = Object.values(gameState.players).filter(p => !p.disconnected);
    const answeredCount = Object.values(gameState.players).filter(p => p.answers[questionIndex] !== undefined).length;
    const totalCount = Object.keys(gameState.players).length;
    io.emit('answer_progress', { answeredCount, totalCount });

    // If everyone answered, end question early!
    if (answeredCount >= totalCount && totalCount > 0) {
      if (gameState.timerInterval) {
        clearInterval(gameState.timerInterval);
        gameState.timerInterval = null;
      }
      setTimeout(() => endQuestion(), 400);
    }
  });

  // Host manually advances to next question
  socket.on('admin_next_question', () => {
    if (gameState.status !== 'REVIEW') return;
    const nextIdx = gameState.currentQuestionIndex + 1;
    if (nextIdx < gameState.totalQuestions) {
      startQuestion(nextIdx);
    } else {
      finishQuiz();
    }
  });

  // Host ends quiz early
  socket.on('admin_finish_quiz', () => {
    if (gameState.timerInterval) {
      clearInterval(gameState.timerInterval);
      gameState.timerInterval = null;
    }
    finishQuiz();
  });

  // Host resets room back to Lobby (clearing all players completely)
  socket.on('admin_reset_room', () => {
    if (gameState.timerInterval) {
      clearInterval(gameState.timerInterval);
      gameState.timerInterval = null;
    }
    gameState.status = 'LOBBY';
    gameState.currentQuestionIndex = -1;
    gameState.players = {}; // Completely reset players so everyone must re-join
    loadActiveQuiz();

    io.emit('room_reset', {
      roomPin: gameState.roomPin,
      quizTitle: gameState.activeQuiz.title
    });
    io.emit('player_list_update', {
      count: 0,
      players: []
    });
    console.log('[Room Reset] Room reset to Lobby. All players cleared.');
  });

  // Disconnect handler - preserve progress during game
  socket.on('disconnect', () => {
    if (gameState.players[socket.id]) {
      console.log(`[Player Disconnected] ${gameState.players[socket.id].name}`);
      gameState.players[socket.id].disconnected = true;
      
      // If room is in LOBBY, we can clean up disconnected user after a moment if they don't reconnect
      if (gameState.status === 'LOBBY') {
        setTimeout(() => {
          if (gameState.players[socket.id] && gameState.players[socket.id].disconnected) {
            delete gameState.players[socket.id];
            io.emit('player_list_update', {
              count: Object.keys(gameState.players).length,
              players: getSortedPlayers()
            });
          }
        }, 3000);
      }
    }
  });
});

// Function to start a question
function startQuestion(index) {
  if (gameState.timerInterval) {
    clearInterval(gameState.timerInterval);
    gameState.timerInterval = null;
  }

  gameState.status = 'QUESTION';
  gameState.currentQuestionIndex = index;
  const q = gameState.activeQuiz.questions[index];
  gameState.timeRemaining = q.timeLimit;

  // Broadcast question to all (without correctAnswer!)
  io.emit('question_start', {
    index,
    total: gameState.totalQuestions,
    question: q.question,
    type: q.type,
    options: q.options,
    timeLimit: q.timeLimit,
    image: q.image,
    points: q.points
  });

  console.log(`[Question] Started Question ${index + 1}/${gameState.totalQuestions}: ${q.question.substring(0, 50)}...`);

  // Start authoritative server timer
  gameState.timerInterval = setInterval(() => {
    gameState.timeRemaining--;
    io.emit('timer_tick', { timeRemaining: gameState.timeRemaining });

    if (gameState.timeRemaining <= 0) {
      clearInterval(gameState.timerInterval);
      gameState.timerInterval = null;
      endQuestion();
    }
  }, 1000);
}

// Function to end current question & reveal answers
function endQuestion() {
  gameState.status = 'REVIEW';
  const qIdx = gameState.currentQuestionIndex;
  const q = gameState.activeQuiz.questions[qIdx];

  // Process any unsubmitted players as timed out
  for (const pid in gameState.players) {
    const p = gameState.players[pid];
    if (p.answers[qIdx] === undefined) {
      p.streak = 0;
      p.answers[qIdx] = {
        answer: -1,
        isCorrect: false,
        points: 0,
        timeTaken: q.timeLimit
      };
    }
  }

  // Calculate statistics for each option
  const stats = [0, 0, 0, 0];
  for (const pid in gameState.players) {
    const ans = gameState.players[pid].answers[qIdx].answer;
    if (ans >= 0 && ans < stats.length) {
      stats[ans]++;
    }
  }

  const sortedPlayers = getSortedPlayers();
  const totalPlayers = sortedPlayers.length;
  const top20Threshold = Math.max(1, Math.ceil(totalPlayers * 0.20));

  const top5 = sortedPlayers.slice(0, 5).map(p => ({
    name: p.name,
    studentId: p.studentId,
    avatar: p.avatar,
    score: p.score,
    streak: p.streak
  }));

  // Send individualized result with instant live rank to each player
  for (const pid in gameState.players) {
    const p = gameState.players[pid];
    const playerAns = p.answers[qIdx];
    const socket = io.sockets.sockets.get(pid);
    const myRank = sortedPlayers.findIndex(x => x.id === pid) + 1;
    const isTop20 = myRank <= top20Threshold;

    if (socket) {
      socket.emit('player_question_result', {
        isCorrect: playerAns.isCorrect,
        pointsAwarded: playerAns.points,
        totalScore: p.score,
        correctAnswer: q.correctAnswer,
        chosenAnswer: playerAns.answer,
        streak: p.streak,
        explanation: q.explanation,
        rank: myRank,
        totalPlayers: totalPlayers,
        isTop20: isTop20,
        top20Threshold: top20Threshold
      });
    }
  }

  // Send host overview
  io.emit('question_ended', {
    questionIndex: qIdx,
    correctAnswer: q.correctAnswer,
    explanation: q.explanation,
    stats,
    top5,
    isLastQuestion: (qIdx === gameState.totalQuestions - 1)
  });
}

// Finish Quiz & Announce Top 20%
function finishQuiz() {
  gameState.status = 'FINISHED';
  const sortedPlayers = getSortedPlayers();
  const totalCount = sortedPlayers.length;

  // Calculate Top 20%
  const top20Count = Math.max(1, Math.ceil(totalCount * 0.20));
  const top20Players = sortedPlayers.slice(0, top20Count).map((p, idx) => ({
    rank: idx + 1,
    id: p.id,
    name: p.name,
    studentId: p.studentId,
    avatar: p.avatar,
    score: p.score,
    correctCount: p.correctCount,
    accuracy: Math.round((p.correctCount / gameState.totalQuestions) * 100)
  }));

  const podium = sortedPlayers.slice(0, 3).map((p, idx) => ({
    rank: idx + 1,
    name: p.name,
    studentId: p.studentId,
    avatar: p.avatar,
    score: p.score,
    correctCount: p.correctCount
  }));

  // Create persistent session record in DB
  const sessionId = 'session_' + Date.now();
  gameState.completedSessionId = sessionId;

  const db = getDB();
  const sessionRecord = {
    id: sessionId,
    quizId: gameState.quizId,
    quizTitle: gameState.activeQuiz.title,
    course: db.system.course || 'Triết học Mác - Lênin (LLCT130105)',
    lecturer: db.system.lecturer || 'ThS. Đoàn Thị Duyên',
    createdAt: new Date().toISOString(),
    totalParticipants: totalCount,
    top20Count,
    top20PercentThreshold: 20,
    results: sortedPlayers.map((p, idx) => {
      const isTop20 = idx < top20Count;
      return {
        rank: idx + 1,
        name: p.name,
        studentId: p.studentId,
        score: p.score,
        correctCount: p.correctCount,
        accuracy: Math.round((p.correctCount / gameState.totalQuestions) * 100),
        isTop20,
        bonusAwarded: isTop20 ? '+1.0 điểm cộng' : 'Tham gia tích cực',
        answers: p.answers
      };
    })
  };

  db.sessions.unshift(sessionRecord);
  saveDB(db);

  // Broadcast finale to all
  io.emit('quiz_finished', {
    sessionId,
    podium,
    top20Players,
    top20Count,
    totalCount,
    fullLeaderboard: sessionRecord.results
  });

  console.log(`[Finish] Quiz finished! Total: ${totalCount} players. Top 20% count: ${top20Count}. Session ID: ${sessionId}`);
}

// REST API Endpoints

// Get System Status & Active Quiz
app.get('/api/status', (req, res) => {
  const db = getDB();
  res.json({
    status: gameState.status,
    roomPin: gameState.roomPin,
    playerCount: Object.keys(gameState.players).length,
    system: db.system,
    activeQuiz: {
      id: gameState.activeQuiz ? gameState.activeQuiz.id : null,
      title: gameState.activeQuiz ? gameState.activeQuiz.title : '',
      totalQuestions: gameState.totalQuestions
    }
  });
});

// Get All Quizzes
app.get('/api/quizzes', (req, res) => {
  const db = getDB();
  res.json(db.quizzes);
});

// Add New Quiz (for other courses / subjects!)
app.post('/api/quizzes', (req, res) => {
  try {
    const { id, subjectId, title, description, questions } = req.body;
    if (!id || !title || !Array.isArray(questions)) {
      return res.status(400).json({ error: 'Dữ liệu bộ câu hỏi không hợp lệ!' });
    }
    const db = getDB();
    const newQuiz = {
      id,
      subjectId: subjectId || 'LLCT130105',
      title,
      description: description || '',
      totalQuestions: questions.length,
      estimatedTimeMinutes: `${Math.round(questions.length * 0.75)} phút`,
      questions
    };
    db.quizzes.push(newQuiz);
    saveDB(db);
    res.json({ success: true, quiz: newQuiz });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get All Subjects
app.get('/api/subjects', (req, res) => {
  const db = getDB();
  res.json(db.subjects);
});

// Add New Subject
app.post('/api/subjects', (req, res) => {
  try {
    const { id, code, name, faculty, university, lecturer } = req.body;
    const db = getDB();
    const newSubject = { id, code, name, faculty, university, lecturer, quizzesCount: 0 };
    db.subjects.push(newSubject);
    saveDB(db);
    res.json({ success: true, subject: newSubject });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Set Active Quiz
app.post('/api/active-quiz', (req, res) => {
  const { quizId, roomPin } = req.body;
  const db = getDB();
  const quiz = db.quizzes.find(q => q.id === quizId);
  if (!quiz) return res.status(404).json({ error: 'Không tìm thấy bộ đề!' });

  db.system.activeQuizId = quizId;
  if (roomPin) db.system.roomPin = roomPin;
  saveDB(db);

  loadActiveQuiz();
  res.json({ success: true, activeQuiz: gameState.activeQuiz });
});

// Get Sessions
app.get('/api/sessions', (req, res) => {
  const db = getDB();
  res.json(db.sessions);
});

// Export Excel Function
function buildExcelBuffer(session) {
  const wb = XLSX.utils.book_new();

  // SHEET 1: TOP 20% SINH VIÊN NHẬN ĐIỂM CỘNG
  const top20Data = [
    ["TRƯỜNG ĐẠI HỌC SƯ PHẠM KỸ THUẬT TP. HỒ CHÍ MINH (HCMUTE)"],
    ["KHOA LÝ LUẬN CHÍNH TRỊ - BỘ MÔN TRIẾT HỌC MÁC - LÊNIN"],
    ["DANH SÁCH TOP 20% SINH VIÊN ĐẠT ĐIỂM CAO NHẤT (XÁC NHẬN CỘNG ĐIỂM)"],
    [`Học phần: ${session.course || 'Triết học Mác - Lênin (LLCT130105)'}`],
    [`Giảng viên: ${session.lecturer || 'ThS. Đoàn Thị Duyên'} | Thời gian thi: ${new Date(session.createdAt).toLocaleString('vi-VN')}`],
    [`Tổng số người dự thi: ${session.totalParticipants} sinh viên | Top 20% tương ứng: ${session.top20Count} bạn`],
    [],
    ["HẠNG", "MÃ SỐ SINH VIÊN", "HỌ VÀ TÊN", "TỔNG ĐIỂM", "SỐ CÂU ĐÚNG", "TỈ LỆ ĐÚNG", "XÁC NHẬN ĐIỂM CỘNG"]
  ];

  const top20List = session.results.filter(r => r.isTop20);
  top20List.forEach(r => {
    top20Data.push([
      `Hạng ${r.rank}`,
      r.studentId || 'Chưa điền',
      r.name,
      r.score,
      `${r.correctCount}/20`,
      `${r.accuracy}%`,
      "🏆 CỘNG +1.0 ĐIỂM CHUYÊN CẦN"
    ]);
  });

  const wsTop20 = XLSX.utils.aoa_to_sheet(top20Data);
  wsTop20['!cols'] = [
    { wch: 12 },
    { wch: 18 },
    { wch: 28 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 32 }
  ];
  XLSX.utils.book_append_sheet(wb, wsTop20, "Top 20% Nhan Diem Cong");

  // SHEET 2: BẢNG XẾP HẠNG TOÀN BỘ LỚP
  const fullData = [
    ["BẢNG XẾP HẠNG KẾT QUẢ THI TOÀN BỘ SINH VIÊN"],
    [`Chủ đề: ${session.quizTitle}`],
    [],
    ["HẠNG", "MÃ SỐ SINH VIÊN", "HỌ VÀ TÊN", "TỔNG ĐIỂM", "SỐ CÂU ĐÚNG", "TỈ LỆ (%)", "KẾT QUẢ"]
  ];

  session.results.forEach(r => {
    fullData.push([
      r.rank,
      r.studentId || 'N/A',
      r.name,
      r.score,
      `${r.correctCount}/20`,
      `${r.accuracy}%`,
      r.isTop20 ? "⭐ Top 20% (Điểm cộng)" : "Tham gia hoàn thành"
    ]);
  });

  const wsFull = XLSX.utils.aoa_to_sheet(fullData);
  wsFull['!cols'] = [
    { wch: 8 },
    { wch: 18 },
    { wch: 28 },
    { wch: 14 },
    { wch: 14 },
    { wch: 12 },
    { wch: 24 }
  ];
  XLSX.utils.book_append_sheet(wb, wsFull, "Bang Xep Hang Day Du");

  // SHEET 3: LỊCH SỬ TRẢ LỜI CHI TIẾT TỪNG CÂU HỎI CỦA NGƯỜI CHƠI
  const historyHeaders = ["Hạng", "MSSV", "Họ và tên", "Tổng điểm"];
  for (let i = 1; i <= 20; i++) {
    historyHeaders.push(`Câu ${i} (Đ/S)`);
    historyHeaders.push(`C${i} Thời gian(s)`);
  }

  const historyData = [
    ["LỊCH SỬ CHI TIẾT TRẢ LỜI 20 CÂU HỎI TRẮC NGHIỆM"],
    [`Chủ đề: ${session.quizTitle}`],
    [],
    historyHeaders
  ];

  session.results.forEach(r => {
    const row = [r.rank, r.studentId || '', r.name, r.score];
    for (let i = 0; i < 20; i++) {
      const ansObj = r.answers ? r.answers[i] : null;
      if (ansObj) {
        row.push(ansObj.isCorrect ? "ĐÚNG" : "SAI");
        row.push(ansObj.timeTaken ? ansObj.timeTaken.toFixed(1) : "0");
      } else {
        row.push("CHƯA LÀM");
        row.push("-");
      }
    }
    historyData.push(row);
  });

  const wsHistory = XLSX.utils.aoa_to_sheet(historyData);
  XLSX.utils.book_append_sheet(wb, wsHistory, "Lich Su Tra Loi Chi Tiet");

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

// Download Excel Route for specific Session
app.get('/api/export-excel/:sessionId', (req, res) => {
  const db = getDB();
  const session = db.sessions.find(s => s.id === req.params.sessionId);
  if (!session) {
    return res.status(404).send('Không tìm thấy phiên làm bài này!');
  }

  try {
    const buffer = buildExcelBuffer(session);
    const filename = `HCMUTE_KetQuaTranhTai_TrietHoc_${session.id}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    console.error('Error generating Excel:', err);
    res.status(500).send('Lỗi khi tạo file Excel: ' + err.message);
  }
});

// Download Excel Route for Latest / Current Session
app.get('/api/export-excel-current', (req, res) => {
  const db = getDB();
  const sessionId = gameState.completedSessionId || (db.sessions.length > 0 ? db.sessions[0].id : null);
  if (!sessionId) {
    return res.status(404).send('Chưa có phiên làm bài nào kết thúc để xuất file!');
  }
  const session = db.sessions.find(s => s.id === sessionId);
  if (!session) {
    return res.status(404).send('Không tìm thấy phiên làm bài!');
  }

  try {
    const buffer = buildExcelBuffer(session);
    const filename = `HCMUTE_BangDiemCong_Top20_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    console.error('Error exporting current excel:', err);
    res.status(500).send('Lỗi khi tạo file Excel: ' + err.message);
  }
});

const QRCode = require('qrcode');

// Network IP Helper
const os = require('os');
function getLocalIP() {
  const ifaces = os.networkInterfaces();
  for (const dev in ifaces) {
    for (const details of ifaces[dev]) {
      if (details.family === 'IPv4' && !details.internal) {
        return details.address;
      }
    }
  }
  return 'localhost';
}

app.get('/api/info', (req, res) => {
  const forwardedHost = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
  const publicUrl = forwardedHost ? `${proto}://${forwardedHost}` : `http://${getLocalIP()}:${PORT}`;

  res.json({
    lanIp: getLocalIP(),
    port: PORT,
    joinUrl: publicUrl,
    pin: gameState.roomPin
  });
});

app.get('/api/qrcode', async (req, res) => {
  try {
    const forwardedHost = req.headers['x-forwarded-host'] || req.headers.host;
    const proto = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
    const defaultUrl = forwardedHost ? `${proto}://${forwardedHost}` : `http://${getLocalIP()}:${PORT}`;
    const targetUrl = req.query.url || defaultUrl;

    const qrDataUrl = await QRCode.toDataURL(targetUrl, {
      margin: 2,
      width: 320,
      color: {
        dark: '#061a40',
        light: '#ffffff'
      }
    });
    res.json({ qrDataUrl, targetUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Host and Player pages redirect
app.get('/host', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'host.html'));
});

server.listen(PORT, '0.0.0.0', () => {
  const lanIp = getLocalIP();
  console.log(`======================================================`);
  console.log(`🎓 HCMUTE Triết Học EduQuiz Server is RUNNING!`);
  console.log(`📡 Local Player Access: http://localhost:${PORT}`);
  console.log(`📱 Phone / LAN Access:  http://${lanIp}:${PORT}`);
  console.log(`👑 Host / Admin Access:  http://localhost:${PORT}/host`);
  console.log(`======================================================`);
});
