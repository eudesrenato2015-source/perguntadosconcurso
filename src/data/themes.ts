export type ThemeItem = {
  id: string;
  name: string;
  description: string;
  cost: number;
  accent: string;
};

export const themes: ThemeItem[] = [
  {
    id: "dark",
    name: "Noite Tática",
    description: "Contraste alto e foco no conteúdo.",
    cost: 0,
    accent: "#18d2a3"
  },
  {
    id: "light",
    name: "Dia Claro",
    description: "Leitura leve e fundo claro.",
    cost: 0,
    accent: "#1f7ae0"
  },
  {
    id: "neon",
    name: "Neon Urbano",
    description: "Vibe arcade, brilho e energia.",
    cost: 160,
    accent: "#00f5d4"
  },
  {
    id: "sunset",
    name: "Pôr do Sol",
    description: "Gradientes quentes e destaque suave.",
    cost: 160,
    accent: "#ff8c42"
  },
  {
    id: "oasis",
    name: "Oásis Frio",
    description: "Azuis profundos e calma.",
    cost: 120,
    accent: "#4cc9f0"
  }
];


