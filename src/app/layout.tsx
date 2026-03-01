import '../styles/globals.css'

export const metadata = {
  title: 'Daily Tracker',
  description: 'Minimal daily task tracker with streaks and metrics.'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-slate-100 antialiased">
        {children}
      </body>
    </html>
  )
}
