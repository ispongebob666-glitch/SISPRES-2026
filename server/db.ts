import fs from 'fs';
import path from 'path';
import type {
  School,
  Participant,
  Question,
  Exam,
  ActivityLog,
  CompetitionSettings,
  LiveScoreBoard,
  LiveScoreItem,
} from '../src/types/index.ts';
import { calculateExamScore, rankParticipants } from '../src/utils/scoring.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'sispres_db.json');

export interface DatabaseSchema {
  schools: School[];
  participants: Participant[];
  questions: Question[];
  exams: Record<string, Exam>; // exam_id or participant_id -> Exam
  activity_logs: ActivityLog[];
  settings: CompetitionSettings;
}

const DEFAULT_SETTINGS: CompetitionSettings = {
  judul_lomba: 'LOMBA SISWA PRESTASI TINGKAT DASAR',
  subjudul_lomba: 'Ajang Kreasi, Inovasi, dan Prestasi Siswa Berkarakter & Cerdas',
  judul1: 'SELEKSI SISWA BERPRESTASI TINGKAT KABUPATEN/KOTA',
  judul2: 'SISPRES — SISTEM LOMBA SISWA PRESTASI 2026',
  durasi_menit: 45,
  logo_url: '',
  logo1_url: '',
  logo2_url: '',
  background_url: '',
  status_lomba: 'berlangsung',
  mode_hasil_akhir: false,
  acak_soal: false,
  acak_jawaban: false,
  fullscreen_wajib: false,
  blok_copy: true,
  blok_paste: true,
  blok_klik_kanan: true,
  deteksi_pindah_tab: true,
  tampilkan_nilai_peserta: 'langsung',
  live_score_publik: true,
  tampilkan_nilai_sementara: true,
  interval_livescore_detik: 10,
  interval_checkpoint_detik: 10,
  kriteria_seri: 'durasi_tercepat',
  supabase_url: '',
  supabase_anon_key: '',
  github_repo: '',
  github_token: '',
};

const SEED_SCHOOLS: School[] = [
  { id: 'SCH-01', nama_sekolah: 'SD Negeri 1 Teladan' },
  { id: 'SCH-02', nama_sekolah: 'SD Bintang Kejora' },
  { id: 'SCH-03', nama_sekolah: 'SD Muhammadiyah Prestasi' },
  { id: 'SCH-04', nama_sekolah: 'SD Kristen Lentera Kasih' },
  { id: 'SCH-05', nama_sekolah: 'SD Insan Mandiri Nusantara' },
  { id: 'SCH-06', nama_sekolah: 'SD Cendikia Harapan' },
  { id: 'SCH-07', nama_sekolah: 'SD Garuda Melati' },
  { id: 'SCH-08', nama_sekolah: 'SD Tunas Bangsa Permai' },
];

const SEED_PARTICIPANTS: Participant[] = [
  { id: 'P-001', nama: 'Ahmad Pratama', gender: 'putra', password_hash: '123456', status: 'Belum Mulai' },
  { id: 'P-002', nama: 'Siti Nurhaliza', gender: 'putri', password_hash: '123456', status: 'Belum Mulai' },
  { id: 'P-003', nama: 'Budi Santoso', gender: 'putra', password_hash: '123456', status: 'Belum Mulai' },
  { id: 'P-004', nama: 'Dewi Lestari', gender: 'putri', password_hash: '123456', status: 'Belum Mulai' },
  { id: 'P-005', nama: 'Rizki Ramadhan', gender: 'putra', password_hash: '123456', status: 'Belum Mulai' },
  { id: 'P-006', nama: 'Anisa Putri', gender: 'putri', password_hash: '123456', status: 'Belum Mulai' },
  { id: 'P-007', nama: 'Dimas Anggara', gender: 'putra', password_hash: '123456', status: 'Belum Mulai' },
  { id: 'P-008', nama: 'Citra Kirana', gender: 'putri', password_hash: '123456', status: 'Belum Mulai' },
];

