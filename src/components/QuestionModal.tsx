import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import {
  CheckCircle2,
  XCircle,
  AlarmClock,
  Play,
  Send,
  Delete,
  Space,
  Keyboard,
  Hash,
  ShieldCheck,
  X,
  Users,
  Sparkles,
  Mic,
  Volume2,
} from 'lucide-react';
import { QuestionItem, TeamConfig } from '../data/defaultQuestions';
import { isAnswerMatch } from '../utils/excelHelper';
import {
  soundEngine,
  INDOOR_ROOM_PRESETS,
  IndoorRoomPreset,
  SoundEngineSnapshot,
} from '../utils/soundEngine';
import { moderatorEngine, ModeratorStateSnapshot } from '../utils/moderatorEngine';

interface QuestionModalProps {
  question: QuestionItem;
  teams: TeamConfig[];
  isMainTimerPaused: boolean;
  onClose: () => void;
  onResolveAnswer: (params: {
    questionId: number;
    teamId: string;
    submittedAnswer: string;
    status: 'BENAR' | 'SALAH' | 'WAKTU HABIS';
    timeTakenSeconds: number;
    pointsEarned: number;
    verifiedManually?: boolean;
  }) => void;
}

type ModalStage = 'SELECT_TEAM_AND_READY' | 'ANSWERING' | 'RESULT_CORRECT' | 'RESULT_WRONG' | 'RESULT_TIMEOUT';

const QWERTY_ROWS = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
];

const NUMERIC_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0'];

