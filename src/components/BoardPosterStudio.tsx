import React, { useState, useMemo, useEffect } from 'react';
import {
  Printer,
  Download,
  LayoutGrid,
  Check,
  Sparkles,
  FileText,
  RotateCcw,
  Volume2,
  Mic,
} from 'lucide-react';
import {
  BOARD_QUIZ_PRESETS,
  GAME_IDENTITY,
  QuestionItem,
} from '../data/defaultQuestions';
import {
  soundEngine,
  INDOOR_ROOM_PRESETS,
  IndoorRoomPreset,
  SoundEngineSnapshot,
} from '../utils/soundEngine';
import { moderatorEngine } from '../utils/moderatorEngine';

interface BoardPosterStudioProps {
  activeQuestions: QuestionItem[];
}

// Compute balanced columns & rows automatically based on question count N
export function computeOptimalGrid(count: number): { cols: number; rows: number } {
  if (count <= 0) return { cols: 1, rows: 1 };
  if (count === 1) return { cols: 1, rows: 1 };
  if (count === 2) return { cols: 1, rows: 2 };
  if (count === 3) return { cols: 1, rows: 3 };
  if (count === 4) return { cols: 2, rows: 2 };
  if (count <= 6) return { cols: 2, rows: Math.ceil(count / 2) };
  if (count <= 8) return { cols: 2, rows: Math.ceil(count / 2) };
  if (count === 9) return { cols: 3, rows: 3 };
  if (count === 10) return { cols: 2, rows: 5 }; // Explicit rule from prompt example: 10 soal -> 2 kolom x 5 baris
  if (count <= 12) return { cols: 3, rows: Math.ceil(count / 3) };
  if (count <= 16) return { cols: 4, rows: Math.ceil(count / 4) };
  if (count <= 20) return { cols: 4, rows: Math.ceil(count / 4) };
  if (count <= 25) return { cols: 5, rows: Math.ceil(count / 5) };
  if (count <= 30) return { cols: 5, rows: Math.ceil(count / 5) };
  return { cols: 5, rows: Math.ceil(count / 5) };
}

// Render text with Turquoise/Cyan highlights for numbers, math operators, superscripts, and variables
function renderHighlightedQuestionText(text: string) {
  // Replace ^2, ^3, ^4 with proper superscripts while preserving exact content
  const formatted = text
    .replace(/\^2/g, '²')
    .replace(/\^3/g, '³')
    .replace(/\^4/g, '⁴');

  // Split by tokens that are numbers, math symbols (+, -, ×, ÷, =, →, ², ³, ⁴), or ALL-CAPS short variables/terms
  const parts = formatted.split(/(\d+(?:[.,]\d+)?|[+\-×÷=→²³⁴]+|\b[A-Z]{2,5}\b|\.\.\.)/g);

  return parts.map((part, idx) => {
    if (!part) return null;
    const isHighlight =
      /^\d+(?:[.,]\d+)?$/.test(part) ||
      /^[+\-×÷=→²³⁴]+$/.test(part) ||
      /^\b[A-Z]{2,5}\b$/.test(part) ||
      part === '...';

    if (isHighlight) {
      return (
        <span key={idx} className="text-[#00F0FF] font-extrabold">
          {part}
        </span>
      );
    }
    return <span key={idx}>{part}</span>;
  });
}

