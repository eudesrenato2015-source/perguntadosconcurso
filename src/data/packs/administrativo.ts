import type { QuestionPack } from "../../types";
import { seedQuestions } from "../seedQuestions";

export const administrativoPack: QuestionPack = {
  id: "pack-adm-base",
  name: "Administrativo - Base",
  discipline: "Administrativo",
  questions: seedQuestions.filter(q => q.discipline === "Administrativo")
};
