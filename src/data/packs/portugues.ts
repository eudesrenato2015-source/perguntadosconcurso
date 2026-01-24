import type { QuestionPack } from "../../types";
import { seedQuestions } from "../seedQuestions";

export const portuguesPack: QuestionPack = {
  id: "pack-pt-base",
  name: "Português - Base",
  discipline: "Português",
  questions: seedQuestions.filter(q => q.discipline === "Português")
};
