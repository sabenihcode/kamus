"use client";

interface IsimForm {
  label: string;
  labelAr: string;
  arabic: string;
  meaning: string;
}

interface AnalysisCardProps {
  analysis: {
    word?: string;
    type?: string;
    category?: string;
    root?: string[];
    wazan?: string;
    bab?: string;
    meaning?: string;
    translation?: string;
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

export default function AnalysisCard({ analysis, isim, tashrif }: AnalysisCardProps) {
  if (!analysis && !isim && !tashrif) return null;

  return (
    <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 sm:px-5 sm:py-4">
      <h3 className="mb-2 text-sm font-semibold text-slate-700">Analisis Terstruktur</h3>

      {analysis && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          {analysis.word && (
            <div className="col-span-2">
              <span className="text-xs text-slate-500">Kata</span>
              <p className="text-base font-semibold text-slate-900" dir="auto">
                {analysis.word}
              </p>
            </div>
          )}
          {analysis.type && (
            <div className="col-span-1">
              <span className="text-xs text-slate-500">Jenis</span>
              <p className="text-sm font-medium text-slate-900">{analysis.type}</p>
            </div>
          )}
          {analysis.category && (
            <div className="col-span-1">
              <span className="text-xs text-slate-500">Kategori</span>
              <p className="text-sm font-medium text-slate-900">{analysis.category}</p>
            </div>
          )}
          {analysis.bab && (
            <div className="col-span-2">
              <span className="text-xs text-slate-500">Bab</span>
              <p className="text-sm font-medium text-slate-900" dir="auto">
                {analysis.bab}
              </p>
            </div>
          )}
          {analysis.root?.length && (
            <div className="col-span-1">
              <span className="text-xs text-slate-500">Akar</span>
              <p className="text-sm font-medium text-slate-900" dir="auto">
                {analysis.root.join(" - ")}
              </p>
            </div>
          )}
          {analysis.wazan && (
            <div className="col-span-1">
              <span className="text-xs text-slate-500">Wazan</span>
              <p className="text-sm font-medium text-slate-900" dir="auto">
                {analysis.wazan}
              </p>
            </div>
          )}
          {analysis.baseWord && (
            <div className="col-span-1">
              <span className="text-xs text-slate-500">Kata Asli</span>
              <p className="text-sm font-medium text-slate-900" dir="auto">
                {analysis.baseWord}
              </p>
            </div>
          )}
          {analysis.prefix && (
            <div className="col-span-1">
              <span className="text-xs text-slate-500">Awalan</span>
              <p className="text-sm font-medium text-slate-900" dir="auto">
                {analysis.prefix}
              </p>
            </div>
          )}
          {analysis.suffix && (
            <div className="col-span-1">
              <span className="text-xs text-slate-500">Akhiran</span>
              <p className="text-sm font-medium text-slate-900" dir="auto">
                {analysis.suffix}
              </p>
            </div>
          )}
          {analysis.meaning && (
            <div className="col-span-2">
              <span className="text-xs text-slate-500">Arti</span>
              <p className="text-sm font-medium text-slate-900">{analysis.meaning}</p>
            </div>
          )}
          {analysis.translation && analysis.translation !== analysis.meaning && (
            <div className="col-span-2">
              <span className="text-xs text-slate-500">Terjemahan</span>
              <p className="text-sm font-medium text-slate-900">{analysis.translation}</p>
            </div>
          )}
        </div>
      )}

      {isim && (
        <div className="mt-3 border-t border-slate-200 pt-3">
          <p className="text-sm font-medium text-slate-900" dir="auto">
            {isim.type} <span className="text-slate-500">({isim.typeAr})</span>
          </p>
          <p className="text-xs text-slate-500">{isim.description}</p>
          <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2">
            <div className="col-span-1">
              <span className="text-xs text-slate-500">Gender</span>
              <p className="text-sm font-medium text-slate-900">
                {isim.gender} ({isim.genderAr})
              </p>
            </div>
            <div className="col-span-1">
              <span className="text-xs text-slate-500">Wazan</span>
              <p className="text-sm font-medium text-slate-900" dir="auto">
                {isim.wazan}
              </p>
            </div>
          </div>
          <div className="mt-3">
            <span className="text-xs text-slate-500">Bentuk-bentuk</span>
            <div className="mt-1 space-y-1">
              {isim.forms.map((form, idx) => (
                <div key={idx} className="flex items-center justify-between rounded-lg bg-white px-3 py-2">
                  <span className="text-xs text-slate-600">
                    {form.label} ({form.labelAr})
                  </span>
                  <span className="text-sm font-medium text-slate-900" dir="auto">
                    {form.arabic}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tashrif && (
        <div className="mt-3 border-t border-slate-200 pt-3">
          <span className="text-xs text-slate-500">Tashrif</span>
          <div className="mt-1 grid grid-cols-2 gap-2">
            {Object.entries(tashrif).map(([key, value]) => (
              <div key={key} className="rounded-lg bg-white px-3 py-2">
                <span className="text-xs text-slate-500 capitalize">{key.replace(/_/g, " ")}</span>
                <p className="text-sm font-medium text-slate-900" dir="auto">
                  {value}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
