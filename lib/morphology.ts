import dictionaryJson from "../data/dictionary.json";
import particlesJson from "../data/particles.json";
import isimPatternsJson from "../data/isim-patterns.json";
import babPatternsJson from "../data/bab-patterns.json";
import rootsJson from "../data/roots.json";

export type ArabicWordType = "fi'il" | "isim" | "harf" | "unknown";

export interface DetectedWord {
  word: string;
  normalized: string;
  type: ArabicWordType;
  root?: string[];
  bab?: string;
  wazan?: string;
  meaning?: string;
  category?: string;
  tags?: string[];
  plural?: string;
  gender?: string;
  prefix?: string;
  suffix?: string;
  baseWord?: string;
}

interface DictionaryEntry {
  type: string;
  root?: string[];
  bab?: string;
  wazan?: string;
  meaning?: string;
  category?: string;
  tags?: string[];
  plural?: string;
  gender?: string;
}

interface DictionaryData {
  entries: Record<string, DictionaryEntry>;
}

interface ParticleEntry {
  type: string;
  name?: string;
  meaning?: string;
  category?: string;
  usage?: string;
}

interface ParticlesData {
  particles: Record<string, ParticleEntry>;
}

interface IsimPatternInfo {
  pattern: string;
  type: string;
  meaning: string;
  example: string;
}

interface IsimPatternsData {
  types: Record<string, unknown>;
  patterns: Record<string, IsimPatternInfo>;
}

interface RootsData {
  roots: Record<string, { letters: string[]; core_meaning: string; common_words: string[] }>;
}

const dictionary = dictionaryJson as unknown as DictionaryData;
const particles = particlesJson as unknown as ParticlesData;
const isimPatterns = isimPatternsJson as unknown as IsimPatternsData;
const babPatterns = babPatternsJson as Record<string, Record<string, unknown>>;
const rootsData = rootsJson as unknown as RootsData;

const ARABIC_DIACRITICS = /[\u064B-\u065F\u0670\u0640]/g;
const ALIF_VARIANTS = /[أإآٱ]/g;
const TA_MARBUTA = /ة$/;

// Prefixes commonly attached to Arabic words in classical texts
const PREFIXES = [
  "ال",
  "و",
  "ف",
  "ب",
  "ك",
  "ل",
  "أ",
  "س",
  "ي",
  "ت",
  "ن",
  "لل",
  "وال",
  "فال",
  "بال",
  "كال",
  "ول",
];

// Suffixes (attached pronouns / plurals / cases)
const SUFFIXES = [
  "ها",
  "هم",
  "هن",
  "كم",
  "كن",
  "ني",
  "نا",
  "ه",
  "ك",
  "ي",
  "وا",
  "ات",
  "اتٌ",
  "اتٍ",
  "ون",
  "ين",
  "ان",
  "تان",
  "تا",
  "ة",
  "تاً",
];

export function normalizeArabic(text: string): string {
  return text
    .replace(ALIF_VARIANTS, "ا")
    .replace(ARABIC_DIACRITICS, "")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .trim();
}

export function stripDiacritics(text: string): string {
  return text.replace(ARABIC_DIACRITICS, "").trim();
}

export function isArabicWord(word: string): boolean {
  return /[\u0600-\u06FF]/.test(word);
}

export function extractArabicWords(text: string): string[] {
  return text
    .split(/\s+/)
    .map((w) => w.replace(/^[^\u0600-\u06FF]+|[^\u0600-\u06FF]+$/g, ""))
    .filter((w) => w.length > 0 && isArabicWord(w));
}

function entryToDetected(word: string, entry: DictionaryEntry | ParticleEntry): DetectedWord {
  const type =
    entry.type === "fi'il"
      ? "fi'il"
      : entry.type === "isim" || entry.type === "ism"
      ? "isim"
      : entry.type === "harf"
      ? "harf"
      : "unknown";

  return {
    word,
    normalized: stripDiacritics(word),
    type,
    root: "root" in entry ? entry.root : undefined,
    bab: "bab" in entry ? entry.bab : undefined,
    wazan: "wazan" in entry ? entry.wazan : undefined,
    meaning: entry.meaning,
    category: entry.category,
    tags: "tags" in entry ? entry.tags : undefined,
    plural: "plural" in entry ? entry.plural : undefined,
    gender: "gender" in entry ? entry.gender : undefined,
  };
}

function exactDictionaryMatch(word: string): DetectedWord | null {
  if (dictionary.entries[word]) {
    return entryToDetected(word, dictionary.entries[word]);
  }
  return null;
}

