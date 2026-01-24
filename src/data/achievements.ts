import type { PlayerState } from "../services/progress";

type Achievement = {
  id: string;
  title: string;
  description: string;
  isUnlocked: (state: PlayerState) => boolean;
};

export const achievements: Achievement[] = [
  {
    id: "first-run",
    title: "Primeiro passo",
    description: "Faça sua primeira questão.",
    isUnlocked: (s) => s.totalAttempts >= 1
  },
  {
    id: "ten-correct",
    title: "Mira certeira",
    description: "Acerte 10 questões.",
    isUnlocked: (s) => s.totalCorrect >= 10
  },
  {
    id: "fifty-correct",
    title: "Ritmo de prova",
    description: "Acerte 50 questões.",
    isUnlocked: (s) => s.totalCorrect >= 50
  },
  {
    id: "hundred-attempts",
    title: "Maratona",
    description: "Faça 100 tentativas.",
    isUnlocked: (s) => s.totalAttempts >= 100
  },
  {
    id: "streak-7",
    title: "Sequência 7",
    description: "Estude 7 dias seguidos.",
    isUnlocked: (s) => s.streak >= 7
  },
  {
    id: "streak-30",
    title: "Disciplina total",
    description: "Estude 30 dias seguidos.",
    isUnlocked: (s) => s.streak >= 30
  },
  {
    id: "level-5",
    title: "Subindo o morro",
    description: "Alcance o nível 5.",
    isUnlocked: (s) => s.level >= 5
  },
  {
    id: "level-10",
    title: "Elite",
    description: "Alcance o nível 10.",
    isUnlocked: (s) => s.level >= 10
  }
];
