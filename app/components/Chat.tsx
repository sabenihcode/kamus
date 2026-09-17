"use client";

import { useState, useRef, useEffect } from "react";
import ChatInput from "./ChatInput";
import ChatMessage from "./ChatMessage";
import AnalysisCard from "./AnalysisCard";

interface IsimForm {
  label: string;
  labelAr: string;
  arabic: string;
  meaning: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  analysis?: {
    word?: string;
    type?: string;
    category?: string;
    root?: string[];
    wazan?: string;
    bab?: string;
    meaning?: string;
    prefix?: string;
    suffix?: string;
    baseWord?: string;
  } | null;
  isim?: {
    word: string;
    type: string;
    typeAr: string;
    description: string;
    root: string[];
    wazan: string;
    meaning: string;
    gender: string;
    genderAr: string;
    forms: IsimForm[];
  } | null;
  tashrif?: Record<string, string> | null;
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Halo! Saya Arabic AI. Tanyakan apa saja tentang bahasa Arab, kosakata, morfologi, atau tashrif. Anda bisa menempel teks langsung dari kitab.",
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  async function handleSend(userMessage: string) {
    const userMsg: Message = { role: "user", content: userMessage };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const conversation = messages.map(({ role, content }) => ({ role, content }));
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          conversation,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.message,
            analysis: data.analysis || null,
            isim: data.isim || null,
            tashrif: data.tashrif || null,
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.error || "Terjadi kesalahan. Silakan coba lagi.",
          },
        ]);
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Maaf, saya tidak dapat terhubung ke server. Silakan coba lagi.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
        {messages.map((msg, index) => (
          <div key={index} className="space-y-2">
            <ChatMessage role={msg.role} content={msg.content} />
            {(msg.analysis || msg.isim || msg.tashrif) && (
              <AnalysisCard analysis={msg.analysis || null} isim={msg.isim || null} tashrif={msg.tashrif || null} />
            )}
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="rounded-2xl border border-slate-200 bg-white px-5 py-3.5">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-600" />
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-600 delay-150" />
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-600 delay-300" />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <ChatInput onSend={handleSend} disabled={isLoading} />
    </div>
  );
}
