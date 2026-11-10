export interface QuestionItem {
  id: number; // 1 to 40
  question: string;
  answer: string;
  points: number; // 10, 25, 50, 100
  aliases?: string[]; // Optional acceptable alternative spellings
}

export interface TeamConfig {
  id: string;
  name: string;
  colorName: string;
  hex: string;
  bgClass: string;
  borderClass: string;
  textClass: string;
  score: number;
  correctCount: number;
  attemptsCount: number;
}

export interface AnswerHistoryItem {
  id: string;
  timestamp: string;
  questionNumber: number;
  questionText: string;
  teamId: string;
  teamName: string;
  teamColorHex: string;
  submittedAnswer: string;
  isCorrect: boolean;
  status: 'BENAR' | 'SALAH' | 'WAKTU HABIS';
  timeTakenSeconds: number;
  pointsEarned: number;
  verifiedManually?: boolean;
}

// FIXED CONFIGURATION FROM DATA INPUT PROMPT
export const GAME_IDENTITY = {
  title: 'CLASS OF CHAMPIONS',
  mataPelajaran: 'PJOK',
  materi: 'ATLETIK',
  kelas: '4 / Fase B',
  footerCredit: 'Game Design by prooflendi',
} as const;

export const TEAM_PALETTE: Omit<TeamConfig, 'id' | 'name' | 'score' | 'correctCount' | 'attemptsCount'>[] = [
  {
    colorName: 'Biru Samudra',
    hex: '#0EA5E9',
    bgClass: 'bg-sky-500/15',
    borderClass: 'border-sky-400',
    textClass: 'text-sky-300',
  },
  {
    colorName: 'Emas Juara',
    hex: '#F59E0B',
    bgClass: 'bg-amber-500/15',
    borderClass: 'border-amber-400',
    textClass: 'text-amber-300',
  },
  {
    colorName: 'Zamrud Tangguh',
    hex: '#10B981',
    bgClass: 'bg-emerald-500/15',
    borderClass: 'border-emerald-400',
    textClass: 'text-emerald-300',
  },
  {
    colorName: 'Merah Garuda',
    hex: '#F43F5E',
    bgClass: 'bg-rose-500/15',
    borderClass: 'border-rose-400',
    textClass: 'text-rose-300',
  },
  {
    colorName: 'Ungu Ksatria',
    hex: '#A855F7',
    bgClass: 'bg-purple-500/15',
    borderClass: 'border-purple-400',
    textClass: 'text-purple-300',
  },
  {
    colorName: 'Sian Kilat',
    hex: '#06B6D4',
    bgClass: 'bg-cyan-500/15',
    borderClass: 'border-cyan-400',
    textClass: 'text-cyan-300',
  },
  {
    colorName: 'Jingga Surya',
    hex: '#F97316',
    bgClass: 'bg-orange-500/15',
    borderClass: 'border-orange-400',
    textClass: 'text-orange-300',
  },
  {
    colorName: ' Merah Muda Bintang',
    hex: '#EC4899',
    bgClass: 'bg-pink-500/15',
    borderClass: 'border-pink-400',
    textClass: 'text-pink-300',
  },
];

