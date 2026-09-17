# Arabic AI

Arabic AI adalah asisten percakapan AI yang mengkhususkan diri dalam bahasa Arab: kosakata, morfologi (Sharaf), Tashrif, tata bahasa dasar (Nahwu), dan terjemahan.

## Struktur Proyek

```
arabic-ai/
├── app/
│   ├── page.tsx
│   ├── layout.tsx
│   ├── globals.css
│   ├── api/
│   │   └── chat/
│   │       └── route.ts
│   └── components/
│       ├── Chat.tsx
│       ├── ChatMessage.tsx
│       ├── ChatInput.tsx
│       └── AnalysisCard.tsx
├── lib/
│   ├── cohere.ts
│   ├── analyzer.ts
│   ├── morphology.ts
│   └── tashrif.ts
├── data/
│   ├── dictionary.json
│   ├── roots.json
│   ├── bab-patterns.json
│   ├── tashrif-patterns.json
│   ├── isim-patterns.json
│   └── particles.json
├── public/
│   └── logo.svg
├── .env.local
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

## Fitur Utama

- ChatGPT-style conversation
- Analisis kata Arab otomatis dari teks kitab / paragraf
- Identifikasi jenis kata: Fi'il, Isim, Harf
- Akar kata (Jizr / Root)
- Wazan dan Bab Sharaf
- Tashrif lengkap: Madhi, Mudhari', Masdar, Isim Fa'il, Isim Maf'ul, Amr, Nahi, Mudhari' Majhul
- Analisis kalimat dan i'rab
- Respons dalam bahasa Indonesia

## Arsitektur

```
User → Chat Interface → POST /api/chat → Analyzer → Dataset / Morphology / Tashrif → Cohere API → Natural Language Response
```

## Dataset

Folder `data/` berisi file JSON yang mudah dikembangkan:

- `dictionary.json`
- `roots.json`
- `bab-patterns.json`
- `tashrif-patterns.json`
- `isim-patterns.json`
- `particles.json`

## Environment Variables

```
COHERE_API_KEY=your_api_key
```

## Menjalankan Aplikasi

```bash
npm install
npm run dev
```

## Teknologi

- Next.js (App Router)
- React + TypeScript
- Tailwind CSS
- Cohere API
