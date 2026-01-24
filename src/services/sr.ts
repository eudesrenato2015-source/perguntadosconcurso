import type { SRItem } from "../types";

type SRInput = { isCorrect: boolean; confidence?: 1|2|3|4|5 };

function qualityFrom({ isCorrect, confidence }: SRInput): number{
  if (!isCorrect){
    if (!confidence) return 1;
    return Math.max(0, 3 - confidence);
  }
  if (!confidence) return 4;
  return Math.min(5, Math.max(3, confidence + 1));
}

export function updateSR(prev: SRItem | null, input: SRInput): SRItem{
  const now = Date.now();
  const quality = qualityFrom(input);
  let ef = prev?.easeFactor ?? 2.5;
  let repetition = prev?.repetition ?? 0;
  let interval = prev?.intervalDays ?? 0;

  if (quality < 3){
    repetition = 0;
    interval = 1;
  } else {
    if (repetition === 0) interval = 1;
    else if (repetition === 1) interval = 6;
    else interval = Math.min(180, Math.round(interval * ef));
    repetition += 1;
  }

  ef = Math.max(1.3, ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));

  return {
    questionId: prev?.questionId ?? "",
    intervalDays: interval,
    easeFactor: Number(ef.toFixed(2)),
    repetition,
    nextReviewAt: now + interval * 86400000,
    lastResult: input.isCorrect ? "correct" : "wrong",
    updatedAt: now
  };
}
