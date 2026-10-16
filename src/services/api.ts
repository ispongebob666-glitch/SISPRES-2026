import { supabase } from './supabaseClient.ts';
import type {
  School,
  Participant,
  Question,
  Exam,
  ActivityLog,
  CompetitionSettings,
  LiveScoreBoard,
  Gender,
} from '../types/index.ts';

const API_BASE = '/api';

export const api = {
  // Public
  async getSchools(): Promise<School[]> {
    const { data, error } = await supabase.from('schools').select('*');
    if (error) throw error;
    return data || [];
  },

  async getPublicParticipants(): Promise<Participant[]> {
    const { data, error } = await supabase.from('participants').select('*');
    if (error) throw error;
    return data || [];
  },

  async getPublicSettings(): Promise<Partial<CompetitionSettings>> {
    const res = await fetch(`${API_BASE}/public/settings`);
    return res.json();
  },

  async getLiveScore(): Promise<LiveScoreBoard> {
    const res = await fetch(`${API_BASE}/live-score`);
    return res.json();
  },

  // Auth
  async login(payload: {
    role: 'ADMIN' | 'PESERTA' | 'LIVE_SCORE';
    username?: string;
    password?: string;
    school_id?: string;
    gender?: Gender;
    participant_id?: string;
  }) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login gagal.');
    return data;
  },

  // Exam (Candidate)
  async getExamSession(participantId: string): Promise<{
    participant: Participant;
    exam: Exam | null;
    settings: any;
    questions: Question[];
    server_time: string;
  }> {
    const res = await fetch(`${API_BASE}/exam/session?participant_id=${encodeURIComponent(participantId)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal memuat sesi lomba.');
    return data;
  },

  async startExam(participantId: string): Promise<{ exam: Exam; participant: Participant }> {
    const res = await fetch(`${API_BASE}/exam/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participant_id: participantId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal memulai lomba.');
    return data;
  },

  async saveAnswer(participantId: string, questionId: string, answer: any) {
    const res = await fetch(`${API_BASE}/exam/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participant_id: participantId, question_id: questionId, answer }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal menyimpan jawaban.');
    return data;
  },

  async recordCheckpoint(participantId: string, answers?: Record<string, any>) {
    const res = await fetch(`${API_BASE}/exam/checkpoint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participant_id: participantId, answers }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal merekam checkpoint.');
    return data;
  },

  async finishExam(participantId: string, reason: 'submit_mandiri' | 'waktu_habis') {
    const res = await fetch(`${API_BASE}/exam/finish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participant_id: participantId, reason }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal mengirim jawaban lomba.');
    return data;
  },

  async logActivity(participantId: string, aktivitas: string) {
    try {
      await fetch(`${API_BASE}/exam/log-activity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participant_id: participantId, aktivitas }),
      });
    } catch {
      // Non-blocking
    }
  },

  // Admin
  async getAdminOverview() {
    const res = await fetch(`${API_BASE}/admin/overview`, {
      headers: { 'x-role': 'ADMIN' },
    });
    return res.json();
  },

  async getParticipants(): Promise<Participant[]> {
    const { data, error } = await supabase.from('participants').select('*');
    if (error) throw error;
    return data || [];
  },

  async createParticipant(p: Partial<Participant>) {
    const { data, error } = await supabase.from('participants').insert(p).select().single();
    if (error) throw error;
    return data;
  },

  async updateParticipant(id: string, p: Partial<Participant>) {
    const { data, error } = await supabase.from('participants').update(p).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  async deleteParticipant(id: string) {
    const { error } = await supabase.from('participants').delete().eq('id', id);
    if (error) throw error;
    return { success: true };
  },

  async resetParticipant(id: string) {
    const res = await fetch(`${API_BASE}/admin/participants/reset/${id}`, {
      method: 'POST',
      headers: { 'x-role': 'ADMIN' },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal mereset peserta.');
    return data;
  },

  async importParticipants(items: any[]) {
    const { data, error } = await supabase.from('participants').insert(items).select();
    if (error) throw error;
    return { addedCount: data?.length || 0, errors: [] };
  },

  async getQuestions(): Promise<Question[]> {
    const res = await fetch(`${API_BASE}/admin/questions`, {
      headers: { 'x-role': 'ADMIN' },
    });
    return res.json();
  },

  async createQuestion(q: Partial<Question>) {
    const res = await fetch(`${API_BASE}/admin/questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-role': 'ADMIN' },
      body: JSON.stringify(q),
    });
    return res.json();
  },

  async updateQuestion(id: string, q: Partial<Question>) {
    const res = await fetch(`${API_BASE}/admin/questions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-role': 'ADMIN' },
      body: JSON.stringify(q),
    });
    return res.json();
  },

  async deleteQuestion(id: string) {
    const res = await fetch(`${API_BASE}/admin/questions/${id}`, {
      method: 'DELETE',
      headers: { 'x-role': 'ADMIN' },
    });
    return res.json();
  },

  async getResults() {
    const res = await fetch(`${API_BASE}/admin/results`, {
      headers: { 'x-role': 'ADMIN' },
    });
    return res.json();
  },

  async getResultDetail(participantId: string) {
    const res = await fetch(`${API_BASE}/admin/results/${participantId}`, {
      headers: { 'x-role': 'ADMIN' },
    });
    return res.json();
  },

  async getActivityLogs(): Promise<ActivityLog[]> {
    const res = await fetch(`${API_BASE}/admin/logs`, {
      headers: { 'x-role': 'ADMIN' },
    });
    return res.json();
  },

  async getSettings(): Promise<CompetitionSettings> {
    const res = await fetch(`${API_BASE}/admin/settings`, {
      headers: { 'x-role': 'ADMIN' },
    });
    return res.json();
  },

  async updateSettings(s: Partial<CompetitionSettings>): Promise<CompetitionSettings> {
    const res = await fetch(`${API_BASE}/admin/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-role': 'ADMIN' },
      body: JSON.stringify(s),
    });
    return res.json();
  },

  async restoreBackup(backupData: any) {
    const res = await fetch(`${API_BASE}/admin/backup/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-role': 'ADMIN' },
      body: JSON.stringify(backupData),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Restore gagal.');
    return data;
  },

  async syncSupabase(url: string, key: string) {
    const res = await fetch(`${API_BASE}/admin/sync/supabase`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-role': 'ADMIN' },
      body: JSON.stringify({ supabase_url: url, supabase_anon_key: key }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal menghubungkan ke Supabase.');
    return data;
  },

  async syncGithub(repo: string, token: string) {
    const res = await fetch(`${API_BASE}/admin/sync/github`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-role': 'ADMIN' },
      body: JSON.stringify({ github_repo: repo, github_token: token }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal sinkronisasi ke GitHub.');
    return data;
  },
};
