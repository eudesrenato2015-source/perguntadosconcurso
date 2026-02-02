import type { QuestionPack } from "../../types";
import { seedQuestions } from "../seedQuestions";

export const segurancaOrgânicaPack: QuestionPack = {
  id: "pack-seg-organica-base",
  name: "Segurança Orgânica - Base",
  discipline: "Segurança Orgânica",
  questions: seedQuestions.filter(q => q.discipline === "Segurança Orgânica")
};