// 40 Curated Questions for PJOK - Materi ATLETIK - Kelas 4/B
// Weights: 10 (Soal 1-10: Dasar), 25 (Soal 11-20: Menengah), 50 (Soal 21-30: Lanjutan), 100 (Soal 31-40: HOTS & Hitungan Atletik)
export const DEFAULT_PJOK_ATLETIK_QUESTIONS: QuestionItem[] = [
  // === BOBOT 10 POIN (SOAL 1 - 10: KONSEP DASAR ATLETIK KELAS 4) ===
  {
    id: 1,
    question: 'Induk cabang olahraga yang mencakup gerakan jalan, lari, lompat, dan lempar disebut olahraga ...',
    answer: 'Atletik',
    points: 10,
  },
  {
    id: 2,
    question: 'Gerakan melangkahkan kaki ke depan secara bergantian di mana salah satu kaki harus selalu menyentuh tanah disebut ...',
    answer: 'Jalan',
    aliases: ['Berjalan', 'Jalan cepat'],
    points: 10,
  },
  {
    id: 3,
    question: 'Lari cepat jarak pendek dalam cabang olahraga atletik sering disebut juga dengan istilah ...',
    answer: 'Sprint',
    aliases: ['Lari sprint', 'Lari cepat'],
    points: 10,
  },
  {
    id: 4,
    question: 'Sebelum melakukan latihan atletik lari dan lompat, kita wajib melakukan gerakan ... agar otot tidak cedera.',
    answer: 'Pemanasan',
    aliases: ['Warming up', 'Peregangan'],
    points: 10,
  },
  {
    id: 5,
    question: 'Pada olahraga lompat jauh, tempat pendaratan yang aman bagi pelompat berisi material ...',
    answer: 'Pasir',
    aliases: ['Bak pasir'],
    points: 10,
  },
  {
    id: 6,
    question: 'Alat berbentuk pipa pendek yang diberikan secara beranting dari pelari satu ke pelari berikutnya pada lari sambung disebut ...',
    answer: 'Tongkat',
    aliases: ['Tongkat estafet'],
    points: 10,
  },
  {
    id: 7,
    question: 'Saat melakukan lari cepat, pandangan mata pelari harus tertuju lurus ke arah ...',
    answer: 'Depan',
    aliases: ['Garis finis', 'Ke depan'],
    points: 10,
  },
  {
    id: 8,
    question: 'Olahraga lempar menggunakan alat menyerupai roket kecil bersayap yang aman untuk siswa SD Kelas 4 disebut lempar ...',
    answer: 'Turbo',
    aliases: ['Roket', 'Lempar turbo', 'Lempar roket'],
    points: 10,
  },
  {
    id: 9,
    question: 'Setelah selesai melakukan kegiatan olahraga atletik di lapangan, kita melakukan gerakan ... untuk menormalkan suhu tubuh.',
    answer: 'Pendinginan',
    aliases: ['Cooling down'],
    points: 10,
  },
  {
    id: 10,
    question: 'Jumlah aba-aba pada start jongkok ("Bersedia", "Siap", "Ya/Bunyi Pistol") terdiri atas ... tahapan aba-aba.',
    answer: '3',
    aliases: ['Tiga'],
    points: 10,
  },

  // === BOBOT 25 POIN (SOAL 11 - 20: TEKNIK GERAK DASAR ATLETIK) ===
  {
    id: 11,
    question: 'Jenis start yang wajib digunakan oleh pelari jarak pendek (sprint) adalah start ...',
    answer: 'Jongkok',
    aliases: ['Start jongkok', 'Crouching start'],
    points: 25,
  },
  {
    id: 12,
    question: 'Jenis start yang digunakan pada perlombaan lari jarak jauh atau marathon adalah start ...',
    answer: 'Berdiri',
    aliases: ['Start berdiri', 'Standing start'],
    points: 25,
  },
  {
    id: 13,
    question: 'Lari sambung beregu yang mengandalkan kerja sama pemberian tongkat antar pelari disebut lari ...',
    answer: 'Estafet',
    aliases: ['Lari estafet', 'Lari sambung'],
    points: 25,
  },
  {
    id: 14,
    question: 'Jumlah pelari dalam satu regu perlombaan lari estafet (4 × 100 meter) adalah ... orang.',
    answer: '4',
    aliases: ['Empat'],
    points: 25,
  },
  {
    id: 15,
    question: 'Saat melakukan pendaratan pada bak pasir lompat jauh, posisi kedua lutut harus ... untuk meredam benturan.',
    answer: 'Ditekuk',
    aliases: ['Mengeper', 'Dibengkokkan'],
    points: 25,
  },
  {
    id: 16,
    question: 'Pada lompat jauh, tumpuan saat menolak pada papan tolakan dilakukan dengan menggunakan ... kaki terkuat.',
    answer: '1',
    aliases: ['Satu', 'Satu kaki'],
    points: 25,
  },
  {
    id: 17,
    question: 'Induk organisasi olahraga atletik di seluruh Indonesia adalah ... (tuliskan singkatannya).',
    answer: 'PASI',
    aliases: ['Persatuan Atletik Seluruh Indonesia'],
    points: 25,
  },
  {
    id: 18,
    question: 'Posisi telapak kaki yang benar saat mendarat ketika melakukan gerakan lari cepat (sprint) adalah menggunakan ujung kaki bagian ...',
    answer: 'Depan',
    aliases: ['Ujung kaki', 'Bola kaki'],
    points: 25,
  },
  {
    id: 19,
    question: 'Aba-aba kedua setelah "Bersedia" pada pelaksanaan start jongkok adalah ...',
    answer: 'Siap',
    points: 25,
  },
  {
    id: 20,
    question: 'Gerakan kombinasi lari pelan-pelan untuk menjaga kebugaran jantung dan paru-paru disebut ...',
    answer: 'Jogging',
    aliases: ['Lari santai', 'Joging'],
    points: 25,
  },

  // === BOBOT 50 POIN (SOAL 21 - 30: ANALISIS TEKNIK & ATURAN ATLETIK) ===
  {
    id: 21,
    question: 'Empat tahapan berurutan dalam lompat jauh adalah: Awalan, Tolakan, Melayang di udara, dan ...',
    answer: 'Mendarat',
    aliases: ['Pendaratan'],
    points: 50,
  },
  {
    id: 22,
    question: 'Dalam permainan Kids Athletics untuk kelas 4 SD, lompat secara beruntun melewati kardus atau gawang rendah melatih kekuatan otot ...',
    answer: 'Kaki',
    aliases: ['Tungkai', 'Otot tungkai', 'Otot kaki'],
    points: 50,
  },
  {
    id: 23,
    question: 'Saat aba-aba "Siap" pada start jongkok, posisi pinggul diangkat sehingga sedikit lebih tinggi daripada ...',
    answer: 'Bahu',
    aliases: ['Kepala', 'Pundak'],
    points: 50,
  },
  {
    id: 24,
    question: 'Perbedaan utama antara jalan dan lari adalah pada gerakan lari terdapat saat di mana kedua kaki ... di udara.',
    answer: 'Melayang',
    aliases: ['Tidak menyentuh tanah', 'Terangkat'],
    points: 50,
  },
  {
    id: 25,
    question: 'Pada lari estafet, pelari pertama menggunakan start jongkok, sedangkan pelari kedua, ketiga, dan keempat menggunakan start ...',
    answer: 'Melayang',
    aliases: ['Start melayang', 'Flying start'],
    points: 50,
  },
  {
    id: 26,
    question: 'Cabang olahraga atletik nomor tolak yang menggunakan bola besi berat yang didorong dari bahu disebut tolak ...',
    answer: 'Peluru',
    aliases: ['Tolak peluru'],
    points: 50,
  },
  {
    id: 27,
    question: 'Cabang atletik nomor lempar yang menggunakan alat berbentuk piringan bundar pipih disebut lempar ...',
    answer: 'Cakram',
    aliases: ['Lempar cakram'],
    points: 50,
  },
  {
    id: 28,
    question: 'Saat melewati garis finis pada lari jarak pendek, bagian tubuh yang dihitung sah menyentuh pita finis terlebih dahulu adalah ...',
    answer: 'Dada',
    aliases: ['Torso', 'Bahu'],
    points: 50,
  },
  {
    id: 29,
    question: 'Lari bolak-balik memindahkan bola atau kerucut pada jarak 4–5 meter disebut latihan ... run (berguna melatih kelincahan).',
    answer: 'Shuttle',
    aliases: ['Shuttle run', 'Lari bolak balik'],
    points: 50,
  },
  {
    id: 30,
    question: 'Gaya lompat jauh di mana posisi badan saat di udara seperti orang sedang duduk atau berjongkok disebut gaya ...',
    answer: 'Jongkok',
    aliases: ['Gaya jongkok', 'Tuck'],
    points: 50,
  },

  // === BOBOT 100 POIN (SOAL 31 - 40: HOTS & NUMERASI ATLETIK KELAS 4 / FASE B) ===
  {
    id: 31,
    question: 'Keliling 1 putaran lintasan lari standar atletik adalah 400 meter. Jika siswa Kelas 4 / Fase B berlari 2 putaran penuh, berapa meter total jaraknya?',
    answer: '800',
    aliases: ['800 meter', '800 m'],
    points: 100,
  },
  {
    id: 32,
    question: 'Pada lomba lari estafet 4 × 50 meter antar kelompok Kelas 4 / Fase B, berapa meter total jarak yang ditempuh oleh satu regu?',
    answer: '200',
    aliases: ['200 meter', '200 m'],
    points: 100,
  },
  {
    id: 33,
    question: 'Budi melakukan 3 kali lempar turbo. Lemparan ke-1 sejauh 12 m, ke-2 sejauh 15 m, dan ke-3 sejauh 14 m. Berapa meter rekor terjauh Budi?',
    answer: '15',
    aliases: ['15 meter', '15 m'],
    points: 100,
  },
  {
    id: 34,
    question: 'Panjang papan tolakan lompat jauh adalah 122 cm dan lebarnya 20 cm. Berapa sentimeter selisih antara panjang dan lebar papan tolakan tersebut?',
    answer: '102',
    aliases: ['102 cm'],
    points: 100,
  },
  {
    id: 35,
    question: 'Dalam permainan lompat katak (Kids Athletics), Rina melompat 3 kali berturut-turut sejauh 120 cm setiap lompatan. Berapa cm total jarak lompatan Rina?',
    answer: '360',
    aliases: ['360 cm'],
    points: 100,
  },
  {
    id: 36,
    question: 'Jika waktu tempuh lari 60 meter milik Andi adalah 10 detik, berapa meter rata-rata jarak yang ditempuh Andi setiap 1 detik? (60 ÷ 10 = ...)',
    answer: '6',
    aliases: ['6 meter', '6 m/s'],
    points: 100,
  },
  {
    id: 37,
    question: 'Olahraga atletik mendapat julukan sebagai "Mother of Sports" atau Ibu dari Segala Cabang Olahraga karena gerakannya berasal dari gerak dasar manusia. Benar atau Salah?',
    answer: 'Benar',
    aliases: ['Betul', 'Ya'],
    points: 100,
  },
  {
    id: 38,
    question: 'Pada latihan sirkuit atletik terdapat 4 pos (Pos Jalan, Pos Sprint, Pos Lompat Gawang, Pos Lempar Turbo). Jika tiap pos berdurasi 3 menit, berapa menit waktu 1 putaran penuh?',
    answer: '12',
    aliases: ['12 menit'],
    points: 100,
  },
  {
    id: 39,
    question: 'Seorang pelompat jauh menolak melewati batas depan papan tolakan (menginjak plastisin). Apakah lompatan tersebut dinyatakan Sah atau Diskualifikasi (Batal)?',
    answer: 'Batal',
    aliases: ['Diskualifikasi', 'Tidak sah', 'Gagal'],
    points: 100,
  },
  {
    id: 40,
    question: 'Regu A meraih 3 kali lemparan tepat sasaran (masing-masing bernilai 25 poin) dan 1 bonus lari gawang (25 poin). Berapa total poin Regu A?',
    answer: '100',
    aliases: ['100 poin'],
    points: 100,
  },
];

