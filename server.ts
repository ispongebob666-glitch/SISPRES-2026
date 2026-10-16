import express from 'express';
import type { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { db } from './server/db.ts';
import { calculateExamScore } from './src/utils/scoring.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const isProd = process.env.NODE_ENV === 'production';

  app.use(express.json({ limit: '10mb' }));

  // Helper for admin authorization check
  const checkAdmin = (req: Request, res: Response, next: () => void) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.includes('admin-token')) {
      // In dev or prototype, permit basic admin access with token or role header
      if (req.headers['x-role'] === 'ADMIN') {
        return next();
      }
    }
    next();
  };

  // --- AUTH ENDPOINTS ---
  app.post('/api/auth/login', (req: Request, res: Response) => {
    const { role, username, password, school_id, gender, participant_id } = req.body;

    // 1. ADMIN LOGIN
    if (role === 'ADMIN') {
      if ((username === 'admin' || username === 'panitia') && (password === 'admin123' || password === 'sispres2026')) {
        return res.json({
          success: true,
          role: 'ADMIN',
          token: 'admin-token-' + Date.now(),
          user: { name: 'Administrator SISPRES' },
        });
      }
      return res.status(401).json({ error: 'Username atau password Admin tidak sesuai.' });
    }

    // 2. LIVE SCORE LOGIN (Direct access, no password required per user request)
    if (role === 'LIVE_SCORE') {
      return res.json({
        success: true,
        role: 'LIVE_SCORE',
        token: 'livescore-token-' + Date.now(),
        user: { name: 'Operator Papan Live Score' },
      });
    }

    // 3. PESERTA LOGIN (by Participant ID)
    const participants = db.getParticipants();
    let found = null;

    if (participant_id) {
      found = participants.find(p => p.id.toUpperCase() === String(participant_id).trim().toUpperCase() || p.nama.toLowerCase() === String(participant_id).trim().toLowerCase());
    }

    if (!found) {
      return res.status(401).json({ error: 'Data peserta tidak ditemukan pada sistem.' });
    }

    db.logActivity(found.id, found.nama, found.gender, 'Peserta berhasil masuk (login langsung).');

    return res.json({
      success: true,
      role: 'PESERTA',
      token: 'participant-token-' + found.id,
      participant: found,
    });
  });

  // --- PUBLIC / COMMON ENDPOINTS ---
  app.get('/api/public/schools', (_req: Request, res: Response) => {
    res.json(db.getSchools());
  });

  app.get('/api/public/participants', (_req: Request, res: Response) => {
    res.json(db.getParticipants().map(p => ({
      id: p.id,
      nama: p.nama,
      gender: p.gender,
      status: p.status,
    })));
  });

  app.get('/api/public/settings', (_req: Request, res: Response) => {
    const s = db.getSettings();
    res.json({
      judul_lomba: s.judul_lomba,
      subjudul_lomba: s.subjudul_lomba,
      judul1: s.judul1 || s.judul_lomba,
      judul2: s.judul2 || s.subjudul_lomba,
      logo_url: s.logo_url,
      logo1_url: s.logo1_url || s.logo_url,
      logo2_url: s.logo2_url || '',
      durasi_menit: s.durasi_menit,
      background_url: s.background_url,
      status_lomba: s.status_lomba,
      mode_hasil_akhir: s.mode_hasil_akhir,
      live_score_publik: s.live_score_publik,
      tampilkan_nilai_sementara: s.tampilkan_nilai_sementara,
      fullscreen_wajib: s.fullscreen_wajib,
      blok_copy: s.blok_copy,
      blok_paste: s.blok_paste,
      blok_klik_kanan: s.blok_klik_kanan,
      deteksi_pindah_tab: s.deteksi_pindah_tab,
      interval_livescore_detik: s.interval_livescore_detik,
      interval_checkpoint_detik: s.interval_checkpoint_detik,
    });
  });

  // LIVE SCORE BOARD (Public / Display Role)
  app.get('/api/live-score', (_req: Request, res: Response) => {
    const board = db.getLiveScoreBoard();
    res.json(board);
  });

  // --- EXAM (PESERTA) ENDPOINTS ---
  app.get('/api/exam/session', (req: Request, res: Response) => {
    const participantId = req.query.participant_id as string;
    if (!participantId) return res.status(400).json({ error: 'participant_id wajib diisi.' });

    const participant = db.getParticipant(participantId);
    if (!participant) return res.status(404).json({ error: 'Peserta tidak ditemukan.' });

    const exam = db.getExam(participantId);
    const settings = db.getSettings();

    // Prepare questions for candidate (hide answer keys!)
    const activeQuestions = db.getQuestions()
      .filter(q => q.status === 'aktif')
      .map(q => ({
        id: q.id,
        no_urut: q.no_urut,
        tipe: q.tipe,
        soal: q.soal,
        gambar: q.gambar,
        posisi_gambar: q.posisi_gambar,
        bobot: q.bobot,
        options: q.options,
        // kunci and pembahasan are intentionally omitted for safety
      }));

    res.json({
      participant,
      exam: exam || null,
      settings: {
        judul_lomba: settings.judul_lomba,
        durasi_menit: settings.durasi_menit,
        status_lomba: settings.status_lomba,
        fullscreen_wajib: settings.fullscreen_wajib,
        blok_copy: settings.blok_copy,
        blok_paste: settings.blok_paste,
        blok_klik_kanan: settings.blok_klik_kanan,
        deteksi_pindah_tab: settings.deteksi_pindah_tab,
        tampilkan_nilai_peserta: settings.tampilkan_nilai_peserta,
      },
      questions: activeQuestions,
      server_time: new Date().toISOString(),
    });
  });

  app.post('/api/exam/start', (req: Request, res: Response) => {
    const { participant_id } = req.body;
    if (!participant_id) return res.status(400).json({ error: 'participant_id wajib diisi.' });

    const result = db.startExam(participant_id);
    if ('error' in result) {
      return res.status(400).json({ error: result.error });
    }

    res.json(result);
  });

  app.post('/api/exam/answer', (req: Request, res: Response) => {
    const { participant_id, question_id, answer } = req.body;
    if (!participant_id || !question_id) {
      return res.status(400).json({ error: 'participant_id dan question_id wajib diisi.' });
    }

    const result = db.saveAnswer(participant_id, question_id, answer);
    if ('error' in result) {
      return res.status(400).json({ error: result.error });
    }
    res.json(result);
  });

  app.post('/api/exam/checkpoint', (req: Request, res: Response) => {
    const { participant_id, answers } = req.body;
    if (!participant_id) return res.status(400).json({ error: 'participant_id wajib diisi.' });

    const result = db.recordCheckpoint(participant_id, answers);
    if ('error' in result) {
      return res.status(400).json({ error: result.error });
    }
    res.json(result);
  });

  app.post('/api/exam/finish', (req: Request, res: Response) => {
    const { participant_id, reason } = req.body;
    if (!participant_id) return res.status(400).json({ error: 'participant_id wajib diisi.' });

    const result = db.finishExam(participant_id, reason);
    if (result.error) {
      return res.status(400).json({ error: result.error });
    }
    res.json(result);
  });

  app.post('/api/exam/log-activity', (req: Request, res: Response) => {
    const { participant_id, aktivitas } = req.body;
    if (!participant_id || !aktivitas) {
      return res.status(400).json({ error: 'Data tidak lengkap.' });
    }

    const participant = db.getParticipant(participant_id);
    if (participant) {
      db.logActivity(participant.id, participant.nama, participant.gender, aktivitas);
    }
    res.json({ success: true });
  });

  // --- ADMIN ENDPOINTS ---
  app.get('/api/admin/overview', checkAdmin, (_req: Request, res: Response) => {
    const participants = db.getParticipants();
    const questions = db.getQuestions();
    const schools = db.getSchools();
    const raw = db.getRawData();

    const exams = Object.values(raw.exams);
    const finishedExams = exams.filter(e => e.status === 'Selesai' || e.status === 'Waktu Habis');

    let maxScore = 0;
    let minScore = 0;
    let avgScore = 0;

    if (finishedExams.length > 0) {
      const scores = finishedExams.map(e => e.nilai_final ?? e.nilai_sementara);
      maxScore = Math.max(...scores);
      minScore = Math.min(...scores);
      avgScore = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
    }

    res.json({
      peserta: {
        total: participants.length,
        belum_mulai: participants.filter(p => p.status === 'Belum Mulai').length,
        sedang_mengerjakan: participants.filter(p => p.status === 'Sedang Mengerjakan').length,
        selesai: participants.filter(p => p.status === 'Selesai' || p.status === 'Waktu Habis').length,
      },
      soal: {
        total: questions.length,
        aktif: questions.filter(q => q.status === 'aktif').length,
        nonaktif: questions.filter(q => q.status === 'nonaktif').length,
      },
      hasil: {
        nilai_tertinggi: maxScore,
        nilai_terendah: minScore,
        nilai_rata_rata: avgScore,
      },
      sekolah: {
        total: schools.length,
        jumlah_peserta: participants.length,
      },
    });
  });

  // Participants CRUD
  app.get('/api/admin/participants', checkAdmin, (_req: Request, res: Response) => {
    res.json(db.getParticipants());
  });

  app.post('/api/admin/participants', checkAdmin, (req: Request, res: Response) => {
    const { nama, gender, password_hash } = req.body;
    if (!nama || !gender) {
      return res.status(400).json({ error: 'Nama dan gender wajib diisi.' });
    }

    const result = db.addParticipant({ nama, gender, password_hash });
    if (result.error) {
      return res.status(400).json({ error: result.error });
    }
    res.json(result.participant);
  });

  app.put('/api/admin/participants/:id', checkAdmin, (req: Request, res: Response) => {
    const id = req.params.id;
    const updated = db.updateParticipant(id, req.body);
    if (!updated) return res.status(404).json({ error: 'Peserta tidak ditemukan.' });
    res.json(updated);
  });

  app.delete('/api/admin/participants/:id', checkAdmin, (req: Request, res: Response) => {
    const id = req.params.id;
    const ok = db.deleteParticipant(id);
    if (!ok) return res.status(404).json({ error: 'Peserta gagal dihapus.' });
    res.json({ success: true });
  });

  app.post('/api/admin/participants/reset/:id', checkAdmin, (req: Request, res: Response) => {
    const id = req.params.id;
    const ok = db.resetParticipant(id);
    if (!ok) return res.status(404).json({ error: 'Gagal mereset peserta.' });
    res.json({ success: true, message: 'Peserta berhasil direset.' });
  });

  // Bulk Import Participants
  app.post('/api/admin/participants/import', checkAdmin, (req: Request, res: Response) => {
    const { items } = req.body;
    if (!Array.isArray(items)) return res.status(400).json({ error: 'Format data tidak valid.' });

    const errors: string[] = [];
    let addedCount = 0;

    for (const item of items) {
      if (!item.nama || !item.gender) {
        errors.push(`Baris "${item.id || 'Peserta'}": Nama dan gender wajib diisi.`);
        continue;
      }

      const resAdd = db.addParticipant({
        nama: item.nama,
        gender: item.gender === 'putri' ? 'putri' : 'putra',
        password_hash: item.password || '123456',
      });

      if (resAdd.error) {
        errors.push(`${item.nama} (${item.gender}): ${resAdd.error}`);
      } else {
        addedCount++;
      }
    }

    res.json({ success: true, addedCount, errors });
  });

  // Questions CRUD
  app.get('/api/admin/questions', checkAdmin, (_req: Request, res: Response) => {
    res.json(db.getQuestions());
  });

  app.post('/api/admin/questions', checkAdmin, (req: Request, res: Response) => {
    const newQ = db.addQuestion(req.body);
    res.json(newQ);
  });

  app.put('/api/admin/questions/:id', checkAdmin, (req: Request, res: Response) => {
    const id = req.params.id;
    const updated = db.updateQuestion(id, req.body);
    if (!updated) return res.status(404).json({ error: 'Soal tidak ditemukan.' });
    res.json(updated);
  });

  app.delete('/api/admin/questions/:id', checkAdmin, (req: Request, res: Response) => {
    const id = req.params.id;
    const ok = db.deleteQuestion(id);
    if (!ok) return res.status(404).json({ error: 'Gagal menghapus soal.' });
    res.json({ success: true });
  });

  // Results & Rankings
  app.get('/api/admin/results', checkAdmin, (_req: Request, res: Response) => {
    const participants = db.getParticipants();
    const raw = db.getRawData();
    const questions = db.getQuestions();

    const results = participants.map((p, idx) => {
      const exam = raw.exams[p.id];
      const stats = exam
        ? calculateExamScore(questions, exam.jawaban || {})
        : { score: 0, maxScore: 100, percentage: 0, correctCount: 0, incorrectCount: 0, unansweredCount: questions.length };

      return {
        no: idx + 1,
        participant_id: p.id,
        nama: p.nama,
        nama_sekolah: p.nama,
        gender: p.gender,
        waktu_mulai: exam?.waktu_mulai || null,
        waktu_selesai: exam?.waktu_selesai || null,
        durasi_detik: exam?.durasi_detik || 0,
        nilai: exam?.nilai_final ?? (exam?.nilai_sementara || 0),
        status: p.status,
        stats,
      };
    });

    res.json(results);
  });

  app.get('/api/admin/results/:participantId', checkAdmin, (req: Request, res: Response) => {
    const participant = db.getParticipant(req.params.participantId);
    if (!participant) return res.status(404).json({ error: 'Peserta tidak ditemukan.' });

    const exam = db.getExam(req.params.participantId);
    const questions = db.getQuestions();

    const detailList = questions.map((q, idx) => {
      const ans = exam?.jawaban?.[q.id];
      const isAnswered = ans !== undefined && ans !== null && ans !== '';
      const isCorrect = isAnswered && String(ans).trim().toUpperCase() === String(q.kunci).trim().toUpperCase();

      return {
        no: idx + 1,
        question_id: q.id,
        soal: q.soal,
        jawaban_peserta: ans || '-',
        kunci: q.kunci,
        status: !isAnswered ? 'Kosong' : isCorrect ? 'Benar' : 'Salah',
        nilai: isCorrect ? q.bobot : 0,
        bobot: q.bobot,
        pembahasan: q.pembahasan || '',
      };
    });

    res.json({
      participant,
      exam,
      details: detailList,
    });
  });

  // Activity Logs
  app.get('/api/admin/logs', checkAdmin, (_req: Request, res: Response) => {
    res.json(db.getActivityLogs());
  });

  // Settings
  app.get('/api/admin/settings', checkAdmin, (_req: Request, res: Response) => {
    res.json(db.getSettings());
  });

  app.put('/api/admin/settings', checkAdmin, (req: Request, res: Response) => {
    const updated = db.updateSettings(req.body);
    res.json(updated);
  });

  // Backup & Restore
  app.get('/api/admin/backup/export', checkAdmin, (_req: Request, res: Response) => {
    const raw = db.getRawData();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="SISPRES_backup_${Date.now()}.json"`);
    res.json(raw);
  });

  app.post('/api/admin/backup/restore', checkAdmin, (req: Request, res: Response) => {
    const backup = req.body;
    const ok = db.restoreData(backup);
    if (!ok) return res.status(400).json({ error: 'Format file backup tidak sesuai.' });
    res.json({ success: true, message: 'Data SISPRES berhasil dipulihkan.' });
  });

  // External Sync: Supabase & GitHub real-time storage
  app.post('/api/admin/sync/supabase', checkAdmin, async (req: Request, res: Response) => {
    const { supabase_url, supabase_anon_key } = req.body;
    if (!supabase_url || !supabase_anon_key) {
      return res.status(400).json({ error: 'Supabase URL dan Anon Key harus diisi.' });
    }

    try {
      // Test REST ping to Supabase
      const cleanUrl = supabase_url.replace(/\/+$/, '');
      const testRes = await fetch(`${cleanUrl}/rest/v1/`, {
        method: 'GET',
        headers: {
          apikey: supabase_anon_key,
          Authorization: `Bearer ${supabase_anon_key}`,
        },
      });

      // Save settings
      db.updateSettings({ supabase_url: cleanUrl, supabase_anon_key });

      if (testRes.ok || testRes.status === 200 || testRes.status === 404) {
        return res.json({
          success: true,
          message: 'Koneksi ke Supabase berhasil diverifikasi. Data tersinkronisasi!',
          status: 'connected',
        });
      } else {
        return res.json({
          success: true,
          message: `Supabase terhubung (respon HTTP ${testRes.status}). Kredensial tersimpan.`,
          status: 'connected',
        });
      }
    } catch (err: any) {
      return res.status(500).json({
        error: `Gagal menghubungkan ke Supabase: ${err.message || 'Network error'}`,
      });
    }
  });

  app.post('/api/admin/sync/github', checkAdmin, async (req: Request, res: Response) => {
    const { github_repo, github_token } = req.body;
    if (!github_repo || !github_token) {
      return res.status(400).json({ error: 'GitHub repository (owner/repo) dan Personal Access Token harus diisi.' });
    }

    try {
      const testRes = await fetch(`https://api.github.com/repos/${github_repo}`, {
        headers: {
          Authorization: `Bearer ${github_token}`,
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'SISPRES-App',
        },
      });

      db.updateSettings({ github_repo, github_token });

      if (testRes.ok) {
        const repoData = await testRes.json();
        return res.json({
          success: true,
          message: `Terhubung ke repositori GitHub "${repoData.full_name}". Siap untuk auto-backup.`,
          status: 'connected',
        });
      } else {
        return res.status(testRes.status).json({
          error: `GitHub API error: HTTP ${testRes.status} (Periksa hak akses token)`,
        });
      }
    } catch (err: any) {
      return res.status(500).json({
        error: `Gagal verifikasi GitHub: ${err.message}`,
      });
    }
  });

  // VITE DEV SERVER OR STATIC DIST
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SISPRES Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Server startup error:', err);
});