export const QuestionModal: React.FC<QuestionModalProps> = ({
  question,
  teams,
  isMainTimerPaused,
  onClose,
  onResolveAnswer,
}) => {
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [stage, setStage] = useState<ModalStage>('SELECT_TEAM_AND_READY');
  const [countdown, setCountdown] = useState<number>(10);
  const [answerText, setAnswerText] = useState<string>('');
  const [keypadMode, setKeypadMode] = useState<'FULL' | 'NUMERIC'>(() => {
    // Automatically default to numeric pad if the expected answer is purely numeric, while allowing instant switch
    const isNum = /^\d+(\.\d+)?$/.test(question.answer.trim());
    return isNum ? 'NUMERIC' : 'FULL';
  });
  const [showTeacherOverride, setShowTeacherOverride] = useState<boolean>(false);
  const [modState, setModState] = useState<ModeratorStateSnapshot>(() =>
    moderatorEngine.getSnapshot()
  );
  const [soundSnap, setSoundSnap] = useState<SoundEngineSnapshot>(() =>
    soundEngine.getSnapshot()
  );

  const inputRef = useRef<HTMLInputElement>(null);
  const startTimeRef = useRef<number>(0);
  const resolvedRef = useRef<boolean>(false);

  const selectedTeam = teams.find((t) => t.id === selectedTeamId);

  // Subscribe to AI Moderator & Sound Engine state & read question automatically on open
  useEffect(() => {
    const unsubMod = moderatorEngine.subscribe(setModState);
    const unsubSound = soundEngine.subscribe(setSoundSnap);
    moderatorEngine.announceQuestionOpened(question);
    return () => {
      unsubMod();
      unsubSound();
      soundEngine.stopQuestionBellsAmbience();
    };
  }, [question]);

  // Handle 10-second question countdown
  useEffect(() => {
    if (stage !== 'ANSWERING' || isMainTimerPaused) return;

    const timer = window.setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleTimeOut();
          return 0;
        }
        const nextVal = prev - 1;
        // Play countdown sound (urgent red alert when <= 3 seconds)
        soundEngine.playTick(nextVal <= 3);
        return nextVal;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [stage, isMainTimerPaused]);

  const handleStartAnswering = () => {
    if (!selectedTeamId) return;
    soundEngine.playStartAnswering();
    if (selectedTeam) {
      moderatorEngine.announceTeamAnswering(selectedTeam.name);
    }
    setCountdown(10);
    startTimeRef.current = Date.now();
    setStage('ANSWERING');
    setTimeout(() => {
      inputRef.current?.focus();
    }, 80);
  };

  const triggerConfetti = () => {
    try {
      confetti({
        particleCount: 90,
        spread: 75,
        origin: { y: 0.55 },
        colors: ['#F59E0B', '#10B981', '#38BDF8', '#FDE047', '#FFFFFF'],
      });
    } catch {}
  };

  const finalizeResolution = (
    status: 'BENAR' | 'SALAH' | 'WAKTU HABIS',
    manualOverride: boolean = false
  ) => {
    if (resolvedRef.current || !selectedTeamId) return;
    resolvedRef.current = true;

    const elapsed = startTimeRef.current
      ? Math.min(10, Math.max(1, Math.round((Date.now() - startTimeRef.current) / 1000)))
      : 10 - countdown;

    if (status === 'BENAR') {
      setStage('RESULT_CORRECT');
      soundEngine.playCorrectAnswer(question.points);
      triggerConfetti();
      if (selectedTeam) {
        moderatorEngine.announceCorrectAnswer(
          selectedTeam.name,
          question.points,
          selectedTeam.score + question.points
        );
      }
      setTimeout(() => {
        onResolveAnswer({
          questionId: question.id,
          teamId: selectedTeamId,
          submittedAnswer: answerText.trim() || (manualOverride ? '[Verifikasi Guru]' : ''),
          status: 'BENAR',
          timeTakenSeconds: elapsed,
          pointsEarned: question.points,
          verifiedManually: manualOverride,
        });
      }, 2400);
    } else if (status === 'SALAH') {
      setStage('RESULT_WRONG');
      soundEngine.playWrongAnswer();
      if (selectedTeam) {
        moderatorEngine.announceWrongAnswer(selectedTeam.name);
      }
      setShowTeacherOverride(true);
    } else {
      setStage('RESULT_TIMEOUT');
      soundEngine.playTimesUpAlarm();
      if (selectedTeam) {
        moderatorEngine.announceTimesUp(selectedTeam.name);
      }
      setShowTeacherOverride(true);
    }
  };

  const handleTimeOut = () => {
    finalizeResolution('WAKTU HABIS', false);
  };

  const handleSubmitAnswer = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (stage !== 'ANSWERING' || !selectedTeamId) return;
    if (!answerText.trim()) return;

    const matched = isAnswerMatch(answerText, question);
    if (matched) {
      finalizeResolution('BENAR', false);
    } else {
      finalizeResolution('SALAH', false);
    }
  };

  // If teacher decides to accept an alternative phrasing after WRONG / TIMEOUT or during ANSWERING
  const handleTeacherManualAccept = () => {
    resolvedRef.current = false; // allow re-resolve as correct
    finalizeResolution('BENAR', true);
  };

  // Close after wrong answer or timeout (commits the attempt and unlocks box for other teams)
  const handleConfirmWrongOrTimeoutClose = () => {
    const elapsed = startTimeRef.current
      ? Math.min(10, Math.max(1, Math.round((Date.now() - startTimeRef.current) / 1000)))
      : 10;
    onResolveAnswer({
      questionId: question.id,
      teamId: selectedTeamId,
      submittedAnswer: answerText.trim(),
      status: stage === 'RESULT_TIMEOUT' ? 'WAKTU HABIS' : 'SALAH',
      timeTakenSeconds: stage === 'RESULT_TIMEOUT' ? 10 : elapsed,
      pointsEarned: 0,
      verifiedManually: false,
    });
  };

  const appendChar = (char: string) => {
    if (stage !== 'ANSWERING') return;
    soundEngine.playKeyPress();
    setAnswerText((prev) => prev + char);
  };

  const handleBackspace = () => {
    if (stage !== 'ANSWERING') return;
    soundEngine.playKeyPress();
    setAnswerText((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    if (stage !== 'ANSWERING') return;
    soundEngine.playKeyPress();
    setAnswerText('');
  };

  const isUrgent = stage === 'ANSWERING' && countdown <= 3;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md">
      <div
        className={`relative w-full max-w-4xl rounded-2xl border bg-[#0A162C] shadow-2xl overflow-hidden transition-transform duration-200 ${
          stage === 'RESULT_WRONG'
            ? 'border-rose-500 animate-shake'
            : stage === 'RESULT_CORRECT'
            ? 'border-emerald-400 shadow-[0_0_60px_rgba(16,185,129,0.35)]'
            : stage === 'RESULT_TIMEOUT'
            ? 'border-amber-500 animate-shake'
            : 'border-amber-400/50 shadow-[0_0_50px_rgba(245,158,11,0.2)]'
        }`}
      >
        {/* Top Modal Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 bg-[#071022] border-b border-slate-800">
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-amber-400 text-slate-950 font-display font-black text-xl shadow-md">
              #{question.id}
            </div>
            <div>
              <div className="text-xs font-semibold tracking-wider text-amber-400 uppercase">
                KOTAK SOAL NOMOR {question.id} · BOBOT {question.points} POIN
              </div>
              <h2 className="text-lg sm:text-xl font-display font-bold text-white">
                 Tantangan Kompetisi Akademik
              </h2>
            </div>
          </div>

          {/* 10-Second Question Countdown Display */}
          <div className="flex items-center gap-4">
            <div
              className={`flex items-center gap-2.5 px-4 py-2 rounded-xl border font-mono-num font-bold text-xl sm:text-2xl transition-colors ${
                isUrgent
                  ? 'bg-rose-600/30 border-rose-500 text-rose-300 animate-pulse'
                  : stage === 'ANSWERING'
                  ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                  : 'bg-slate-900 border-slate-700 text-slate-300'
              }`}
            >
              <AlarmClock className={`w-6 h-6 ${isUrgent ? 'text-rose-400 animate-bounce' : 'text-amber-400'}`} />
              <span>00:{String(countdown).padStart(2, '0')}</span>
            </div>

            {stage === 'SELECT_TEAM_AND_READY' && (
              <button
                onClick={() => {
                  soundEngine.playClick();
                  onClose();
                }}
                className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                title="Batal / Tutup Kotak"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Main Content Body */}
        <div className="p-6 sm:p-8 space-y-6 max-h-[85vh] overflow-y-auto">
          {/* Question Card Display */}
          <div className="p-6 sm:p-7 rounded-xl bg-[#050B16] border border-slate-800/90 shadow-inner space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-medium text-cyan-400">
                PERTANYAAN SOAL #{question.id} ({question.points} POIN):
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-amber-400/40">
                  <Volume2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <select
                    value={soundSnap.roomPreset}
                    onChange={(e) =>
                      soundEngine.setRoomPreset(e.target.value as IndoorRoomPreset, true)
                    }
                    aria-label="Efek Suara Dalam Ruangan"
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
                    soundEngine.playClick();
                    moderatorEngine.announceQuestionOpened(question, true);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                    modState.isSpeaking || modState.isLoading
                      ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                      : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-cyan-300'
                  }`}
                >
                  {modState.isSpeaking ? (
                    <Volume2 className="w-3.5 h-3.5 text-cyan-300 animate-bounce" />
                  ) : (
                    <Mic className="w-3.5 h-3.5 text-cyan-400" />
                  )}
                  <span>
                    {modState.isLoading
                      ? 'Moderator Menyiapkan Suara...'
                      : modState.isSpeaking
                      ? 'Moderator Sedang Membacakan...'
                      : 'Bacakan Ulang Soal (Moderator AI)'}
                  </span>
                </button>
              </div>
            </div>
            <p className="text-xl sm:text-2xl md:text-3xl font-display font-bold text-white leading-snug">
              {question.question}
            </p>
          </div>

          {/* Step 1: Select Team Which Is Answering */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-300">
                <Users className="w-4 h-4 text-amber-400" />
                <span>1. Pilih Tim yang Menjawab Soal Ini:</span>
              </label>
              {selectedTeam && (
                <span className="text-xs font-medium text-amber-300">
                  Tim Terpilih: <strong>{selectedTeam.name}</strong> ({selectedTeam.score} Poin)
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {teams.map((team) => {
                const isSelected = team.id === selectedTeamId;
                const disabled = stage !== 'SELECT_TEAM_AND_READY';
                return (
                  <button
                    key={team.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      soundEngine.playClick();
                      setSelectedTeamId(team.id);
                    }}
                    style={{
                      borderColor: isSelected ? team.hex : undefined,
                      boxShadow: isSelected ? `0 0 20px ${team.hex}40` : undefined,
                    }}
                    className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'bg-slate-800/95 text-white ring-2 ring-amber-400/70'
                        : 'bg-slate-900/70 border-slate-800 text-slate-300 hover:border-slate-600'
                    } ${disabled && !isSelected ? 'opacity-45 cursor-not-allowed' : ''}`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="w-3.5 h-3.5 rounded-sm shrink-0"
                        style={{ backgroundColor: team.hex }}
                      />
                      <span className="font-semibold text-sm truncate">{team.name}</span>
                    </div>
                    <span className="font-mono-num text-xs text-slate-400 ml-2 shrink-0">
                      {team.score}p
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Stage: Ready to Start Answering */}
          {stage === 'SELECT_TEAM_AND_READY' && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-slate-800/80">
              <p className="text-sm text-slate-300">
                Pilih tim terlebih dahulu, lalu tekan tombol <strong>MULAI MENJAWAB</strong> untuk mengaktifkan hitung mundur <strong>10 detik</strong> dan papan ketik.
              </p>
              <button
                type="button"
                disabled={!selectedTeamId}
                onClick={handleStartAnswering}
                className={`w-full sm:w-auto flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-xl font-display font-bold text-base tracking-wide transition-all whitespace-nowrap shrink-0 ${
                  selectedTeamId
                    ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-[0_0_30px_rgba(245,158,11,0.45)] cursor-pointer'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                <Play className="w-5 h-5 fill-current" />
                <span>MULAI MENJAWAB (10 DETIK)</span>
              </button>
            </div>
          )}

          {/* Stage: Active Answering with Input & Virtual Keyboard / Numeric Keypad */}
          {stage === 'ANSWERING' && (
            <div className="space-y-4 pt-2 border-t border-slate-800">
              <form onSubmit={handleSubmitAnswer} className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <input
                    ref={inputRef}
                    type="text"
                    value={answerText}
                    onChange={(e) => setAnswerText(e.target.value)}
                    placeholder="Ketik jawaban di sini atau gunakan tombol layar di bawah..."
                    className="w-full px-4 py-3.5 rounded-xl bg-slate-950 border-2 border-cyan-400/70 focus:border-amber-400 text-white font-display font-bold text-lg sm:text-xl outline-none"
                  />
                  {answerText && (
                    <button
                      type="button"
                      onClick={handleClear}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800"
                    >
                      Hapus
                    </button>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={!answerText.trim()}
                  className={`flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl font-display font-bold text-base transition-all whitespace-nowrap shrink-0 ${
                    answerText.trim()
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-[0_0_25px_rgba(16,185,129,0.4)] cursor-pointer'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <Send className="w-5 h-5" />
                  <span>KIRIM JAWABAN</span>
                </button>
              </form>

              {/* On-Screen Interactive Keypad / Keyboard for Projector & Touchboard */}
              <div className="p-4 rounded-xl bg-[#060D1A] border border-slate-800 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-medium text-slate-400">
                    Papan Ketik Interaktif Layar (Mendukung Layar Sentuh / Proyektor):
                  </span>
                  <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-lg border border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        soundEngine.playClick();
                        setKeypadMode('FULL');
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                        keypadMode === 'FULL'
                          ? 'bg-amber-400 text-slate-950'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Keyboard className="w-3.5 h-3.5" />
                      <span>Keyboard Lengkap (A–Z)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        soundEngine.playClick();
                        setKeypadMode('NUMERIC');
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                        keypadMode === 'NUMERIC'
                          ? 'bg-amber-400 text-slate-950'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Hash className="w-3.5 h-3.5" />
                      <span>Numeric Keypad (0–9)</span>
                    </button>
                  </div>
                </div>

                {keypadMode === 'NUMERIC' ? (
                  <div className="grid grid-cols-4 gap-2 max-w-md mx-auto">
                    {NUMERIC_KEYS.map((k) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => appendChar(k)}
                        className="h-12 rounded-lg bg-slate-800/90 hover:bg-slate-700 active:scale-95 border border-slate-700 text-white font-mono-num font-bold text-lg transition-all"
                      >
                        {k}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={handleBackspace}
                      className="h-12 rounded-lg bg-rose-950/70 hover:bg-rose-900 border border-rose-700/60 text-rose-200 flex items-center justify-center font-semibold text-sm"
                    >
                      <Delete className="w-5 h-5" />
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {QWERTY_ROWS.map((row, rIdx) => (
                      <div key={rIdx} className="flex justify-center gap-1.5">
                        {row.map((keyChar) => (
                          <button
                            key={keyChar}
                            type="button"
                            onClick={() => appendChar(keyChar)}
                            className="w-8 sm:w-11 h-10 sm:h-11 rounded-lg bg-slate-800/90 hover:bg-slate-700 active:scale-95 border border-slate-700 text-white font-mono-num font-bold text-sm sm:text-base transition-all"
                          >
                            {keyChar}
                          </button>
                        ))}
                      </div>
                    ))}
                    <div className="flex justify-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => appendChar(' ')}
                        className="px-8 h-10 rounded-lg bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-slate-200 flex items-center gap-2 text-xs font-semibold"
                      >
                        <Space className="w-4 h-4" />
                        <span>SPASI</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleBackspace}
                        className="px-4 h-10 rounded-lg bg-rose-950/70 hover:bg-rose-900 border border-rose-700/60 text-rose-200 flex items-center gap-1.5 text-xs font-semibold"
                      >
                        <Delete className="w-4 h-4" />
                        <span>HAPUS</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Quick Teacher Verification Bar during Answering */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/70 text-xs text-slate-400">
                  <span>Opsi Verifikasi Langsung Khusus Guru (Lisan / Makna Sama):</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleTeacherManualAccept}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-600/60 text-emerald-300 font-semibold transition-colors whitespace-nowrap shrink-0"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>Verifikasi Guru: Benar (+{question.points} Poin)</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Stage: RESULT_CORRECT */}
          {stage === 'RESULT_CORRECT' && (
            <div className="p-6 sm:p-8 rounded-2xl bg-emerald-950/40 border-2 border-emerald-400 text-center space-y-3 shadow-[0_0_50px_rgba(16,185,129,0.25)]">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500 text-slate-950 shadow-lg animate-bounce">
                <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
              </div>
              <h3 className="text-3xl sm:text-4xl font-display font-black tracking-tight text-emerald-300 flex items-center justify-center gap-2">
                <Sparkles className="w-7 h-7 text-amber-300" />
                <span>CORRECT ANSWER!</span>
                <Sparkles className="w-7 h-7 text-amber-300" />
              </h3>
              <p className="text-base sm:text-lg text-slate-200">
                Selamat! <strong>{selectedTeam?.name}</strong> memperoleh tambahan{' '}
                <strong className="text-amber-300 font-mono-num">+{question.points} POIN</strong>!
              </p>
              <div className="text-xs text-emerald-300/80">
                Kotak Soal #{question.id} kini berubah menjadi hijau dan terkunci secara permanen.
              </div>
            </div>
          )}

          {/* Stage: RESULT_WRONG */}
          {stage === 'RESULT_WRONG' && (
            <div className="p-6 rounded-2xl bg-rose-950/40 border-2 border-rose-500 text-center space-y-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-rose-500 text-white shadow-lg">
                <XCircle className="w-10 h-10 stroke-[2.5]" />
              </div>
              <h3 className="text-3xl sm:text-4xl font-display font-black tracking-tight text-rose-400">
                WRONG ANSWER!
              </h3>
              <p className="text-sm sm:text-base text-slate-200">
                Jawaban <strong>&ldquo;{answerText}&rdquo;</strong> belum tepat.{' '}
                <strong>{selectedTeam?.name}</strong> memperoleh <strong>0 poin</strong> dan soal tetap tersedia untuk tim lain.
              </p>

              {showTeacherOverride && (
                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleConfirmWrongOrTimeoutClose}
                    className="px-6 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-display font-bold text-sm transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    Tutup & Kembalikan Soal ke Arena
                  </button>
                  <button
                    type="button"
                    onClick={handleTeacherManualAccept}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-emerald-900/80 border border-emerald-500/50 text-emerald-300 font-semibold text-xs transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>Verifikasi Manual Guru: Terima Jawaban (Makna Sama)</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Stage: RESULT_TIMEOUT */}
          {stage === 'RESULT_TIMEOUT' && (
            <div className="p-6 rounded-2xl bg-amber-950/40 border-2 border-amber-500 text-center space-y-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-500 text-slate-950 shadow-lg animate-pulse">
                <AlarmClock className="w-10 h-10 stroke-[2.5]" />
              </div>
              <h3 className="text-3xl sm:text-4xl font-display font-black tracking-tight text-amber-300">
                TIME&apos;S UP!
              </h3>
              <p className="text-sm sm:text-base text-slate-200">
                Waktu menjawab 10 detik telah habis! <strong>{selectedTeam?.name}</strong> tidak memperoleh poin dan soal tetap tersedia untuk dimainkan kembali.
              </p>

              {showTeacherOverride && (
                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleConfirmWrongOrTimeoutClose}
                    className="px-6 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-bold text-sm transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    Tutup & Lanjutkan Permainan
                  </button>
                  <button
                    type="button"
                    onClick={handleTeacherManualAccept}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-emerald-900/80 border border-emerald-500/50 text-emerald-300 font-semibold text-xs transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>Verifikasi Manual Guru: Sahkan Jawaban</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
