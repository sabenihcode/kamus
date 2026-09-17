import Chat from "./components/Chat";

export default function HomePage() {
  return (
    <main className="flex h-screen flex-col bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-700 text-sm font-bold text-white sm:h-9 sm:w-9">
            ع
          </div>
          <h1 className="text-lg font-semibold text-slate-900 sm:text-xl">Arabic AI</h1>
        </div>
      </header>
      <div className="flex-1 overflow-hidden">
        <Chat />
      </div>
    </main>
  );
}