// Preset Boards for the "BOARD QUIZ INTERAKTIF (A4)" Studio
export interface BoardPreset {
  id: string;
  judulBoard: string;
  poinLabel: string;
  description: string;
  questions: string[];
}

export const BOARD_QUIZ_PRESETS: BoardPreset[] = [
  {
    id: 'board-1-atletik',
    judulBoard: 'BOARD 1',
    poinLabel: '10 POINTS',
    description: '10 Soal Dasar PJOK Atletik Kelas 4 / Fase B (2 Kolom × 5 Baris)',
    questions: DEFAULT_PJOK_ATLETIK_QUESTIONS.slice(0, 10).map((q) => q.question),
  },
  {
    id: 'board-2-atletik',
    judulBoard: 'BOARD 2',
    poinLabel: '25 POINTS',
    description: '10 Soal Teknik Gerak Atletik Kelas 4 / Fase B (2 Kolom × 5 Baris)',
    questions: DEFAULT_PJOK_ATLETIK_QUESTIONS.slice(10, 20).map((q) => q.question),
  },
  {
    id: 'board-3-atletik',
    judulBoard: 'BOARD 3',
    poinLabel: '50 POINTS',
    description: '10 Soal Analisis & Peraturan Atletik Kelas 4 / Fase B (2 Kolom × 5 Baris)',
    questions: DEFAULT_PJOK_ATLETIK_QUESTIONS.slice(20, 30).map((q) => q.question),
  },
  {
    id: 'board-4-numerasi-atletik',
    judulBoard: 'BOARD 4',
    poinLabel: '100 POINTS',
    description: '10 Soal HOTS & Numerasi Skor Atletik Kelas 4 / Fase B (2 Kolom × 5 Baris)',
    questions: [
      'Keliling lintasan = 400 m\n2 × 400 m = ... m',
      'Estafet 4 × 50 m\nTotal Jarak = ... m',
      'Lempar Turbo: 12 m, 15 m, 14 m\nRekor Terjauh = ... m',
      'Papan Tolak: 122 cm − 20 cm\nSelisih = ... cm',
      'Lompat Katak: 3 × 120 cm\nTotal = ... cm',
      'Kecepatan Sprint:\n60 m ÷ 10 detik = ... m/detik',
      'Pos Sirkuit: 4 Pos × 3 Menit\nTotal Durasi = ... menit',
      'Skor Lempar: (3 × 25) + 25\nTotal Poin = ...',
      'Aba-aba Start Jongkok:\nBersedia → Siap → ...',
      '4 Tahap Lompat Jauh:\nAwalan → Tolakan → Melayang → ...',
    ],
  },
];
