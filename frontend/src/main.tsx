import { Suspense, lazy } from 'react'
import ReactDOM from 'react-dom/client'

const BootstrapApp = lazy(() => import('./bootstrapApp'))

ReactDOM.createRoot(document.getElementById('root')!).render(
  <Suspense fallback={<div />}>
    <BootstrapApp />
  </Suspense>
)

if ('serviceWorker' in navigator) {
  const registerServiceWorker = () => {
    void navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.warn('Service worker registration failed:', error)
    })
  }
  window.addEventListener('load', registerServiceWorker, { once: true })
}
