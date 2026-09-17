import tashrifPatterns from "../data/tashrif-patterns.json";
import { analyzeWord, stripDiacritics, type DetectedWord } from "./morphology";

export interface TashrifResult {
  madhi: string;
  mudhari: string;
  masdar: string;
  "isim_fa'il": string;
  "isim_maf'ul": string;
  amr: string;
  nahi: string;
  mudhari_majhul: string;
}

interface TashrifPatternsData {
  tsulatsi_mujarrad: Record<string, TashrifResult>;
  tsulatsi_mazid: Record<string, TashrifResult>;
  "ruba'i": Record<string, TashrifResult>;
}

const patterns = tashrifPatterns as unknown as TashrifPatternsData;

function getPatternGroup(category?: string): keyof TashrifPatternsData | null {
  if (!category) return null;
  if (category === "tsulatsi_mujarrad") return "tsulatsi_mujarrad";
  if (category === "tsulatsi_mazid") return "tsulatsi_mazid";
  if (category === "ruba'i") return "ruba'i";
  return null;
}

export function getTashrif(word: string, detected?: DetectedWord): Partial<TashrifResult> | null {
  const analysis = detected || analyzeWord(word);

  if (analysis.type !== "fi'il") {
    return null;
  }

  const group = getPatternGroup(analysis.category || "tsulatsi_mujarrad");
  if (!group || !analysis.bab) {
    return null;
  }

  const groupPatterns = patterns[group];
  const pattern = groupPatterns[analysis.bab];
  if (!pattern) {
    return null;
  }

  const root = analysis.root;
  if (!root || root.length < 3) {
    return null;
  }

  return applyRootToPattern(root, pattern);
}

function applyRootToPattern(root: string[], pattern: TashrifResult): TashrifResult {
  const [f, a, l] = root;

  return {
    madhi: replacePatternLetters(pattern.madhi, f, a, l),
    mudhari: replacePatternLetters(pattern.mudhari, f, a, l),
    masdar: replacePatternLetters(pattern.masdar, f, a, l),
    "isim_fa'il": replacePatternLetters(pattern["isim_fa'il"], f, a, l),
    "isim_maf'ul": replacePatternLetters(pattern["isim_maf'ul"], f, a, l),
    amr: replacePatternLetters(pattern.amr, f, a, l),
    nahi: replacePatternLetters(pattern.nahi, f, a, l),
    mudhari_majhul: replacePatternLetters(pattern.mudhari_majhul, f, a, l),
  };
}

function replacePatternLetters(template: string, f: string, a: string, l: string): string {
  // Use placeholders to avoid recursive replacement issues
  let result = template
    .replace(/ف/g, "\u0001")
    .replace(/ع/g, "\u0002")
    .replace(/ل/g, "\u0003")
    .replace(/\u0001/g, f)
    .replace(/\u0002/g, a)
    .replace(/\u0003/g, l);

  // Fix accidental replacement of the fixed particle "لَا" in nahi templates
  result = result.replace(/^[\u0600-\u06FF]َا\s+/, "لَا ");

  return result;
}

export function detectFormFromIsim(word: string): Partial<TashrifResult> | null {
  const stripped = stripDiacritics(word);

  if (stripped.startsWith("م") && stripped.length >= 4) {
    const rootCandidates = stripped.slice(1).split("");
    if (rootCandidates.length >= 3) {
      for (const rootLength of [3, 4]) {
        const root = rootCandidates.slice(0, rootLength);
        if (root.length >= 3) {
          for (const group of Object.values(patterns)) {
            for (const pattern of Object.values(group as Record<string, TashrifResult>)) {
              const applied = applyRootToPattern(root, pattern);
              if (
                stripDiacritics(applied["isim_maf'ul"]) === stripped ||
                stripDiacritics(applied["isim_fa'il"]) === stripped
              ) {
                return applied;
              }
            }
          }
        }
      }
    }
  }

  return null;
}
