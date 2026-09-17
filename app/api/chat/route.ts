import { NextRequest, NextResponse } from "next/server";
import { analyzeMessage, buildDatasetContext } from "@/lib/analyzer";
import { generateCohereResponse } from "@/lib/cohere";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, conversation = [] } = body as {
      message: string;
      conversation: Array<{ role: "user" | "assistant"; content: string }>;
    };

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { success: false, error: "Message is required" },
        { status: 400 }
      );
    }

    const localAnalysis = analyzeMessage(message, conversation);
    const datasetContext = buildDatasetContext(localAnalysis);

    const systemPrompt = buildJsonSystemPrompt(datasetContext, message);

    const messages = [
      ...conversation,
      { role: "user" as const, content: message },
    ];

    let aiResponse: string;
    let parsed: AIParsedResponse | null = null;

    try {
      aiResponse = await generateCohereResponse(systemPrompt, messages);
      parsed = parseAIResponse(aiResponse);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error("Cohere API error:", err.message);
      parsed = buildFallbackFromLocal(localAnalysis, err.message);
      aiResponse = parsed.message;
    }

    // Merge with local analysis if AI returned partial/invalid data
    if (!parsed) {
      parsed = buildFallbackFromLocal(localAnalysis);
    }

    const responsePayload: {
      success: boolean;
      message: string;
      analysis?: Record<string, unknown>;
      tashrif?: Record<string, unknown> | null;
      isim?: Record<string, unknown> | null;
    } = {
      success: true,
      message: parsed.message,
    };

    if (parsed.analysis && Object.keys(parsed.analysis).length > 0) {
      responsePayload.analysis = parsed.analysis;
    }

    if (parsed.tashrif && Object.keys(parsed.tashrif).length > 0) {
      responsePayload.tashrif = parsed.tashrif;
    }

    if (parsed.isim && Object.keys(parsed.isim).length > 0) {
      responsePayload.isim = parsed.isim;
    }

    return NextResponse.json(responsePayload);
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

interface AIParsedResponse {
  message: string;
  analysis?: Record<string, unknown>;
  tashrif?: Record<string, unknown>;
  isim?: Record<string, unknown>;
}

function buildJsonSystemPrompt(datasetContext: string, message: string): string {
  return `Kamu adalah Arabic AI, asisten ahli bahasa Arab. Tugas utama kamu adalah menganalisis kata, frasa, atau kalimat bahasa Arab yang diberikan pengguna dan mengembalikan hasilnya dalam format JSON yang ketat.

ATURAN PENTING:
1. Kamu adalah sumber data utama. Jelaskan morfologi, akar kata, wazan, bab, dan arti berdasarkan pengetahuan bahasa Arab kamu.
2. Jangan mengarang jika kamu tidak yakin. Jika kata tidak dikenal, tetap berikan analisis terbaik dengan catatan "belum pasti" atau katakan tidak tersedia.
3. Untuk fi'il, berikan Tashrif lengkap jika memungkinkan.
4. Untuk isim, berikan tipe isim, gender, dan bentuk-bentuk (mufrad, mutsanna, jamak) jika relevan.
5. Gunakan bahasa Indonesia yang bersih, profesional, tanpa emoji.
6. Respons HARUS berupa JSON valid, tanpa teks di luar JSON, tanpa markdown code block.

Data referensi dari dataset lokal (jika tersedia):
${datasetContext}

Struktur JSON yang harus dikembalikan:

{
  "message": "Penjelasan singkat dalam bahasa Indonesia. Prioritaskan jawaban langsung, gunakan tabel Markdown jika relevan.",
  "analysis": {
    "word": "kata asli tanpa awalan/akhiran",
    "type": "fi'il | isim | harf | unknown",
    "category": "tsulatsi_mujarrad | tsulatsi_mazid | isim_fa'il | isim_maf'ul | masdar | isim_jamid | isim_dhomir | sifat_musyabbahah | dsb.",
    "bab": "contoh: فَعَلَ - يَفْعُلُ",
    "root": ["ح", "ر", "ف"],
    "wazan": "contoh: فَاعِلٌ",
    "meaning": "arti dalam bahasa Indonesia",
    "prefix": "awalan jika ada, contoh: ال atau و",
    "suffix": "akhiran jika ada, contoh: ين atau ات",
    "baseWord": "kata dasar sebelum awalan/akhiran"
  },
  "tashrif": {
    "madhi": "...",
    "mudhari": "...",
    "masdar": "...",
    "isim_fa'il": "...",
    "isim_maf'ul": "...",
    "amr": "...",
    "nahi": "...",
    "mudhari_majhul": "..."
  },
  "isim": {
    "type": "Isim Fa'il",
    "typeAr": "اسم الفاعل",
    "description": "...",
    "root": ["ح", "ر", "ف"],
    "wazan": "فَاعِلٌ",
    "meaning": "...",
    "gender": "Mudzakkar",
    "genderAr": "مذكر",
    "forms": [
      { "label": "Mufrad", "labelAr": "مفرد", "arabic": "...", "meaning": "Tunggal" },
      { "label": "Mutsanna", "labelAr": "مثنى", "arabic": "...", "meaning": "Dua" },
      { "label": "Jamak", "labelAr": "جمع", "arabic": "...", "meaning": "Banyak" }
    ]
  }
}

Catatan:
- "tashrif" hanya untuk fi'il.
- "isim" hanya untuk isim.
- Jika bukan fi'il atau isim, boleh kosongkan field tersebut.
- Jika kata tidak dikenal, analysis.type = "unknown" dan message menjelaskannya.

Pesan pengguna: ${message}`;
}

