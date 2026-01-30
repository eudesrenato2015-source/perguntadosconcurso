export type Discipline =
  | "Português"
  | "Constitucional"
  | "Administrativo"
  | "Penal/Proc Penal"
  | "DH/Criminologia"
  | "Informática/RLM"
  | "Segurança Orgânica"
  | "História";

export type PackDiscipline = Discipline | "Misto";

export type ExamStyle =
  | "CEBRASPE"
  | "CESPE"
  | "FGV"
  | "VUNESP"
  | "FCC"
  | "IBFC"
  | "QUADRIX"
  | "AOCP";

export type QType = "MCQ" | "TF";

export type Question = {
  id: string;
  discipline: Discipline;
  subject: string;
  topic: string;
  difficulty: 1|2|3|4|5;
  type: QType;
  style?: ExamStyle;
  statement: string;
  options: { key: "A"|"B"|"C"|"D"|"E"; text: string }[];
  correctKey: "A"|"B"|"C"|"D"|"E";
  explanation: {
    summary: string;
    whyCorrect: string;
    whyWrong: Partial<Record<"A"|"B"|"C"|"D"|"E", string>>;
    tips: string[];
  };
};

export type QuestionPack = {
  id: string;
  name: string;
  discipline: PackDiscipline;
  questions: Question[];
};

export type RunMode = "arena"|"daily"|"review"|"library"|"duel"|"dashboard"|"import";

export type RunSession = {
  id: string;
  mode: RunMode;
  createdAt: number;
  queue: string[];
  index: number;
  seed: { discipline?: Discipline; label?: string };
  meta?: Record<string, unknown>;
};

export type Attempt = {
  id: string;
  questionId: string;
  createdAt: number;
  mode: RunMode;
  selectedKey: string;
  isCorrect: boolean;
  timeSpentMs: number;
  markedForReview: boolean;
  flagged: boolean;
  confidence?: 1|2|3|4|5;
};

export type SRItem = {
  questionId: string;
  intervalDays: number;
  easeFactor: number;
  repetition?: number;
  nextReviewAt: number;
  lastResult: "correct"|"wrong";
  updatedAt: number;
};

export type Notebook = { id: string; name: string; createdAt: number; questionIds: string[] };
export type Note = { id: string; questionId: string; text: string; createdAt: number; updatedAt: number };
