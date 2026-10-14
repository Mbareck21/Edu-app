// When the online voice fails, the phone's own voice reads the text: on
// 2026-10-13 the free voice service moved and every sentence went silent.

import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";

import { playTextThroughTTS } from "@/lib/voice";

type FakeUtterance = {
  text: string;
  lang: string;
  rate: number;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};

let spoken: FakeUtterance[] = [];
let cancels = 0;
/** What the fake phone voice does with an utterance. */
let behaviour: "speak" | "never-start" = "speak";
/** What the fake online voice does. */
let online: "fails" | "plays" = "fails";

class FakeAudio {
  src = "";
  preload = "";
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  play() {
    if (online === "fails") queueMicrotask(() => this.onerror?.());
    else queueMicrotask(() => this.onended?.());
    return Promise.resolve();
  }
  pause() {}
  load() {}
  removeAttribute() {}
}

class FakeUtteranceClass implements FakeUtterance {
  lang = "";
  rate = 1;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;
  constructor(public text: string) {}
}

const synth = {
  speak(u: FakeUtterance) {
    spoken.push(u);
    if (behaviour === "speak") {
      queueMicrotask(() => {
        u.onstart?.();
        u.onend?.();
      });
    }
  },
  cancel() {
    cancels++;
  },
  pause() {},
  resume() {},
};

const g = globalThis as Record<string, unknown>;

beforeEach(() => {
  spoken = [];
  cancels = 0;
  behaviour = "speak";
  online = "fails";
  g.window = globalThis;
  g.Audio = FakeAudio;
  g.SpeechSynthesisUtterance = FakeUtteranceClass;
  g.speechSynthesis = synth;
});

afterEach(() => {
  for (const k of ["window", "Audio", "SpeechSynthesisUtterance", "speechSynthesis"]) delete g[k];
  mock.timers.reset();
});

test("the online voice fails: the phone's own voice reads the same sentence", async () => {
  const end = await playTextThroughTTS("The frog jumped into the pond.").promise;
  assert.equal(end, "ended");
  assert.equal(spoken.length, 1);
  assert.equal(spoken[0].text, "The frog jumped into the pond.");
  assert.equal(spoken[0].lang, "en-US");
});

test("the online voice plays: the phone's voice stays quiet", async () => {
  online = "plays";
  const end = await playTextThroughTTS("Hello").promise;
  assert.equal(end, "ended");
  assert.equal(spoken.length, 0);
});

test("Arabic is read with an Arabic voice", async () => {
  await playTextThroughTTS("شجاع").promise;
  assert.equal(spoken[0].lang, "ar");
});

test("no voice on the phone either: it is a failure, so the screen can say so", async () => {
  delete g.speechSynthesis;
  const end = await playTextThroughTTS("Hello").promise;
  assert.equal(end, "failed");
});

test("a phone that never starts speaking gives up instead of waiting forever", async () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  behaviour = "never-start";
  const pb = playTextThroughTTS("Hello");
  // Let the online failure land and the phone's voice be asked.
  await new Promise<void>((r) => queueMicrotask(r));
  await new Promise<void>((r) => queueMicrotask(r));
  assert.equal(spoken.length, 1);
  mock.timers.tick(3000);
  assert.equal(await pb.promise, "failed");
});

test("cancel stops the phone's voice too", async () => {
  behaviour = "never-start";
  const pb = playTextThroughTTS("Hello");
  await new Promise<void>((r) => queueMicrotask(r));
  await new Promise<void>((r) => queueMicrotask(r));
  const before = cancels;
  pb.cancel();
  assert.ok(cancels > before);
});
