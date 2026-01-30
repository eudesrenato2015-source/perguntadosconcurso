import { useEffect, useState } from "react";

const KEY = "rota190:sfx";
let ctx: AudioContext | null = null;
let unlocked = false;

function getCtx(){
  if (!ctx && typeof window !== "undefined"){
    const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (AudioCtx) ctx = new AudioCtx();
  }
  return ctx;
}

function playTone(freq: number, duration = 0.12, type: OscillatorType = "sine", gain = 0.05){
  const audio = getCtx();
  if (!audio) return;
  if (audio.state === "suspended"){
    audio.resume().catch(()=>{});
  }
  const osc = audio.createOscillator();
  const amp = audio.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  amp.gain.value = gain;
  osc.connect(amp);
  amp.connect(audio.destination);
  osc.start();
  osc.stop(audio.currentTime + duration);
}

export const sfx = {
  unlock(){
    unlocked = true;
    playTone(440, 0.03, "sine", 0.01);
  },
  spin(){
    if (!unlocked) return;
    playTone(420, 0.2, "triangle", 0.04);
  },
  correct(){
    if (!unlocked) return;
    playTone(520, 0.12, "sine", 0.05);
    playTone(680, 0.12, "sine", 0.04);
  },
  wrong(){
    if (!unlocked) return;
    playTone(180, 0.2, "sawtooth", 0.05);
  },
  crown(){
    if (!unlocked) return;
    playTone(740, 0.12, "triangle", 0.06);
    playTone(980, 0.12, "triangle", 0.05);
  },
  power(){
    if (!unlocked) return;
    playTone(600, 0.08, "square", 0.04);
  }
};

export function useSfxEnabled(){
  const [enabled, setEnabled] = useState(() => {
    const raw = localStorage.getItem(KEY);
    return raw ? raw === "1" : true;
  });

  useEffect(() => {
    localStorage.setItem(KEY, enabled ? "1" : "0");
  }, [enabled]);

  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    if (next) sfx.unlock();
  };

  return { enabled, toggle };
}
