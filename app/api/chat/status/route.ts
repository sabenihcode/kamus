import { NextResponse } from "next/server";
import { getCohereClient } from "@/lib/cohere";

export const dynamic = "force-dynamic";

export async function GET() {
  const apiKey = process.env.COHERE_API_KEY;

  if (!apiKey || apiKey === "your_api_key") {
    return NextResponse.json({
      configured: false,
      message: "COHERE_API_KEY belum dikonfigurasi. Tambahkan ke .env.local dan restart server.",
    });
  }

  try {
    const cohere = getCohereClient();
    const response = await cohere.chat({
      model: "command-r-plus-08-2024",
      message: "Halo",
      maxTokens: 10,
    });

    return NextResponse.json({
      configured: true,
      valid: response.text ? true : false,
      message: response.text ? "API key valid dan Cohere merespons." : "Cohere merespons tanpa teks.",
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    return NextResponse.json({
      configured: true,
      valid: false,
      message: "Cohere API gagal dipanggil.",
      error: err.message,
    });
  }
}
