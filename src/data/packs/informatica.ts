import type { QuestionPack } from "../../types";
import { seedQuestions } from "../seedQuestions";

export const informaticaPack: QuestionPack = {
  id: "pack-ti-base",
  name: "Informática/RLM - Base",
  discipline: "Informática/RLM",
  questions: seedQuestions.filter(q => q.discipline === "Informática/RLM")
};
