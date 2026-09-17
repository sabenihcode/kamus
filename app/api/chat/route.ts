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

    const analysis = analyzeMessage(message, conversation);
    const datasetContext = buildDatasetContext(analysis);

    const systemPrompt = buildSystemPrompt(datasetContext, analysis);

    const messages = [
      ...conversation,
      { role: "user" as const, content: message },
    ];

    let aiResponse: string;

    try {
      aiResponse = await generateCohereResponse(systemPrompt, messages);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error("Cohere API error:", err.message);
      aiResponse = generateFallbackResponse(analysis, err.message);
    }

    const responsePayload: {
      success: boolean;
      message: string;
      analysis?: Record<string, unknown>;
      tashrif?: Record<string, unknown> | null;
      isim?: Record<string, unknown> | null;
    } = {
      success: true,
      message: aiResponse,
      analysis: {},
      tashrif: null,
      isim: null,
    };

    if (analysis.primaryWord) {
      const pw = analysis.primaryWord;
      responsePayload.analysis = {
        word: pw.word,
        type: pw.type,
        category: pw.category,
        root: pw.root,
        wazan: pw.wazan,
        bab: pw.bab,
        meaning: pw.meaning,
        prefix: pw.prefix,
        suffix: pw.suffix,
        baseWord: pw.baseWord,
      };

      if (analysis.tashrif) {
        responsePayload.tashrif = analysis.tashrif;
      }

      if (analysis.isimAnalysis) {
        responsePayload.isim = analysis.isimAnalysis as unknown as Record<string, unknown>;
      }
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

function buildSystemPrompt(
  datasetContext: string,
  analysis: ReturnType<typeof analyzeMessage>
): string {
  const ctx = analysis.context;
  const hasMultipleWords = analysis.words.length > 1;

  let instruction = `Kamu adalah Arabic AI, asisten AI untuk bahasa Arab. Kamu menjawab dalam bahasa Indonesia dengan format yang bersih dan profesional. Prioritaskan jawaban langsung, gunakan tabel Markdown jika relevan, dan hindari pengantar panjang, emoji, serta penutup seperti "Semoga membantu".

ATURAN PENTING:
- Gunakan HANYA data morfologi dari dataset di bawah ini.
- Jika kata tidak ditemukan dalam dataset, katakan "Kata ini belum tersedia dalam dataset." dan jangan membuat data seperti akar, wazan, atau arti.
- Jangan mengarang (hallucinate) informasi morfologi.
- Untuk frasa/kalimat, identifikasi kata asli dengan melepas awalan seperti وَ, الْ, بِ, كِ, لِ, فَ, ثُمَّ, dll.

Data morfologi dari dataset (jika tersedia):
${datasetContext}

`;

  if (analysis.primaryWord?.type === "unknown") {
    instruction += `Kata Arab yang diberikan pengguna TIDAK DITEMUKAN dalam dataset. Jawab dengan jelas: "Kata ${analysis.primaryWord.word} belum tersedia dalam dataset." Jangan membuat tabel analisis, akar, wazan, atau arti. Jelaskan bahwa pengguna dapat menambahkannya ke data/dictionary.json.`;
  } else if (hasMultipleWords || ctx.asksForSentenceAnalysis) {
    instruction += `Pengguna memberikan frasa/kalimat bahasa Arab. Untuk SETIAP kata Arab, tentukan kata aslinya dengan melepas awalan seperti وَ (dan), الْ (al-), بِ, كِ, لِ, فَ, لِ, ثُمَّ, dll. Berikan tabel analisis per kata dengan kolom: Kata Asli, Jenis, Analisis, Arti. Jika diminta i'rab, tambahkan tabel i'rab. Berikan terjemahan singkat frasa/kalimat tersebut.`;
  } else if (analysis.isimAnalysis) {
    instruction += `Pengguna menanyakan tentang sebuah isim. Berikan analisis lengkap: tipe isim, akar kata, wazan, arti, gender (mudzakkar/muannats), dan bentuk-bentuknya (mufrad, mutsanna, jamak).`;
  } else if (ctx.asksForTashrif && analysis.tashrif) {
    instruction += `Pengguna meminta tashrif. Tampilkan tabel Tashrif dengan kolom: Bentuk, Arab, Arti. Sertakan semua bentuk yang tersedia: Madhi, Mudhari', Masdar, Isim Fa'il, Isim Maf'ul, Amr, Nahi, Mudhari' Majhul.`;
  } else if (ctx.asksForRoot && analysis.primaryWord?.root) {
    instruction += `Pengguna menanyakan akar kata. Jawab singkat dengan menyebutkan akar kata dan arti intinya.`;
  } else if (ctx.asksForWazan && analysis.primaryWord?.wazan) {
    instruction += `Pengguna menanyakan wazan. Jawab singkat dengan menyebutkan wazan dan kategorinya.`;
  } else if (ctx.asksForIsimFaIl && analysis.tashrif?.["isim_fa'il"]) {
    instruction += `Pengguna menanyakan isim fa'il. Jawab langsung dengan isim fa'il dan artinya.`;
  } else if (ctx.asksForIsimMafUl && analysis.tashrif?.["isim_maf'ul"]) {
    instruction += `Pengguna menanyakan isim maf'ul. Jawab langsung dengan isim maf'ul dan artinya.`;
  } else if (ctx.asksForMeaning && analysis.primaryWord?.meaning) {
    instruction += `Pengguna menanyakan arti. Jawab singkat dengan arti kata dalam bahasa Indonesia.`;
  } else if (analysis.primaryWord) {
    instruction += `Analisis kata Arab yang diberikan pengguna. Gunakan tabel dengan kolom Analisis dan Hasil. Tampilkan hanya field yang relevan dan tersedia: Jenis, Kategori, Bab, Akar, Wazan, Arti.`;
  } else {
    instruction += `Jawab pertanyaan pengguna secara alami dan bermanfaat. Jika ada kata Arab, bantu analisis sesuai kebutuhan.`;
  }

  if (ctx.asksForExplanation && !ctx.asksForWhy) {
    instruction += `\n\nBeri penjelasan yang lebih rinci karena pengguna meminta "jelaskan". Tetap gunakan tabel dan format yang terstruktur.`;
  }

  if (ctx.asksForWhy) {
    instruction += `\n\nJelaskan alasan gramatikal atau morfologisnya karena pengguna bertanya "kenapa".`;
  }

  return instruction;
}

function generateFallbackResponse(
  analysis: ReturnType<typeof analyzeMessage>,
  cohereError?: string
): string {
  const pw = analysis.primaryWord;

  // Phrase / sentence analysis
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

    lines.push("");
    lines.push("**Catatan:** Jika ada kata yang belum dikenali, tambahkan ke dataset agar analisis lebih lengkap.");
    return lines.join("\n");
  }

  // Single isim analysis
  if (pw?.type === "isim" && analysis.isimAnalysis) {
    const isim = analysis.isimAnalysis;
    const lines: string[] = [];
    lines.push(`### ${isim.word}`);
    lines.push("");
    lines.push(`**Tipe:** ${isim.type} (${isim.typeAr})`);
    lines.push(`**Akar:** ${isim.root.join(" - ")}`);
    lines.push(`**Wazan:** ${isim.wazan}`);
    lines.push(`**Gender:** ${isim.gender} (${isim.genderAr})`);
    lines.push(`**Arti:** ${isim.meaning}`);
    lines.push("");
    lines.push("### Bentuk-bentuk");
    lines.push("");
    lines.push("| Bentuk | Arab | Makna |");
    lines.push("| ------ | ---- | ----- |");
    for (const form of isim.forms) {
      lines.push(`| ${form.label} (${form.labelAr}) | ${form.arabic} | ${form.meaning} |`);
    }
    return lines.join("\n");
  }

  // Single word analysis
  if (!pw) {
    return `Maaf, saya tidak dapat mengenali kata **${analysis.words[0]?.word || ""}**. Kata ini belum tersedia dalam dataset. Silakan tambahkan ke data/dictionary.json agar bisa dianalisis dengan akurat.`;
  }

  // Unknown word with no useful info
  if (pw.type === "unknown" && !pw.root && !pw.meaning) {
    let msg = `Kata **${pw.word}** belum tersedia dalam dataset. Sistem tidak dapat mengenali akar, wazan, atau artinya.`;
    if (cohereError) {
      msg += `\n\nCatatan: Cohere AI tidak dapat digunakan (${cohereError}). Respons ini berasal dari fallback dataset.`;
    } else {
      msg += " Silakan tambahkan ke data/dictionary.json agar bisa dianalisis.";
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
