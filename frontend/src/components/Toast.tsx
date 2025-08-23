import { useEffect, useState } from 'react'

export default function Toast({ text }: { text: string }) {
  const [show, setShow] = useState(true)
  useEffect(() => {
    const t = setTimeout(() => setShow(false), 2500)
    return () => clearTimeout(t)
  }, [])
  if (!show) return null
  return (
    <div className="fixed bottom-4 right-4 bg-slate-900 text-white px-3 py-2 rounded shadow">
      {text}
    </div>
  )
}
