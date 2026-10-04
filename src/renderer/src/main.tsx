import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import ExtensionToolbar from './ExtensionToolbar'
import Gallery from './Gallery'
import { Layers3, RotateCw } from 'lucide-react'
import './styles.css'
import './shop.css'
import './gallery.css'

function StartupError(): React.JSX.Element {
  return (
    <main className="startup-error">
      <span className="startup-error-mark"><Layers3 size={23} /></span>
      <span className="eyebrow">WEBNEST · INICIO</span>
      <h1>No se pudo iniciar WebNest</h1>
      <p>Falta el puente seguro entre la interfaz y la aplicación. Cierra WebNest e instala de nuevo la versión más reciente.</p>
      <button className="button button-primary" type="button" onClick={() => window.location.reload()}>
        <RotateCw size={15} /> Volver a intentar
      </button>
    </main>
  )
}

const parameters = new URLSearchParams(window.location.search)
if (parameters.has('toolbar')) {
  document.documentElement.classList.add('toolbar-window')
  document.body.classList.add('toolbar-window')
}
const Root = typeof window.webApps === 'undefined'
  ? StartupError
  : parameters.has('toolbar') ? ExtensionToolbar : parameters.has('gallery') ? Gallery : App

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
)
