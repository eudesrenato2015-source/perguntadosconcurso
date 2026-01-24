import type { QuestionPack } from "../../types";
import { seedQuestions } from "../seedQuestions";

export const penalPack: QuestionPack = {
  id: "pack-penal-base",
  name: "Penal/Proc Penal - Base",
  discipline: "Penal/Proc Penal",
  questions: seedQuestions.filter(q => q.discipline === "Penal/Proc Penal")
};
