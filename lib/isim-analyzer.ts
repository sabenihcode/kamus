import isimPatterns from "../data/isim-patterns.json";
import type { DetectedWord } from "./morphology";

export interface IsimForm {
  label: string;
  labelAr: string;
  arabic: string;
  meaning: string;
}

export interface IsimAnalysis {
  word: string;
  type: string;
  typeAr: string;
  description: string;
  root: string[];
  wazan: string;
  meaning: string;
  gender: "Mudzakkar" | "Muannats";
  genderAr: "مذكر" | "مؤنث";
  forms: IsimForm[];
}

interface IsimPatternTypeInfo {
  name: string;
  nameAr: string;
  description: string;
  wazan: string;
  examples: string[];
}

interface IsimPatternsData {
  types: Record<string, IsimPatternTypeInfo>;
  patterns: Record<string, unknown>;
}

const patterns = isimPatterns as unknown as IsimPatternsData;

const MUANNATS_EXCEPTIONS = ["شَمْس", "أَرْض", "سَمَاء", "نَار", "دَار", "نَفْس", "رِجْل", "عَيْن", "يَد"];

export function detectGender(word: string, genderHint?: string): { gender: "Mudzakkar" | "Muannats"; genderAr: "مذكر" | "مؤنث" } {
  const stripped = word.replace(/[\u064B-\u065F\u0670\u0640]/g, "");

  if (genderHint) {
    if (genderHint === "muannats") return { gender: "Muannats", genderAr: "مؤنث" };
    if (genderHint === "mudzakkar") return { gender: "Mudzakkar", genderAr: "مذكر" };
  }

  // Ta marbuta usually indicates feminine
  if (stripped.endsWith("ة")) {
    return { gender: "Muannats", genderAr: "مؤنث" };
  }

  // Some common feminine exceptions
  const base = stripped.replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي");
  for (const exc of MUANNATS_EXCEPTIONS) {
    if (base.includes(exc)) {
      return { gender: "Muannats", genderAr: "مؤنث" };
    }
  }

  return { gender: "Mudzakkar", genderAr: "مذكر" };
}

export function getTypeInfo(category?: string): IsimPatternTypeInfo | null {
  if (!category) return null;
  const key = category.replace(/isim_/g, "").replace(/'/g, "'");
  return patterns.types[category] || patterns.types[key] || null;
}

export function generateForms(word: string, detected: DetectedWord): IsimForm[] {
  const stripped = word.replace(/[\u064B-\u065F\u0670\u0640]/g, "");
  const { gender } = detectGender(word, detected.category === "muannats" ? "muannats" : undefined);
  const isMuannats = gender === "Muannats";
  const base = detected.baseWord || stripped;
  const forms: IsimForm[] = [];

  // Mufrad - singular
  forms.push({
    label: "Mufrad",
    labelAr: "مفرد",
    arabic: base,
    meaning: "Tunggal",
  });

  // Mutsanna - dual
  if (isMuannats && base.endsWith("ة")) {
    forms.push({
      label: "Mutsanna",
      labelAr: "مثنى",
      arabic: base.slice(0, -1) + "تَانِ",
      meaning: "Dua (muannats)",
    });
  } else {
    forms.push({
      label: "Mutsanna",
      labelAr: "مثنى",
      arabic: base + "َانِ",
      meaning: "Dua",
    });
  }

  // Jamak - plural
  if (detected.category && (detected.category as string).includes("jamid") && "plural" in detected && detected.plural) {
    forms.push({
      label: "Jamak",
      labelAr: "جمع",
      arabic: detected.plural as string,
      meaning: "Banyak",
    });
  } else if (detected.plural) {
    forms.push({
      label: "Jamak",
      labelAr: "جمع",
      arabic: detected.plural,
      meaning: "Banyak",
    });
  } else {
    // Auto-generate fallback plural
    if (isMuannats && base.endsWith("ة")) {
      forms.push({
        label: "Jamak",
        labelAr: "جمع",
        arabic: base.slice(0, -1) + "اتٌ",
        meaning: "Banyak (muannats)",
      });
    } else {
      forms.push({
        label: "Jamak",
        labelAr: "جمع",
        arabic: base + "ُونَ",
        meaning: "Banyak (mudzakkar)",
      });
    }
  }

  return forms;
}

export function analyzeIsim(detected: DetectedWord): IsimAnalysis {
  const typeInfo = getTypeInfo(detected.category) || {
    name: "Isim",
    nameAr: "اسم",
    description: "Kata benda",
    wazan: detected.wazan || "—",
    examples: [],
  };

  const { gender, genderAr } = detectGender(detected.word, detected.category === "muannats" ? "muannats" : undefined);

  return {
    word: detected.word,
    type: typeInfo.name,
    typeAr: typeInfo.nameAr,
    description: typeInfo.description,
    root: detected.root || [],
    wazan: detected.wazan || typeInfo.wazan || "—",
    meaning: detected.meaning || "—",
    gender,
    genderAr,
    forms: generateForms(detected.word, detected),
  };
}