function fuzzyDictionaryMatch(word: string): DetectedWord | null {
  const normalized = normalizeArabic(word);
  const stripped = stripDiacritics(word);

  for (const [key, value] of Object.entries(dictionary.entries)) {
    if (normalizeArabic(key) === normalized || stripDiacritics(key) === stripped) {
      return entryToDetected(word, value);
    }
  }

  return null;
}

function particleMatch(word: string): DetectedWord | null {
  if (particles.particles[word]) {
    return entryToDetected(word, particles.particles[word]);
  }

  const normalized = normalizeArabic(word);
  const stripped = stripDiacritics(word);

  for (const [key, value] of Object.entries(particles.particles)) {
    if (normalizeArabic(key) === normalized || stripDiacritics(key) === stripped) {
      return entryToDetected(word, value);
    }
  }

  return null;
}

function preprocessVariants(word: string): string[] {
  const variants = [word];
  const stripped = stripDiacritics(word);

  // Common OCR/typo: "لال" at start often should be "لل"
  if (stripped.startsWith("لال") && stripped.length > 3) {
    variants.push("لل" + stripped.slice(3));
  }

  return [...new Set(variants)];
}

export function deconjugateWord(word: string): { base: string; prefix: string; suffix: string }[] {
  const results: { base: string; prefix: string; suffix: string }[] = [];
  const seen = new Set<string>();

  function add(base: string, prefix: string, suffix: string) {
    const key = `${base}|${prefix}|${suffix}`;
    if (seen.has(key)) return;
    seen.add(key);
    results.push({ base, prefix, suffix });
  }

  function recurse(current: string, prefixAccum: string, suffixAccum: string) {
    const stripped = stripDiacritics(current);
    add(stripped, prefixAccum, suffixAccum);

    // Try stripping prefixes recursively
    for (const prefix of PREFIXES) {
      const prefixStripped = stripDiacritics(prefix);
      if (stripped.startsWith(prefixStripped) && stripped.length > prefixStripped.length + 1) {
        const base = stripped.slice(prefixStripped.length);
        recurse(base, prefixAccum + prefixStripped, suffixAccum);
      }
    }

    // Try stripping suffixes
    for (const suffix of SUFFIXES) {
      const suffixStripped = stripDiacritics(suffix);
      if (
        stripped.endsWith(suffixStripped) &&
        stripped.length > suffixStripped.length + 1
      ) {
        const base = stripped.slice(0, stripped.length - suffixStripped.length);
        add(base, prefixAccum, suffixAccum + suffixStripped);

        // Also try stripping prefixes from the suffix-stripped form
        for (const prefix of PREFIXES) {
          const prefixStripped2 = stripDiacritics(prefix);
          if (base.startsWith(prefixStripped2) && base.length > prefixStripped2.length + 1) {
            recurse(base.slice(prefixStripped2.length), prefixAccum + prefixStripped2, suffixAccum + suffixStripped);
          }
        }
      }
    }

    // Handle ta marbuta variants
    if (TA_MARBUTA.test(stripped)) {
      add(stripped.replace(/ة$/, "ه"), prefixAccum, suffixAccum);
      add(stripped.replace(/ة$/, "ت"), prefixAccum, suffixAccum);
    }
  }

  recurse(word, "", "");

  // Sort by shortest base (prefer simpler/more likely base forms)
  return results.sort((a, b) => a.base.length - b.base.length);
}

export function lookupDictionary(word: string): DetectedWord | null {
  // Exact match
  const exact = exactDictionaryMatch(word);
  if (exact) return exact;

  // Particle match
  const particle = particleMatch(word);
  if (particle) return particle;

  // Fuzzy match (diacritics/normalization)
  const fuzzy = fuzzyDictionaryMatch(word);
  if (fuzzy) return fuzzy;

  // Try variants (e.g. OCR typos like لال -> لل)
  for (const variant of preprocessVariants(word)) {
    const variantMatch = exactDictionaryMatch(variant) || fuzzyDictionaryMatch(variant);
    if (variantMatch) return { ...variantMatch, word };
  }

  // Deconjugate and try to find base form
  const deconjugations = deconjugateWord(word);
  for (const { base, prefix, suffix } of deconjugations) {
    const baseMatch = exactDictionaryMatch(base) || fuzzyDictionaryMatch(base);
    if (baseMatch) {
      return {
        ...baseMatch,
        word,
        normalized: stripDiacritics(word),
        prefix,
        suffix,
        baseWord: baseMatch.word,
        meaning: baseMatch.meaning
          ? `${baseMatch.meaning}${prefix ? ` (dengan awalan ${prefix})` : ""}${suffix ? ` (dengan akhiran ${suffix})` : ""}`
          : undefined,
      };
    }
  }

  return null;
}