const SEED_QUESTIONS: Question[] = [
  {
    id: 'Q-01',
    no_urut: 1,
    tipe: 'pilihan_ganda',
    soal: 'Hasil dari 450 + 125 × 4 - 300 adalah ...',
    bobot: 5,
    kunci: 'C',
    pembahasan: 'Operasi perkalian didahulukan: 125 × 4 = 500. Kemudian 450 + 500 - 300 = 950 - 300 = 650.',
    status: 'aktif',
    options: [
      { id: 'opt-1', label: 'A', teks: '600' },
      { id: 'opt-2', label: 'B', teks: '625' },
      { id: 'opt-3', label: 'C', teks: '650' },
      { id: 'opt-4', label: 'D', teks: '700' },
    ],
  },
  {
    id: 'Q-02',
    no_urut: 2,
    tipe: 'pilihan_ganda',
    soal: 'Sebuah taman berbentuk persegi panjang berukuran panjang 24 meter dan lebar 18 meter. Di sekeliling taman akan ditanami pohon palem dengan jarak antar pohon 3 meter. Jumlah pohon palem yang dibutuhkan adalah ...',
    bobot: 5,
    kunci: 'B',
    pembahasan: 'Keliling = 2 × (24 + 18) = 2 × 42 = 84 meter. Jumlah pohon = 84 / 3 = 28 pohon.',
    status: 'aktif',
    options: [
      { id: 'opt-1', label: 'A', teks: '26 pohon' },
      { id: 'opt-2', label: 'B', teks: '28 pohon' },
      { id: 'opt-3', label: 'C', teks: '32 pohon' },
      { id: 'opt-4', label: 'D', teks: '36 pohon' },
    ],
  },
  {
    id: 'Q-03',
    no_urut: 3,
    tipe: 'pilihan_ganda',
    soal: 'Bagian tumbuhan yang berfungsi menyerap air dan zat hara dari dalam tanah serta memperkokoh berdirinya tanaman adalah ...',
    bobot: 5,
    kunci: 'A',
    pembahasan: 'Akar berfungsi menyerap air dan garam mineral dari dalam tanah serta menunjang berdirinya tumbuhan.',
    status: 'aktif',
    options: [
      { id: 'opt-1', label: 'A', teks: 'Akar' },
      { id: 'opt-2', label: 'B', teks: 'Batang' },
      { id: 'opt-3', label: 'C', teks: 'Daun' },
      { id: 'opt-4', label: 'D', teks: 'Bunga' },
    ],
  },
  {
    id: 'Q-04',
    no_urut: 4,
    tipe: 'pilihan_ganda',
    soal: 'Proses perubahan wujud benda dari padat langsung menjadi gas tanpa melalui fase cair disebut ...',
    bobot: 5,
    kunci: 'D',
    pembahasan: 'Menyublim adalah perubahan wujud zat dari padat langsung menjadi gas, contohnya kapur barus.',
    status: 'aktif',
    options: [
      { id: 'opt-1', label: 'A', teks: 'Mencair' },
      { id: 'opt-2', label: 'B', teks: 'Menguap' },
      { id: 'opt-3', label: 'C', teks: 'Mengembun' },
      { id: 'opt-4', label: 'D', teks: 'Menyublim' },
    ],
  },
  {
    id: 'Q-05',
    no_urut: 5,
    tipe: 'pilihan_ganda',
    soal: 'Ide pokok atau gagasan utama dalam sebuah paragraf biasanya terdapat pada ...',
    bobot: 5,
    kunci: 'B',
    pembahasan: 'Ide pokok paragraf termuat dalam kalimat utama, yang dapat berada di awal (deduktif), akhir (induktif), atau campuran.',
    status: 'aktif',
    options: [
      { id: 'opt-1', label: 'A', teks: 'Kalimat penjelas' },
      { id: 'opt-2', label: 'B', teks: 'Kalimat utama' },
      { id: 'opt-3', label: 'C', teks: 'Kalimat pengembang terakhir' },
      { id: 'opt-4', label: 'D', teks: 'Judul bacaan' },
    ],
  },
  {
    id: 'Q-06',
    no_urut: 6,
    tipe: 'pilihan_ganda',
    soal: 'Perhatikan deret bilangan berikut: 3, 7, 15, 31, 63, ... . Bilangan berikutnya pada deret tersebut adalah ...',
    bobot: 5,
    kunci: 'C',
    pembahasan: 'Pola deret: n × 2 + 1. 3×2+1=7; 7×2+1=15; 15×2+1=31; 31×2+1=63; 63×2+1=127.',
    status: 'aktif',
    options: [
      { id: 'opt-1', label: 'A', teks: '96' },
      { id: 'opt-2', label: 'B', teks: '124' },
      { id: 'opt-3', label: 'C', teks: '127' },
      { id: 'opt-4', label: 'D', teks: '135' },
    ],
  },
  {
    id: 'Q-07',
    no_urut: 7,
    tipe: 'pilihan_ganda',
    soal: 'Organ tubuh manusia yang berfungsi memompa darah ke seluruh tubuh melalui pembuluh darah adalah ...',
    bobot: 5,
    kunci: 'B',
    pembahasan: 'Jantung bertindak sebagai pompa yang mengedarkan darah kaya oksigen dan nutrisi ke seluruh jaringan tubuh.',
    status: 'aktif',
    options: [
      { id: 'opt-1', label: 'A', teks: 'Paru-paru' },
      { id: 'opt-2', label: 'B', teks: 'Jantung' },
      { id: 'opt-3', label: 'C', teks: 'Hati' },
      { id: 'opt-4', label: 'D', teks: 'Ginjal' },
    ],
  },
  {
    id: 'Q-08',
    no_urut: 8,
    tipe: 'pilihan_ganda',
    soal: 'Semboyan bangsa Indonesia "Bhinneka Tunggal Ika" diambil dari kitab Sutasoma karangan ...',
    bobot: 5,
    kunci: 'A',
    pembahasan: 'Kitab Sutasoma ditulis oleh Mpu Tantular pada zaman Kerajaan Majapahit abad ke-14.',
    status: 'aktif',
    options: [
      { id: 'opt-1', label: 'A', teks: 'Mpu Tantular' },
      { id: 'opt-2', label: 'B', teks: 'Mpu Prapanca' },
      { id: 'opt-3', label: 'C', teks: 'Mpu Sedah' },
      { id: 'opt-4', label: 'D', teks: 'Mpu Panuluh' },
    ],
  },
  {
    id: 'Q-09',
    no_urut: 9,
    tipe: 'pilihan_ganda',
    soal: 'FPB (Faktor Persekutuan Terbesar) dan KPK (Kelipatan Persekutuan Terkecil) dari bilangan 36 dan 48 berturut-turut adalah ...',
    bobot: 5,
    kunci: 'A',
    pembahasan: '36 = 2² × 3², 48 = 2⁴ × 3. FPB = 2² × 3 = 12. KPK = 2⁴ × 3² = 16 × 9 = 144.',
    status: 'aktif',
    options: [
      { id: 'opt-1', label: 'A', teks: '12 dan 144' },
      { id: 'opt-2', label: 'B', teks: '6 dan 144' },
      { id: 'opt-3', label: 'C', teks: '12 dan 96' },
      { id: 'opt-4', label: 'D', teks: '18 dan 144' },
    ],
  },
  {
    id: 'Q-10',
    no_urut: 10,
    tipe: 'pilihan_ganda',
    soal: 'Gaya tarik bumi yang menyebabkan semua benda bermassa jatuh ke permukaan bumi dinamakan gaya ...',
    bobot: 5,
    kunci: 'D',
    pembahasan: 'Gaya gravitasi adalah gaya tarik-menarik antarpartikel yang memiliki massa di alam semesta.',
    status: 'aktif',
    options: [
      { id: 'opt-1', label: 'A', teks: 'Pegas' },
      { id: 'opt-2', label: 'B', teks: 'Gesek' },
      { id: 'opt-3', label: 'C', teks: 'Magnet' },
      { id: 'opt-4', label: 'D', teks: 'Gravitasi' },
    ],
  },
  {
    id: 'Q-11',
    no_urut: 11,
    tipe: 'pilihan_ganda',
    soal: 'Sebuah mobil melaju dengan kecepatan rata-rata 60 km/jam dari kota P ke kota Q. Jika jarak kedua kota tersebut adalah 150 km dan mobil berangkat pukul 07.30, maka mobil akan tiba di kota Q pada pukul ...',
    bobot: 5,
    kunci: 'B',
    pembahasan: 'Waktu tempuh = 150 km / 60 km/jam = 2,5 jam = 2 jam 30 menit. Tiba = 07.30 + 02.30 = 10.00.',
    status: 'aktif',
    options: [
      { id: 'opt-1', label: 'A', teks: '09.30' },
      { id: 'opt-2', label: 'B', teks: '10.00' },
      { id: 'opt-3', label: 'C', teks: '10.30' },
      { id: 'opt-4', label: 'D', teks: '11.00' },
    ],
  },
  {
    id: 'Q-12',
    no_urut: 12,
    tipe: 'pilihan_ganda',
    soal: 'Hubungan timbal balik antara dua makhluk hidup di mana satu pihak diuntungkan dan pihak lain tidak dirugikan maupun diuntungkan disebut simbiosis ...',
    bobot: 5,
    kunci: 'B',
    pembahasan: 'Simbiosis komensalisme menguntungkan salah satu pihak tanpa merugikan pihak lain (contoh: ikan remora dan hiu).',
    status: 'aktif',
    options: [
      { id: 'opt-1', label: 'A', teks: 'Mutualisme' },
      { id: 'opt-2', label: 'B', teks: 'Komensalisme' },
      { id: 'opt-3', label: 'C', teks: 'Parasitisme' },
      { id: 'opt-4', label: 'D', teks: 'Amensalisme' },
    ],
  },
  {
    id: 'Q-13',
    no_urut: 13,
    tipe: 'pilihan_ganda',
    soal: 'Kutub-kutub magnet yang senama jika didekatkan akan saling ...',
    bobot: 5,
    kunci: 'A',
    pembahasan: 'Sifat magnet: kutub senama tolak-menolak, kutub tidak senama tarik-menarik.',
    status: 'aktif',
    options: [
      { id: 'opt-1', label: 'A', teks: 'Tolak-menolak' },
      { id: 'opt-2', label: 'B', teks: 'Tarik-menarik' },
      { id: 'opt-3', label: 'C', teks: 'Menempel kuat' },
      { id: 'opt-4', label: 'D', teks: 'Tidak bereaksi' },
    ],
  },
  {
    id: 'Q-14',
    no_urut: 14,
    tipe: 'pilihan_ganda',
    soal: 'Penulisan kata baku yang tepat menurut Pedoman Umum Ejaan Bahasa Indonesia (PUEBI) adalah ...',
    bobot: 5,
    kunci: 'C',
    pembahasan: 'Kata baku yang tepat adalah "Praktik", "Kualitas", "Objektif". Bukan praktek/kwalitas.',
    status: 'aktif',
    options: [
      { id: 'opt-1', label: 'A', teks: 'Praktek' },
      { id: 'opt-2', label: 'B', teks: 'Kwalitas' },
      { id: 'opt-3', label: 'C', teks: 'Praktik' },
      { id: 'opt-4', label: 'D', teks: 'Objektiip' },
    ],
  },
  {
    id: 'Q-15',
    no_urut: 15,
    tipe: 'pilihan_ganda',
    soal: 'Perhatikan piramida makanan: Tumbuhan hijau menduduki posisi sebagai ...',
    bobot: 5,
    kunci: 'A',
    pembahasan: 'Tumbuhan hijau mampu menghasilkan makanannya sendiri melalui fotosintesis, sehingga bertindak sebagai produsen.',
    status: 'aktif',
    options: [
      { id: 'opt-1', label: 'A', teks: 'Produsen' },
      { id: 'opt-2', label: 'B', teks: 'Konsumen tingkat I' },
      { id: 'opt-3', label: 'C', teks: 'Konsumen tingkat II' },
      { id: 'opt-4', label: 'D', teks: 'Dekomposer' },
    ],
  },
  {
    id: 'Q-16',
    no_urut: 16,
    tipe: 'pilihan_ganda',
    soal: 'Jika 3 kg mangga harganya Rp45.000, maka harga 7 kg mangga yang sama adalah ...',
    bobot: 5,
    kunci: 'B',
    pembahasan: 'Harga per kg = Rp45.000 / 3 = Rp15.000. Harga 7 kg = 7 × Rp15.000 = Rp105.000.',
    status: 'aktif',
    options: [
      { id: 'opt-1', label: 'A', teks: 'Rp95.000' },
      { id: 'opt-2', label: 'B', teks: 'Rp105.000' },
      { id: 'opt-3', label: 'C', teks: 'Rp115.000' },
      { id: 'opt-4', label: 'D', teks: 'Rp120.000' },
    ],
  },
  {
    id: 'Q-17',
    no_urut: 17,
    tipe: 'pilihan_ganda',
    soal: 'Planet terbesar dalam tata surya kita yang juga memiliki badai besar terkenal bernama "Bintik Merah Raksasa" adalah ...',
    bobot: 5,
    kunci: 'C',
    pembahasan: 'Yupiter (Jupiter) adalah planet terbesar di tata surya.',
    status: 'aktif',
    options: [
      { id: 'opt-1', label: 'A', teks: 'Mars' },
      { id: 'opt-2', label: 'B', teks: 'Saturnus' },
      { id: 'opt-3', label: 'C', teks: 'Yupiter' },
      { id: 'opt-4', label: 'D', teks: 'Neptunus' },
    ],
  },
  {
    id: 'Q-18',
    no_urut: 18,
    tipe: 'pilihan_ganda',
    soal: 'Pernyataan berikut yang merupakan hak asasi sebagai warga negara dalam bidang pendidikan di Indonesia diatur dalam UUD 1945 pasal ...',
    bobot: 5,
    kunci: 'D',
    pembahasan: 'Pasal 31 UUD 1945 menyatakan bahwa setiap warga negara berhak mendapat pendidikan.',
    status: 'aktif',
    options: [
      { id: 'opt-1', label: 'A', teks: 'Pasal 27' },
      { id: 'opt-2', label: 'B', teks: 'Pasal 28' },
      { id: 'opt-3', label: 'C', teks: 'Pasal 30' },
      { id: 'opt-4', label: 'D', teks: 'Pasal 31' },
    ],
  },
  {
    id: 'Q-19',
    no_urut: 19,
    tipe: 'pilihan_ganda',
    soal: 'Rata-rata nilai ulangan matematika dari 5 siswa adalah 82. Jika nilai siswa keenam digabungkan, nilai rata-ratanya menjadi 84. Nilai siswa keenam tersebut adalah ...',
    bobot: 5,
    kunci: 'C',
    pembahasan: 'Jumlah 5 siswa = 5 × 82 = 410. Jumlah 6 siswa = 6 × 84 = 504. Nilai siswa ke-6 = 504 - 410 = 94.',
    status: 'aktif',
    options: [
      { id: 'opt-1', label: 'A', teks: '88' },
      { id: 'opt-2', label: 'B', teks: '90' },
      { id: 'opt-3', label: 'C', teks: '94' },
      { id: 'opt-4', label: 'D', teks: '96' },
    ],
  },
  {
    id: 'Q-20',
    no_urut: 20,
    tipe: 'pilihan_ganda',
    soal: 'Sikap toleransi dan saling menghormati perbedaan suku, agama, dan ras merupakan cerminan pengamalan Pancasila sila ke-...',
    bobot: 5,
    kunci: 'B',
    pembahasan: 'Sila ketiga "Persatuan Indonesia" menempatkan kesatuan, persatuan, serta kepentingan bangsa dan negara di atas kepentingan pribadi atau golongan dengan semangat Bhinneka Tunggal Ika.',
    status: 'aktif',
    options: [
      { id: 'opt-1', label: 'A', teks: 'Pertama' },
      { id: 'opt-2', label: 'B', teks: 'Ketiga' },
      { id: 'opt-3', label: 'C', teks: 'Keempat' },
      { id: 'opt-4', label: 'D', teks: 'Kelima' },
    ],
  },
];

