import {
  analyzeWord,
  extractArabicWords,
  type DetectedWord,
} from "./morphology";
import { getTashrif, type TashrifResult } from "./tashrif";
import { analyzeIsim, type IsimAnalysis } from "./isim-analyzer";

export interface AnalysisResult {
  words: DetectedWord[];
  primaryWord: DetectedWord | null;
  isimAnalysis: IsimAnalysis | null;
  tashrif: Partial<TashrifResult> | null;
  context: {
    isQuestion: boolean;
    asksForTashrif: boolean;
    asksForRoot: boolean;
    asksForWazan: boolean;
    asksForMeaning: boolean;
    asksForSentenceAnalysis: boolean;
    asksForIsimFaIl: boolean;
    asksForIsimMafUl: boolean;
    asksForExplanation: boolean;
    asksForWhy: boolean;
  };
}

const QUESTION_WORDS = [
  "apa",
  "siapa",
  "mengapa",
  "kenapa",
  "bagaimana",
  "berapa",
  "kapan",
  "dimana",
  "di mana",
  "kemana",
  "mana",
  "jelaskan",
  "terangkan",
  "uraikan",
];

const TASHRIF_WORDS = [
  "tashrif",
  "bentuk",
  "madhi",
  "mudhari",
  "masdar",
  "ism fa'il",
  "isim fa'il",
  "ism maf'ul",
  "isim maf'ul",
  "amr",
  "nahi",
  "majhul",
];

const ROOT_WORDS = ["akar", "root", "jizr", "jizrun", "jazr"];
const WAZAN_WORDS = ["wazan", "pola", "pattern"];
const MEANING_WORDS = ["arti", "makna", "artinya", "maksud", "terjemah"];
const SENTENCE_WORDS = ["kalimat", "jumlah", "irab", "i'rab", "analisis kalimat"];
const ISIM_FA_IL_WORDS = ["isim fa'il", "ism fa'il", "fa'il"];
const ISIM_MAF_UL_WORDS = ["isim maf'ul", "ism maf'ul", "maf'ul"];
const EXPLANATION_WORDS = ["jelaskan", "terangkan", "uraikan", "jelas", "penjelasan"];
const WHY_WORDS = ["kenapa", "mengapa", "sebab", "karena"];

function detectContext(message: string) {
  const lower = message.toLowerCase();

  return {
    isQuestion: QUESTION_WORDS.some((w) => lower.includes(w)) || lower.includes("?"),
    asksForTashrif: TASHRIF_WORDS.some((w) => lower.includes(w)),
    asksForRoot: ROOT_WORDS.some((w) => lower.includes(w)),
    asksForWazan: WAZAN_WORDS.some((w) => lower.includes(w)),
    asksForMeaning: MEANING_WORDS.some((w) => lower.includes(w)),
    asksForSentenceAnalysis: SENTENCE_WORDS.some((w) => lower.includes(w)),
    asksForIsimFaIl: ISIM_FA_IL_WORDS.some((w) => lower.includes(w)),
    asksForIsimMafUl: ISIM_MAF_UL_WORDS.some((w) => lower.includes(w)),
    asksForExplanation: EXPLANATION_WORDS.some((w) => lower.includes(w)),
    asksForWhy: WHY_WORDS.some((w) => lower.includes(w)),
  };
}

function determinePrimaryWord(
  words: DetectedWord[],
  context: AnalysisResult["context"]
): DetectedWord | null {
  if (words.length === 0) return null;

  if (context.asksForIsimFaIl || context.asksForIsimMafUl) {
    const isim = words.find((w) => w.type === "isim");
    if (isim) return isim;
  }

  if (context.asksForTashrif || context.asksForRoot || context.asksForWazan) {
    const fiil = words.find((w) => w.type === "fi'il");
    if (fiil) return fiil;
  }

  const known = words.find((w) => w.type !== "unknown");
  if (known) return known;

  return words[0];
}

export function findWordInConversation(
  conversation: Array<{ role: "user" | "assistant"; content: string }>,
  message: string
): DetectedWord | null {
  const current = extractArabicWords(message).map((w) => analyzeWord(w));
  const known = current.find((w) => w.type !== "unknown");
  if (known) return known;

  for (let i = conversation.length - 1; i >= 0; i--) {
    const msg = conversation[i];
    const words = extractArabicWords(msg.content).map((w) => analyzeWord(w));
    const found = words.find((w) => w.type !== "unknown");
    if (found) return found;
  }

  return null;
}

