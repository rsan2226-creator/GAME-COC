import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Users,
  Clock,
  LayoutGrid,
  Trophy,
  CheckCircle2,
  XCircle,
  Lock,
  Sparkles,
  Mic,
  ShieldCheck,
  FileSpreadsheet,
  X,
  Volume2,
} from 'lucide-react';
import { GAME_IDENTITY } from '../data/defaultQuestions';
import {
  soundEngine,
  INDOOR_ROOM_PRESETS,
  IndoorRoomPreset,
  SoundEngineSnapshot,
} from '../utils/soundEngine';
import { moderatorEngine } from '../utils/moderatorEngine';

interface HowToPlayModalProps {
  onClose: () => void;
}

type GuideTab = 'ATURAN_ARENA' | 'PERSIAPAN_GURU' | 'WARNA_DAN_POIN';

export const HowToPlayModal: React.FC<HowToPlayModalProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<GuideTab>('ATURAN_ARENA');
  const [soundSnap, setSoundSnap] = useState<SoundEngineSnapshot>(() =>
    soundEngine.getSnapshot()
  );

  useEffect(() => {
    return soundEngine.subscribe(setSoundSnap);
  }, []);

  const handleReadRulesByModerator = () => {
    soundEngine.playClick();
    moderatorEngine.speak(
      `Perhatian seluruh peserta Kelas ${GAME_IDENTITY.kelas}! Berikut adalah panduan singkat bermain Class of Champions mata pelajaran ${GAME_IDENTITY.mataPelajaran} materi ${GAME_IDENTITY.materi}. Pertama, terdapat 40 kotak soal bernomor 1 sampai 40 dengan bobot 10, 25, 50, dan 100 poin. Kedua, pilih kotak berwarna biru, pilih nama tim kalian, lalu tekan tombol Mulai Menjawab. Ketiga, kalian memiliki waktu 10 detik untuk memasukkan jawaban. Jika benar, tim kalian mendapat poin dan kotak terkunci menjadi hijau. Jika salah atau waktu habis, kotak kembali terbuka untuk direbut tim lain. Tim dengan total poin tertinggi saat waktu habis akan menjadi Sang Juara!`
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md">
      <div className="w-full max-w-4xl rounded-3xl bg-[#0A162C] border-2 border-amber-400/50 shadow-[0_0_60px_rgba(245,158,11,0.25)] overflow-hidden flex flex-col max-h-[90vh]">
        {/* Top Modal Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 bg-[#071022] border-b border-slate-800">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-amber-400/20 border border-amber-400/50 flex items-center justify-center text-amber-400 shrink-0">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-semibold tracking-wider text-amber-400 uppercase">
                PANDUAN RESMI KOMPETISI AKADEMIK
              </div>
              <h2 className="text-lg sm:text-xl font-display font-black text-white">
                Cara Bermain CLASS OF CHAMPIONS ({GAME_IDENTITY.mataPelajaran} · {GAME_IDENTITY.materi} · Kelas {GAME_IDENTITY.kelas})
              </h2>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-amber-400/40">
              <Volume2 className="w-4 h-4 text-amber-400 shrink-0" />
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
              onClick={handleReadRulesByModerator}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/50 text-xs font-display font-bold text-cyan-200 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Mic className="w-4 h-4 text-cyan-300" />
              <span>Bacakan Aturan (Moderator AI)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                soundEngine.playMenuSwitch();
                onClose();
              }}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Tutup Panduan"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Interactive Tab Selector */}
        <div className="flex items-center gap-2 px-6 pt-4 bg-[#081226] border-b border-slate-800 overflow-x-auto">
          <button
            type="button"
            onClick={() => {
              soundEngine.playMenuSwitch();
              setActiveTab('ATURAN_ARENA');
            }}
            className={`px-4 py-2.5 rounded-t-xl font-display font-bold text-xs sm:text-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer border-b-2 ${
              activeTab === 'ATURAN_ARENA'
                ? 'bg-[#0A162C] text-amber-400 border-amber-400'
                : 'text-slate-400 hover:text-white border-transparent'
            }`}
          >
            1. Cara Bermain di Arena (Siswa & Tim)
          </button>

          <button
            type="button"
            onClick={() => {
              soundEngine.playMenuSwitch();
              setActiveTab('WARNA_DAN_POIN');
            }}
            className={`px-4 py-2.5 rounded-t-xl font-display font-bold text-xs sm:text-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer border-b-2 ${
              activeTab === 'WARNA_DAN_POIN'
                ? 'bg-[#0A162C] text-cyan-300 border-cyan-400'
                : 'text-slate-400 hover:text-white border-transparent'
            }`}
          >
            2. Warna Kotak, Bobot Poin & Podium
          </button>

          <button
            type="button"
            onClick={() => {
              soundEngine.playMenuSwitch();
              setActiveTab('PERSIAPAN_GURU');
            }}
            className={`px-4 py-2.5 rounded-t-xl font-display font-bold text-xs sm:text-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer border-b-2 ${
              activeTab === 'PERSIAPAN_GURU'
                ? 'bg-[#0A162C] text-emerald-300 border-emerald-400'
                : 'text-slate-400 hover:text-white border-transparent'
            }`}
          >
            3. Panduan Persiapan & Kontrol Guru
          </button>
        </div>

        {/* Modal Body Content */}
        <div className="p-6 sm:p-8 overflow-y-auto space-y-6 flex-1">
          {/* TAB 1: ATURAN ARENA */}
          {activeTab === 'ATURAN_ARENA' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-5 rounded-2xl bg-[#060E1F] border border-slate-800 space-y-2">
                  <div className="flex items-center gap-2.5 text-amber-400 font-display font-bold text-base">
                    <span className="w-7 h-7 rounded-lg bg-amber-400 text-slate-950 flex items-center justify-center font-black text-sm">
                      01
                    </span>
                    <span>Pilih Kotak Soal (Nomor 1–40)</span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    Di tengah arena terdapat <strong>40 kotak soal</strong> yang disusun dalam grid 8 kolom × 5 baris. Tim yang mendapat giliran memilih satu kotak berwarna <strong>Biru (Tersedia)</strong>. Moderator AI akan otomatis membacakan isi pertanyaan.
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-[#060E1F] border border-slate-800 space-y-2">
                  <div className="flex items-center gap-2.5 text-cyan-300 font-display font-bold text-base">
                    <span className="w-7 h-7 rounded-lg bg-cyan-400 text-slate-950 flex items-center justify-center font-black text-sm">
                      02
                    </span>
                    <span>Pilih Tim & Tekan Mulai Menjawab</span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    Pada jendela pop-up soal, klik <strong>Nama Tim</strong> yang akan menjawab terlebih dahulu, kemudian tekan tombol <strong>MULAI MENJAWAB (10 DETIK)</strong> untuk mengaktifkan hitung mundur dan papan ketik.
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-[#060E1F] border border-slate-800 space-y-2">
                  <div className="flex items-center gap-2.5 text-emerald-300 font-display font-bold text-base">
                    <span className="w-7 h-7 rounded-lg bg-emerald-400 text-slate-950 flex items-center justify-center font-black text-sm">
                      03
                    </span>
                    <span>Jawab dalam Waktu 10 Detik</span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    Masukkan jawaban melalui keyboard laptop atau tombol interaktif di layar (<strong>Keyboard Lengkap A–Z</strong> / <strong>Numeric Keypad 0–9</strong>), lalu tekan <strong>KIRIM JAWABAN</strong> sebelum waktu 10 detik habis! Saat tersisa 3 detik, timer berubah menjadi merah disertai bunyi peringatan.
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-[#060E1F] border border-slate-800 space-y-2">
                  <div className="flex items-center gap-2.5 text-rose-300 font-display font-bold text-base">
                    <span className="w-7 h-7 rounded-lg bg-rose-400 text-slate-950 flex items-center justify-center font-black text-sm">
                      04
                    </span>
                    <span>Rebut Kembali Soal yang Salah</span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    Jika jawaban benar, tim langsung memperoleh poin dan kotak terkunci permanen. Namun jika jawaban salah atau kehabisan waktu, tim mendapat <strong>0 poin</strong> dan kotak tersebut <strong>kembali dibuka</strong> untuk direbut oleh tim lain!
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: WARNA KOTAK & BOBOT POIN */}
          {activeTab === 'WARNA_DAN_POIN' && (
            <div className="space-y-6">
              {/* 4 Box Colors Explanation */}
              <div>
                <h3 className="text-sm font-display font-bold text-amber-300 uppercase tracking-wider mb-3">
                  Arti Indikator Warna pada 40 Kotak Soal:
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="p-4 rounded-xl bg-[#0B1D3A] border-2 border-sky-400/50 space-y-1.5">
                    <div className="font-display font-black text-sm text-sky-300 flex items-center justify-between">
                      <span>KOTAK BIRU</span>
                      <LayoutGrid className="w-4 h-4" />
                    </div>
                    <p className="text-xs text-slate-300">
                      Soal belum terjawab dan tersedia untuk dipilih oleh tim mana saja.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-amber-500/20 border-2 border-amber-400 space-y-1.5">
                    <div className="font-display font-black text-sm text-amber-300 flex items-center justify-between">
                      <span>KOTAK EMAS</span>
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <p className="text-xs text-slate-300">
                      Soal sedang dibuka dan dimainkan oleh tim di layar utama.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-emerald-950/60 border-2 border-emerald-400 space-y-1.5">
                    <div className="font-display font-black text-sm text-emerald-300 flex items-center justify-between">
                      <span>KOTAK HIJAU</span>
                      <Lock className="w-4 h-4" />
                    </div>
                    <p className="text-xs text-slate-300">
                      Soal sudah dijawab benar, poin telah diberikan, dan terkunci permanen.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-rose-950/60 border-2 border-rose-500 space-y-1.5">
                    <div className="font-display font-black text-sm text-rose-300 flex items-center justify-between">
                      <span>KOTAK MERAH</span>
                      <XCircle className="w-4 h-4" />
                    </div>
                    <p className="text-xs text-slate-300">
                      Efek getaran sementara saat jawaban salah, lalu kembali menjadi biru.
                    </p>
                  </div>
                </div>
              </div>

              {/* Point Tiers Explanation */}
              <div>
                <h3 className="text-sm font-display font-bold text-cyan-300 uppercase tracking-wider mb-3">
                  Tingkatan Bobot Poin Soal (PJOK · Atletik · Kelas {GAME_IDENTITY.kelas}):
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-4 rounded-xl bg-[#060E1F] border border-slate-800 text-center space-y-1">
                    <div className="font-mono-num font-black text-2xl text-cyan-300">10 POIN</div>
                    <div className="text-xs font-bold text-white">Kotak #1 – #10</div>
                    <div className="text-[11px] text-slate-400">Konsep Dasar Atletik</div>
                  </div>
                  <div className="p-4 rounded-xl bg-[#060E1F] border border-slate-800 text-center space-y-1">
                    <div className="font-mono-num font-black text-2xl text-emerald-300">25 POIN</div>
                    <div className="text-xs font-bold text-white">Kotak #11 – #20</div>
                    <div className="text-[11px] text-slate-400">Teknik Gerak Dasar</div>
                  </div>
                  <div className="p-4 rounded-xl bg-[#060E1F] border border-slate-800 text-center space-y-1">
                    <div className="font-mono-num font-black text-2xl text-amber-300">50 POIN</div>
                    <div className="text-xs font-bold text-white">Kotak #21 – #30</div>
                    <div className="text-[11px] text-slate-400">Analisis & Peraturan</div>
                  </div>
                  <div className="p-4 rounded-xl bg-[#060E1F] border border-slate-800 text-center space-y-1">
                    <div className="font-mono-num font-black text-2xl text-rose-400">100 POIN</div>
                    <div className="text-xs font-bold text-white">Kotak #31 – #40</div>
                    <div className="text-[11px] text-slate-400">Tantangan HOTS & Hitungan</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PANDUAN PERSIAPAN & KONTROL GURU */}
          {activeTab === 'PERSIAPAN_GURU' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-[#060E1F] border border-slate-800 flex items-start gap-3.5">
                <Users className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="font-display font-bold text-sm text-white">
                    Pengaturan 2–8 Tim & Durasi
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Pada halaman Beranda, pilih jumlah tim (2 sampai 8 tim), ketik nama masing-masing kelompok siswa, dan pilih durasi waktu (10–60 menit atau manual).
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[#060E1F] border border-slate-800 flex items-start gap-3.5">
                <FileSpreadsheet className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="font-display font-bold text-sm text-white">
                    Unduh & Unggah Template Soal Excel (.xlsx)
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    40 soal PJOK Atletik sudah langsung siap dimainkan. Guru juga dapat menekan <strong>UNDUH SOAL (.XLSX)</strong> untuk mengubah soal di Excel lalu mengunggahnya kembali lewat <strong>UNGGAH SOAL (.XLSX)</strong>.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[#060E1F] border border-slate-800 flex items-start gap-3.5">
                <ShieldCheck className="w-6 h-6 text-cyan-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="font-display font-bold text-sm text-white">
                    Fitur Verifikasi Manual Khusus Guru
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Pemeriksaan jawaban otomatis mengabaikan huruf besar/kecil dan spasi. Jika siswa menjawab dengan kalimat berbeda namun maknanya benar, guru cukup menekan tombol <strong>Verifikasi Guru: Benar</strong>.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[#060E1F] border border-slate-800 flex items-start gap-3.5">
                <Trophy className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="font-display font-bold text-sm text-white">
                    Pause/Resume, Layar Penuh & Unduh Nilai Akhir
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Gunakan tombol <strong>PAUSE / RESUME</strong> untuk menghentikan timer sementara saat berdiskusi di kelas, tombol <strong>Layar Penuh</strong> untuk proyektor, dan <strong>UNDUH HASIL (.XLSX)</strong> di halaman Final Ranking.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Modal Footer */}
        <div className="px-6 py-4 bg-[#071022] border-t border-slate-800 flex items-center justify-between gap-4">
          <span className="text-xs text-slate-400">
            Progres permainan disimpan otomatis meskipun halaman tidak sengaja dimuat ulang.
          </span>
          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              onClose();
            }}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-black text-xs sm:text-sm transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Mengerti & Tutup Panduan</span>
          </button>
        </div>
      </div>
    </div>
  );
};
