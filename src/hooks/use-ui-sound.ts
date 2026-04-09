"use client";

import { useCallback, useRef } from "react";

type SoundType = "pop" | "click" | "success" | "error";

export function useUiSound() {
  const audioCtx = useRef<AudioContext | null>(null);

  const playSynthesizedSound = useCallback((type: SoundType) => {
    // Only play if in browser
    if (typeof window === "undefined") return;

    try {
      if (!audioCtx.current) {
        audioCtx.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      const ctx = audioCtx.current;
      if (ctx.state === "suspended") {
        ctx.resume();
      }

      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      const now = ctx.currentTime;

      switch (type) {
        case "pop":
          // A quick little pop for opening menus
          osc.type = "sine";
          osc.frequency.setValueAtTime(400, now);
          osc.frequency.exponentialRampToValueAtTime(600, now + 0.05);
          gainNode.gain.setValueAtTime(0, now);
          gainNode.gain.linearRampToValueAtTime(0.15, now + 0.02);
          gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
          osc.start(now);
          osc.stop(now + 0.1);
          break;

        case "click":
          // A very short transient click for simple selections
          osc.type = "square";
          osc.frequency.setValueAtTime(150, now);
          gainNode.gain.setValueAtTime(0.05, now);
          gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.02);
          osc.start(now);
          osc.stop(now + 0.02);
          break;

        case "success":
          // Two tones rising
          osc.type = "sine";
          osc.frequency.setValueAtTime(440, now);
          osc.frequency.setValueAtTime(554.37, now + 0.1); // C#
          gainNode.gain.setValueAtTime(0, now);
          gainNode.gain.linearRampToValueAtTime(0.1, now + 0.05);
          gainNode.gain.linearRampToValueAtTime(0.1, now + 0.1);
          gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
          osc.start(now);
          osc.stop(now + 0.3);
          break;

        case "error":
          // A low dull beep
          osc.type = "triangle";
          osc.frequency.setValueAtTime(200, now);
          osc.frequency.linearRampToValueAtTime(180, now + 0.2);
          gainNode.gain.setValueAtTime(0, now);
          gainNode.gain.linearRampToValueAtTime(0.15, now + 0.05);
          gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
          osc.start(now);
          osc.stop(now + 0.2);
          break;
      }
    } catch (err) {
      console.warn("UI Sound failed to play", err);
    }
  }, []);

  return { playSound: playSynthesizedSound };
}
