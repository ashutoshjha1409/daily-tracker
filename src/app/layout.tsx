import '../styles/globals.css'

export const metadata = {
  title: 'Daily Execution Ledger',
  description:
    'Brutal discipline ledger that tracks planning accuracy, overload, and immutable execution history.'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-slate-100">
        <div className="min-h-screen">
          <header className="border-b border-slate-800 bg-slate-900/60 px-6 py-4">
            <div className="mx-auto max-w-6xl">
              <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Daily Execution Ledger</p>
              <h1 className="text-3xl font-semibold text-white">Brutal execution discipline</h1>
            </div>
          </header>
          <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
        </div>
      </body>
    </html>
  )
}
