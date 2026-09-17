import { analyzeWord, stripDiacritics } from "./morphology";

export interface ValidatedAIResponse {
  message: string;
  analysis: Record<string, unknown>;
  tashrif?: Record<string, unknown>;
  isim?: Record<string, unknown>;
}

export function validateAndCorrect(
  aiResponse: ValidatedAIResponse,
  userMessage: string
): ValidatedAIResponse {
  const word = extractArabicWord(userMessage);
  if (!word) return aiResponse;

  const localMatch = analyzeWord(word);

  const result: ValidatedAIResponse = {
    message: aiResponse.message,
    analysis: aiResponse.analysis ? { ...aiResponse.analysis } : {},
  };

  if (aiResponse.tashrif) result.tashrif = { ...aiResponse.tashrif };
  if (aiResponse.isim) result.isim = { ...aiResponse.isim };

  // If local dataset knows this word, override AI's factual fields
  if (localMatch.type !== "unknown" && localMatch.meaning) {
    result.analysis.word = localMatch.word;
    result.analysis.type = localMatch.type;
    result.analysis.category = localMatch.category;
    result.analysis.root = localMatch.root;
    result.analysis.wazan = localMatch.wazan;
    result.analysis.meaning = localMatch.meaning;
    result.analysis.prefix = localMatch.prefix || null;
    result.analysis.suffix = localMatch.suffix || null;
    result.analysis.baseWord = localMatch.baseWord || localMatch.word;

    // Remove incorrect Bab for non-fi'il
    if (localMatch.type !== "fi'il") {
      delete result.analysis.bab;
    } else if (localMatch.bab) {
      result.analysis.bab = localMatch.bab;
    }
  } else {
    // AI-only mode: validate structure
    result.analysis = validateAnalysisStructure(result.analysis, word);
  }

  // Ensure translation is in Indonesian
  result.analysis.translation = ensureIndonesianTranslation(
    (result.analysis.translation as string) || (result.analysis.meaning as string)
  );

  // Clean message from obvious English translations
  result.message = cleanMessageLanguage(result.message);

  return result;
}

function extractArabicWord(text: string): string | null {
  const match = text.match(/[\u0600-\u06FF]{2,}/);
  return match ? match[0] : null;
}

function validateAnalysisStructure(
  analysis: Record<string, unknown>,
  word: string
): Record<string, unknown> {
  const validated = { ...analysis };

  // Ensure word is set
  validated.word = validated.word || word;

  // Bab should not contain Arabic words for isim/harf
  if (validated.type !== "fi'il" && validated.bab) {
    const babStr = String(validated.bab);
    if (/[\u0600-\u06FF]/.test(babStr) && !babStr.includes("-")) {
      delete validated.bab;
    }
  }

  // Root should be array of Arabic letters
  if (validated.root && Array.isArray(validated.root)) {
    validated.root = validated.root.filter(
      (r) => typeof r === "string" && /[\u0600-\u06FF]/.test(r)
    );
  }

  // Wazan should contain ف ع ل pattern or the actual word pattern
  if (validated.wazan && typeof validated.wazan === "string") {
    const w = validated.wazan as string;
    if (/[a-zA-Z]/.test(w) && !/[\u0600-\u06FF]/.test(w)) {
      delete validated.wazan;
    }
  }

  // Meaning should not be purely English if we can help it
  if (validated.meaning && typeof validated.meaning === "string") {
    const meaning = validated.meaning as string;
    if (/^[a-zA-Z\s,]+$/.test(meaning.trim())) {
      validated.meaning = translateCommon(meaning);
    }
  }

  return validated;
}

function ensureIndonesianTranslation(text: string | undefined): string {
  if (!text) return "";
  if (/^[a-zA-Z\s,]+$/.test(text.trim())) {
    return translateCommon(text);
  }
  return text;
}

function cleanMessageLanguage(message: string): string {
  // Replace obvious English-only phrases with Indonesian
  return message
    .replace(/\bConsciousness, awareness, conscience\b/gi, "kesadaran, hati nurani")
    .replace(/\bIt is a\b/gi, "Ini adalah")
    .replace(/\bIt means\b/gi, "Artinya")
    .replace(/\bThis word\b/gi, "Kata ini");
}

function translateCommon(english: string): string {
  const map: Record<string, string> = {
    "consciousness, awareness, conscience": "kesadaran, hati nurani",
    "conscience": "hati nurani",
    "consciousness": "kesadaran",
    "awareness": "kesadaran",
    "pronoun": "kata ganti",
    "pen": "pulpen",
    "house": "rumah",
    "book": "buku",
    "write": "menulis",
    "read": "membaca",
    "go": "pergi",
    "eat": "makan",
    "drink": "minum",
    "sit": "duduk",
    "understand": "mengerti",
    "know": "tahu",
    "hear": "mendengar",
    "see": "melihat",
    "help": "menolong",
    "mercy": "rahmat",
    "guidance": "petunjuk",
    "path": "jalan",
    "worship": "menyembah",
    "slave": "hamba",
    "blessing": "nikmat",
    "faith": "keimanan",
    "work": "bekerja",
    "peace": "kedamaian",
    "disbelief": "kekafiran",
    "world": "dunia",
    "key": "kunci",
    "door": "pintu",
    "light": "cahaya",
  };

  const normalized = english.toLowerCase().trim();
  if (map[normalized]) return map[normalized];

  // Try to map individual words
  const words = normalized.split(/[\s,]+/).filter(Boolean);
  const translated = words.map((w) => map[w] || w);
  return translated.join(" / ");
}
