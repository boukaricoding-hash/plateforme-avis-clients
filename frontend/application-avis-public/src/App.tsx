import { Route, Routes, useParams } from 'react-router'

function EcranTest() {
  const { code } = useParams()
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 bg-slate-900 p-6 text-center">
      <h1 className="text-3xl font-bold text-white">Page d'avis du client</h1>
      <p className="text-lg text-slate-300">Code du QR lu dans l'adresse :</p>
      <p className="break-all rounded-xl bg-slate-800 px-4 py-3 font-mono text-amber-400">{code}</p>
    </main>
  )
}

function PageIntrouvable() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 bg-slate-900 p-6 text-center">
      <p className="text-lg text-slate-300">Adresse introuvable.</p>
    </main>
  )
}

function App() {
  return (
    <Routes>
      <Route path="/q/:code" element={<EcranTest />} />
      <Route path="*" element={<PageIntrouvable />} />
    </Routes>
  )
}

export default App