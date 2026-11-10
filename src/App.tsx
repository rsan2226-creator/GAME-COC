import React, { useState, useEffect, useMemo, useRef } from 'react';
import confetti from 'canvas-confetti';
import {
  Trophy,
  Download,
  Upload,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Clock,
  Users,
  CheckCircle2,
  AlertCircle,
  Lock,
  Sparkles,
  History,
  Medal,
  Award,
  Home,
  Flag,
  LayoutGrid,
  FileSpreadsheet,
  X,
  Mic,
  Radio,
  Square,
  BookOpen,
} from 'lucide-react';
import {
  AnswerHistoryItem,
  DEFAULT_PJOK_ATLETIK_QUESTIONS,
  GAME_IDENTITY,
  QuestionItem,
  TEAM_PALETTE,
  TeamConfig,
} from './data/defaultQuestions';
import {
  downloadFinalRankingExcel,
  downloadQuestionTemplateExcel,
  parseAndValidateExcelFile,
} from './utils/excelHelper';
import {
  soundEngine,
  STUDIO_AUDIO_ASSETS,
  INDOOR_ROOM_PRESETS,
  IndoorRoomPreset,
  SoundEngineSnapshot,
} from './utils/soundEngine';
import {
  moderatorEngine,
  MODERATOR_VOICES,
  MODERATOR_FX_MODES,
  ModeratorStateSnapshot,
} from './utils/moderatorEngine';
import { QuestionModal } from './components/QuestionModal';
import { BoardPosterStudio } from './components/BoardPosterStudio';
import { HowToPlayModal } from './components/HowToPlayModal';

type AppView = 'HOME' | 'GAME' | 'FINAL_RANKING' | 'BOARD_POSTER_STUDIO';

interface BoxState {
  questionId: number;
  status: 'BLUE_AVAILABLE' | 'GOLD_PLAYING' | 'GREEN_LOCKED' | 'RED_FLASH';
  answeredByTeamName?: string;
  answeredByTeamHex?: string;
}

const STORAGE_KEY = 'coc_pjok_atletik_4b_saved_session_v1';
const DURATION_PRESETS = [10, 15, 20, 25, 30, 45, 60];
const TROPHY_IMG_PATH = '/src/assets/images/championship_trophy_3d_1794310440546.jpg';

function createInitialTeams(count: number, existingTeams?: TeamConfig[]): TeamConfig[] {
  const defaultTeamNames = [
    'Tim Garuda Cepat',
    'Tim Rajawali Tangguh',
    'Tim Elang Juara',
    'Tim Harimau Sprint',
    'Tim Banteng Perkasa',
    'Tim Ksatria Atletik',
    'Tim Bintang Lapangan',
    'Tim Surya Kencana',
  ];

  return Array.from({ length: count }, (_, idx) => {
    const prev = existingTeams?.[idx];
    const palette = TEAM_PALETTE[idx % TEAM_PALETTE.length];
    return {
      id: `team-${idx + 1}`,
      name: prev?.name || defaultTeamNames[idx] || `Tim ${idx + 1}`,
      colorName: palette.colorName,
      hex: palette.hex,
      bgClass: palette.bgClass,
      borderClass: palette.borderClass,
      textClass: palette.textClass,
      score: prev?.score ?? 0,
      correctCount: prev?.correctCount ?? 0,
      attemptsCount: prev?.attemptsCount ?? 0,
    };
  });
}

function createInitialBoxes(questions: QuestionItem[]): Record<number, BoxState> {
  const map: Record<number, BoxState> = {};
  questions.forEach((q) => {
    map[q.id] = {
      questionId: q.id,
      status: 'BLUE_AVAILABLE',
    };
  });
  return map;
}

