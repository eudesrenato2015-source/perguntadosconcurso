import type { QuestionPack } from "../../types";
import { seedQuestions } from "../seedQuestions";

export const historiaPack: QuestionPack = {
  id: "pack-hist-base",
  name: "História - Base",
  discipline: "História",
  questions: seedQuestions.filter(q => q.discipline === "História")
};
