export type ThemePreference = "light" | "dark" | "system";

export type TopicStatus = "not_started" | "studying" | "mastered";

export type EnemArea = "linguagens" | "humanas" | "natureza" | "matematica";

export type MockExamMode = "express" | "xray";

export type MockTaggingMode = "topic" | "enem_skill" | "both";

export type QuestionOutcome =
  | "real_correct"
  | "guess_1"
  | "guess_2"
  | "guess_3"
  | "error_gap"
  | "error_attention"
  | "error_other";

export type StudySessionSource = "timer" | "manual";

export interface PriorityWeights {
  real_correct: number;
  error_attention: number;
  guess_1: number;
  guess_2: number;
  guess_3: number;
  error_gap: number;
  error_other: number;
}

export const DEFAULT_PRIORITY_WEIGHTS: PriorityWeights = {
  real_correct: 0,
  error_attention: 0,
  guess_1: 1.5,
  guess_2: 2.5,
  guess_3: 3.5,
  error_gap: 4.0,
  error_other: 1.0,
};

export interface UserProfile {
  id: string;
  app_name: string;
  display_name: string;
  subtitle: string;
  avatar_url: string | null;
  header_url: string | null;
  theme_preference: ThemePreference;
  priority_weights: PriorityWeights;
  decay_half_life_days: number;
  smoothing_c: number;
  daily_goal_minutes: number;
  created_at?: string;
  updated_at?: string;
}

export interface Subject {
  id: string;
  name: string;
  color: string;
  icon_name: string;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface Topic {
  id: string;
  subject_id: string;
  name: string;
  status: TopicStatus;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface Subtopic {
  id: string;
  topic_id: string;
  name: string;
  is_completed: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface EnemSkill {
  id: string;
  area: EnemArea;
  code: string;
  competency: string;
  description: string;
  created_at?: string;
}

export interface ExerciseLog {
  id: string;
  date: string;
  subject_id: string;
  topic_id: string;
  subtopic_id: string | null;
  total_questions: number;
  raw_correct: number;
  guesses_count: number;
  error_gap_count: number;
  error_attention_count: number;
  error_other_count: number;
  notes: string | null;
  created_at?: string;
}

export interface MockExam {
  id: string;
  title: string;
  date: string;
  mode: MockExamMode;
  tagging_mode: MockTaggingMode;
  score_lc: number | null;
  score_ch: number | null;
  score_cn: number | null;
  score_mt: number | null;
  tri_lc: number | null;
  tri_ch: number | null;
  tri_cn: number | null;
  tri_mt: number | null;
  essay_total: number | null;
  essay_c1: number | null;
  essay_c2: number | null;
  essay_c3: number | null;
  essay_c4: number | null;
  essay_c5: number | null;
  notes: string | null;
  created_at?: string;
}

export interface MockQuestion {
  id: string;
  mock_exam_id: string;
  question_number: number;
  area: EnemArea;
  subject_id: string | null;
  topic_id: string | null;
  subtopic_id: string | null;
  enem_skill_id: string | null;
  outcome: QuestionOutcome;
  error_note: string | null;
}

export interface StudySession {
  id: string;
  date: string;
  subject_id: string | null;
  topic_id: string | null;
  duration_minutes: number;
  source: StudySessionSource;
  created_at?: string;
}

export interface WeeklyPlanItem {
  id: string;
  planned_date: string;
  subject_id: string | null;
  topic_id: string | null;
  title: string;
  is_completed: boolean;
  created_at?: string;
}
