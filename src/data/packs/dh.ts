import type { QuestionPack } from "../../types";
import { seedQuestions } from "../seedQuestions";

export const dhPack: QuestionPack = {
  id: "pack-dh-base",
  name: "Segurança Orgânica - Base",
  discipline: "Segurança Orgânica",
  questions: seedQuestions.filter(q => q.discipline === "Segurança Orgânica")
};
