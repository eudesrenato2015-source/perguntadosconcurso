import type { QuestionPack } from "../../types";
import { seedQuestions } from "../seedQuestions";

export const dhPack: QuestionPack = {
  id: "pack-dh-base",
  name: "DH/Criminologia - Base",
  discipline: "DH/Criminologia",
  questions: seedQuestions.filter(q => q.discipline === "DH/Criminologia")
};
