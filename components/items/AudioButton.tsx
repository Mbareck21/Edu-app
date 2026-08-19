"use client";

import { useCallback, useEffect, useRef } from "react";

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
  const t = tone(color);

  const play = useCallback(() => {
    if (!text.trim()) return;
    playback.current?.cancel();
    playback.current = playTextThroughTTS(text);
  }, [text]);

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
      onClick={play}
      aria-label={label}
      className={`btn-3d btn-3d-lg press-3d inline-flex items-center justify-center rounded-full ${className}`}
      style={{
        width: size,
        height: size,
        minWidth: 56,
        minHeight: 56,
        background: t.base,
        color: t.on,
        ["--btn-shade" as string]: t.dark,
      }}
    >
      <Icon name="volume" size={Math.round(size * 0.42)} strokeWidth={2.6} />
    </button>
  );
}

export { AudioButton };
