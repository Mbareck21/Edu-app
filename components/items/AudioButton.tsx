"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import Icon from "@/components/ui/Icon";
import { tone, type AccentColor } from "@/components/ui/colors";
import { playTextThroughTTS, type Playback } from "@/lib/voice";

export type AudioButtonProps = {
  /** What the voice says. */
  text: string;
  /** Play once as soon as the item appears. */
  autoPlay?: boolean;
  size?: number;
  color?: AccentColor;
  label?: string;
  className?: string;
};

/**
 * Big round speaker. Every listen item and every learn card has one, and the
 * tap target never drops below 56px.
 */
export default function AudioButton({
  text,
  autoPlay = false,
  size = 72,
  color = "blue",
  label = "Play the word",
  className = "",
}: AudioButtonProps) {
  const playback = useRef<Playback | null>(null);
  const [failed, setFailed] = useState(false);
  const t = tone(color);

  const play = useCallback(() => {
    if (!text.trim()) return;
    playback.current?.cancel();
    // The TTS service sits behind a network call, so one blip is worth a
    // silent second try before we tell him the sound is broken.
    const attempt = (retriesLeft: number) => {
      const pb = playTextThroughTTS(text);
      playback.current = pb;
      void pb.promise.then((end) => {
        if (end !== "failed" || playback.current !== pb) return;
        if (retriesLeft > 0) attempt(retriesLeft - 1);
        else setFailed(true);
      });
    };
    attempt(1);
  }, [text]);

  const tap = useCallback(() => {
    setFailed(false);
    play();
  }, [play]);

  useEffect(() => {
    if (autoPlay) play();
    return () => {
      playback.current?.cancel();
      playback.current = null;
    };
  }, [autoPlay, play]);

  return (
    <button
      type="button"
      onClick={tap}
      aria-label={failed ? "The sound did not play. Tap to try again." : label}
      className={`btn-3d btn-3d-lg press-3d inline-flex items-center justify-center rounded-full ${className}`}
      style={{
        width: size,
        height: size,
        minWidth: 56,
        minHeight: 56,
        background: failed ? "var(--color-coral)" : t.base,
        color: failed ? "#fff" : t.on,
        ["--btn-shade" as string]: failed ? "var(--color-coral-dark)" : t.dark,
      }}
    >
      <Icon name="volume" size={Math.round(size * 0.42)} strokeWidth={2.6} />
    </button>
  );
}

export { AudioButton };
