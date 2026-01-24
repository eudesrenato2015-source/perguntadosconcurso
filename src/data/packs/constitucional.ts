import type { QuestionPack } from "../../types";
import { seedQuestions } from "../seedQuestions";

export const constitucionalPack: QuestionPack = {
  id: "pack-const-base",
  name: "Constitucional - Base",
  discipline: "Constitucional",
  questions: seedQuestions.filter(q => q.discipline === "Constitucional")
};
