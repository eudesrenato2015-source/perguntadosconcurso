// Auto-generated question bank (empty). Import via app.
export type Subject = 'portugues'|'informatica'|'raciocinio_logico'|'direito_administrativo'|'direito_constitucional'|'historia'|'seguranca_organica';
export type ChoiceKey = 'a'|'b'|'c'|'d'|'e';
export type ChoiceMap = Partial<Record<ChoiceKey, string>>;

export type Question = {
  id: string;
  subject: Subject;
  source?: string;
  qnum?: string;
  statement: string;
  choices: ChoiceMap;
  /** answer uses 'a'..'e' (or 'a'/'b' for Certo/Errado), null when unknown */
  answer?: ChoiceKey | null;
};

export const QUESTIONS: Question[] = [];

export const bySubject = (subject: Subject): Question[] => QUESTIONS.filter(q => q.subject === subject);
export const bySource = (source: string): Question[] => QUESTIONS.filter(q => (q.source || '') === source);
export const getById = (id: string): Question | undefined => QUESTIONS.find(q => q.id === id);

export const PACKS: Record<Subject|'todas', Question[]> = {
  portugues: bySubject('portugues'),
  informatica: bySubject('informatica'),
  raciocinio_logico: bySubject('raciocinio_logico'),
  direito_administrativo: bySubject('direito_administrativo'),
  direito_constitucional: bySubject('direito_constitucional'),
  historia: bySubject('historia'),
  seguranca_organica: bySubject('seguranca_organica'),
  todas: QUESTIONS,
};

export default QUESTIONS;