export function analyzeMessage(
  message: string,
  conversation: Array<{ role: "user" | "assistant"; content: string }> = []
): AnalysisResult {
  const arabicWords = extractArabicWords(message);
  const analyzedWords = arabicWords.map((w) => analyzeWord(w));

  const context = detectContext(message);

  let primaryWord = determinePrimaryWord(analyzedWords, context);

  // If no Arabic word in current message, look back in conversation for follow-ups
  if (!primaryWord && conversation.length > 0) {
    primaryWord = findWordInConversation(conversation, message);
  }

  let tashrif: Partial<TashrifResult> | null = null;
  let isimAnalysis: IsimAnalysis | null = null;

  if (primaryWord) {
    if (primaryWord.type === "fi'il") {
      tashrif = getTashrif(primaryWord.word, primaryWord);
    } else if (primaryWord.type === "isim") {
      isimAnalysis = analyzeIsim(primaryWord);
    }
  }

  return {
    words: analyzedWords,
    primaryWord,
    isimAnalysis,
    tashrif,
    context,
  };
}

export function buildDatasetContext(analysis: AnalysisResult): string {
  const lines: string[] = [];

  if (analysis.words.length > 0) {
    lines.push("Analisis kata per kata:");
    for (const w of analysis.words) {
      const prefix = w.prefix ? ` [awalan: ${w.prefix}]` : "";
      const suffix = w.suffix ? ` [akhiran: ${w.suffix}]` : "";
      const base = w.baseWord ? ` (bentuk dasar: ${w.baseWord})` : "";
      lines.push(
        `- ${w.word}${prefix}${suffix}${base}: ${w.type}${w.category ? ` / ${w.category}` : ""}${w.root ? `, akar ${w.root.join(" ")}` : ""}${w.meaning ? ` — ${w.meaning}` : ""}`
      );
    }
  }

  if (analysis.primaryWord) {
    const pw = analysis.primaryWord;
    lines.push("");
    lines.push(`Kata utama: ${pw.word}`);
    if (pw.type) lines.push(`Jenis: ${pw.type}`);
    if (pw.category) lines.push(`Kategori: ${pw.category}`);
    if (pw.root) lines.push(`Akar kata: ${pw.root.join(" ")}`);
    if (pw.bab) lines.push(`Bab: ${pw.bab}`);
    if (pw.wazan) lines.push(`Wazan: ${pw.wazan}`);
    if (pw.meaning) lines.push(`Arti: ${pw.meaning}`);
  }

  if (analysis.isimAnalysis) {
    lines.push("");
    lines.push("Analisis Isim:");
    lines.push(`- Tipe: ${analysis.isimAnalysis.type} (${analysis.isimAnalysis.typeAr})`);
    lines.push(`- Jenis kelamin: ${analysis.isimAnalysis.gender} (${analysis.isimAnalysis.genderAr})`);
    lines.push("- Bentuk-bentuk:");
    for (const form of analysis.isimAnalysis.forms) {
      lines.push(`  * ${form.label} (${form.labelAr}): ${form.arabic} — ${form.meaning}`);
    }
  }

  if (analysis.tashrif) {
    lines.push("");
    lines.push("Tashrif yang tersedia:");
    const t = analysis.tashrif;
    if (t.madhi) lines.push(`- Madhi: ${t.madhi}`);
    if (t.mudhari) lines.push(`- Mudhari': ${t.mudhari}`);
    if (t.masdar) lines.push(`- Masdar: ${t.masdar}`);
    if (t["isim_fa'il"]) lines.push(`- Isim Fa'il: ${t["isim_fa'il"]}`);
    if (t["isim_maf'ul"]) lines.push(`- Isim Maf'ul: ${t["isim_maf'ul"]}`);
    if (t.amr) lines.push(`- Amr: ${t.amr}`);
    if (t.nahi) lines.push(`- Nahi: ${t.nahi}`);
    if (t.mudhari_majhul) lines.push(`- Mudhari' Majhul: ${t.mudhari_majhul}`);
  }

  return lines.length > 0 ? lines.join("\n") : "Tidak ada data Arab yang ditemukan dalam dataset.";
}
