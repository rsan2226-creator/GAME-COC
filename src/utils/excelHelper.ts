import * as XLSX from 'xlsx';
import {
  AnswerHistoryItem,
  GAME_IDENTITY,
  QuestionItem,
  TeamConfig,
} from '../data/defaultQuestions';

// Normalize string for case-insensitive and extra-space-ignoring comparison
export function normalizeAnswerText(val: string): string {
  return val
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

export function isAnswerMatch(submitted: string, question: QuestionItem): boolean {
  const cleanSubmitted = normalizeAnswerText(submitted);
  if (!cleanSubmitted) return false;

  const cleanPrimary = normalizeAnswerText(question.answer);
  if (cleanSubmitted === cleanPrimary) return true;

  // Support comma or slash separated multiple acceptable answers in Kunci jawaban column (e.g. "Atletik / Olahraga Atletik")
  const primaryParts = question.answer
    .split(/[\/|;]/)
    .map((p) => normalizeAnswerText(p))
    .filter(Boolean);

  if (primaryParts.includes(cleanSubmitted)) return true;

  if (question.aliases && question.aliases.length > 0) {
    for (const alias of question.aliases) {
      if (normalizeAnswerText(alias) === cleanSubmitted) {
        return true;
      }
    }
  }

  return false;
}

// Download 40-Question Excel (.xlsx) Template
export function downloadQuestionTemplateExcel(questions: QuestionItem[]) {
  const rows = questions.map((q) => ({
    'Nomor soal': q.id,
    'Pertanyaan': q.question,
    'Kunci jawaban': q.answer,
    'Poin': q.points,
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  // Set column widths for clean readability in Excel
  worksheet['!cols'] = [
    { wch: 14 }, // Nomor soal
    { wch: 78 }, // Pertanyaan
    { wch: 28 }, // Kunci jawaban
    { wch: 12 }, // Poin
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Soal_Class_Of_Champions');

  const safeSubject = `${GAME_IDENTITY.mataPelajaran}_${GAME_IDENTITY.materi}_${GAME_IDENTITY.kelas.replace('/', '-')}`;
  XLSX.writeFile(workbook, `Template_40_Soal_Class_Of_Champions_${safeSubject}.xlsx`);
}

export interface ExcelValidationResult {
  valid: boolean;
  questions?: QuestionItem[];
  message: string;
  details?: string[];
}

// Parse & Validate Uploaded 40-Question Excel (.xlsx) File
export async function parseAndValidateExcelFile(file: File): Promise<ExcelValidationResult> {
  try {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      return {
        valid: false,
        message: 'File Excel tidak memiliki lembar kerja (sheet) yang valid.',
      };
    }

    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, {
      defval: '',
    });

    if (!rawRows || rawRows.length === 0) {
      return {
        valid: false,
        message: 'File Excel kosong. Silakan unduh template soal terlebih dahulu.',
      };
    }

    const parsedQuestions: QuestionItem[] = [];
    const errors: string[] = [];

    rawRows.forEach((row, index) => {
      // Find columns flexibly regardless of minor case differences
      const keys = Object.keys(row);
      const findVal = (candidates: string[]) => {
        const foundKey = keys.find((k) =>
          candidates.some((c) => k.toLowerCase().trim() === c.toLowerCase())
        );
        return foundKey ? row[foundKey] : undefined;
      };

      const rawNo = findVal(['Nomor soal', 'Nomor', 'No', 'No Soal']);
      const rawQuestion = findVal(['Pertanyaan', 'Soal', 'Question']);
      const rawAnswer = findVal(['Kunci jawaban', 'Kunci', 'Jawaban', 'Answer']);
      const rawPoints = findVal(['Poin', 'Bobot', 'Skor', 'Points']);

      const rowNum = index + 1;
      const id = Number(rawNo) || rowNum;
      const question = String(rawQuestion ?? '').trim();
      const answer = String(rawAnswer ?? '').trim();
      const pointsNum = Number(rawPoints);
      const points = !isNaN(pointsNum) && pointsNum > 0 ? pointsNum : 100;

      if (!question) {
        errors.push(`Baris ke-${rowNum} (Soal #${id}): Kolom "Pertanyaan" masih kosong.`);
      }
      if (!answer) {
        errors.push(`Baris ke-${rowNum} (Soal #${id}): Kolom "Kunci jawaban" masih kosong.`);
      }

      parsedQuestions.push({
        id,
        question,
        answer,
        points,
      });
    });

    if (errors.length > 0) {
      return {
        valid: false,
        message: `Terdapat ${errors.length} data soal yang belum lengkap di dalam file Excel.`,
        details: errors.slice(0, 5),
      };
    }

    if (parsedQuestions.length !== 40) {
      return {
        valid: false,
        message: `Jumlah soal harus tepat 40 nomor soal (ditemukan ${parsedQuestions.length} soal pada file Excel).`,
      };
    }

    // Sort by id 1..40 and normalize IDs
    const sorted = parsedQuestions
      .sort((a, b) => a.id - b.id)
      .map((item, idx) => ({
        ...item,
        id: idx + 1,
      }));

    return {
      valid: true,
      questions: sorted,
      message: `Berhasil memuat dan memvalidasi 40 soal beserta kunci jawaban dan bobot poin (${file.name}).`,
    };
  } catch (err) {
    return {
      valid: false,
      message: `Gagal membaca file Excel: ${err instanceof Error ? err.message : 'Format file tidak didukung'}.`,
    };
  }
}

// Download Final Ranking & Answer History Recap Excel (.xlsx)
export function downloadFinalRankingExcel(
  teams: TeamConfig[],
  history: AnswerHistoryItem[]
) {
  const sortedTeams = [...teams].sort((a, b) => b.score - a.score);

  // Compute rank with tie support
  const rankingRows = sortedTeams.map((team, idx) => {
    const sameScoreCount = sortedTeams.filter((t) => t.score === team.score).length;
    const higherCount = sortedTeams.filter((t) => t.score > team.score).length;
    const rankNumber = higherCount + 1;

    return {
      'Peringkat': sameScoreCount > 1 ? `Juara ${rankNumber} (SERI)` : `Juara ${rankNumber}`,
      'Nama Tim': team.name,
      'Warna Identitas': team.colorName,
      'Total Skor': team.score,
      'Soal Dijawab Benar': team.correctCount,
      'Total Percobaan Menjawab': team.attemptsCount,
      'Mata Pelajaran': GAME_IDENTITY.mataPelajaran,
      'Materi': GAME_IDENTITY.materi,
      'Kelas': GAME_IDENTITY.kelas,
    };
  });

  const historyRows = history.map((h, i) => ({
    'No': i + 1,
    'Waktu': h.timestamp,
    'Nomor Soal': `Soal #${h.questionNumber}`,
    'Pertanyaan': h.questionText,
    'Tim yang Menjawab': h.teamName,
    'Jawaban Tim': h.submittedAnswer || '-',
    'Status Hasil': h.status,
    'Waktu Menjawab (Detik)': `${h.timeTakenSeconds} dtk`,
    'Poin Diperoleh': h.pointsEarned,
    'Keterangan': h.verifiedManually ? 'Verifikasi Manual Guru' : 'Verifikasi Otomatis',
  }));

  const workbook = XLSX.utils.book_new();

  const rankSheet = XLSX.utils.json_to_sheet(rankingRows);
  rankSheet['!cols'] = [
    { wch: 18 },
    { wch: 26 },
    { wch: 18 },
    { wch: 14 },
    { wch: 20 },
    { wch: 24 },
    { wch: 16 },
    { wch: 16 },
    { wch: 12 },
  ];
  XLSX.utils.book_append_sheet(workbook, rankSheet, 'Final_Ranking');

  const historySheet = XLSX.utils.json_to_sheet(
    historyRows.length > 0
      ? historyRows
      : [
          {
            'No': '-',
            'Waktu': '-',
            'Nomor Soal': '-',
            'Pertanyaan': 'Belum ada riwayat jawaban',
            'Tim yang Menjawab': '-',
            'Jawaban Tim': '-',
            'Status Hasil': '-',
            'Waktu Menjawab (Detik)': '-',
            'Poin Diperoleh': 0,
            'Keterangan': '-',
          },
        ]
  );
  historySheet['!cols'] = [
    { wch: 8 },
    { wch: 14 },
    { wch: 14 },
    { wch: 64 },
    { wch: 22 },
    { wch: 24 },
    { wch: 16 },
    { wch: 22 },
    { wch: 16 },
    { wch: 22 },
  ];
  XLSX.utils.book_append_sheet(workbook, historySheet, 'Riwayat_Jawaban');

  const safeSubject = `${GAME_IDENTITY.mataPelajaran}_${GAME_IDENTITY.materi}_${GAME_IDENTITY.kelas.replace('/', '-')}`;
  XLSX.writeFile(workbook, `Hasil_Akhir_Class_Of_Champions_${safeSubject}.xlsx`);
}