function findRootBySubstring(word: string): { letters: string[]; core_meaning: string } | null {
  const stripped = stripDiacritics(word);
  for (const value of Object.values(rootsData.roots)) {
    const rootStr = value.letters.join("");
    if (stripped.includes(rootStr)) {
      return { letters: value.letters, core_meaning: value.core_meaning };
    }
  }
  return null;
}

function findRootBySequence(word: string): { letters: string[]; core_meaning: string } | null {
  const stripped = stripDiacritics(word);
  let best: { letters: string[]; core_meaning: string; matched: number } | null = null;

  for (const value of Object.values(rootsData.roots)) {
    const letters = value.letters;
    let pos = 0;
    let matched = 0;
    for (const letter of letters) {
      const idx = stripped.indexOf(letter, pos);
      if (idx === -1) break;
      pos = idx + 1;
      matched++;
    }
    if (matched >= 2 && (!best || matched > best.matched)) {
      best = { letters, core_meaning: value.core_meaning, matched };
    }
  }

  return best ? { letters: best.letters, core_meaning: best.core_meaning } : null;
}

function extractRoot(word: string): string[] | undefined {
  const root = findRootBySubstring(word) || findRootBySequence(word);
  if (root) return root.letters;

  const stripped = stripDiacritics(word);
  // Heuristic: remove common non-root letters and take first 3 consonants
  const consonants = stripped.replace(/[اوي]/g, "").replace(/[اأإآ]/g, "ا").split("");
  if (consonants.length >= 3) {
    return consonants.slice(0, 3);
  }
  return undefined;
}

export function detectIsimPattern(word: string): DetectedWord | null {
  const stripped = stripDiacritics(word);
  const root = extractRoot(word);

  // مفعول / مفعل / مفعلة
  if (stripped.startsWith("م") && stripped.length >= 4) {
    const rest = stripped.slice(1);
    const letters = rest.replace(/[اوي]/g, "").split("");
    if (letters.length >= 3) {
      return {
        word,
        normalized: stripped,
        type: "isim",
        root,
        wazan: "مَفْعُولٌ / مَفْعَلَةٌ",
        meaning: "bentuk isim (kemungkinan isim maf'ul/makan)",
        category: "isim_maf'ul_or_makan",
      };
    }
  }

  // فاعل (active participle)
  if (/^ف/.test(stripped) && stripped.length >= 4) {
    return {
      word,
      normalized: stripped,
      type: "isim",
      root,
      wazan: "فَاعِلٌ",
      meaning: "bentuk isim fa'il (pelaku)",
      category: "isim_fa'il",
    };
  }

  // مفاعلة / تفعيل etc. (mazid masdar patterns)
  const masdarPatterns = ["تفعيل", "تفعيلة", "مفاعلة", "تفعل", "افتعال", "انفعال", "استفعال"];
  for (const pattern of masdarPatterns) {
    const patternCore = pattern.replace(/ف|ع|ل/g, "");
    if (stripped.includes(patternCore)) {
      return {
        word,
        normalized: stripped,
        type: "isim",
        root,
        wazan: pattern,
        meaning: "bentuk masdar atau isim derivatif",
        category: "masdar",
      };
    }
  }

  return null;
}

export function analyzeWord(word: string): DetectedWord {
  const dictionaryMatch = lookupDictionary(word);
  if (dictionaryMatch) {
    return dictionaryMatch;
  }

  const isimMatch = detectIsimPattern(word);
  if (isimMatch) {
    return isimMatch;
  }

  // Try to find root by matching common roots
  const root = findRootBySubstring(word) || findRootBySequence(word);
  if (root) {
    return {
      word,
      normalized: stripDiacritics(word),
      type: "unknown",
      root: root.letters,
      meaning: `kemungkinan berakar ${root.letters.join(" ")}: ${root.core_meaning}`,
    };
  }

  return {
    word,
    normalized: stripDiacritics(word),
    type: "unknown",
  };
}

export function getBabPattern(babName: string): unknown {
  for (const group of Object.values(babPatterns)) {
    if (group[babName]) {
      return group[babName];
    }
  }
  return null;
}

export function getAllBabPatterns(): Record<string, Record<string, unknown>> {
  return babPatterns;
}

export function stripPrefixes(word: string): { word: string; prefix: string } {
  const stripped = stripDiacritics(word);
  for (const prefix of ["ال", "و", "ف", "ب", "ك", "ل"]) {
    if (stripped.startsWith(prefix) && stripped.length > prefix.length + 1) {
      return { word: stripped.slice(prefix.length), prefix };
    }
  }
  return { word, prefix: "" };
}
