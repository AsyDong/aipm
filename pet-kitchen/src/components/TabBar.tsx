import { TABS, useNav } from '../store/nav'

export default function TabBar() {
  const stack = useNav((s) => s.stack)
  const tab = useNav((s) => s.tab)
  const root = stack[0]?.page ?? 'home'

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-sky-100 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-[480px]">
        {TABS.map((t) => {
          const on = root === t.key
          return (
            <button
              key={t.key}
              onClick={() => tab(t.key)}
              className={`flex h-[60px] flex-1 flex-col items-center justify-center gap-0.5 transition ${
                on ? 'text-sky-500' : 'text-muted'
              }`}
            >
              <span className={`text-[22px] transition-transform ${on ? 'scale-110' : ''}`}>{t.icon}</span>
              <span className={`text-[12px] ${on ? 'font-extrabold' : 'font-medium'}`}>{t.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