class Database {
  private data: DatabaseSchema;

  constructor() {
    this.data = this.load();
  }

  private load(): DatabaseSchema {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        return {
          schools: parsed.schools || SEED_SCHOOLS,
          participants: parsed.participants || SEED_PARTICIPANTS,
          questions: parsed.questions || SEED_QUESTIONS,
          exams: parsed.exams || {},
          activity_logs: parsed.activity_logs || [],
          settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
        };
      } catch (err) {
        console.error('Failed reading DB file, re-initializing seed:', err);
      }
    }

    const initial: DatabaseSchema = {
      schools: SEED_SCHOOLS,
      participants: SEED_PARTICIPANTS,
      questions: SEED_QUESTIONS,
      exams: {},
      activity_logs: [
        {
          id: 'log-seed-1',
          participant_id: 'SYSTEM',
          nama_sekolah: 'PANITIA',
          gender: 'putra',
          aktivitas: 'Sistem Lomba Siswa Prestasi (SISPRES) siap digunakan.',
          waktu: new Date().toISOString(),
        },
      ],
      settings: DEFAULT_SETTINGS,
    };

    this.saveDirect(initial);
    return initial;
  }

  private saveDirect(dataToSave: DatabaseSchema) {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(dataToSave, null, 2), 'utf-8');
    } catch (err) {
      console.error('Error saving database to file:', err);
    }
  }

  public save() {
    this.saveDirect(this.data);
  }

  public getSchools(): School[] {
    return this.data.schools;
  }

  public addSchool(nama_sekolah: string): School {
    const id = `SCH-${String(this.data.schools.length + 1).padStart(2, '0')}`;
    const newSchool: School = { id, nama_sekolah: nama_sekolah.trim() };
    this.data.schools.push(newSchool);
    this.save();
    return newSchool;
  }

  public deleteSchool(schoolId: string): boolean {
    const countBefore = this.data.schools.length;
    this.data.schools = this.data.schools.filter(s => s.id !== schoolId);
    this.save();
    return this.data.schools.length < countBefore;
  }

  public getParticipants(): Participant[] {
    return this.data.participants;
  }

  public getParticipant(id: string): Participant | undefined {
    return this.data.participants.find(p => p.id === id);
  }

  public addParticipant(p: { nama: string; gender: 'putra' | 'putri'; password_hash: string }): { participant?: Participant; error?: string } {
    const nextNumber = this.data.participants.length + 1;
    const newId = `P-${String(nextNumber).padStart(3, '0')}`;
    const newParticipant: Participant = {
      id: newId,
      nama: p.nama.trim(),
      gender: p.gender,
      password_hash: p.password_hash || '123456',
      status: 'Belum Mulai',
    };

    this.data.participants.push(newParticipant);
    this.save();
    return { participant: newParticipant };
  }

  public updateParticipant(id: string, updates: Partial<Participant>): Participant | undefined {
    const idx = this.data.participants.findIndex(p => p.id === id);
    if (idx === -1) return undefined;
    this.data.participants[idx] = { ...this.data.participants[idx], ...updates };
    this.save();
    return this.data.participants[idx];
  }

  public deleteParticipant(id: string): boolean {
    const before = this.data.participants.length;
    this.data.participants = this.data.participants.filter(p => p.id !== id);
    delete this.data.exams[id];
    this.save();
    return this.data.participants.length < before;
  }

  public resetParticipant(id: string): boolean {
    const participant = this.data.participants.find(p => p.id === id);
    if (!participant) return false;

    participant.status = 'Belum Mulai';
    participant.exam_id = undefined;
    delete this.data.exams[id];

    this.logActivity(id, participant.nama, participant.gender, 'Admin mereset sesi lomba peserta.');
    this.save();
    return true;
  }

  public getQuestions(): Question[] {
    return this.data.questions;
  }

  public addQuestion(q: Omit<Question, 'id'>): Question {
    const id = `Q-${String(this.data.questions.length + 1).padStart(2, '0')}`;
    const newQ: Question = { ...q, id };
    this.data.questions.push(newQ);
    this.save();
    return newQ;
  }

  public updateQuestion(id: string, updates: Partial<Question>): Question | undefined {
    const idx = this.data.questions.findIndex(q => q.id === id);
    if (idx === -1) return undefined;
    this.data.questions[idx] = { ...this.data.questions[idx], ...updates };
    this.save();
    return this.data.questions[idx];
  }

  public deleteQuestion(id: string): boolean {
    const before = this.data.questions.length;
    this.data.questions = this.data.questions.filter(q => q.id !== id);
    this.save();
    return this.data.questions.length < before;
  }

  public getSettings(): CompetitionSettings {
    return this.data.settings;
  }

  public updateSettings(updates: Partial<CompetitionSettings>): CompetitionSettings {
    this.data.settings = { ...this.data.settings, ...updates };
    this.save();
    return this.data.settings;
  }

  public getExam(participantId: string): Exam | undefined {
    return this.data.exams[participantId];
  }

  public startExam(participantId: string): { exam: Exam; participant: Participant } | { error: string } {
    const participant = this.getParticipant(participantId);
    if (!participant) {
      return { error: 'Peserta tidak ditemukan.' };
    }

    if (this.data.settings.status_lomba === 'belum_mulai') {
      return { error: 'Lomba belum dimulai oleh Admin.' };
    }

    if (participant.status === 'Selesai' || participant.status === 'Waktu Habis') {
      return { error: 'Peserta telah menyelesaikan lomba dan tidak dapat mengulang.' };
    }

    let exam = this.data.exams[participantId];
    const nowIso = new Date().toISOString();

    if (!exam) {
      const activeQuestions = this.data.questions.filter(q => q.status === 'aktif');
      exam = {
        id: `EXAM-${participantId}-${Date.now()}`,
        participant_id: participantId,
        nama_sekolah: participant.nama,
        gender: participant.gender,
        waktu_mulai: nowIso,
        waktu_selesai: null,
        checkpoint_terakhir: nowIso,
        durasi_detik: 0,
        status: 'Sedang Mengerjakan',
        nilai_sementara: 0,
        nilai_final: null,
        total_soal: activeQuestions.length,
        jumlah_terjawab: 0,
        jawaban: {},
      };
      this.data.exams[participantId] = exam;
      participant.status = 'Sedang Mengerjakan';
      participant.exam_id = exam.id;

      this.logActivity(participantId, participant.nama, participant.gender, 'Peserta memulai sesi lomba.');
      this.save();
    }

    return { exam, participant };
  }

  public saveAnswer(participantId: string, questionId: string, answer: any): { success: boolean; jumlah_terjawab: number; nilai_sementara: number } | { error: string } {
    const exam = this.data.exams[participantId];
    if (!exam) return { error: 'Sesi lomba tidak ditemukan.' };
    if (exam.status === 'Selesai' || exam.status === 'Waktu Habis') {
      return { error: 'Lomba sudah disubmit.' };
    }

    exam.jawaban[questionId] = answer;
    const answeredCount = Object.keys(exam.jawaban).filter(k => exam.jawaban[k] !== undefined && exam.jawaban[k] !== null && exam.jawaban[k] !== '').length;
    exam.jumlah_terjawab = answeredCount;

    // Recalculate temporary score
    const activeQuestions = this.data.questions.filter(q => q.status === 'aktif');
    const { score } = calculateExamScore(activeQuestions, exam.jawaban);
    exam.nilai_sementara = score;
    exam.checkpoint_terakhir = new Date().toISOString();

    // calculate running duration
    if (exam.waktu_mulai) {
      const startMs = new Date(exam.waktu_mulai).getTime();
      const currentMs = Date.now();
      exam.durasi_detik = Math.max(0, Math.floor((currentMs - startMs) / 1000));
    }

    this.save();
    return { success: true, jumlah_terjawab: exam.jumlah_terjawab, nilai_sementara: exam.nilai_sementara };
  }

  public recordCheckpoint(participantId: string, answers?: Record<string, any>): { success: boolean; checkpoint_terakhir: string; nilai_sementara: number } | { error: string } {
    const exam = this.data.exams[participantId];
    if (!exam) return { error: 'Sesi lomba tidak ditemukan.' };

    const nowIso = new Date().toISOString();
    exam.checkpoint_terakhir = nowIso;

    if (answers) {
      exam.jawaban = { ...exam.jawaban, ...answers };
      const answeredCount = Object.keys(exam.jawaban).filter(k => exam.jawaban[k] !== undefined && exam.jawaban[k] !== null && exam.jawaban[k] !== '').length;
      exam.jumlah_terjawab = answeredCount;
    }

    // calculate duration
    if (exam.waktu_mulai && exam.status === 'Sedang Mengerjakan') {
      const startMs = new Date(exam.waktu_mulai).getTime();
      const currentMs = Date.now();
      exam.durasi_detik = Math.max(0, Math.floor((currentMs - startMs) / 1000));
    }

    // Recalculate temporary score
    const activeQuestions = this.data.questions.filter(q => q.status === 'aktif');
    const { score } = calculateExamScore(activeQuestions, exam.jawaban);
    exam.nilai_sementara = score;

    this.save();
    return { success: true, checkpoint_terakhir: nowIso, nilai_sementara: exam.nilai_sementara };
  }

  public finishExam(participantId: string, reason: 'submit_mandiri' | 'waktu_habis' = 'submit_mandiri'): { exam: Exam; error?: string } {
    const exam = this.data.exams[participantId];
    const participant = this.getParticipant(participantId);
    if (!exam || !participant) {
      return { exam: {} as Exam, error: 'Sesi lomba atau peserta tidak ditemukan.' };
    }

    if (exam.status === 'Selesai' || exam.status === 'Waktu Habis') {
      return { exam };
    }

    const nowIso = new Date().toISOString();
    exam.waktu_selesai = nowIso;
    exam.checkpoint_terakhir = nowIso;
    exam.status = reason === 'waktu_habis' ? 'Waktu Habis' : 'Selesai';
    participant.status = exam.status;

    if (exam.waktu_mulai) {
      const startMs = new Date(exam.waktu_mulai).getTime();
      const endMs = new Date(nowIso).getTime();
      exam.durasi_detik = Math.max(0, Math.floor((endMs - startMs) / 1000));
    }

    // Final evaluation
    const activeQuestions = this.data.questions.filter(q => q.status === 'aktif');
    const { score, percentage } = calculateExamScore(activeQuestions, exam.jawaban);
    exam.nilai_final = score;
    exam.nilai_sementara = score;

    const logMsg = reason === 'waktu_habis'
      ? `Waktu lomba habis. Sesi otomatis disubmit dengan nilai akhir ${score} (${percentage}%).`
      : `Peserta mengirim jawaban mandiri dengan nilai akhir ${score} (${percentage}%).`;

    this.logActivity(participantId, participant.nama, participant.gender, logMsg);
    this.save();
    return { exam };
  }

  public logActivity(participantId: string, namaSekolah: string, gender: 'putra' | 'putri', aktivitas: string) {
    const newLog: ActivityLog = {
      id: `LOG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      participant_id: participantId,
      nama_sekolah: namaSekolah,
      gender,
      aktivitas,
      waktu: new Date().toISOString(),
    };
    this.data.activity_logs.unshift(newLog);
    // Keep max 500 logs
    if (this.data.activity_logs.length > 500) {
      this.data.activity_logs = this.data.activity_logs.slice(0, 500);
    }
    this.save();
  }

  public getActivityLogs(): ActivityLog[] {
    return this.data.activity_logs;
  }

  public getLiveScoreBoard(): LiveScoreBoard {
    const participants = this.data.participants;
    const settings = this.data.settings;
    const activeQuestionsCount = this.data.questions.filter(q => q.status === 'aktif').length;

    const items: Array<{
      participant_id: string;
      school_id: string;
      nama_sekolah: string;
      gender: 'putra' | 'putri';
      status: any;
      nilai_sementara: number;
      nilai_final: number | null;
      durasi_detik: number;
      waktu_mulai: string | null;
      checkpoint_terakhir: string | null;
      waktu_selesai: string | null;
      jumlah_terjawab: number;
      total_soal: number;
    }> = participants.map(p => {
      const exam = this.data.exams[p.id];
      if (!exam) {
        return {
          participant_id: p.id,
          school_id: '',
          nama_sekolah: p.nama,
          gender: p.gender,
          status: p.status,
          nilai_sementara: 0,
          nilai_final: null,
          durasi_detik: 0,
          waktu_mulai: null,
          checkpoint_terakhir: null,
          waktu_selesai: null,
          jumlah_terjawab: 0,
          total_soal: activeQuestionsCount,
        };
      }

      // Calculate running duration if still in progress
      let dur = exam.durasi_detik;
      if (exam.status === 'Sedang Mengerjakan' && exam.waktu_mulai) {
        const startMs = new Date(exam.waktu_mulai).getTime();
        dur = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
      }

      return {
        participant_id: p.id,
        school_id: '',
        nama_sekolah: p.nama,
        gender: p.gender,
        status: exam.status,
        nilai_sementara: exam.nilai_sementara,
        nilai_final: exam.nilai_final,
        durasi_detik: dur,
        waktu_mulai: exam.waktu_mulai,
        checkpoint_terakhir: exam.checkpoint_terakhir,
        waktu_selesai: exam.waktu_selesai,
        jumlah_terjawab: exam.jumlah_terjawab,
        total_soal: exam.total_soal || activeQuestionsCount,
      };
    });

    const putraItems = items.filter(it => it.gender === 'putra');
    const putriItems = items.filter(it => it.gender === 'putri');

    const rankedPutra = rankParticipants(putraItems, settings.kriteria_seri);
    const rankedPutri = rankParticipants(putriItems, settings.kriteria_seri);

    const totalSelesai = items.filter(it => it.status === 'Selesai' || it.status === 'Waktu Habis').length;

    return {
      putra: rankedPutra,
      putri: rankedPutri,
      last_update: new Date().toISOString(),
      status_lomba: settings.status_lomba,
      mode_hasil_akhir: settings.mode_hasil_akhir,
      tampilkan_nilai_sementara: settings.tampilkan_nilai_sementara,
      total_sekolah: this.data.schools.length,
      total_selesai: totalSelesai,
      interval_livescore_detik: settings.interval_livescore_detik || 10,
    };
  }

  public getRawData(): DatabaseSchema {
    return this.data;
  }

  public restoreData(backup: DatabaseSchema): boolean {
    if (!backup || !backup.schools || !backup.participants || !backup.questions) {
      return false;
    }
    this.data = backup;
    this.save();
    return true;
  }
}

export const db = new Database();