function parseAIResponse(text: string): AIParsedResponse | null {
  // Remove markdown code block if present
  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned) as AIParsedResponse;
    return {
      message: parsed.message || "",
      analysis: parsed.analysis || {},
      tashrif: parsed.tashrif || {},
      isim: parsed.isim || {},
    };
  } catch (error) {
    console.error("Failed to parse AI response as JSON:", error);
    console.error("Raw response:", text);
    return null;
  }
}

function buildFallbackFromLocal(
  localAnalysis: ReturnType<typeof analyzeMessage>,
  cohereError?: string
): AIParsedResponse {
  const pw = localAnalysis.primaryWord;
  const message = generateFallbackMessage(localAnalysis, cohereError);

  const analysis: Record<string, unknown> = {};
  if (pw) {
    analysis.word = pw.word;
    analysis.type = pw.type;
    analysis.category = pw.category;
    analysis.root = pw.root;
    analysis.wazan = pw.wazan;
    analysis.bab = pw.bab;
    analysis.meaning = pw.meaning;
    analysis.prefix = pw.prefix;
    analysis.suffix = pw.suffix;
    analysis.baseWord = pw.baseWord;
  }

  return {
    message,
    analysis,
    tashrif: localAnalysis.tashrif || {},
    isim: localAnalysis.isimAnalysis
      ? (localAnalysis.isimAnalysis as unknown as Record<string, unknown>)
      : {},
  };
}

function generateFallbackMessage(
  analysis: ReturnType<typeof analyzeMessage>,
  cohereError?: string
): string {
  const pw = analysis.primaryWord;

  if (analysis.words.length > 1) {
    const lines: string[] = [];
    lines.push("### Analisis Kata");
    lines.push("");
    lines.push("| Kata | Kata Asli | Jenis | Analisis | Arti |");
    lines.push("| ---- | --------- | ----- | -------- | ---- |");

    for (const w of analysis.words) {
      const base = w.baseWord || w.word;
      let detail = "";
      if (w.prefix) detail += `awalan ${w.prefix}; `;
      if (w.suffix) detail += `akhiran ${w.suffix}; `;
      if (w.category) detail += `${w.category}`;
      if (w.root) detail += `${detail ? "; " : ""}akar ${w.root.join(" ")}`;

      const meaning = w.meaning || "—";
      lines.push(`| ${w.word} | ${base} | ${w.type} | ${detail || "—"} | ${meaning} |`);
    }

    return lines.join("\n");
  }

  if (!pw) {
    return "Maaf, saya tidak dapat mengenali pesan tersebut. Silakan coba dengan kata atau kalimat bahasa Arab.";
  }

  if (pw.type === "unknown" && !pw.root && !pw.meaning) {
    let msg = `Kata **${pw.word}** belum dapat dianalisis.`;
    if (cohereError) {
      msg += `\n\nCatatan: Cohere AI tidak dapat digunakan (${cohereError}). Respons ini berasal dari fallback dataset.`;
    }
    return msg;
  }

  const lines: string[] = [];
  lines.push(`### ${pw.word}`);
  lines.push("");
  lines.push("| Analisis | Hasil |");
  lines.push("| -------- | ----- |");
  if (pw.type) lines.push(`| Jenis | ${pw.type} |`);
  if (pw.category) lines.push(`| Kategori | ${pw.category} |`);
  if (pw.bab) lines.push(`| Bab | ${pw.bab} |`);
  if (pw.root) lines.push(`| Akar | ${pw.root.join(" ")} |`);
  if (pw.wazan) lines.push(`| Wazan | ${pw.wazan} |`);
  if (pw.meaning) lines.push(`| Arti | ${pw.meaning} |`);
  if (pw.prefix) lines.push(`| Awalan | ${pw.prefix} |`);
  if (pw.suffix) lines.push(`| Akhiran | ${pw.suffix} |`);
  if (pw.baseWord) lines.push(`| Bentuk Dasar | ${pw.baseWord} |`);

  if (analysis.tashrif) {
    lines.push("");
    lines.push("### Tashrif");
    lines.push("");
    lines.push("| Bentuk | Arab |");
    lines.push("| ------ | ---- |");
    const t = analysis.tashrif;
    if (t.madhi) lines.push(`| Madhi | ${t.madhi} |`);
    if (t.mudhari) lines.push(`| Mudhari' | ${t.mudhari} |`);
    if (t.masdar) lines.push(`| Masdar | ${t.masdar} |`);
    if (t["isim_fa'il"]) lines.push(`| Isim Fa'il | ${t["isim_fa'il"]} |`);
    if (t["isim_maf'ul"]) lines.push(`| Isim Maf'ul | ${t["isim_maf'ul"]} |`);
    if (t.amr) lines.push(`| Amr | ${t.amr} |`);
    if (t.nahi) lines.push(`| Nahi | ${t.nahi} |`);
    if (t.mudhari_majhul) lines.push(`| Mudhari' Majhul | ${t.mudhari_majhul} |`);
  }

  return lines.join("\n");
}