export const BoardPosterStudio: React.FC<BoardPosterStudioProps> = ({
  activeQuestions,
}) => {
  const [selectedPresetId, setSelectedPresetId] = useState<string>(BOARD_QUIZ_PRESETS[3].id);
  const [judulBoard, setJudulBoard] = useState<string>('BOARD 1');
  const [poinLabel, setPoinLabel] = useState<string>('10 POINTS');
  const [rawSoalText, setRawSoalText] = useState<string>(() =>
    BOARD_QUIZ_PRESETS[0].questions
      .map((q, idx) => `${idx + 1}. ${q.replace(/\n/g, ' ')}`)
      .join('\n')
  );
  const [isExportingPng, setIsExportingPng] = useState<boolean>(false);
  const [soundSnap, setSoundSnap] = useState<SoundEngineSnapshot>(() =>
    soundEngine.getSnapshot()
  );

  useEffect(() => {
    return soundEngine.subscribe(setSoundSnap);
  }, []);

  // Parse questions line by line
  const parsedQuestions = useMemo(() => {
    const lines = rawSoalText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    return lines.map((line) => {
      // Strip leading numbering like "1. " or "1) " so we don't duplicate or alter the core question content
      return line.replace(/^\d+[\.\)]\s*/, '');
    });
  }, [rawSoalText]);

  const questionCount = parsedQuestions.length;
  const { cols, rows } = useMemo(
    () => computeOptimalGrid(questionCount),
    [questionCount]
  );

  // Determine dynamic font size class based on question count & text length
  const maxCharLength = useMemo(() => {
    return parsedQuestions.reduce((max, q) => Math.max(max, q.length), 0);
  }, [parsedQuestions]);

  const getBoxFontSizeClass = (qText: string) => {
    if (questionCount <= 6 && qText.length < 45) return 'text-xl sm:text-2xl';
    if (questionCount <= 10 && qText.length < 55) return 'text-base sm:text-lg';
    if (questionCount <= 12 && qText.length < 95) return 'text-sm sm:text-base';
    if (maxCharLength > 120 || questionCount > 20) return 'text-xs sm:text-sm';
    return 'text-xs sm:text-[15px]';
  };

  const applyPreset = (preset: (typeof BOARD_QUIZ_PRESETS)[number]) => {
    soundEngine.playMenuSwitch();
    setSelectedPresetId(preset.id);
    setJudulBoard(preset.judulBoard);
    setPoinLabel(preset.poinLabel);
    setRawSoalText(
      preset.questions
        .map((q, i) => `${i + 1}. ${q.replace(/\n/g, ' | ')}`)
        .join('\n')
    );
  };

  const applyFromActiveExcelRange = (startIdx: number, endIdx: number, boardNum: number, pts: number) => {
    soundEngine.playMenuSwitch();
    const slice = activeQuestions.slice(startIdx, endIdx);
    setSelectedPresetId(`excel-board-${boardNum}`);
    setJudulBoard(`BOARD ${boardNum}`);
    setPoinLabel(`${pts} POINTS`);
    setRawSoalText(
      slice.map((q, i) => `${i + 1}. ${q.question}`).join('\n')
    );
  };

  // High-Resolution A4 Canvas PNG Generator (21.0 x 29.7 cm ratio = 1240 x 1754 px)
  const handleDownloadPosterPng = () => {
    soundEngine.playCorrectAnswer(50);
    setIsExportingPng(true);

    setTimeout(() => {
      try {
        const canvas = document.createElement('canvas');
        const width = 1240;
        const height = 1754;
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // 1. Pitch Black High-Contrast Minimalist Background
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, width, height);

        // Subtle outer frame border
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
        ctx.lineWidth = 2;
        ctx.strokeRect(36, 36, width - 72, height - 72);

        // 2. Top Poster Title: "{JUDUL_BOARD} ({POIN})"
        const titleY = 115;
        ctx.font = '900 46px Outfit, sans-serif';
        ctx.textBaseline = 'middle';

        const cleanBoard = judulBoard.toUpperCase().trim();
        const cleanPoin = `(${poinLabel.toUpperCase().trim()})`;
        const spaceWidth = 16;

        const boardWidth = ctx.measureText(cleanBoard).width;
        const poinWidth = ctx.measureText(cleanPoin).width;
        const totalTitleWidth = boardWidth + spaceWidth + poinWidth;
        const startX = (width - totalTitleWidth) / 2;

        // White for JUDUL_BOARD
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(cleanBoard, startX, titleY);

        // Turquoise/Cyan for (POIN)
        ctx.fillStyle = '#00F0FF';
        ctx.fillText(cleanPoin, startX + boardWidth + spaceWidth, titleY);

        // Subtitle Identity Line (PJOK · ATLETIK · KELAS 4/B)
        ctx.font = '600 18px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        const subText = `${GAME_IDENTITY.title}  ·  ${GAME_IDENTITY.mataPelajaran}  ·  MATERI ${GAME_IDENTITY.materi}  ·  KELAS ${GAME_IDENTITY.kelas}`;
        const subWidth = ctx.measureText(subText).width;
        ctx.fillText(subText, (width - subWidth) / 2, titleY + 46);

        // 3. Grid Geometry
        const padX = 68;
        const gridTop = 205;
        const gridBottom = height - 85;
        const availWidth = width - padX * 2;
        const availHeight = gridBottom - gridTop;
        const gap = 22;

        const boxWidth = (availWidth - gap * (cols - 1)) / cols;
        const boxHeight = (availHeight - gap * (rows - 1)) / rows;

        parsedQuestions.forEach((qText, index) => {
          const r = Math.floor(index / cols);
          const c = index % cols;

          // Center last row if it has fewer items than cols
          const itemsInThisRow =
            r === rows - 1 && questionCount % cols !== 0
              ? questionCount % cols
              : cols;
          const rowTotalWidth = itemsInThisRow * boxWidth + (itemsInThisRow - 1) * gap;
          const rowStartX = padX + (availWidth - rowTotalWidth) / 2;

          const x = rowStartX + c * (boxWidth + gap);
          const y = gridTop + r * (boxHeight + gap);

          // Box Black Fill & Thin White Border
          ctx.fillStyle = '#050505';
          ctx.fillRect(x, y, boxWidth, boxHeight);

          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 2.2;
          ctx.strokeRect(x, y, boxWidth, boxHeight);

          // Question Number Badge in Top-Left of Box
          ctx.fillStyle = '#00F0FF';
          ctx.font = '800 20px "JetBrains Mono", monospace';
          ctx.fillText(`#${index + 1}`, x + 20, y + 30);

          // Wrap & Render Question Text inside Box
          const fontSize =
            questionCount <= 10 && qText.length < 65
              ? 26
              : qText.length < 110
              ? 22
              : 18;
          ctx.font = `700 ${fontSize}px "Plus Jakarta Sans", sans-serif`;

          const words = qText.replace(/\s*\|\s*/g, '\n').split(' ');
          const lines: string[] = [];
          let currentLine = '';
          const maxTextW = boxWidth - 44;

          words.forEach((word) => {
            if (word.includes('\n')) {
              const subParts = word.split('\n');
              subParts.forEach((sp, sIdx) => {
                const test = currentLine ? `${currentLine} ${sp}` : sp;
                if (ctx.measureText(test).width > maxTextW && currentLine) {
                  lines.push(currentLine);
                  currentLine = sp;
                } else {
                  currentLine = test;
                }
                if (sIdx < subParts.length - 1) {
                  lines.push(currentLine);
                  currentLine = '';
                }
              });
            } else {
              const testLine = currentLine ? `${currentLine} ${word}` : word;
              if (ctx.measureText(testLine).width > maxTextW && currentLine) {
                lines.push(currentLine);
                currentLine = word;
              } else {
                currentLine = testLine;
              }
            }
          });
          if (currentLine) lines.push(currentLine);

          const lineHeight = fontSize * 1.38;
          const totalTextH = lines.length * lineHeight;
          let textY = y + 30 + (boxHeight - 30 - totalTextH) / 2 + fontSize / 2;

          lines.forEach((lineStr) => {
            const lineW = ctx.measureText(lineStr).width;
            const lineX = x + (boxWidth - lineW) / 2;
            // Highlight numbers/operators in cyan if line is short math expression
            if (/[+\-×÷=]/.test(lineStr) || /^\d/.test(lineStr)) {
              ctx.fillStyle = '#00F0FF';
            } else {
              ctx.fillStyle = '#FFFFFF';
            }
            ctx.fillText(lineStr, lineX, textY);
            textY += lineHeight;
          });
        });

        // Footer credit
        ctx.font = '600 15px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
        const credit = `${GAME_IDENTITY.footerCredit}  ·  BOARD QUIZ INTERAKTIF A4 (${questionCount} KOTAK: ${cols} KOLOM × ${rows} BARIS)`;
        const creditW = ctx.measureText(credit).width;
        ctx.fillText(credit, (width - creditW) / 2, height - 52);

        const dataUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `Poster_${judulBoard.replace(/\s+/g, '_')}_${GAME_IDENTITY.mataPelajaran}_${GAME_IDENTITY.materi}.png`;
        link.href = dataUrl;
        link.click();
      } finally {
        setIsExportingPng(false);
      }
    }, 100);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Studio Header Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-6 rounded-2xl bg-[#0A162C] border border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-cyan-400 uppercase tracking-wider">
            <Sparkles className="w-4 h-4" />
            <span>GENERATOR POSTER SOAL EDUKATIF A4 (21,0 × 29,7 CM)</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-display font-black text-white">
            BOARD QUIZ INTERAKTIF — {GAME_IDENTITY.mataPelajaran} ({GAME_IDENTITY.materi} · KELAS {GAME_IDENTITY.kelas})
          </h2>
          <p className="text-sm text-slate-300">
            Jumlah kolom dan baris menyesuaikan secara otomatis dengan jumlah soal (<strong className="text-cyan-300 font-mono-num">{questionCount} Soal → {cols} Kolom × {rows} Baris</strong>).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 border border-amber-400/40">
            <Volume2 className="w-4 h-4 text-amber-400 shrink-0" />
            <select
              value={soundSnap.roomPreset}
              onChange={(e) =>
                soundEngine.setRoomPreset(e.target.value as IndoorRoomPreset, true)
              }
              aria-label="Efek Suara Dalam Ruangan di Studio Poster"
              className="bg-transparent text-xs font-semibold text-amber-300 outline-none cursor-pointer"
            >
              {INDOOR_ROOM_PRESETS.map((p) => (
                <option key={p.id} value={p.id} className="bg-slate-900 text-white">
                  Akustik: {p.shortLabel}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              const previewList = parsedQuestions.slice(0, 3).join('. ');
              moderatorEngine.speak(
                `Menampilkan poster Board Quiz Interaktif ${judulBoard} dengan bobot ${poinLabel}, terdiri dari ${questionCount} kotak soal dalam komposisi ${cols} kolom dikali ${rows} baris. Contoh soal pada board ini: ${previewList}`
              );
            }}
            className="flex items-center gap-2 px-4 py-3 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/50 text-cyan-200 font-display font-bold text-xs sm:text-sm transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Mic className="w-4 h-4 text-cyan-300" />
            <span>Bacakan Board (AI)</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadPosterPng}
            disabled={isExportingPng || questionCount === 0}
            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-display font-bold text-sm transition-all shadow-[0_0_25px_rgba(34,211,238,0.35)] cursor-pointer whitespace-nowrap shrink-0"
          >
            <Download className="w-4 h-4" />
            <span>{isExportingPng ? 'Membuat Gambar...' : 'UNDUH GAMBAR POSTER (.PNG)'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              soundEngine.playMenuSwitch();
              window.print();
            }}
            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-display font-bold text-sm transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Printer className="w-4 h-4 text-amber-400" />
            <span>CETAK A4 / PDF</span>
          </button>
        </div>
      </div>

      {/* Main 2-Column Split: Controls Left, Live High-Contrast A4 Poster Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Preset & Data Input Configuration */}
        <div className="lg:col-span-5 space-y-6 bg-[#0A162C] p-6 rounded-2xl border border-slate-800">
          <div className="space-y-3">
            <h3 className="text-base font-display font-bold text-white flex items-center gap-2">
              <LayoutGrid className="w-4 h-4 text-cyan-400" />
              <span>Pilih Paket Soal Board Quiz (PJOK Atletik Kelas 4 / Fase B)</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {BOARD_QUIZ_PRESETS.map((preset) => {
                const active = selectedPresetId === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applyPreset(preset)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      active
                        ? 'bg-cyan-950/60 border-cyan-400 text-white'
                        : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-display font-bold text-sm text-white">
                        {preset.judulBoard}{' '}
                        <span className="text-cyan-400">({preset.poinLabel})</span>
                      </span>
                      {active && <Check className="w-4 h-4 text-cyan-400" />}
                    </div>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-1">
                      {preset.description}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Load directly from active 40-question bank */}
            <div className="pt-2">
              <div className="text-xs font-medium text-slate-400 mb-2">
                Atau Muat Langsung dari 40 Soal Aktif:
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => applyFromActiveExcelRange(0, 10, 1, 10)}
                  className="px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-300 transition-colors cursor-pointer"
                >
                  Soal #1–#10 (10 Pts)
                </button>
                <button
                  type="button"
                  onClick={() => applyFromActiveExcelRange(10, 20, 2, 25)}
                  className="px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-300 transition-colors cursor-pointer"
                >
                  Soal #11–#20 (25 Pts)
                </button>
                <button
                  type="button"
                  onClick={() => applyFromActiveExcelRange(20, 30, 3, 50)}
                  className="px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-300 transition-colors cursor-pointer"
                >
                  Soal #21–#30 (50 Pts)
                </button>
                <button
                  type="button"
                  onClick={() => applyFromActiveExcelRange(30, 40, 4, 100)}
                  className="px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-300 transition-colors cursor-pointer"
                >
                  Soal #31–#40 (100 Pts)
                </button>
              </div>
            </div>
          </div>

          {/* DATA INPUT Fields for Poster */}
          <div className="space-y-4 pt-4 border-t border-slate-800">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  JUDUL_BOARD
                </label>
                <input
                  type="text"
                  value={judulBoard}
                  onChange={(e) => setJudulBoard(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-cyan-400 text-white font-display font-bold text-sm outline-none uppercase"
                  placeholder="BOARD 1"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  POIN
                </label>
                <input
                  type="text"
                  value={poinLabel}
                  onChange={(e) => setPoinLabel(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-cyan-400 text-cyan-300 font-display font-bold text-sm outline-none uppercase"
                  placeholder="10 POINTS"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-cyan-400" />
                  <span>DAFTAR SOAL (1 Baris = 1 Kotak Soal):</span>
                </label>
                <button
                  type="button"
                  onClick={() => applyPreset(BOARD_QUIZ_PRESETS[3])}
                  className="text-xs text-cyan-400 hover:underline flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset Contoh</span>
                </button>
              </div>
              <textarea
                rows={10}
                value={rawSoalText}
                onChange={(e) => setRawSoalText(e.target.value)}
                placeholder="Masukkan daftar soal (1 baris per soal)..."
                className="w-full p-3.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-cyan-400 text-slate-100 font-mono text-xs leading-relaxed outline-none"
              />
            </div>

            {/* Automatic Grid Telemetry Summary */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-400">Komposisi Grid Otomatis:</span>
              <span className="font-mono-num font-bold text-cyan-300">
                {questionCount} Soal = {questionCount} Kotak ({cols} Kolom × {rows} Baris)
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Live Vertical A4 Poster Preview (21.0 x 29.7 cm Aspect Ratio) */}
        <div className="lg:col-span-7 flex flex-col items-center">
          <div
            id="printable-board-poster"
            className="w-full max-w-[680px] aspect-[210/297] bg-black border-2 border-white/25 rounded-none shadow-[0_0_70px_rgba(0,0,0,0.95)] p-6 sm:p-10 flex flex-col justify-between select-none"
          >
            {/* Top Poster Header: "{JUDUL_BOARD} ({POIN})" */}
            <div className="text-center space-y-1.5 pb-4 sm:pb-6">
              <h1 className="text-2xl sm:text-4xl font-display font-black tracking-wider uppercase leading-none">
                <span className="text-white">{judulBoard.toUpperCase()}</span>{' '}
                <span className="text-[#00F0FF]">({poinLabel.toUpperCase()})</span>
              </h1>
              <div className="text-[11px] sm:text-xs font-medium tracking-widest text-white/60 uppercase">
                {GAME_IDENTITY.title} · {GAME_IDENTITY.mataPelajaran} · {GAME_IDENTITY.materi} · KELAS {GAME_IDENTITY.kelas}
              </div>
            </div>

            {/* Dynamic Proportional Grid where JUMLAH KOTAK = JUMLAH SOAL */}
            <div
              className="flex-1 grid gap-3 sm:gap-4 content-stretch"
              style={{
                gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
              }}
            >
              {parsedQuestions.map((soal, idx) => {
                const lines = soal.split(/\s*\|\s*/);
                return (
                  <div
                    key={idx}
                    className="relative bg-black border border-white px-3.5 py-3 flex flex-col justify-center items-center text-center overflow-hidden"
                  >
                    {/* Subtle Corner Box Index */}
                    <span className="absolute top-1.5 left-2 font-mono-num font-bold text-[11px] text-[#00F0FF]/90">
                      {idx + 1}
                    </span>

                    <div
                      className={`font-display font-bold text-white leading-snug break-words w-full pt-2 ${getBoxFontSizeClass(
                        soal
                      )}`}
                    >
                      {lines.map((linePart, lIdx) => (
                        <div key={lIdx} className="my-0.5">
                          {renderHighlightedQuestionText(linePart)}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Minimalist Bottom Poster Footer */}
            <div className="pt-4 text-center flex items-center justify-between text-[10px] font-mono-num text-white/45 uppercase tracking-wider">
              <span>BOARD QUIZ INTERAKTIF A4</span>
              <span>{GAME_IDENTITY.footerCredit}</span>
              <span>
                {questionCount} SOAL ({cols}×{rows})
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