export default function App() {
  // Navigation & View State
  const [view, setView] = useState<AppView>('HOME');

  // Setup State
  const [teamCount, setTeamCount] = useState<number>(4);
  const [teams, setTeams] = useState<TeamConfig[]>(() => createInitialTeams(4));
  const [durationMinutes, setDurationMinutes] = useState<number>(20);
  const [isManualDuration, setIsManualDuration] = useState<boolean>(false);
  const [manualDurationInput, setManualDurationInput] = useState<string>('25');

  // Questions & Excel Validation State
  const [questions, setQuestions] = useState<QuestionItem[]>(DEFAULT_PJOK_ATLETIK_QUESTIONS);
  const [uploadedFileName, setUploadedFileName] = useState<string>(
    'Paket_Default_40_Soal_PJOK_Atletik_Kelas_4_Fase_B.xlsx (Siap Dimainkan)'
  );
  const [excelNotification, setExcelNotification] = useState<{
    type: 'success' | 'error';
    message: string;
    details?: string[];
  } | null>({
    type: 'success',
    message:
      '40 Soal PJOK Materi Atletik (Kelas 4 / Fase B) telah dimuat otomatis. Guru juga dapat mengunduh template Excel (.xlsx) untuk mengedit atau mengunggah soal baru.',
  });

  // Active Game State
  const [boxes, setBoxes] = useState<Record<number, BoxState>>(() =>
    createInitialBoxes(DEFAULT_PJOK_ATLETIK_QUESTIONS)
  );
  const [remainingSeconds, setRemainingSeconds] = useState<number>(20 * 60);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [activeQuestionId, setActiveQuestionId] = useState<number | null>(null);
  const [history, setHistory] = useState<AnswerHistoryItem[]>([]);
  const [showGameOverBanner, setShowGameOverBanner] = useState<boolean>(false);

  // Utility Modals & Controls
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [showGuideModal, setShowGuideModal] = useState<boolean>(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    description: string;
    confirmLabel: string;
    onConfirm: () => void;
  } | null>(null);

  // Audio, Indoor Room Acoustics, AI Moderator & Fullscreen State
  const [isMuted, setIsMuted] = useState<boolean>(() => soundEngine.getMuted());
  const [volume, setVolume] = useState<number>(() => soundEngine.getVolume());
  const [soundSnap, setSoundSnap] = useState<SoundEngineSnapshot>(() =>
    soundEngine.getSnapshot()
  );
  const [showAudioPopover, setShowAudioPopover] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [trophyImgError, setTrophyImgError] = useState<boolean>(false);
  const [modState, setModState] = useState<ModeratorStateSnapshot>(() =>
    moderatorEngine.getSnapshot()
  );

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsubMod = moderatorEngine.subscribe(setModState);
    const unsubSound = soundEngine.subscribe((snap) => {
      setSoundSnap(snap);
      setIsMuted(snap.isMuted);
      setVolume(snap.volume);
    });
    return () => {
      unsubMod();
      unsubSound();
    };
  }, []);

  // Load saved game progress from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.teams && parsed.questions && parsed.boxes) {
          setTeamCount(parsed.teamCount || parsed.teams.length);
          setTeams(parsed.teams);
          setDurationMinutes(parsed.durationMinutes || 20);
          setQuestions(parsed.questions);
          setBoxes(parsed.boxes);
          setRemainingSeconds(parsed.remainingSeconds ?? 1200);
          setHistory(parsed.history || []);
          if (parsed.view === 'GAME' || parsed.view === 'FINAL_RANKING') {
            setView(parsed.view);
          }
        }
      }
    } catch {
      // ignore corrupted storage
    }
  }, []);

  // Persist game state automatically so reloading page never loses progress
  useEffect(() => {
    try {
      const payload = {
        view,
        teamCount,
        teams,
        durationMinutes,
        questions,
        boxes,
        remainingSeconds,
        history,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {}
  }, [view, teamCount, teams, durationMinutes, questions, boxes, remainingSeconds, history]);

  // Main Game Countdown Timer (runs continuously during GAME view, even when question modal is open, unless paused)
  useEffect(() => {
    if (view !== 'GAME' || isPaused || showGameOverBanner) return;

    const interval = window.setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          triggerGameOverSequence();
          return 0;
        }
        const next = prev - 1;
        // Play subtle warning pulse at 60s and last 10s of main timer
        if (next === 60) {
          soundEngine.playWarningPulse();
          const topTeam = [...teams].sort((a, b) => b.score - a.score)[0];
          moderatorEngine.announceOneMinuteWarning(topTeam?.score > 0 ? topTeam.name : undefined);
        } else if (next <= 10 && next > 0) {
          soundEngine.playWarningPulse();
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [view, isPaused, showGameOverBanner, teams]);

  // Stop or start victory ambience & AI Moderator Champion Announcement when entering FINAL_RANKING
  useEffect(() => {
    if (view === 'FINAL_RANKING') {
      soundEngine.startVictoryAmbience();
      const sorted = [...teams].sort((a, b) => b.score - a.score);
      if (sorted.length > 0) {
        const topScore = sorted[0].score;
        const winners = sorted.filter((t) => t.score === topScore).map((t) => t.name);
        moderatorEngine.announceFinalRanking(winners, topScore, winners.length > 1);
      }
      try {
        confetti({
          particleCount: 130,
          spread: 95,
          origin: { y: 0.5 },
          colors: ['#F59E0B', '#FDE047', '#38BDF8', '#10B981', '#FFFFFF'],
        });
      } catch {}
    } else {
      soundEngine.stopVictoryAmbience();
    }
    return () => {
      soundEngine.stopVictoryAmbience();
    };
  }, [view]);

  // Track Fullscreen changes
  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const toggleFullscreen = () => {
    soundEngine.playClick();
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  const handleToggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    soundEngine.setMuted(next);
    if (!next) soundEngine.playClick();
  };

  const handleVolumeChange = (val: number) => {
    setVolume(val);
    soundEngine.setVolume(val);
    if (val > 0 && isMuted) {
      setIsMuted(false);
      soundEngine.setMuted(false);
    }
  };

  // Handle Team Count Selection (2 to 8)
  const handleSelectTeamCount = (count: number) => {
    soundEngine.playChooseYourChampion();
    setTeamCount(count);
    setTeams((prev) => createInitialTeams(count, prev));
  };

  const handleTeamNameChange = (idx: number, newName: string) => {
    setTeams((prev) =>
      prev.map((t, i) => (i === idx ? { ...t, name: newName } : t))
    );
  };

  // Handle Excel Upload
  const handleExcelFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    soundEngine.playClick();

    const result = await parseAndValidateExcelFile(file);
    if (result.valid && result.questions) {
      setQuestions(result.questions);
      setBoxes(createInitialBoxes(result.questions));
      setUploadedFileName(file.name);
      setExcelNotification({
        type: 'success',
        message: result.message,
      });
      soundEngine.playCorrectAnswer();
    } else {
      setExcelNotification({
        type: 'error',
        message: result.message,
        details: result.details,
      });
      soundEngine.playWrongAnswer();
    }
    e.target.value = '';
  };

  // Validate if Start Game can be pressed
  const canStartGame = useMemo(() => {
    const validTeamCount = teamCount >= 2 && teamCount <= 8;
    const allTeamsNamed = teams.length === teamCount && teams.every((t) => t.name.trim().length > 0);
    const validDuration = durationMinutes >= 1 && durationMinutes <= 180;
    const validQuestions = questions.length === 40;
    return validTeamCount && allTeamsNamed && validDuration && validQuestions;
  }, [teamCount, teams, durationMinutes, questions]);

  // Start a Fresh Game
  const handleStartGame = () => {
    if (!canStartGame) return;
    soundEngine.playStartGameFanfare();

    // Reset team scores and boxes
    const freshTeams = teams.map((t) => ({
      ...t,
      score: 0,
      correctCount: 0,
      attemptsCount: 0,
    }));
    setTeams(freshTeams);
    setBoxes(createInitialBoxes(questions));
    setHistory([]);
    setRemainingSeconds(durationMinutes * 60);
    setIsPaused(false);
    setActiveQuestionId(null);
    setShowGameOverBanner(false);
    setView('GAME');
    moderatorEngine.announceStartGame(
      teamCount,
      durationMinutes,
      freshTeams.map((t) => t.name)
    );
  };

  // Game Over Sequence when timer hits 00:00 or all 40 boxes are solved
  const triggerGameOverSequence = () => {
    setActiveQuestionId(null);
    setShowGameOverBanner(true);
    soundEngine.playGameOver();
    setTimeout(() => {
      setShowGameOverBanner(false);
      setView('FINAL_RANKING');
    }, 2800);
  };

  // Click a Question Box (1-40)
  const handleBoxClick = (qId: number) => {
    if (view !== 'GAME' || showGameOverBanner) return;
    const box = boxes[qId];
    if (!box || box.status === 'GREEN_LOCKED' || box.status === 'RED_FLASH') return;

    soundEngine.playBoxOpen();
    setBoxes((prev) => ({
      ...prev,
      [qId]: {
        ...prev[qId],
        status: 'GOLD_PLAYING',
      },
    }));
    setActiveQuestionId(qId);
  };

  // Close Question Modal without answering (returns box from GOLD_PLAYING to BLUE_AVAILABLE)
  const handleCloseModalUnanswered = () => {
    if (activeQuestionId !== null) {
      setBoxes((prev) => ({
        ...prev,
        [activeQuestionId]: {
          ...prev[activeQuestionId],
          status: 'BLUE_AVAILABLE',
        },
      }));
    }
    setActiveQuestionId(null);
  };

  // Resolve Answer from QuestionModal
  const handleResolveAnswer = (params: {
    questionId: number;
    teamId: string;
    submittedAnswer: string;
    status: 'BENAR' | 'SALAH' | 'WAKTU HABIS';
    timeTakenSeconds: number;
    pointsEarned: number;
    verifiedManually?: boolean;
  }) => {
    const answeringTeam = teams.find((t) => t.id === params.teamId);
    const qObj = questions.find((q) => q.id === params.questionId);
    if (!answeringTeam || !qObj) return;

    const nowStr = new Date().toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    const newHistoryItem: AnswerHistoryItem = {
      id: `${Date.now()}-${Math.random()}`,
      timestamp: nowStr,
      questionNumber: params.questionId,
      questionText: qObj.question,
      teamId: answeringTeam.id,
      teamName: answeringTeam.name,
      teamColorHex: answeringTeam.hex,
      submittedAnswer: params.submittedAnswer,
      isCorrect: params.status === 'BENAR',
      status: params.status,
      timeTakenSeconds: params.timeTakenSeconds,
      pointsEarned: params.pointsEarned,
      verifiedManually: params.verifiedManually,
    };

    setHistory((prev) => [newHistoryItem, ...prev]);

    // Update Team Score & Counters
    setTeams((prev) =>
      prev.map((t) => {
        if (t.id !== params.teamId) return t;
        return {
          ...t,
          score: t.score + params.pointsEarned,
          correctCount: params.status === 'BENAR' ? t.correctCount + 1 : t.correctCount,
          attemptsCount: t.attemptsCount + 1,
        };
      })
    );

    setActiveQuestionId(null);

    if (params.status === 'BENAR') {
      // Lock box permanently in GREEN
      setBoxes((prev) => {
        const updated: Record<number, BoxState> = {
          ...prev,
          [params.questionId]: {
            questionId: params.questionId,
            status: 'GREEN_LOCKED',
            answeredByTeamName: answeringTeam.name,
            answeredByTeamHex: answeringTeam.hex,
          },
        };

        // Check if all 40 boxes are now GREEN_LOCKED
        const allSolved = Object.values(updated).every(
          (b) => b.status === 'GREEN_LOCKED'
        );
        if (allSolved) {
          setTimeout(() => {
            triggerGameOverSequence();
          }, 900);
        }

        return updated;
      });
    } else {
      // Temporary RED flash on the box, then revert to BLUE_AVAILABLE so other teams can play it
      setBoxes((prev) => ({
        ...prev,
        [params.questionId]: {
          ...prev[params.questionId],
          status: 'RED_FLASH',
        },
      }));

      setTimeout(() => {
        setBoxes((prev) => {
          if (prev[params.questionId]?.status === 'GREEN_LOCKED') return prev;
          return {
            ...prev,
            [params.questionId]: {
              ...prev[params.questionId],
              status: 'BLUE_AVAILABLE',
            },
          };
        });
      }, 1500);
    }
  };

  // Sorted Leaderboard Teams (highest score first)
  const sortedLeaderboard = useMemo(() => {
    return [...teams].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.correctCount - a.correctCount;
    });
  }, [teams]);

  // Group Teams by Score for Final Ranking Podium (supports ties honestly without random tie-breaking)
  const rankGroups = useMemo(() => {
    const uniqueScores = Array.from(new Set(sortedLeaderboard.map((t) => t.score))).sort(
      (a, b) => b - a
    );
    return uniqueScores.map((score, idx) => {
      const tiedTeams = sortedLeaderboard.filter((t) => t.score === score);
      return {
        rank: idx + 1,
        score,
        teams: tiedTeams,
        isTie: tiedTeams.length > 1,
      };
    });
  }, [sortedLeaderboard]);

  const solvedBoxesCount = useMemo(() => {
    return Object.values(boxes).filter((b) => b.status === 'GREEN_LOCKED').length;
  }, [boxes]);

  const formatTimer = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const activeQuestionObj = useMemo(() => {
    if (activeQuestionId === null) return null;
    return questions.find((q) => q.id === activeQuestionId) || null;
  }, [activeQuestionId, questions]);

  return (
    <div className="min-h-screen flex flex-col bg-[#060E1F] text-slate-100 relative selection:bg-amber-400 selection:text-slate-950">
      {/* Ambient Championship Background Glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[420px] bg-amber-500/10 blur-[140px] rounded-full" />
        <div className="absolute top-1/3 -left-32 w-[500px] h-[500px] bg-sky-500/10 blur-[130px] rounded-full" />
        <div className="absolute bottom-0 right-0 w-[600px] h-[400px] bg-cyan-500/10 blur-[140px] rounded-full" />
      </div>

      {/* 3-Zone Top Bar Navigation Contract */}
      <header className="sticky top-0 z-40 flex items-center justify-between gap-8 px-4 sm:px-8 py-3.5 bg-[#050B18]/90 backdrop-blur-md border-b border-slate-800/80">
        {/* Zone 1: Brand Title (Single text element wordmark) */}
        <button
          type="button"
          onClick={() => {
            soundEngine.playMenuSwitch();
            setView('HOME');
          }}
          className="text-lg sm:text-xl font-display font-black tracking-wider text-amber-400 hover:text-amber-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          CLASS OF CHAMPIONS
        </button>

        {/* Zone 2: Concise Single-Line Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
          <button
            type="button"
            onClick={() => {
              soundEngine.playMenuSwitch();
              setView('HOME');
            }}
            className={`hover:text-amber-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              view === 'HOME' ? 'text-amber-400 font-bold underline underline-offset-8' : ''
            }`}
          >
            Beranda Pengaturan
          </button>
          <button
            type="button"
            onClick={() => {
              soundEngine.playMenuSwitch();
              setView('GAME');
            }}
            className={`hover:text-amber-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              view === 'GAME' ? 'text-amber-400 font-bold underline underline-offset-8' : ''
            }`}
          >
            Arena 40 Kotak
          </button>
          <button
            type="button"
            onClick={() => {
              soundEngine.playMenuSwitch();
              setView('FINAL_RANKING');
            }}
            className={`hover:text-amber-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              view === 'FINAL_RANKING' ? 'text-amber-400 font-bold underline underline-offset-8' : ''
            }`}
          >
            Final Ranking
          </button>
          <button
            type="button"
            onClick={() => {
              soundEngine.playMenuSwitch();
              setView('BOARD_POSTER_STUDIO');
            }}
            className={`hover:text-cyan-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              view === 'BOARD_POSTER_STUDIO' ? 'text-cyan-400 font-bold underline underline-offset-8' : ''
            }`}
          >
            Poster Board Quiz
          </button>
          <button
            type="button"
            onClick={() => {
              soundEngine.playMenuSwitch();
              setShowHistoryModal(true);
            }}
            className="hover:text-amber-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Riwayat ({history.length})
          </button>
        </nav>

        {/* Zone 3: Primary Utility Action (Sound & Fullscreen) */}
        <div className="relative flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              setShowAudioPopover((prev) => !prev);
            }}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-amber-400/40 text-xs font-semibold text-slate-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="w-4 h-4 text-rose-400" />
            ) : (
              <Volume2 className="w-4 h-4 text-amber-400" />
            )}
            <span>
              {isMuted
                ? 'Suara Mati'
                : `${Math.round(volume * 100)}% · ${
                    INDOOR_ROOM_PRESETS.find((p) => p.id === soundSnap.roomPreset)?.shortLabel ||
                    'Aula'
                  }`}
            </span>
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/40 text-xs font-semibold text-amber-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            title="Mode Layar Penuh Proyektor"
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">
              {isFullscreen ? 'Keluar Penuh' : 'Layar Penuh'}
            </span>
          </button>

          {/* Audio Volume, Indoor Room Reverb & AI Moderator Popover */}
          {showAudioPopover && (
            <div className="absolute right-0 top-12 w-88 p-4 rounded-xl bg-[#0A162C] border border-amber-400/50 shadow-2xl space-y-4 z-50">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">
                  Audio, Efek Ruangan & Moderator AI
                </span>
                <button
                  type="button"
                  onClick={handleToggleMute}
                  className={`px-2.5 py-1 rounded text-xs font-semibold cursor-pointer ${
                    isMuted
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  }`}
                >
                  {isMuted ? 'Aktifkan Semua' : 'Matikan Semua'}
                </button>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Volume Master (Semua Menu)</span>
                  <span className="font-mono-num text-amber-300">{Math.round(volume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={isMuted ? 0 : volume}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  className="w-full accent-amber-400 cursor-pointer"
                />
              </div>

              {/* Global Indoor Room Sound Effect & Clarity Preamp Boost */}
              <div className="pt-3 border-t border-slate-800 space-y-2.5">
                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-amber-300">
                    Efek Suara Dalam Ruangan (Diterapkan di Semua Menu):
                  </label>
                  <select
                    value={soundSnap.roomPreset}
                    onChange={(e) =>
                      soundEngine.setRoomPreset(e.target.value as IndoorRoomPreset, true)
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-amber-400/50 text-xs text-amber-200 font-semibold outline-none cursor-pointer"
                  >
                    {INDOOR_ROOM_PRESETS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-300 font-semibold">
                      Penguat Kejelasan Efek Suara (Booster):
                    </span>
                    <span className="font-mono-num font-bold text-emerald-300">
                      {Math.round(soundSnap.clarityBoost * 100)}%
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { label: 'Normal (120%)', val: 1.2 },
                      { label: 'Jelas (175%)', val: 1.75 },
                      { label: 'Proyektor (220%)', val: 2.2 },
                    ].map((b) => (
                      <button
                        key={b.val}
                        type="button"
                        onClick={() => soundEngine.setClarityBoost(b.val, true)}
                        className={`py-1 px-2 rounded text-[11px] font-bold transition-colors cursor-pointer ${
                          Math.abs(soundSnap.clarityBoost - b.val) < 0.1
                            ? 'bg-amber-400 text-slate-950'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                        }`}
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* AI Moderator Settings inside Popover */}
              <div className="pt-3 border-t border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-cyan-300 flex items-center gap-1.5">
                    <Mic className="w-3.5 h-3.5" />
                    <span>Suara Moderator AI</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => moderatorEngine.setEnabled(!modState.enabled)}
                    className={`px-2.5 py-0.5 rounded text-[11px] font-bold cursor-pointer ${
                      modState.enabled
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/50'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {modState.enabled ? 'AKTIF' : 'NONAKTIF'}
                  </button>
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] text-slate-400">
                    Karakter Suara Moderator AI:
                  </label>
                  <select
                    value={modState.voiceName}
                    onChange={(e) =>
                      moderatorEngine.setVoiceName(e.target.value as typeof modState.voiceName)
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white font-semibold outline-none"
                  >
                    {MODERATOR_VOICES.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.label} — {v.persona}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] text-slate-400">
                    Mode Suara Moderator (Robot + Gema Ruangan):
                  </label>
                  <select
                    value={modState.fxMode}
                    onChange={(e) =>
                      moderatorEngine.setFxMode(e.target.value as typeof modState.fxMode)
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-cyan-500/50 text-xs text-cyan-300 font-semibold outline-none"
                  >
                    {MODERATOR_FX_MODES.map((fx) => (
                      <option key={fx.id} value={fx.id}>
                        {fx.label}
                      </option>
                    ))}
                  </select>
                </div>

                <label className="flex items-center justify-between text-xs text-slate-300 cursor-pointer pt-1">
                  <span>Bacakan Soal Otomatis Saat Dibuka</span>
                  <input
                    type="checkbox"
                    checked={modState.autoReadQuestion}
                    onChange={(e) => moderatorEngine.setAutoReadQuestion(e.target.checked)}
                    className="accent-cyan-400 w-4 h-4"
                  />
                </label>
              </div>

              {/* Studio Soundboard (8 Uploaded MP3 Effects + Room Reverb Test) */}
              <div className="pt-3 border-t border-slate-800 space-y-2">
                <div className="text-[11px] font-semibold text-amber-300">
                  Tes Efek Suara Dalam Ruangan & Studio (MP3):
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => soundEngine.playChooseYourChampion()}
                    className="py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-amber-300 transition-colors cursor-pointer truncate"
                  >
                    🎙️ Choose Champion!
                  </button>
                  <button
                    type="button"
                    onClick={() => soundEngine.playMp3(STUDIO_AUDIO_ASSETS.VICTORY_TRUMPET, 1.35)}
                    className="py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-emerald-300 transition-colors cursor-pointer truncate"
                  >
                    🎺 Terompet Juara
                  </button>
                  <button
                    type="button"
                    onClick={() => soundEngine.playMp3(STUDIO_AUDIO_ASSETS.VICTORY_ORCHESTRA_HIT, 1.4)}
                    className="py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-amber-200 transition-colors cursor-pointer truncate"
                  >
                    🥁 Fanfare Orkestra
                  </button>
                  <button
                    type="button"
                    onClick={() => soundEngine.playMp3(STUDIO_AUDIO_ASSETS.VICTORY_FANFARE_DOUBLE, 1.35)}
                    className="py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-cyan-300 transition-colors cursor-pointer truncate"
                  >
                    ✨ Brass Ganda
                  </button>
                  <button
                    type="button"
                    onClick={() => soundEngine.playRoomAcousticPreview()}
                    className="py-1.5 px-2 rounded-lg bg-amber-400/20 hover:bg-amber-400/30 border border-amber-400/40 text-[11px] font-semibold text-amber-200 transition-colors cursor-pointer truncate"
                  >
                    🏛️ Tes Gema Ruangan
                  </button>
                  <button
                    type="button"
                    onClick={() => moderatorEngine.announceWelcome()}
                    className="py-1.5 px-2 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 text-[11px] font-semibold text-cyan-300 transition-colors cursor-pointer truncate"
                  >
                    🤖 Tes Moderator AI
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Live AI Moderator & Global Indoor Room Acoustic Bar (Visible Across ALL Menus) */}
      <div className="relative z-30 bg-[#071226]/95 border-b border-cyan-500/30 px-4 sm:px-8 py-2.5">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Left: Moderator Status & Live Subtitle Transcript */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div
              className={`flex items-center gap-2 px-3 py-1 rounded-lg border text-xs font-display font-bold shrink-0 ${
                modState.isSpeaking
                  ? 'bg-cyan-500/25 border-cyan-400 text-cyan-200 shadow-[0_0_20px_rgba(34,211,238,0.35)]'
                  : modState.isLoading
                  ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                  : 'bg-slate-900 border-slate-700 text-cyan-400'
              }`}
            >
              <Radio
                className={`w-4 h-4 ${
                  modState.isSpeaking
                    ? 'text-cyan-300 animate-spin'
                    : modState.isLoading
                    ? 'text-amber-300 animate-bounce'
                    : 'text-cyan-400'
                }`}
              />
              <span>MODERATOR AI ({modState.voiceName})</span>
            </div>

            <p className="text-xs sm:text-sm text-slate-200 font-medium truncate">
              {modState.isLoading
                ? 'Menyiapkan suara Moderator AI...'
                : `“${modState.currentSubtitle}”`}
            </p>
          </div>

          {/* Right: Global Indoor Room Reverb Selector (Applies to ALL Menus) & Moderator Controls */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Global Indoor Room Effect Selector */}
            <select
              value={soundSnap.roomPreset}
              onChange={(e) => {
                soundEngine.setRoomPreset(e.target.value as IndoorRoomPreset, true);
              }}
              aria-label="Pilih Efek Suara Dalam Ruangan untuk Semua Menu"
              className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-amber-400/60 text-xs font-semibold text-amber-300 outline-none cursor-pointer"
            >
              {INDOOR_ROOM_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  Akustik Menu: {preset.label}
                </option>
              ))}
            </select>

            <select
              value={modState.fxMode}
              onChange={(e) => {
                moderatorEngine.setFxMode(e.target.value as typeof modState.fxMode);
              }}
              aria-label="Pilih Efek Suara Moderator AI"
              className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-cyan-500/50 text-xs font-semibold text-cyan-300 outline-none cursor-pointer"
            >
              {MODERATOR_FX_MODES.map((fx) => (
                <option key={fx.id} value={fx.id}>
                  Moderator: {fx.label}
                </option>
              ))}
            </select>

            <select
              value={modState.voiceName}
              onChange={(e) => {
                soundEngine.playClick();
                moderatorEngine.setVoiceName(e.target.value as typeof modState.voiceName);
              }}
              aria-label="Pilih Karakter Suara Moderator AI"
              className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-semibold text-slate-200 outline-none cursor-pointer"
            >
              {MODERATOR_VOICES.map((v) => (
                <option key={v.id} value={v.id}>
                  Suara: {v.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => {
                soundEngine.playRoomAcousticPreview();
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/50 text-xs font-semibold text-amber-200 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              title="Dengarkan Kejernihan Efek Suara Dalam Ruangan"
            >
              <Volume2 className="w-3.5 h-3.5 text-amber-300" />
              <span>Tes Suara Ruangan</span>
            </button>

            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                if (view === 'HOME') {
                  moderatorEngine.announceWelcome();
                } else {
                  const leader = sortedLeaderboard[0];
                  moderatorEngine.speakLiveCommentary(
                    'LIVE_LEADERBOARD_UPDATE',
                    {
                      mataPelajaran: GAME_IDENTITY.mataPelajaran,
                      materi: GAME_IDENTITY.materi,
                      kelas: GAME_IDENTITY.kelas,
                      leaderName: leader?.name,
                      leaderScore: leader?.score,
                      solvedBoxesCount,
                      remainingTime: formatTimer(remainingSeconds),
                    },
                    `Suasana kompetisi Class of Champions ${GAME_IDENTITY.mataPelajaran} materi ${GAME_IDENTITY.materi} Kelas ${GAME_IDENTITY.kelas} semakin memanas! Saat ini ${leader?.name} memimpin dengan ${leader?.score} poin, dan ${solvedBoxesCount} dari 40 kotak soal telah terpecahkan!`
                  );
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/50 text-xs font-semibold text-cyan-200 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Mic className="w-3.5 h-3.5 text-cyan-300" />
              <span>{view === 'HOME' ? 'Sambutan Moderator AI' : 'Komentar Langsung AI'}</span>
            </button>

            {(modState.isSpeaking || modState.isLoading) && (
              <button
                type="button"
                onClick={() => moderatorEngine.stop()}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-950/80 hover:bg-rose-900 border border-rose-600/60 text-xs font-semibold text-rose-200 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Square className="w-3 h-3 fill-current" />
                <span>Stop</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Navigation Bar */}
      <div className="flex md:hidden items-center justify-around px-2 py-2 bg-[#071022] border-b border-slate-800 text-xs font-semibold">
        <button
          type="button"
          onClick={() => {
            soundEngine.playMenuSwitch();
            setView('HOME');
          }}
          className={`px-2.5 py-1.5 rounded-lg whitespace-nowrap ${
            view === 'HOME' ? 'bg-amber-400 text-slate-950' : 'text-slate-300'
          }`}
        >
          Beranda
        </button>
        <button
          type="button"
          onClick={() => {
            soundEngine.playMenuSwitch();
            setView('GAME');
          }}
          className={`px-2.5 py-1.5 rounded-lg whitespace-nowrap ${
            view === 'GAME' ? 'bg-amber-400 text-slate-950' : 'text-slate-300'
          }`}
        >
          Arena (40)
        </button>
        <button
          type="button"
          onClick={() => {
            soundEngine.playMenuSwitch();
            setView('FINAL_RANKING');
          }}
          className={`px-2.5 py-1.5 rounded-lg whitespace-nowrap ${
            view === 'FINAL_RANKING' ? 'bg-amber-400 text-slate-950' : 'text-slate-300'
          }`}
        >
          Podium
        </button>
        <button
          type="button"
          onClick={() => {
            soundEngine.playMenuSwitch();
            setView('BOARD_POSTER_STUDIO');
          }}
          className={`px-2.5 py-1.5 rounded-lg whitespace-nowrap ${
            view === 'BOARD_POSTER_STUDIO' ? 'bg-cyan-400 text-slate-950' : 'text-slate-300'
          }`}
        >
          Board A4
        </button>
      </div>

      {/* ===================================================================== */}
      {/* 1. HALAMAN BERANDA (HOME SETUP VIEW)                                  */}
      {/* ===================================================================== */}
      {view === 'HOME' && (
        <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-4 sm:px-8 py-8 sm:py-10 space-y-10">
          {/* Hero Section with 3D Trophy & Fixed DATA INPUT Identity */}
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-gradient-to-br from-[#0B1933] via-[#091326] to-[#060D1A] p-6 sm:p-10 rounded-3xl border border-amber-400/30 shadow-[0_0_60px_rgba(10,25,47,0.9)]">
            <div className="lg:col-span-7 space-y-5">
              <div className="text-xs sm:text-sm font-semibold tracking-widest text-amber-400 uppercase">
                KOMPETISI AKADEMIK ANTARTIM INTERAKTIF
              </div>

              <h1
                className="text-4xl sm:text-6xl font-display font-black tracking-tight text-white leading-none"
                style={{ textWrap: 'balance' }}
              >
                CLASS OF <span className="text-amber-400">CHAMPIONS</span>
              </h1>

              {/* Fixed DATA INPUT Display (Strictly Pre-configured, NOT Input Fields) */}
              <div className="pt-1 pb-2">
                <div className="text-xs font-medium text-slate-400 mb-2">
                  Identitas Pembelajaran Terkonfigurasi:
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-base sm:text-lg font-display font-bold text-cyan-300">
                  <span>MATA PELAJARAN: {GAME_IDENTITY.mataPelajaran}</span>
                  <span aria-hidden="true" className="text-slate-600">·</span>
                  <span>MATERI: {GAME_IDENTITY.materi}</span>
                  <span aria-hidden="true" className="text-slate-600">·</span>
                  <span>KELAS: {GAME_IDENTITY.kelas}</span>
                </div>
              </div>

              <p className="text-slate-300 text-sm sm:text-base leading-relaxed max-w-2xl">
                Selamat datang di arena kompetisi akademik <strong>Class of Champions</strong> khusus mata pelajaran <strong>{GAME_IDENTITY.mataPelajaran}</strong> materi <strong>{GAME_IDENTITY.materi}</strong> untuk <strong>Kelas {GAME_IDENTITY.kelas}</strong>. Atur jumlah tim, sesuaikan durasi permainan, kelola soal melalui template Excel, dan mulailah pertarungan 40 kotak soal!
              </p>

              {/* Quick Action Buttons in Hero: Panduan Cara Bermain & Sambutan Moderator */}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    setShowGuideModal(true);
                  }}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/50 text-amber-300 font-display font-bold text-xs sm:text-sm transition-all cursor-pointer whitespace-nowrap shrink-0"
                >
                  <BookOpen className="w-4 h-4 text-amber-400" />
                  <span>Buka Panduan Cara Bermain</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    moderatorEngine.announceWelcome();
                  }}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/50 text-cyan-300 font-display font-bold text-xs sm:text-sm transition-all cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Mic className="w-4 h-4 text-cyan-400" />
                  <span>Dengarkan Sambutan Moderator AI</span>
                </button>
              </div>

              {/* Quick Resume Banner if a game is already in progress */}
              {history.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-amber-500/10 border border-amber-400/40">
                  <div className="text-xs sm:text-sm text-amber-200">
                    <strong>Sesi Permainan Aktif Tersimpan:</strong> {solvedBoxesCount}/40 soal terjawab · Sisa waktu{' '}
                    <span className="font-mono-num font-bold">{formatTimer(remainingSeconds)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playClick();
                      setView('GAME');
                    }}
                    className="px-4 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-bold text-xs transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    Lanjutkan Sesi Sebelumnya →
                  </button>
                </div>
              )}
            </div>

            {/* 3D Championship Trophy Visual */}
            <div className="lg:col-span-5 flex justify-center">
              <div className="relative w-64 h-64 sm:w-80 sm:h-80 rounded-2xl overflow-hidden border-2 border-amber-400/40 bg-[#050C1A] shadow-[0_0_60px_rgba(245,158,11,0.25)] flex items-center justify-center group">
                {!trophyImgError ? (
                  <img
                    src={TROPHY_IMG_PATH}
                    alt="Piala Kejuaraan 3D Class of Champions"
                    referrerPolicy="no-referrer"
                    onError={() => setTrophyImgError(true)}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-center p-6">
                    <Trophy className="w-28 h-28 text-amber-400 drop-shadow-[0_0_25px_rgba(245,158,11,0.6)]" />
                    <span className="mt-3 font-display font-black text-lg text-amber-300">
                      TROPHY OF CHAMPIONS
                    </span>
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-4 text-center">
                  <span className="text-xs font-display font-bold tracking-widest text-amber-300 uppercase">
                    PIALA KEJUARAAN {GAME_IDENTITY.mataPelajaran} {GAME_IDENTITY.kelas}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Panduan Cepat 4 Langkah Cara Bermain */}
          <section className="bg-[#0A162C] p-6 sm:p-8 rounded-2xl border border-slate-800 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <BookOpen className="w-5 h-5 text-amber-400" />
                <h2 className="text-lg sm:text-xl font-display font-bold text-white">
                  Panduan Cepat Cara Bermain CLASS OF CHAMPIONS
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  setShowGuideModal(true);
                }}
                className="text-xs font-display font-bold text-cyan-400 hover:text-cyan-300 underline underline-offset-4 cursor-pointer"
              >
                Lihat Aturan Lengkap & Arti Warna Kotak →
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-[#060E1F] border border-slate-800 space-y-2">
                <div className="text-xs font-mono-num font-bold text-amber-400">
                  01. ATUR TIM & WAKTU
                </div>
                <h3 className="font-display font-bold text-sm text-white">
                  Pilih 2–8 Tim & Durasi
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Tentukan jumlah tim peserta, beri nama tim, pilih durasi permainan, dan gunakan 40 soal PJOK Atletik atau unggah file Excel.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[#060E1F] border border-slate-800 space-y-2">
                <div className="text-xs font-mono-num font-bold text-cyan-400">
                  02. BUKA 40 KOTAK SOAL
                </div>
                <h3 className="font-display font-bold text-sm text-white">
                  Pilih Kotak Biru (#1–#40)
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Klik salah satu dari 40 kotak soal (bobot 10, 25, 50, atau 100 poin). Moderator AI akan membacakan soal secara otomatis.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[#060E1F] border border-slate-800 space-y-2">
                <div className="text-xs font-mono-num font-bold text-emerald-400">
                  03. JAWAB DALAM 10 DETIK
                </div>
                <h3 className="font-display font-bold text-sm text-white">
                  Pilih Tim & Mulai Menjawab
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Pilih tim yang menjawab lalu klik <strong>Mulai Menjawab</strong>. Ketik jawaban sebelum hitung mundur 10 detik habis!
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[#060E1F] border border-slate-800 space-y-2">
                <div className="text-xs font-mono-num font-bold text-rose-400">
                  04. RAIH PODIUM JUARA
                </div>
                <h3 className="font-display font-bold text-sm text-white">
                  Kunci Poin & Final Ranking
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Jawaban benar mengunci kotak menjadi <strong>Hijau</strong>. Jawaban salah membuat kotak tetap bisa direbut tim lain hingga waktu habis!
                </p>
              </div>
            </div>
          </section>

          {/* Game Configuration Grid */}
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: 1. JUMLAH TIM & NAMA TIM */}
            <div className="lg:col-span-7 bg-[#0A162C] p-6 sm:p-8 rounded-2xl border border-slate-800 space-y-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-display font-bold text-white flex items-center gap-2.5">
                    <Users className="w-5 h-5 text-amber-400" />
                    <span>1. Pengaturan Jumlah & Nama Tim</span>
                  </h2>
                  <span className="text-xs font-mono-num text-amber-300">
                    {teamCount} Tim Aktif
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-400">
                  Pilih jumlah tim peserta kompetisi (2 hingga 8 tim) dan sesuaikan nama setiap tim.
                </p>
              </div>

              {/* Team Count Buttons (2 to 8) */}
              <div className="grid grid-cols-7 gap-2">
                {[2, 3, 4, 5, 6, 7, 8].map((num) => {
                  const active = teamCount === num;
                  return (
                    <button
                      key={num}
                      type="button"
                      onClick={() => handleSelectTeamCount(num)}
                      className={`py-3 rounded-xl font-display font-black text-base transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                        active
                          ? 'bg-amber-400 text-slate-950 shadow-[0_0_20px_rgba(245,158,11,0.45)]'
                          : 'bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300'
                      }`}
                    >
                      {num} Tim
                    </button>
                  );
                })}
              </div>

              {/* Team Name & Distinct Identity Color Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
                {teams.map((team, idx) => (
                  <div
                    key={team.id}
                    className="p-3.5 rounded-xl bg-[#060E1F] border border-slate-800 flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-300 flex items-center gap-2">
                        <span
                          className="w-3.5 h-3.5 rounded-sm inline-block"
                          style={{ backgroundColor: team.hex }}
                        />
                        TIM #{idx + 1}
                      </span>
                      <span className="text-slate-400">{team.colorName}</span>
                    </div>
                    <input
                      type="text"
                      value={team.name}
                      onChange={(e) => handleTeamNameChange(idx, e.target.value)}
                      placeholder={`Masukkan Nama Tim ${idx + 1}...`}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 focus:border-amber-400 text-white font-semibold text-sm outline-none"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Right Column: 2. DURASI PERMAINAN & 3. UNDUH / UNGGAH SOAL EXCEL */}
            <div className="lg:col-span-5 space-y-6">
              {/* Duration Configuration */}
              <div className="bg-[#0A162C] p-6 sm:p-7 rounded-2xl border border-slate-800 space-y-5">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-display font-bold text-white flex items-center gap-2.5">
                      <Clock className="w-5 h-5 text-amber-400" />
                      <span>2. Durasi Permainan</span>
                    </h2>
                    <span className="font-mono-num text-sm font-bold text-amber-300">
                      {durationMinutes} Menit
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Pilih durasi waktu kompetisi atau tentukan secara manual.
                  </p>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  {DURATION_PRESETS.map((mins) => {
                    const active = !isManualDuration && durationMinutes === mins;
                    return (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => {
                          soundEngine.playClick();
                          setIsManualDuration(false);
                          setDurationMinutes(mins);
                        }}
                        className={`py-2.5 px-2 rounded-xl font-mono-num font-bold text-xs sm:text-sm transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                          active
                            ? 'bg-amber-400 text-slate-950 shadow-[0_0_15px_rgba(245,158,11,0.4)]'
                            : 'bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300'
                        }`}
                      >
                        {mins} Menit
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playClick();
                      setIsManualDuration(true);
                      const parsed = parseInt(manualDurationInput, 10);
                      if (!isNaN(parsed) && parsed > 0) setDurationMinutes(parsed);
                    }}
                    className={`py-2.5 px-2 rounded-xl font-display font-bold text-xs sm:text-sm transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                      isManualDuration
                        ? 'bg-cyan-400 text-slate-950'
                        : 'bg-slate-900 hover:bg-slate-800 border border-slate-800 text-cyan-300'
                    }`}
                  >
                    Manual
                  </button>
                </div>

                {isManualDuration && (
                  <div className="flex items-center gap-3 p-3.5 rounded-xl bg-[#060E1F] border border-cyan-500/40">
                    <label className="text-xs font-semibold text-slate-300 whitespace-nowrap">
                      Durasi Manual (Menit):
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={180}
                      value={manualDurationInput}
                      onChange={(e) => {
                        setManualDurationInput(e.target.value);
                        const val = parseInt(e.target.value, 10);
                        if (!isNaN(val) && val >= 1) {
                          setDurationMinutes(Math.min(180, val));
                        }
                      }}
                      className="w-24 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-cyan-300 font-mono-num font-bold text-sm outline-none"
                    />
                    <span className="text-xs text-slate-400">Menit (1–180)</span>
                  </div>
                )}
              </div>

              {/* Excel Question Bank Template Download & Upload */}
              <div className="bg-[#0A162C] p-6 sm:p-7 rounded-2xl border border-slate-800 space-y-5">
                <div className="space-y-1">
                  <h2 className="text-xl font-display font-bold text-white flex items-center gap-2.5">
                    <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                    <span>3. Manajemen 40 Soal Excel (.xlsx)</span>
                  </h2>
                  <p className="text-xs text-slate-400">
                    Bobot poin bertingkat sesuai kesulitan: <strong>10, 25, 50, dan 100 Poin</strong>.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playClick();
                      downloadQuestionTemplateExcel(questions);
                    }}
                    className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 border border-amber-400/50 text-amber-300 font-display font-bold text-xs sm:text-sm transition-all cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Download className="w-4 h-4" />
                    <span>UNDUH SOAL (.XLSX)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400 text-emerald-300 font-display font-bold text-xs sm:text-sm transition-all cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Upload className="w-4 h-4" />
                    <span>UNGGAH SOAL (.XLSX)</span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleExcelFileUpload}
                    className="hidden"
                  />
                </div>

                {/* Active File Status & Validation Banner */}
                <div className="p-3.5 rounded-xl bg-[#060E1F] border border-slate-800 text-xs space-y-1.5">
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Paket Soal Aktif:</span>
                    <button
                      type="button"
                      onClick={() => {
                        soundEngine.playClick();
                        setQuestions(DEFAULT_PJOK_ATLETIK_QUESTIONS);
                        setBoxes(createInitialBoxes(DEFAULT_PJOK_ATLETIK_QUESTIONS));
                        setUploadedFileName('Paket_Default_40_Soal_PJOK_Atletik_Kelas_4_Fase_B.xlsx');
                        setExcelNotification({
                          type: 'success',
                          message:
                            'Berhasil memuat ulang 40 Soal Default PJOK Materi Atletik Kelas 4 / Fase B.',
                        });
                      }}
                      className="text-cyan-400 hover:underline cursor-pointer"
                    >
                      Reset ke Default PJOK Kelas 4 / Fase B
                    </button>
                  </div>
                  <div className="font-mono-num font-semibold text-white truncate">
                    {uploadedFileName}
                  </div>
                </div>

                {excelNotification && (
                  <div
                    className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
                      excelNotification.type === 'success'
                        ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200'
                        : 'bg-rose-950/40 border-rose-500/50 text-rose-200'
                    }`}
                  >
                    <div className="flex items-start gap-2 font-semibold">
                      {excelNotification.type === 'success' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      )}
                      <span>{excelNotification.message}</span>
                    </div>
                    {excelNotification.details && excelNotification.details.length > 0 && (
                      <ul className="pl-6 list-disc space-y-0.5 text-[11px] text-rose-300">
                        {excelNotification.details.map((d, i) => (
                          <li key={i}>{d}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Grand START GAME Call-to-Action */}
          <section className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-[#0A162C] via-[#0F2142] to-[#0A162C] border border-amber-400/40 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-1 text-center md:text-left">
              <div className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
                SIAP MEMULAI KOMPETISI KELAS?
              </div>
              <h3 className="text-xl sm:text-2xl font-display font-black text-white">
                {teamCount} Tim Peserta · Durasi {durationMinutes} Menit · 40 Kotak Soal {GAME_IDENTITY.mataPelajaran} ({GAME_IDENTITY.materi})
              </h3>
            </div>

            <button
              type="button"
              disabled={!canStartGame}
              onMouseEnter={() => soundEngine.playHover()}
              onClick={handleStartGame}
              className={`flex items-center justify-center gap-3 px-10 py-5 rounded-2xl font-display font-black text-xl tracking-wider transition-all whitespace-nowrap shrink-0 ${
                canStartGame
                  ? 'bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 text-slate-950 shadow-[0_0_45px_rgba(245,158,11,0.6)] hover:shadow-[0_0_65px_rgba(245,158,11,0.9)] hover:scale-[1.03] active:scale-[0.98] cursor-pointer'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              <Play className="w-6 h-6 fill-current" />
              <span>START GAME</span>
            </button>
          </section>
        </main>
      )}

      {/* ===================================================================== */}
      {/* 2. HALAMAN UTAMA PERMAINAN (40-BOX ARENA & LIVE LEADERBOARD)          */}
      {/* ===================================================================== */}
      {view === 'GAME' && (
        <main className="relative z-10 flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-8 py-6 space-y-6">
          {/* Top Arena HUD: Left Identity & Right Countdown Timer + Teacher Controls */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 rounded-2xl bg-[#091428] border border-slate-800 shadow-lg">
            {/* POJOK KIRI ATAS: Logo, Title, and Pre-configured Subject/Topic/Class */}
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-400/15 border border-amber-400/50 flex items-center justify-center shrink-0">
                <Trophy className="w-7 h-7 text-amber-400" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-display font-black tracking-wide text-white leading-tight">
                  CLASS OF <span className="text-amber-400">CHAMPIONS</span>
                </h1>
                <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm font-semibold text-cyan-300 mt-0.5">
                  <span>MATA PELAJARAN: {GAME_IDENTITY.mataPelajaran}</span>
                  <span aria-hidden="true">·</span>
                  <span>MATERI: {GAME_IDENTITY.materi}</span>
                  <span aria-hidden="true">·</span>
                  <span>KELAS: {GAME_IDENTITY.kelas}</span>
                </div>
              </div>
            </div>

            {/* POJOK KANAN ATAS: Main Countdown Timer (MM:SS) & Pause/Resume/End Controls */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Progress Counter */}
              <div className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-medium text-slate-300">
                Soal Terkunci:{' '}
                <strong className="font-mono-num text-emerald-400">
                  {solvedBoxesCount}/40
                </strong>
              </div>

              {/* Overall Game Countdown Timer */}
              <div
                className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl border font-mono-num font-black text-2xl sm:text-3xl tracking-wider transition-all ${
                  remainingSeconds <= 60
                    ? 'bg-rose-950/80 border-rose-500 text-rose-300 animate-pulse shadow-[0_0_30px_rgba(244,63,94,0.45)]'
                    : isPaused
                    ? 'bg-amber-950/60 border-amber-400 text-amber-300'
                    : 'bg-[#050C1A] border-amber-400/50 text-amber-300'
                }`}
              >
                <Clock
                  className={`w-6 h-6 ${
                    remainingSeconds <= 60 ? 'text-rose-400 animate-bounce' : 'text-amber-400'
                  }`}
                />
                <span>{formatTimer(remainingSeconds)}</span>
              </div>

              {/* Teacher PAUSE / RESUME Button */}
              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  setIsPaused((prev) => !prev);
                }}
                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-display font-bold text-xs sm:text-sm transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  isPaused
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                    : 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                }`}
              >
                {isPaused ? (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    <span>RESUME</span>
                  </>
                ) : (
                  <>
                    <Pause className="w-4 h-4 fill-current" />
                    <span>PAUSE</span>
                  </>
                )}
              </button>

              {/* Guide Modal Trigger in Arena */}
              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  setShowGuideModal(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-amber-300 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <BookOpen className="w-4 h-4" />
                <span>Panduan</span>
              </button>

              {/* Reset / Ulangi with Confirmation */}
              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  setConfirmDialog({
                    title: 'Ulangi Permainan Dari Awal?',
                    description:
                      'Seluruh skor tim dan status 40 kotak soal akan diatur ulang ke 0. Tindakan ini memerlukan konfirmasi guru.',
                    confirmLabel: 'Ya, Ulangi Permainan',
                    onConfirm: () => {
                      setConfirmDialog(null);
                      handleStartGame();
                    },
                  });
                }}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Ulangi</span>
              </button>

              {/* Finish Game Early with Confirmation */}
              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  setConfirmDialog({
                    title: 'Akhiri Permainan & Tampilkan Final Ranking?',
                    description:
                      'Permainan akan dihentikan sekarang dan sistem akan langsung mengumumkan pemenang di halaman Final Ranking.',
                    confirmLabel: 'Ya, Akhiri & Lihat Pemenang',
                    onConfirm: () => {
                      setConfirmDialog(null);
                      setView('FINAL_RANKING');
                    },
                  });
                }}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-rose-950/70 hover:bg-rose-900 border border-rose-700/60 text-xs font-semibold text-rose-200 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Flag className="w-4 h-4" />
                <span>Akhiri</span>
              </button>
            </div>
          </div>

          {/* BAGIAN ATAS: Permanent Auto-Sorted Leaderboard */}
          <section className="p-4 sm:p-5 rounded-2xl bg-[#091428] border border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-display font-bold uppercase tracking-wider text-amber-300">
                PAPAN SKOR & LEADERBOARD TIM (URUT OTOMATIS)
              </span>
              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  setShowHistoryModal(true);
                }}
                className="flex items-center gap-1.5 text-cyan-400 hover:underline cursor-pointer"
              >
                <History className="w-3.5 h-3.5" />
                <span>Lihat Riwayat Jawaban ({history.length})</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-3">
              {sortedLeaderboard.map((team, idx) => {
                const isLeader = idx === 0 && team.score > 0;
                return (
                  <div
                    key={team.id}
                    style={{
                      borderColor: isLeader ? '#F59E0B' : `${team.hex}66`,
                    }}
                    className={`relative p-3.5 rounded-xl bg-[#050C1A] border transition-all duration-200 flex items-center justify-between gap-3 ${
                      isLeader ? 'shadow-[0_0_25px_rgba(245,158,11,0.2)]' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center font-mono-num font-black text-sm text-slate-950 shrink-0"
                        style={{ backgroundColor: team.hex }}
                      >
                        #{idx + 1}
                      </div>
                      <div className="min-w-0">
                        <div className="font-display font-bold text-sm sm:text-base text-white truncate">
                          {team.name}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Benar: <strong className="text-emerald-400">{team.correctCount}</strong> · Percobaan: {team.attemptsCount}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="font-mono-num font-black text-xl sm:text-2xl text-amber-300">
                        {team.score}
                      </div>
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        POIN
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* BAGIAN TENGAH: 40 Question Boxes in 8 Columns × 5 Rows Grid */}
          <section className="p-5 sm:p-7 rounded-3xl bg-[#091428] border border-slate-800 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <LayoutGrid className="w-5 h-5 text-amber-400" />
                <h2 className="text-base sm:text-lg font-display font-bold text-white">
                  ARENA 40 KOTAK SOAL KOMPETISI (8 KOLOM × 5 BARIS)
                </h2>
              </div>

              {/* Status Legend */}
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-sky-600 inline-block" />
                  <span>Biru: Belum Dijawab</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-amber-400 inline-block" />
                  <span>Emas: Sedang Dimainkan</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" />
                  <span>Hijau: Benar & Terkunci</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-rose-600 inline-block" />
                  <span>Merah: Jawaban Salah</span>
                </span>
              </div>
            </div>

            {/* 8 Columns x 5 Rows Grid on Desktop */}
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-8 gap-3 sm:gap-3.5">
              {questions.map((q) => {
                const box = boxes[q.id] || {
                  questionId: q.id,
                  status: 'BLUE_AVAILABLE',
                };
                const isLocked = box.status === 'GREEN_LOCKED';
                const isPlaying = box.status === 'GOLD_PLAYING';
                const isRedFlash = box.status === 'RED_FLASH';

                return (
                  <button
                    key={q.id}
                    type="button"
                    disabled={isLocked || showGameOverBanner}
                    onMouseEnter={() => {
                      if (!isLocked) soundEngine.playHover();
                    }}
                    onClick={() => handleBoxClick(q.id)}
                    className={`group relative h-24 sm:h-28 rounded-2xl p-3 flex flex-col justify-between transition-all duration-150 select-none ${
                      isLocked
                        ? 'bg-gradient-to-b from-emerald-600 to-emerald-800 border-2 border-emerald-400 border-b-4 text-white cursor-not-allowed shadow-[0_0_20px_rgba(16,185,129,0.25)]'
                        : isPlaying
                        ? 'bg-gradient-to-b from-amber-300 to-amber-500 border-2 border-yellow-200 border-b-4 text-slate-950 scale-105 shadow-[0_0_30px_rgba(245,158,11,0.65)]'
                        : isRedFlash
                        ? 'bg-gradient-to-b from-rose-600 to-rose-800 border-2 border-rose-400 border-b-4 text-white animate-shake'
                        : 'bg-gradient-to-b from-[#13315C] to-[#0B1D3A] hover:from-[#1B437C] hover:to-[#102A52] border-2 border-sky-400/40 hover:border-amber-400 border-b-4 border-b-sky-950 text-white hover:-translate-y-1 active:translate-y-0.5 cursor-pointer shadow-lg'
                    }`}
                  >
                    {/* Top Row inside Box: Point Weight & Status Icon */}
                    <div className="w-full flex items-center justify-between text-[11px] font-mono-num font-bold">
                      <span
                        className={
                          isPlaying
                            ? 'text-slate-950'
                            : isLocked
                            ? 'text-emerald-100'
                            : 'text-cyan-300'
                        }
                      >
                        {q.points}P
                      </span>
                      {isLocked ? (
                        <Lock className="w-3.5 h-3.5 text-emerald-200" />
                      ) : isPlaying ? (
                        <Sparkles className="w-3.5 h-3.5 text-slate-950 animate-spin" />
                      ) : (
                        <span className="text-[10px] opacity-60">BUKA</span>
                      )}
                    </div>

                    {/* Center Question Number (1-40) */}
                    <div className="font-display font-black text-2xl sm:text-3xl tracking-tight text-center my-auto">
                      {q.id}
                    </div>

                    {/* Bottom Status Label */}
                    <div className="w-full text-center truncate text-[10px] font-semibold tracking-wide">
                      {isLocked ? (
                        <span className="text-emerald-100">
                          ✓ {box.answeredByTeamName || 'TERKUNCI'}
                        </span>
                      ) : isPlaying ? (
                        <span className="text-slate-950 font-bold">DIMAINKAN</span>
                      ) : isRedFlash ? (
                        <span className="text-rose-100 font-bold">SALAH!</span>
                      ) : (
                        <span className="text-sky-200/80 group-hover:text-amber-300">
                          TERSEDIA
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* GAME OVER Dramatic Fullscreen Overlay when timer reaches 00:00 or all 40 solved */}
          {showGameOverBanner && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-6">
              <div className="max-w-xl w-full p-10 rounded-3xl bg-[#0A162C] border-2 border-amber-400 text-center space-y-4 shadow-[0_0_80px_rgba(245,158,11,0.5)] animate-bounce">
                <Trophy className="w-20 h-20 text-amber-400 mx-auto" />
                <h2 className="text-5xl sm:text-6xl font-display font-black text-white tracking-tight">
                  {solvedBoxesCount === 40 ? 'ALL 40 CLEARED!' : 'GAME OVER!'}
                </h2>
                <p className="text-lg text-amber-300 font-semibold">
                  Menghitung perolehan poin akhir dan menyiapkan Podium Juara...
                </p>
              </div>
            </div>
          )}
        </main>
      )}

      {/* ===================================================================== */}
      {/* 3. HALAMAN FINAL RANKING (GRAND PODIUM & EXCEL RECAP DOWNLOAD)        */}
      {/* ===================================================================== */}
      {view === 'FINAL_RANKING' && (
        <main className="relative z-10 flex-1 max-w-6xl w-full mx-auto px-4 sm:px-8 py-8 sm:py-10 space-y-10">
          {/* Grand Championship Header with Fixed DATA INPUT Identity */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center gap-2 text-xs font-bold tracking-widest text-amber-400 uppercase">
              <Sparkles className="w-4 h-4" />
              <span>PENGUMUMAN PEMENANG KOMPETISI AKADEMIK</span>
              <Sparkles className="w-4 h-4" />
            </div>

            <h1 className="text-4xl sm:text-6xl font-display font-black text-white tracking-tight">
              FINAL <span className="text-amber-400">RANKING</span> — CLASS OF CHAMPIONS
            </h1>

            <div className="flex flex-wrap items-center justify-center gap-3 text-sm sm:text-base font-display font-bold text-cyan-300">
              <span>MATA PELAJARAN: {GAME_IDENTITY.mataPelajaran}</span>
              <span aria-hidden="true">·</span>
              <span>MATERI: {GAME_IDENTITY.materi}</span>
              <span aria-hidden="true">·</span>
              <span>KELAS: {GAME_IDENTITY.kelas}</span>
            </div>

            {/* Quick Indoor Acoustic & Championship Fanfare Bar on Final Ranking Menu */}
            <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
              <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 border border-amber-400/50">
                <Volume2 className="w-4 h-4 text-amber-400" />
                <select
                  value={soundSnap.roomPreset}
                  onChange={(e) =>
                    soundEngine.setRoomPreset(e.target.value as IndoorRoomPreset, true)
                  }
                  aria-label="Efek Suara Dalam Ruangan di Podium Final Ranking"
                  className="bg-transparent text-xs font-semibold text-amber-300 outline-none cursor-pointer"
                >
                  {INDOOR_ROOM_PRESETS.map((p) => (
                    <option key={p.id} value={p.id} className="bg-slate-900 text-white">
                      Akustik Podium: {p.label}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={() => soundEngine.playCorrectAnswer(100)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-400/20 hover:bg-amber-400/30 border border-amber-400/60 text-xs font-display font-bold text-amber-200 transition-colors cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Bunyikan Terompet Kemenangan</span>
              </button>
            </div>
          </div>

          {/* PODIUM TIGA BESAR (Handles 2 teams or 3+ teams, and honest tie display) */}
          <section className="pt-6 pb-2">
            <div
              className={`grid gap-6 items-end max-w-4xl mx-auto ${
                teams.length === 2
                  ? 'grid-cols-1 sm:grid-cols-2 max-w-2xl'
                  : 'grid-cols-1 sm:grid-cols-3'
              }`}
            >
              {/* JUARA 2: Left Podium */}
              {rankGroups[1] && (
                <div className="order-2 sm:order-1 flex flex-col items-center">
                  <div className="w-full p-6 rounded-t-3xl bg-gradient-to-b from-slate-800/90 to-[#0A162C] border-2 border-slate-300/60 text-center space-y-3 shadow-xl">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-200 text-slate-900 shadow-md">
                      <Medal className="w-8 h-8" />
                    </div>
                    <div className="text-xs font-display font-black tracking-widest text-slate-300 uppercase">
                      JUARA 2 · MEDALI PERAK {rankGroups[1].isTie ? '(SERI)' : ''}
                    </div>
                    <div className="space-y-1">
                      {rankGroups[1].teams.map((t) => (
                        <div
                          key={t.id}
                          className="text-lg sm:text-xl font-display font-black text-white flex items-center justify-center gap-2"
                        >
                          <span
                            className="w-3 h-3 rounded-sm"
                            style={{ backgroundColor: t.hex }}
                          />
                          <span>{t.name}</span>
                        </div>
                      ))}
                    </div>
                    <div className="font-mono-num font-black text-3xl text-slate-200">
                      {rankGroups[1].score}{' '}
                      <span className="text-xs font-normal text-slate-400">POIN</span>
                    </div>
                  </div>
                  <div className="w-full h-24 bg-gradient-to-b from-slate-400/30 to-slate-900/80 border-x-2 border-b-2 border-slate-400/50 rounded-b-xl flex items-center justify-center font-display font-black text-3xl text-slate-300">
                    2
                  </div>
                </div>
              )}

              {/* JUARA 1: Center Highest Podium */}
              {rankGroups[0] && (
                <div className="order-1 sm:order-2 flex flex-col items-center">
                  <div className="w-full p-7 rounded-t-3xl bg-gradient-to-b from-amber-500/25 via-[#122240] to-[#0A162C] border-2 border-amber-400 text-center space-y-3 shadow-[0_0_55px_rgba(245,158,11,0.35)]">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-400 text-slate-950 shadow-lg animate-bounce">
                      <Trophy className="w-10 h-10 stroke-[2.2]" />
                    </div>
                    <div className="text-xs font-display font-black tracking-widest text-amber-300 uppercase">
                      JUARA 1 · PIALA EMAS {rankGroups[0].isTie ? '(SERI / JUARA BERSAMA)' : ''}
                    </div>
                    <div className="space-y-1">
                      {rankGroups[0].teams.map((t) => (
                        <div
                          key={t.id}
                          className="text-xl sm:text-2xl font-display font-black text-white flex items-center justify-center gap-2"
                        >
                          <span
                            className="w-3.5 h-3.5 rounded-sm"
                            style={{ backgroundColor: t.hex }}
                          />
                          <span>{t.name}</span>
                        </div>
                      ))}
                    </div>
                    <div className="font-mono-num font-black text-4xl text-amber-300">
                      {rankGroups[0].score}{' '}
                      <span className="text-xs font-normal text-amber-200/80">POIN</span>
                    </div>
                  </div>
                  <div className="w-full h-36 bg-gradient-to-b from-amber-400/40 to-amber-950/60 border-x-2 border-b-2 border-amber-400 rounded-b-xl flex items-center justify-center font-display font-black text-5xl text-amber-300">
                    1
                  </div>
                </div>
              )}

              {/* JUARA 3: Right Podium (Only shown when >= 3 rank groups & >= 3 teams) */}
              {teams.length >= 3 && rankGroups[2] && (
                <div className="order-3 flex flex-col items-center">
                  <div className="w-full p-6 rounded-t-3xl bg-gradient-to-b from-amber-900/35 to-[#0A162C] border-2 border-amber-600/60 text-center space-y-3 shadow-xl">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-600 text-white shadow-md">
                      <Award className="w-8 h-8" />
                    </div>
                    <div className="text-xs font-display font-black tracking-widest text-amber-400 uppercase">
                      JUARA 3 · MEDALI PERUNGGU {rankGroups[2].isTie ? '(SERI)' : ''}
                    </div>
                    <div className="space-y-1">
                      {rankGroups[2].teams.map((t) => (
                        <div
                          key={t.id}
                          className="text-lg sm:text-xl font-display font-black text-white flex items-center justify-center gap-2"
                        >
                          <span
                            className="w-3 h-3 rounded-sm"
                            style={{ backgroundColor: t.hex }}
                          />
                          <span>{t.name}</span>
                        </div>
                      ))}
                    </div>
                    <div className="font-mono-num font-black text-3xl text-amber-400">
                      {rankGroups[2].score}{' '}
                      <span className="text-xs font-normal text-slate-400">POIN</span>
                    </div>
                  </div>
                  <div className="w-full h-16 bg-gradient-to-b from-amber-700/30 to-slate-900/80 border-x-2 border-b-2 border-amber-600/60 rounded-b-xl flex items-center justify-center font-display font-black text-2xl text-amber-400">
                    3
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Complete Ranking Table of All Teams */}
          <section className="bg-[#0A162C] p-6 sm:p-8 rounded-2xl border border-slate-800 space-y-4">
            <h2 className="text-lg sm:text-xl font-display font-bold text-white">
              Daftar Peringkat Lengkap Seluruh Tim
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase">
                    <th className="py-3 px-4">Peringkat</th>
                    <th className="py-3 px-4">Nama Tim</th>
                    <th className="py-3 px-4">Soal Dijawab Benar</th>
                    <th className="py-3 px-4">Total Percobaan</th>
                    <th className="py-3 px-4 text-right">Total Skor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 text-sm">
                  {sortedLeaderboard.map((team) => {
                    const sameScoreCount = sortedLeaderboard.filter(
                      (t) => t.score === team.score
                    ).length;
                    const higherCount = sortedLeaderboard.filter(
                      (t) => t.score > team.score
                    ).length;
                    const rankNum = higherCount + 1;

                    return (
                      <tr key={team.id} className="hover:bg-slate-900/50">
                        <td className="py-3.5 px-4 font-mono-num font-bold text-amber-300">
                          Juara {rankNum}{' '}
                          {sameScoreCount > 1 && (
                            <span className="text-xs text-cyan-300 ml-1">(SERI)</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-display font-bold text-white flex items-center gap-2.5">
                          <span
                            className="w-3.5 h-3.5 rounded-sm shrink-0"
                            style={{ backgroundColor: team.hex }}
                          />
                          <span>{team.name}</span>
                        </td>
                        <td className="py-3.5 px-4 font-mono-num text-emerald-400 font-semibold">
                          {team.correctCount} Soal
                        </td>
                        <td className="py-3.5 px-4 font-mono-num text-slate-300">
                          {team.attemptsCount} Kali
                        </td>
                        <td className="py-3.5 px-4 font-mono-num font-black text-xl text-amber-300 text-right">
                          {team.score} Poin
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* Action Buttons: MAIN LAGI, KEMBALI KE BERANDA, UNDUH HASIL */}
          <section className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <button
              type="button"
              onClick={handleStartGame}
              className="flex items-center gap-2.5 px-8 py-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-black text-base shadow-[0_0_30px_rgba(245,158,11,0.45)] transition-all cursor-pointer whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-5 h-5" />
              <span>MAIN LAGI</span>
            </button>

            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                setView('HOME');
              }}
              className="flex items-center gap-2.5 px-7 py-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-display font-bold text-base transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Home className="w-5 h-5 text-cyan-400" />
              <span>KEMBALI KE BERANDA</span>
            </button>

            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                downloadFinalRankingExcel(teams, history);
              }}
              className="flex items-center gap-2.5 px-7 py-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-black text-base shadow-[0_0_25px_rgba(16,185,129,0.4)] transition-all cursor-pointer whitespace-nowrap shrink-0"
            >
              <Download className="w-5 h-5" />
              <span>UNDUH HASIL (.XLSX)</span>
            </button>
          </section>
        </main>
      )}

      {/* ===================================================================== */}
      {/* 4. STUDIO POSTER BOARD QUIZ INTERAKTIF (A4)                           */}
      {/* ===================================================================== */}
      {view === 'BOARD_POSTER_STUDIO' && (
        <main className="relative z-10 flex-1">
          <BoardPosterStudio activeQuestions={questions} />
        </main>
      )}

      {/* Question Popup Modal */}
      {activeQuestionObj && (
        <QuestionModal
          question={activeQuestionObj}
          teams={teams}
          isMainTimerPaused={isPaused}
          onClose={handleCloseModalUnanswered}
          onResolveAnswer={handleResolveAnswer}
        />
      )}

      {/* Answer History & Points Log Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-4xl rounded-2xl bg-[#0A162C] border border-slate-700 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 bg-[#071022] border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <History className="w-5 h-5 text-amber-400" />
                <h3 className="text-lg font-display font-bold text-white">
                  Riwayat Jawaban & Perolehan Poin Tim
                </h3>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-amber-400/40">
                  <Volume2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <select
                    value={soundSnap.roomPreset}
                    onChange={(e) =>
                      soundEngine.setRoomPreset(e.target.value as IndoorRoomPreset, true)
                    }
                    aria-label="Efek Suara Dalam Ruangan di Menu Riwayat"
                    className="bg-transparent text-xs font-semibold text-amber-300 outline-none cursor-pointer"
                  >
                    {INDOOR_ROOM_PRESETS.map((p) => (
                      <option key={p.id} value={p.id} className="bg-slate-900 text-white">
                        Ruangan: {p.shortLabel}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playMenuSwitch();
                    setShowHistoryModal(false);
                  }}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {history.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm">
                  Belum ada riwayat jawaban pada sesi permainan ini.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs sm:text-sm">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 uppercase text-xs">
                        <th className="py-2.5 px-3">Waktu</th>
                        <th className="py-2.5 px-3">Soal</th>
                        <th className="py-2.5 px-3">Tim</th>
                        <th className="py-2.5 px-3">Jawaban</th>
                        <th className="py-2.5 px-3">Hasil</th>
                        <th className="py-2.5 px-3">Durasi</th>
                        <th className="py-2.5 px-3 text-right">Poin</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/70">
                      {history.map((item) => (
                        <tr key={item.id}>
                          <td className="py-3 px-3 font-mono-num text-slate-400">
                            {item.timestamp}
                          </td>
                          <td className="py-3 px-3 font-mono-num font-bold text-white">
                            #{item.questionNumber}
                          </td>
                          <td className="py-3 px-3 font-semibold text-white flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-sm shrink-0"
                              style={{ backgroundColor: item.teamColorHex }}
                            />
                            <span>{item.teamName}</span>
                          </td>
                          <td className="py-3 px-3 text-slate-200">
                            {item.submittedAnswer || '-'}
                          </td>
                          <td className="py-3 px-3 font-bold">
                            {item.status === 'BENAR' ? (
                              <span className="text-emerald-400">✓ BENAR</span>
                            ) : item.status === 'WAKTU HABIS' ? (
                              <span className="text-amber-400">⏰ WAKTU HABIS</span>
                            ) : (
                              <span className="text-rose-400">✕ SALAH</span>
                            )}
                          </td>
                          <td className="py-3 px-3 font-mono-num text-slate-300">
                            {item.timeTakenSeconds} dtk
                          </td>
                          <td className="py-3 px-3 font-mono-num font-bold text-right text-amber-300">
                            +{item.pointsEarned}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* How To Play / Game Guide Modal */}
      {showGuideModal && (
        <HowToPlayModal onClose={() => setShowGuideModal(false)} />
      )}

      {/* Teacher Confirmation Dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-[#0A162C] border border-slate-700 p-6 space-y-5 shadow-2xl">
            <h3 className="text-xl font-display font-bold text-white">
              {confirmDialog.title}
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              {confirmDialog.description}
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmDialog.onConfirm}
                className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-bold text-xs cursor-pointer"
              >
                {confirmDialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mandatory Footer with "Game Design by prooflendi" */}
      <footer className="relative z-10 mt-auto py-5 px-6 bg-[#040914] border-t border-slate-800/80 text-center text-xs text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-2 max-w-7xl w-full mx-auto">
        <div>
          <strong>CLASS OF CHAMPIONS</strong> · {GAME_IDENTITY.mataPelajaran} · Materi {GAME_IDENTITY.materi} · Kelas {GAME_IDENTITY.kelas}
        </div>
        <div className="font-display font-bold text-amber-400 tracking-wide">
          {GAME_IDENTITY.footerCredit}
        </div>
      </footer>
    </div>
  );
}
