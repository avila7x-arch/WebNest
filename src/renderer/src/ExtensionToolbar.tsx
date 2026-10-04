import { useEffect, useState } from 'react'
import { Check, Copy, Puzzle } from 'lucide-react'
import type { ExtensionToolbarEntry } from '../../shared/types'

function ExtensionToolbar(): React.JSX.Element {
  const profileId = new URLSearchParams(window.location.search).get('toolbar') ?? ''
  const [extensions, setExtensions] = useState<ExtensionToolbarEntry[]>([])
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    window.webApps.listProfileExtensions(profileId)
      .then((collection) => setExtensions([
        ...collection.global.map((extension) => ({ ...extension, scope: 'global' as const })),
        ...collection.profile.map((extension) => ({ ...extension, scope: 'profile' as const })),
      ]))
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'No se pudieron cargar las extensiones.'))
  }, [profileId])

  async function activate(extension: ExtensionToolbarEntry): Promise<void> {
    if (!extension.hasPopup) return
    try {
      await window.webApps.activateExtension(profileId, extension.id)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo abrir esta extensión.')
    }
  }

  async function copyCurrentUrl(): Promise<void> {
    try {
      await window.webApps.copyCurrentUrl(profileId)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo copiar la URL.')
    }
  }

  return (
    <main className="extension-toolbar" aria-label="Controles del perfil y extensiones">
      <button className="extension-toolbar-button" type="button" aria-label={copied ? 'URL copiada' : 'Copiar URL actual'} title={copied ? 'URL copiada' : 'Copiar URL actual'} onClick={() => void copyCurrentUrl()}>
        {copied ? <Check size={16} /> : <Copy size={16} />}
      </button>
      {extensions.map((extension) => (
        <button
          className="extension-toolbar-button"
          type="button"
          key={extension.id}
          aria-label={extension.name}
          title={`${extension.scope === 'global' ? 'Global · ' : ''}${extension.hasPopup ? extension.name : `${extension.name}: no tiene popup compatible`}`}
          disabled={!extension.hasPopup}
          onClick={() => void activate(extension)}
        >
          {extension.iconDataUrl ? <img src={extension.iconDataUrl} alt="" /> : <Puzzle size={17} />}
        </button>
      ))}
      {error && <span className="extension-toolbar-error" role="status">{error}</span>}
    </main>
  )
}

export default ExtensionToolbar
