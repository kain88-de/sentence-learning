const DEFAULT_RATE = 0.65;

export function createSpeechController({ onVoices, onBoundary, onStart, onEnd }) {
  let voices = [];
  let activeUtterance = null;

  function readVoices() {
    const availableVoices = window.speechSynthesis
      .getVoices()
      .filter((voice) => voice.lang.toLowerCase().startsWith("de"))
      .sort((left, right) => left.name.localeCompare(right.name, "de"));

    voices = availableVoices;
    onVoices?.(voices);
  }

  readVoices();
  window.speechSynthesis.onvoiceschanged = readVoices;

  function stop() {
    window.speechSynthesis.cancel();
    activeUtterance = null;
    onEnd?.();
  }

  function speak({ text, voiceName, rate = DEFAULT_RATE }) {
    stop();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "de-DE";
    utterance.rate = Number(rate);
    utterance.pitch = 1;

    if (voiceName) {
      utterance.voice = voices.find((voice) => voice.name === voiceName) ?? null;
    }

    utterance.onstart = () => {
      activeUtterance = utterance;
      onStart?.();
    };

    utterance.onend = () => {
      activeUtterance = null;
      onEnd?.();
    };

    utterance.onerror = () => {
      activeUtterance = null;
      onEnd?.();
    };

    utterance.onboundary = (event) => {
      if (event.name === "word" || event.charIndex >= 0) {
        onBoundary?.(event.charIndex);
      }
    };

    window.speechSynthesis.speak(utterance);
  }

  return {
    getVoices() {
      return voices;
    },
    isSpeaking() {
      return Boolean(activeUtterance);
    },
    speak,
    stop,
  };
}
