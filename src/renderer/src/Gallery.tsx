import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight, Check, ChevronDown, Command, ExternalLink, Folder, Layers3, Search, Settings2, X } from 'lucide-react'
import type { ExternalLink as ExternalLinkItem, LibrarySnapshot, WebAppSite } from '../../shared/types'

type GalleryEntry =
  | { kind: 'profile'; site: WebAppSite; profile: WebAppSite['profiles'][number] }
  | { kind: 'link'; link: ExternalLinkItem }

const emptyLibrary: LibrarySnapshot = { sites: [], links: [], categories: [], globalExtensions: [] }

function getHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function Gallery(): React.JSX.Element {
  const [library, setLibrary] = useState<LibrarySnapshot>(emptyLibrary)
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [categoryId, setCategoryId] = useState<string | 'uncategorized' | null>(null)
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false)
  const [switchingWorkspace, setSwitchingWorkspace] = useState(false)
  const workspaceTriggerRef = useRef<HTMLButtonElement>(null)
  const { sites, links, categories } = library

  useEffect(() => {
    window.webApps.list().then(setLibrary).catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : 'No se pudieron cargar tus aplicaciones.')
    })
  }, [])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key !== 'Escape') return
      if (workspaceMenuOpen) {
        event.preventDefault()
        event.stopPropagation()
        setWorkspaceMenuOpen(false)
        workspaceTriggerRef.current?.focus()
      } else {
        void window.webApps.closeGallery()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [workspaceMenuOpen])

  async function switchWorkspace(workspaceId: string): Promise<void> {
    setWorkspaceMenuOpen(false)
    if (workspaceId === library.activeWorkspaceId) {
      workspaceTriggerRef.current?.focus()
      return
    }
    setSwitchingWorkspace(true)
    setError('')
    try {
      setLibrary(await window.webApps.switchWorkspace(workspaceId))
      setCategoryId(null)
      setQuery('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo cambiar de workspace.')
    } finally {
      setSwitchingWorkspace(false)
      workspaceTriggerRef.current?.focus()
    }
  }

  const entries: GalleryEntry[] = [
    ...sites.flatMap((site) => site.profiles.map((profile) => ({ kind: 'profile' as const, site, profile }))),
    ...links.map((link) => ({ kind: 'link' as const, link })),
  ]
  const filteredEntries = entries.filter((entry) => {
    const itemCategoryId = entry.kind === 'profile' ? entry.site.categoryId : entry.link.categoryId
    const inCategory = categoryId === null
      || (categoryId === 'uncategorized' ? !itemCategoryId : itemCategoryId === categoryId)
    const searchText = entry.kind === 'profile'
      ? `${entry.site.name} ${entry.site.url} ${entry.profile.name}`
      : `${entry.link.name} ${entry.link.url}`
    return inCategory && searchText.toLowerCase().includes(query.trim().toLowerCase())
  })

  async function launch(entry: GalleryEntry): Promise<void> {
    try {
      if (entry.kind === 'profile') await window.webApps.openProfile(entry.site.id, entry.profile.id)
      else await window.webApps.openExternalLink(entry.link.id)
      await window.webApps.closeGallery()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo abrir el perfil.')
    }
  }

  return (
    <main className="gallery-shell">
      <header className="gallery-header">
        <div className="gallery-brand">
          <span className="gallery-brand-mark"><Command size={18} /></span>
          <span>webnest<span className="gallery-brand-dot">.</span></span>
          <span className="gallery-label">GALERÍA</span>
        </div>
        <div className="gallery-workspace-switcher">
          <button
            className="gallery-workspace-trigger"
            type="button"
            ref={workspaceTriggerRef}
            aria-label={`Workspace activo: ${library.activeWorkspaceName ?? 'Espacio personal'}. Cambiar workspace`}
            aria-expanded={workspaceMenuOpen}
            aria-controls="gallery-workspace-options"
            disabled={switchingWorkspace || !(library.workspaces?.length)}
            onClick={() => setWorkspaceMenuOpen((open) => !open)}
          >
            <span>{switchingWorkspace ? 'Cambiando…' : library.activeWorkspaceName ?? 'Espacio personal'}</span>
            <ChevronDown size={13} />
          </button>
          {workspaceMenuOpen && <div className="gallery-workspace-options" id="gallery-workspace-options" role="group" aria-label="Seleccionar workspace">
            {(library.workspaces ?? []).map((workspace) => (
              <button
                className={workspace.id === library.activeWorkspaceId ? 'active' : ''}
                type="button"
                key={workspace.id}
                aria-pressed={workspace.id === library.activeWorkspaceId}
                disabled={switchingWorkspace}
                onClick={() => void switchWorkspace(workspace.id)}
              >
                <span>{workspace.name}</span>
                {workspace.id === library.activeWorkspaceId && <Check size={14} />}
              </button>
            ))}
          </div>}
        </div>
        <button className="gallery-close" type="button" aria-label="Cerrar galería" onClick={() => void window.webApps.closeGallery()}><X size={18} /></button>
      </header>

      <div className="gallery-search-wrap">
        <Search size={18} />
        <input
          autoFocus
          aria-label="Buscar sitios y perfiles"
          placeholder="Busca un sitio o perfil..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <kbd>ESC</kbd>
      </div>

      <section className="gallery-apps" aria-labelledby="gallery-heading">
        <div className="gallery-section-heading">
          <div>
            <span className="gallery-overline">{library.activeWorkspaceName?.toUpperCase() ?? 'TU ESPACIO PERSONAL'}</span>
            <h1 id="gallery-heading">Tu galería</h1>
          </div>
          <span className="gallery-total">{filteredEntries.length} elementos</span>
        </div>

        <nav className="gallery-categories" aria-label="Filtrar por categoría">
          <button className={categoryId === null ? 'active' : ''} type="button" aria-pressed={categoryId === null} onClick={() => setCategoryId(null)}><Layers3 size={13} /> Todo</button>
          <button className={categoryId === 'uncategorized' ? 'active' : ''} type="button" aria-pressed={categoryId === 'uncategorized'} onClick={() => setCategoryId('uncategorized')}><Folder size={13} /> Sin categoría</button>
          {categories.map((category) => <button className={categoryId === category.id ? 'active' : ''} type="button" aria-pressed={categoryId === category.id} key={category.id} onClick={() => setCategoryId(category.id)}><Folder size={13} /> {category.name}</button>)}
        </nav>

        {error ? (
          <p className="gallery-empty">{error}</p>
        ) : filteredEntries.length > 0 ? (
          <div className="gallery-grid">
            {filteredEntries.map((entry) => (
              <button className="gallery-tile" type="button" key={entry.kind === 'profile' ? entry.profile.id : entry.link.id} onClick={() => void launch(entry)}>
                <span className="gallery-tile-icon">
                  {entry.kind === 'profile'
                    ? entry.site.iconDataUrl ? <img src={entry.site.iconDataUrl} alt="" /> : <span>{entry.site.name.slice(0, 1).toUpperCase()}</span>
                    : entry.link.iconDataUrl ? <img src={entry.link.iconDataUrl} alt="" /> : <Link2Fallback />}
                </span>
                <span className="gallery-tile-name">{entry.kind === 'profile' ? entry.site.name : entry.link.name}</span>
                <span className="gallery-tile-profile">{entry.kind === 'profile' ? entry.profile.name : getHost(entry.link.url)}</span>
                {entry.kind === 'link' ? <ExternalLink className="gallery-tile-arrow" size={14} /> : <ArrowUpRight className="gallery-tile-arrow" size={14} />}
              </button>
            ))}
          </div>
        ) : (
          <div className="gallery-empty-state">
            <span className="gallery-empty-mark"><Search size={21} /></span>
            <strong>{query ? 'No encontramos ese elemento' : 'No hay elementos en esta categoría'}</strong>
            <span>{query ? 'Prueba con otro nombre.' : 'Añade sitios y enlaces desde el administrador.'}</span>
          </div>
        )}
      </section>

      <footer className="gallery-footer">
        <span><i className="gallery-status-dot" /> Sesiones aisladas con Chromium</span>
        <span className="gallery-author-credit">Creado por Juan Avila</span>
        <button type="button" onClick={() => void window.webApps.showManager()}><Settings2 size={15} /> Administrar aplicaciones</button>
      </footer>
    </main>
  )
}

function Link2Fallback(): React.JSX.Element {
  return <ExternalLink size={18} />
}

export default Gallery
