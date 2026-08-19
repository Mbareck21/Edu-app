"use client";

import { useEffect, useState } from "react";

import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * "Add to phone". The browser only fires beforeinstallprompt when the app is
 * installable and not already installed, so an installed app simply never
 * gets a prompt to show — no extra check needed.
 */
export default function InstallButton({ className }: { className?: string }) {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPromptEvent);
    };
    const onInstalled = () => {
      setDone(true);
      setPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (done || !prompt) return null;

  return (
    <Button
      variant="secondary"
      color="blue"
      size="md"
      fullWidth
      className={className}
      onClick={async () => {
        await prompt.prompt();
        const choice = await prompt.userChoice;
        if (choice.outcome === "accepted") setDone(true);
        setPrompt(null);
      }}
    >
      <Icon name="install" size={20} />
      Add to phone
    </Button>
  );
}

export { InstallButton };
