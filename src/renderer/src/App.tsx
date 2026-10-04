import { useEffect, useRef, useState } from 'react'
import {
  ArrowDownLeft,
  ArrowDown,
  ArrowUpRight,
  ArrowUp,
  Archive,
  Check,
  CircleHelp,
  Download,
  ExternalLink,
  Folder,
  FolderPlus,
  FolderOpen,
  Globe2,
  Image,
  Layers3,
  LayoutGrid,
  List,
  Link2,
  MoreHorizontal,
  Plus,
  Puzzle,
  ShieldCheck,
  Sparkles,
  Store,
  Trash2,
  UserRoundPlus,
  X,
} from 'lucide-react'
import type { AppCategory, BrowserExtensionCandidate, BrowserExtensionScan, BrowserExtensionSource, CreateSiteInput, ExtensionCollection, ExtensionScope, ExternalLink as ExternalLinkRecord, ExternalLinkInput, LibrarySnapshot, WebAppSite } from '../../shared/types'
import Shop from './Shop'

type DialogState =
  | { kind: 'site'; site?: WebAppSite }
  | { kind: 'link'; link?: ExternalLinkRecord }
  | { kind: 'profile'; site: WebAppSite }
  | { kind: 'extensions'; site: WebAppSite; profile: WebAppSite['profiles'][number] }
  | { kind: 'category'; category?: AppCategory }
  | { kind: 'workspace'; mode: 'create' }
  | { kind: 'workspace'; mode: 'rename'; workspaceId: string; name: string }
  | null

const emptyLibrary: LibrarySnapshot = { sites: [], links: [], categories: [], globalExtensions: [] }

function getHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Ocurrió un error inesperado.'
}

function formatExtensionSize(bytes: number): string {
  const mebibytes = bytes / (1024 * 1024)
  return mebibytes >= 1024 ? `${(mebibytes / 1024).toFixed(2)} GiB` : `${mebibytes.toFixed(1)} MiB`
}

function defaultProfileName(): string {
  return `Profile_${crypto.randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase()}`
}

function App(): React.JSX.Element {
  const [library, setLibrary] = useState<LibrarySnapshot>(emptyLibrary)
  const [dialog, setDialog] = useState<DialogState>(null)
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true)
  const [activeCategoryId, setActiveCategoryId] = useState<string | 'uncategorized' | null>(null)
  const [activeView, setActiveView] = useState<'library' | 'shop'>('library')
  const [layoutMode, setLayoutMode] = useState<'grid' | 'list'>('grid')
  const dialogRef = useRef<HTMLDialogElement>(null)
  const { sites, links, categories } = library

  useEffect(() => {
    window.webApps.list()
      .then(setLibrary)
      .catch((error: unknown) => setNotice(getErrorMessage(error)))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    function refreshLibrary(): void {
      if (document.visibilityState !== 'visible') return
      window.webApps.list()
        .then(setLibrary)
        .catch((error: unknown) => setNotice(getErrorMessage(error)))
    }
    window.addEventListener('focus', refreshLibrary)
    return () => window.removeEventListener('focus', refreshLibrary)
  }, [])

  useEffect(() => {
    setActiveCategoryId(null)
    setDialog(null)
    setActiveView('library')
  }, [library.activeWorkspaceId])

  useEffect(() => {
    const element = dialogRef.current
    if (!element) return
    if (dialog && !element.open) element.showModal()
    if (!dialog && element.open) element.close()
  }, [dialog])

  useEffect(() => {
    if (!notice) return
    const timeout = window.setTimeout(() => setNotice(''), 4200)
    return () => window.clearTimeout(timeout)
  }, [notice])

  function openSiteDialog(site?: WebAppSite): void {
    setDialog({ kind: 'site', site })
  }

  function selectedCategoryId(): string | undefined {
    return activeCategoryId && activeCategoryId !== 'uncategorized' ? activeCategoryId : undefined
  }

  async function submitSite(input: CreateSiteInput): Promise<void> {
    try {
      const updated = dialog?.kind === 'site' && dialog.site
        ? await window.webApps.updateSite(dialog.site.id, input)
        : await window.webApps.createSite(input)
      setLibrary(updated)
      setDialog(null)
      setNotice(dialog?.kind === 'site' && dialog.site ? 'Cambios guardados.' : 'Sitio instalado.')
    } catch (error) {
      setNotice(getErrorMessage(error))
    }
  }

  async function submitProfile(site: WebAppSite, name: string): Promise<void> {
    try {
      setLibrary(await window.webApps.addProfile(site.id, name))
      setDialog(null)
      setNotice(`Perfil añadido a ${site.name}.`)
    } catch (error) {
      setNotice(getErrorMessage(error))
    }
  }

  async function removeSite(site: WebAppSite): Promise<void> {
    const confirmed = window.confirm(
      `¿Eliminar ${site.name} y sus ${site.profiles.length} ${site.profiles.length === 1 ? 'perfil' : 'perfiles'}? También se borrarán sus cookies y datos guardados.`,
    )
    if (!confirmed) return
    try {
      setLibrary(await window.webApps.deleteSite(site.id))
      setNotice(`${site.name} y sus datos se eliminaron.`)
    } catch (error) {
      setNotice(getErrorMessage(error))
    }
  }

  async function removeProfile(site: WebAppSite, profileId: string, profileName: string): Promise<void> {
    if (site.profiles.length <= 1) {
      setNotice('El sitio necesita al menos un perfil. Para quitarlo, elimina el sitio completo.')
      return
    }
    if (!window.confirm(`¿Eliminar el perfil “${profileName}” y todos sus datos de sesión?`)) return
    try {
      setLibrary(await window.webApps.deleteProfile(site.id, profileId))
      setNotice(`Perfil “${profileName}” eliminado.`)
    } catch (error) {
      setNotice(getErrorMessage(error))
    }
  }

  async function openProfile(site: WebAppSite, profileId: string): Promise<void> {
    try {
      await window.webApps.openProfile(site.id, profileId)
    } catch (error) {
      setNotice(getErrorMessage(error))
    }
  }

  async function submitLink(input: ExternalLinkInput): Promise<void> {
    try {
      const updated = dialog?.kind === 'link' && dialog.link
        ? await window.webApps.updateExternalLink(dialog.link.id, input)
        : await window.webApps.createExternalLink(input)
      setLibrary(updated)
      setDialog(null)
      setNotice(dialog?.kind === 'link' && dialog.link ? 'Enlace actualizado.' : 'Enlace añadido.')
    } catch (error) {
      setNotice(getErrorMessage(error))
    }
  }

  async function removeLink(link: ExternalLinkRecord): Promise<void> {
    if (!window.confirm(`¿Eliminar el enlace “${link.name}”?`)) return
    try {
      setLibrary(await window.webApps.deleteExternalLink(link.id))
      setNotice(`Enlace “${link.name}” eliminado.`)
    } catch (error) {
      setNotice(getErrorMessage(error))
    }
  }

  async function openExternalLink(link: ExternalLinkRecord): Promise<void> {
    try {
      await window.webApps.openExternalLink(link.id)
    } catch (error) {
      setNotice(getErrorMessage(error))
    }
  }

  async function setItemIcon(itemType: 'site' | 'link', itemId: string, source: 'favicon' | 'custom'): Promise<void> {
    try {
      setLibrary(await window.webApps.setIcon(itemType, itemId, source))
      setNotice(source === 'custom' ? 'Icono personalizado guardado.' : 'Favicon actualizado.')
    } catch (error) {
      setNotice(getErrorMessage(error))
    }
  }

  async function saveCategory(name: string): Promise<void> {
    try {
      const updated = dialog?.kind === 'category' && dialog.category
        ? await window.webApps.updateCategory(dialog.category.id, name)
        : await window.webApps.createCategory(name)
      setLibrary(updated)
      setDialog(null)
      setNotice(dialog?.kind === 'category' && dialog.category ? 'Categoría actualizada.' : 'Categoría creada.')
    } catch (error) {
      setNotice(getErrorMessage(error))
    }
  }

  async function moveCategory(categoryId: string, direction: 'up' | 'down'): Promise<void> {
    try {
      setLibrary(await window.webApps.moveCategory(categoryId, direction))
    } catch (error) {
      setNotice(getErrorMessage(error))
    }
  }

  function canMoveSite(siteId: string, direction: 'up' | 'down'): boolean {
    const index = visibleSites.findIndex((site) => site.id === siteId)
    return direction === 'up' ? index > 0 : index >= 0 && index < visibleSites.length - 1
  }

  async function moveSite(siteId: string, direction: 'up' | 'down'): Promise<void> {
    try {
      setLibrary(await window.webApps.moveSite(siteId, direction, activeCategoryId))
      setNotice('Orden de sitios actualizado.')
    } catch (error) {
      setNotice(getErrorMessage(error))
    }
  }

  async function changeWorkspace(workspaceId: string): Promise<void> {
    try {
      setLibrary(await window.webApps.switchWorkspace(workspaceId))
      setNotice('Workspace cambiado.')
    } catch (error) {
      setNotice(getErrorMessage(error))
    }
  }

  function openRenameWorkspaceDialog(): void {
    const current = library.workspaces?.find((workspace) => workspace.id === library.activeWorkspaceId)
    if (!current) return
    setDialog({ kind: 'workspace', mode: 'rename', workspaceId: current.id, name: current.name })
  }

  async function submitWorkspace(name: string): Promise<void> {
    if (dialog?.kind !== 'workspace') return
    try {
      const updated = dialog.mode === 'create'
        ? await window.webApps.createWorkspace(name)
        : await window.webApps.renameWorkspace(dialog.workspaceId, name)
      setLibrary(updated)
      setDialog(null)
      setNotice(dialog.mode === 'create' ? 'Workspace creado.' : 'Workspace renombrado.')
    } catch (error) {
      setNotice(getErrorMessage(error))
    }
  }

  async function exportWorkspace(): Promise<void> {
    try {
      const exported = await window.webApps.exportWorkspace()
      if (exported) setNotice('Workspace exportado. Las sesiones y extensiones no se incluyen.')
    } catch (error) {
      setNotice(getErrorMessage(error))
    }
  }

  async function importWorkspace(): Promise<void> {
    try {
      const imported = await window.webApps.importWorkspace()
      if (imported) {
        setLibrary(imported)
        setNotice('Workspace importado. Reinstala las extensiones que necesites.')
      }
    } catch (error) {
      setNotice(getErrorMessage(error))
    }
  }

  async function installCatalogSite(site: { name: string; url: string }): Promise<void> {
    try {
      setLibrary(await window.webApps.createSite({ name: site.name, url: site.url, profileName: defaultProfileName() }))
      setNotice(`${site.name} añadido al workspace.`)
    } catch (error) {
      setNotice(getErrorMessage(error))
    }
  }

  async function removeCategory(category: AppCategory): Promise<void> {
    if (!window.confirm(`¿Eliminar la categoría “${category.name}”? Sus elementos pasarán a “Sin categoría”.`)) return
    try {
      setLibrary(await window.webApps.deleteCategory(category.id))
      if (activeCategoryId === category.id) setActiveCategoryId('uncategorized')
      setDialog(null)
      setNotice(`Categoría “${category.name}” eliminada.`)
    } catch (error) {
      setNotice(getErrorMessage(error))
    }
  }

  function updateProfileExtensions(profileId: string, extensions: NonNullable<WebAppSite['profiles'][number]['extensions']>): void {
    setLibrary((current) => ({
      ...current,
      sites: current.sites.map((site) => ({
        ...site,
        profiles: site.profiles.map((profile) => profile.id === profileId ? { ...profile, extensions } : profile),
      })),
    }))
  }

  const profileCount = sites.reduce((count, site) => count + site.profiles.length, 0)
  const categoryMatches = (categoryId?: string): boolean => activeCategoryId === null
    || (activeCategoryId === 'uncategorized' ? !categoryId : categoryId === activeCategoryId)
  const visibleSites = sites.filter((site) => categoryMatches(site.categoryId))
  const visibleLinks = links.filter((link) => categoryMatches(link.categoryId))
  const activeCategoryName = activeCategoryId === null
    ? 'Tus aplicaciones'
    : activeCategoryId === 'uncategorized'
      ? 'Sin categoría'
      : categories.find((category) => category.id === activeCategoryId)?.name ?? 'Categoría'

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#inicio" aria-label="WebNest, inicio">
          <span className="brand-mark"><Layers3 size={20} strokeWidth={2.2} /></span>
          <span className="brand-name">webnest<span>.</span></span>
        </a>

        <div className="workspace-label">TU ESPACIO</div>
        <nav className="side-nav" aria-label="Navegación principal">
          <button className={`nav-item${activeView === 'library' ? ' active' : ''}`} type="button" aria-pressed={activeView === 'library'} onClick={() => setActiveView('library')}>
            <Globe2 size={17} />
            <span>Aplicaciones</span>
            <span className="nav-count">{sites.length}</span>
          </button>
          <button className={`nav-item${activeView === 'shop' ? ' active' : ''}`} type="button" aria-pressed={activeView === 'shop'} onClick={() => setActiveView('shop')}>
            <Store size={17} />
            <span>Tienda</span>
          </button>
        </nav>

        <div className="sidebar-rule" />
        <div className="sidebar-note">
          <div className="note-icon"><ShieldCheck size={17} /></div>
          <div>
            <strong>Tus sesiones, separadas</strong>
            <p>Cada perfil guarda sus propias cookies y datos.</p>
          </div>
        </div>

        <div className="sidebar-bottom">
          <div className="engine-status"><span className="status-dot" /> Chromium integrado</div>
          <button className="help-link" type="button" onClick={() => setNotice('Cada perfil tiene su sesión aislada. Alt+Shift+T oculta o muestra su toolbar.') }>
            <CircleHelp size={16} /> Acerca de WebNest
          </button>
        </div>
      </aside>

      <main className="main-content" id="apps" tabIndex={-1}>
        <header className="topbar">
          <div className="workspace-switcher">
            <span>Workspace</span>
            <select aria-label="Workspace activo" value={library.activeWorkspaceId ?? ''} onChange={(event) => void changeWorkspace(event.target.value)}>
              {(library.workspaces ?? []).map((workspace) => <option value={workspace.id} key={workspace.id}>{workspace.name}</option>)}
            </select>
          </div>
          <div className="topbar-right">
            <span className="engine-pill"><span className="status-dot" /> Motor Chromium</span>
            <details className="workspace-menu">
              <summary aria-label="Opciones del workspace" title="Opciones del workspace"><MoreHorizontal size={18} /></summary>
              <div className="workspace-menu-items">
                <button type="button" onClick={() => setDialog({ kind: 'workspace', mode: 'create' })}>Nuevo workspace</button>
                <button type="button" onClick={openRenameWorkspaceDialog}>Renombrar workspace</button>
                <button type="button" onClick={() => void exportWorkspace()}><Download size={14} /> Exportar configuración</button>
                <button type="button" onClick={() => void importWorkspace()}><FolderOpen size={14} /> Importar configuración</button>
              </div>
            </details>
            <div className="avatar" aria-label="Perfil local">W</div>
          </div>
        </header>

        <div className="content-wrap">
          <section className="page-heading">
            <div>
              <div className="eyebrow"><Sparkles size={13} /> {activeView === 'shop' ? 'DESCUBRE NUEVOS SITIOS' : library.activeWorkspaceName?.toUpperCase() ?? 'TU ESPACIO DIGITAL'}</div>
              <h1>{activeView === 'shop' ? 'Tienda de sitios' : activeCategoryName}<span className="heading-period">.</span></h1>
              <p className="page-subtitle">{activeView === 'shop' ? 'Añade servicios a tu biblioteca con perfiles aislados.' : 'Sitios y enlaces, organizados a tu manera.'}</p>
            </div>
            {activeView === 'library' && <div className="heading-actions">
              <button className="button button-quiet" type="button" onClick={() => setDialog({ kind: 'link' })}><Link2 size={16} /> Añadir enlace</button>
              <button className="button button-primary install-button" type="button" onClick={() => openSiteDialog()}>
                <Plus size={18} strokeWidth={2.2} /> Instalar sitio
              </button>
            </div>}
          </section>

          {activeView === 'library' && <section className="summary-row" aria-label="Resumen">
            <div className="summary-item"><span className="summary-number">{sites.length.toString().padStart(2, '0')}</span><span>SITIOS</span></div>
            <div className="summary-separator" />
            <div className="summary-item"><span className="summary-number">{links.length.toString().padStart(2, '0')}</span><span>ENLACES</span></div>
            <div className="summary-separator" />
            <div className="summary-item"><span className="summary-number">{profileCount.toString().padStart(2, '0')}</span><span>PERFILES AISLADOS</span></div>
            <div className="summary-caption"><span className="summary-lock"><ShieldCheck size={14} /></span> Privados por diseño</div>
          </section>}

          {activeView === 'library' && <nav className="category-bar" aria-label="Categorías">
            <div className="category-scroll">
              <button className={`category-chip${activeCategoryId === null ? ' active' : ''}`} type="button" aria-pressed={activeCategoryId === null} onClick={() => setActiveCategoryId(null)}>
                <Layers3 size={14} /> Todo
              </button>
              <button className={`category-chip${activeCategoryId === 'uncategorized' ? ' active' : ''}`} type="button" aria-pressed={activeCategoryId === 'uncategorized'} onClick={() => setActiveCategoryId('uncategorized')}>
                <Folder size={14} /> Sin categoría
              </button>
              {categories.map((category) => (
                <span className="category-chip-wrap" key={category.id}>
                  <button className={`category-chip${activeCategoryId === category.id ? ' active' : ''}`} type="button" aria-pressed={activeCategoryId === category.id} onClick={() => setActiveCategoryId(category.id)}>
                    <Folder size={14} /> {category.name}
                  </button>
                  <button className="category-edit" type="button" aria-label={`Editar categoría ${category.name}`} onClick={() => setDialog({ kind: 'category', category })}><MoreHorizontal size={14} /></button>
                </span>
              ))}
              <button className="category-create" type="button" onClick={() => setDialog({ kind: 'category' })}><FolderPlus size={15} /> Nueva carpeta</button>
            </div>
            <div className="view-mode-toggle" role="group" aria-label="Vista de aplicaciones">
              <button className={layoutMode === 'grid' ? 'active' : ''} type="button" aria-label="Vista de cuadrícula" title="Vista de cuadrícula" aria-pressed={layoutMode === 'grid'} onClick={() => setLayoutMode('grid')}><LayoutGrid size={15} /></button>
              <button className={layoutMode === 'list' ? 'active' : ''} type="button" aria-label="Vista de lista" title="Vista de lista" aria-pressed={layoutMode === 'list'} onClick={() => setLayoutMode('list')}><List size={15} /></button>
            </div>
          </nav>}

          {activeView === 'shop' ? <Shop installedUrls={sites.map((site) => site.url)} onInstall={installCatalogSite} /> : <section className="apps-section" aria-labelledby="apps-heading">
            <div className="section-heading">
              <div>
                <h2 id="apps-heading">{activeCategoryName}</h2>
                <span className="section-caption">Aplicaciones aisladas y enlaces del navegador</span>
              </div>
              {(visibleSites.length + visibleLinks.length) > 0 && <span className="collection-count">{visibleSites.length + visibleLinks.length} elementos</span>}
            </div>

            {loading ? (
              <div className="loading-state"><span className="loading-dot" /> Preparando tu espacio…</div>
            ) : visibleSites.length === 0 && visibleLinks.length === 0 ? (
              <div className="empty-state">
                <div className="empty-art" aria-hidden="true">
                  <div className="empty-orbit orbit-one" />
                  <div className="empty-orbit orbit-two" />
                  <div className="empty-window"><div className="empty-window-bar"><i /><i /><i /></div><div className="empty-window-mark"><Globe2 size={30} /></div></div>
                  <span className="empty-spark spark-one">✳</span><span className="empty-spark spark-two">✦</span>
                </div>
                <h3>{sites.length + links.length === 0 ? 'Tu espacio empieza aquí' : 'Esta carpeta está vacía'}</h3>
                <p>Añade una Web App con perfiles aislados o un enlace para abrirlo en tu navegador habitual.</p>
                <div className="empty-actions">
                  <button className="button button-primary" type="button" onClick={() => openSiteDialog()}><Plus size={17} /> Instalar sitio</button>
                  <button className="button button-quiet" type="button" onClick={() => setDialog({ kind: 'link' })}><Link2 size={16} /> Añadir enlace</button>
                </div>
                <span className="empty-footnote"><ShieldCheck size={13} /> Las sesiones nunca se mezclan</span>
              </div>
            ) : layoutMode === 'list' ? (
              <div className="library-list-view">
                {visibleSites.length > 0 && <section className="site-list-section" aria-labelledby="site-list-heading">
                  <div className="site-list-heading"><h3 id="site-list-heading">Sitios</h3><span>{visibleSites.length}</span></div>
                  <div className="site-list-rows">
                    {visibleSites.map((site) => (
                      <article className="site-list-row" key={site.id}>
                        <div className="site-identity site-list-identity">
                          <div className="site-icon">
                            {site.iconDataUrl ? <img src={site.iconDataUrl} alt="" /> : <span>{site.name.slice(0, 1).toUpperCase()}</span>}
                          </div>
                          <div className="site-title-wrap">
                            <h3>{site.name}</h3>
                            <span className="site-host">{getHost(site.url)}</span>
                          </div>
                        </div>
                        <div className="site-list-profiles" aria-label={`Perfiles de ${site.name}`}>
                          {site.profiles.map((profile) => (
                            <div className="site-list-profile" key={profile.id}>
                              <button className="site-list-open" type="button" aria-label={`Abrir ${site.name}, perfil ${profile.name}`} onClick={() => void openProfile(site, profile.id)}>
                                <span>{profile.name}</span><ArrowUpRight size={13} />
                              </button>
                              <button className="profile-extensions" type="button" aria-label={`Gestionar extensiones de ${profile.name}`} title={`${library.globalExtensions.length} globales, ${profile.extensions?.length ?? 0} de este perfil`} onClick={() => setDialog({ kind: 'extensions', site, profile })}>
                                <Puzzle size={13} /><span>{library.globalExtensions.length + (profile.extensions?.length ?? 0)}</span>
                              </button>
                              <button className="profile-delete" type="button" aria-label={`Eliminar perfil ${profile.name}`} onClick={() => void removeProfile(site, profile.id, profile.name)}><X size={14} /></button>
                            </div>
                          ))}
                          <button className="site-list-add-profile" type="button" aria-label={`Añadir perfil a ${site.name}`} onClick={() => setDialog({ kind: 'profile', site })}><Plus size={14} /></button>
                        </div>
                        <div className="site-list-actions">
                          <div className="site-order-controls">
                            <button className="site-order-button" type="button" aria-label={`Mover ${site.name} arriba`} title="Mover arriba" disabled={!canMoveSite(site.id, 'up')} onClick={() => void moveSite(site.id, 'up')}><ArrowUp size={15} /></button>
                            <button className="site-order-button" type="button" aria-label={`Mover ${site.name} abajo`} title="Mover abajo" disabled={!canMoveSite(site.id, 'down')} onClick={() => void moveSite(site.id, 'down')}><ArrowDown size={15} /></button>
                          </div>
                          <div className="card-actions">
                            <button className="icon-button" type="button" aria-label={`Opciones de ${site.name}`}><MoreHorizontal size={19} /></button>
                            <div className="action-menu">
                              <button type="button" onClick={() => openSiteDialog(site)}><ArrowDownLeft size={15} /> Editar sitio</button>
                              <button type="button" onClick={() => void setItemIcon('site', site.id, 'favicon')}><Download size={15} /> Descargar favicon</button>
                              <button type="button" onClick={() => void setItemIcon('site', site.id, 'custom')}><Image size={15} /> Icono personalizado</button>
                              <button className="danger-action" type="button" onClick={() => void removeSite(site)}><Trash2 size={15} /> Eliminar sitio</button>
                            </div>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>}

                {visibleLinks.length > 0 && <section className="site-list-section" aria-labelledby="link-list-heading">
                  <div className="site-list-heading"><h3 id="link-list-heading">Enlaces externos</h3><span>{visibleLinks.length}</span></div>
                  <div className="site-list-rows">
                    {visibleLinks.map((link) => (
                      <article className="site-list-row link-list-row" key={link.id}>
                        <div className="site-identity site-list-identity">
                          <div className="site-icon">
                            {link.iconDataUrl ? <img src={link.iconDataUrl} alt="" /> : <Link2 size={18} />}
                          </div>
                          <div className="site-title-wrap">
                            <h3>{link.name}</h3>
                            <span className="site-host">{getHost(link.url)}</span>
                          </div>
                        </div>
                        <span className="site-list-link-kind">Se abre en el navegador</span>
                        <button className="open-link site-list-open-link" type="button" onClick={() => void openExternalLink(link)}>
                          Abrir <ExternalLink size={14} />
                        </button>
                        <div className="card-actions">
                          <button className="icon-button" type="button" aria-label={`Opciones de ${link.name}`}><MoreHorizontal size={19} /></button>
                          <div className="action-menu">
                            <button type="button" onClick={() => setDialog({ kind: 'link', link })}><ArrowDownLeft size={15} /> Editar enlace</button>
                            <button type="button" onClick={() => void setItemIcon('link', link.id, 'favicon')}><Download size={15} /> Descargar favicon</button>
                            <button type="button" onClick={() => void setItemIcon('link', link.id, 'custom')}><Image size={15} /> Icono personalizado</button>
                            <button className="danger-action" type="button" onClick={() => void removeLink(link)}><Trash2 size={15} /> Eliminar enlace</button>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>}
              </div>
            ) : (
              <div className="site-grid">
                {visibleSites.map((site) => (
                  <article className="site-card" key={site.id}>
                    <div className="site-card-top">
                      <div className="site-identity">
                        <div className="site-icon">
                          {site.iconDataUrl
                            ? <img src={site.iconDataUrl} alt="" />
                            : <span>{site.name.slice(0, 1).toUpperCase()}</span>}
                        </div>
                        <div className="site-title-wrap">
                          <h3>{site.name}</h3>
                          <span className="site-host">{getHost(site.url)}</span>
                        </div>
                      </div>
                      <div className="card-actions">
                        <button className="icon-button" type="button" aria-label={`Opciones de ${site.name}`}><MoreHorizontal size={19} /></button>
                        <div className="action-menu">
                          <button type="button" onClick={() => openSiteDialog(site)}><ArrowDownLeft size={15} /> Editar sitio</button>
                          <button type="button" onClick={() => void setItemIcon('site', site.id, 'favicon')}><Download size={15} /> Descargar favicon</button>
                          <button type="button" onClick={() => void setItemIcon('site', site.id, 'custom')}><Image size={15} /> Icono personalizado</button>
                          <button type="button" disabled={!canMoveSite(site.id, 'up')} onClick={() => void moveSite(site.id, 'up')}><ArrowUp size={15} /> Mover arriba</button>
                          <button type="button" disabled={!canMoveSite(site.id, 'down')} onClick={() => void moveSite(site.id, 'down')}><ArrowDown size={15} /> Mover abajo</button>
                          <button className="danger-action" type="button" onClick={() => void removeSite(site)}><Trash2 size={15} /> Eliminar sitio</button>
                        </div>
                      </div>
                    </div>

                    <div className="profile-heading"><span>PERFILES</span><span>{site.profiles.length.toString().padStart(2, '0')}</span></div>
                    <ul className="profile-list">
                      {site.profiles.map((profile) => (
                        <li className="profile-row" key={profile.id}>
                          <div className="profile-avatar">{profile.name.slice(0, 1).toUpperCase()}</div>
                          <span className="profile-name">{profile.name}</span>
                          <button className="profile-delete" type="button" aria-label={`Eliminar perfil ${profile.name}`} onClick={() => void removeProfile(site, profile.id, profile.name)}><X size={15} /></button>
                          <button className="profile-extensions" type="button" aria-label={`Gestionar extensiones de ${profile.name}`} title={`${library.globalExtensions.length} globales, ${profile.extensions?.length ?? 0} de este perfil`} onClick={() => setDialog({ kind: 'extensions', site, profile })}>
                            <Puzzle size={14} /><span>{library.globalExtensions.length + (profile.extensions?.length ?? 0)}</span>
                          </button>
                          <button className="open-profile" type="button" aria-label={`Abrir ${site.name}, perfil ${profile.name}`} onClick={() => void openProfile(site, profile.id)}>
                            Abrir <ArrowUpRight size={14} />
                          </button>
                        </li>
                      ))}
                    </ul>
                    <button className="add-profile" type="button" onClick={() => setDialog({ kind: 'profile', site })}>
                      <span className="add-profile-icon"><UserRoundPlus size={15} /></span>
                      Añadir otro perfil
                      <Plus className="add-profile-plus" size={15} />
                    </button>
                    <div className="site-card-footer"><ShieldCheck size={13} /> Perfiles con sesiones independientes</div>
                  </article>
                ))}

                {visibleLinks.map((link) => (
                  <article className="site-card link-card" key={link.id}>
                    <div className="site-card-top">
                      <div className="site-identity">
                        <div className="site-icon">
                          {link.iconDataUrl ? <img src={link.iconDataUrl} alt="" /> : <Link2 size={18} />}
                        </div>
                        <div className="site-title-wrap"><h3>{link.name}</h3><span className="site-host">{getHost(link.url)}</span></div>
                      </div>
                      <div className="card-actions">
                        <button className="icon-button" type="button" aria-label={`Opciones de ${link.name}`}><MoreHorizontal size={19} /></button>
                        <div className="action-menu">
                          <button type="button" onClick={() => setDialog({ kind: 'link', link })}><ArrowDownLeft size={15} /> Editar enlace</button>
                          <button type="button" onClick={() => void setItemIcon('link', link.id, 'favicon')}><Download size={15} /> Descargar favicon</button>
                          <button type="button" onClick={() => void setItemIcon('link', link.id, 'custom')}><Image size={15} /> Icono personalizado</button>
                          <button className="danger-action" type="button" onClick={() => void removeLink(link)}><Trash2 size={15} /> Eliminar enlace</button>
                        </div>
                      </div>
                    </div>
                    <button className="open-link" type="button" onClick={() => void openExternalLink(link)}>
                      Abrir en navegador <ExternalLink size={14} />
                    </button>
                    <div className="site-card-footer"><ExternalLink size={13} /> Se abre en el navegador predeterminado</div>
                  </article>
                ))}

                <button className="add-site-card" type="button" onClick={() => openSiteDialog()}>
                  <span className="add-site-icon"><Plus size={20} /></span>
                  <strong>Añadir un sitio</strong>
                  <span>Tu próximo espacio está a un clic.</span>
                </button>
                <button className="add-site-card add-link-card" type="button" onClick={() => setDialog({ kind: 'link' })}>
                  <span className="add-site-icon"><Link2 size={18} /></span>
                  <strong>Añadir enlace externo</strong>
                  <span>Se abrirá fuera de WebNest.</span>
                </button>
              </div>
            )}
          </section>}

          <footer className="page-footer"><span>WEBNEST <i>·</i> ESPACIOS QUE SE SIENTEN TUYOS</span><span className="author-credit">Creado por Juan Avila</span><span>Chromium integrado <ExternalLink size={12} /></span></footer>
        </div>
      </main>

      <dialog className="app-dialog" ref={dialogRef} onClose={() => setDialog(null)} onClick={(event) => {
        const bounds = dialogRef.current?.getBoundingClientRect()
        if (event.target === dialogRef.current && bounds && (
          event.clientX < bounds.left || event.clientX > bounds.right
          || event.clientY < bounds.top || event.clientY > bounds.bottom
        )) dialogRef.current?.close()
      }}>
        {dialog?.kind === 'site' && <SiteForm site={dialog.site} categories={categories} defaultCategoryId={selectedCategoryId()} onSubmit={(input) => void submitSite(input)} onCancel={() => setDialog(null)} />}
        {dialog?.kind === 'link' && <LinkForm link={dialog.link} categories={categories} defaultCategoryId={selectedCategoryId()} onSubmit={(input) => void submitLink(input)} onCancel={() => setDialog(null)} />}
        {dialog?.kind === 'profile' && <ProfileForm site={dialog.site} onSubmit={(name) => void submitProfile(dialog.site, name)} onCancel={() => setDialog(null)} />}
        {dialog?.kind === 'extensions' && <ExtensionManager site={dialog.site} profile={dialog.profile} onClose={() => setDialog(null)} onChange={(extensions) => updateProfileExtensions(dialog.profile.id, extensions)} />}
        {dialog?.kind === 'workspace' && <WorkspaceForm
          key={`${dialog.mode}:${dialog.mode === 'rename' ? dialog.workspaceId : ''}`}
          mode={dialog.mode}
          initialName={dialog.mode === 'rename' ? dialog.name : ''}
          onSubmit={submitWorkspace}
          onCancel={() => setDialog(null)}
        />}
        {dialog?.kind === 'category' && <CategoryForm
          category={dialog.category}
          onSubmit={(name) => void saveCategory(name)}
          onDelete={dialog.category ? () => void removeCategory(dialog.category!) : undefined}
          onMove={(direction) => dialog.category && void moveCategory(dialog.category.id, direction)}
          canMoveUp={Boolean(dialog.category && categories.findIndex((item) => item.id === dialog.category?.id) > 0)}
          canMoveDown={Boolean(dialog.category && categories.findIndex((item) => item.id === dialog.category?.id) < categories.length - 1)}
          onCancel={() => setDialog(null)}
        />}
      </dialog>

      <div className="toast" aria-live="polite" aria-atomic="true" data-visible={Boolean(notice)}>
        <span className="toast-check"><Check size={14} /></span>{notice}
      </div>
    </div>
  )
}

function SiteForm({ site, categories, defaultCategoryId, onSubmit, onCancel }: {
  site?: WebAppSite
  categories: AppCategory[]
  defaultCategoryId?: string
  onSubmit: (input: CreateSiteInput) => void
  onCancel: () => void
}): React.JSX.Element {
  const [name, setName] = useState(site?.name ?? '')
  const [url, setUrl] = useState(site?.url ?? '')
  const [profileName, setProfileName] = useState(defaultProfileName)
  const [categoryId, setCategoryId] = useState(site?.categoryId ?? defaultCategoryId ?? '')

  return (
    <form className="dialog-form" onSubmit={(event) => {
      event.preventDefault()
      onSubmit({ name, url, profileName, categoryId: categoryId || undefined })
    }}>
      <div className="dialog-topline"><span className="dialog-mark"><Globe2 size={18} /></span><button className="dialog-close" type="button" aria-label="Cerrar" onClick={onCancel}><X size={18} /></button></div>
      <span className="eyebrow">{site ? 'AJUSTES DEL SITIO' : 'NUEVO ESPACIO'}</span>
      <h2>{site ? 'Editar sitio' : 'Instalar una Web App'}</h2>
      <p className="dialog-copy">{site ? 'Actualiza el nombre o la dirección de este sitio.' : 'Añade un sitio y abre cada cuenta en su propio perfil aislado.'}</p>
      <label className="field-label" htmlFor="site-name">Nombre</label>
      <input id="site-name" autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej. ChatGPT" maxLength={80} required />
      <label className="field-label" htmlFor="site-url">URL del sitio</label>
       <input id="site-url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://chatgpt.com o http://intranet.local" required />
      <label className="field-label" htmlFor="site-category">Categoría</label>
      <select id="site-category" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
        <option value="">Sin categoría</option>
        {categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}
      </select>
      {!site && <>
        <label className="field-label" htmlFor="profile-name">Nombre del primer perfil</label>
        <input id="profile-name" value={profileName} onChange={(event) => setProfileName(event.target.value)} placeholder="Profile_XXXXXX" maxLength={80} required />
      </>}
      <div className="dialog-assurance"><ShieldCheck size={15} /> Chromium guardará una sesión separada para este perfil.</div>
      <div className="dialog-actions"><button className="button button-quiet" type="button" onClick={onCancel}>Cancelar</button><button className="button button-primary" type="submit">{site ? 'Guardar cambios' : 'Instalar sitio'} <ArrowUpRight size={15} /></button></div>
    </form>
  )
}

function LinkForm({ link, categories, defaultCategoryId, onSubmit, onCancel }: {
  link?: ExternalLinkRecord
  categories: AppCategory[]
  defaultCategoryId?: string
  onSubmit: (input: ExternalLinkInput) => void
  onCancel: () => void
}): React.JSX.Element {
  const [name, setName] = useState(link?.name ?? '')
  const [url, setUrl] = useState(link?.url ?? '')
  const [categoryId, setCategoryId] = useState(link?.categoryId ?? defaultCategoryId ?? '')

  return (
    <form className="dialog-form" onSubmit={(event) => {
      event.preventDefault()
      onSubmit({ name, url, categoryId: categoryId || undefined })
    }}>
      <div className="dialog-topline"><span className="dialog-mark"><Link2 size={18} /></span><button className="dialog-close" type="button" aria-label="Cerrar" onClick={onCancel}><X size={18} /></button></div>
      <span className="eyebrow">ENLACE EXTERNO</span>
      <h2>{link ? 'Editar enlace' : 'Añadir enlace'}</h2>
      <p className="dialog-copy">Se abrirá en el navegador predeterminado del equipo, sin crear una ventana de WebNest.</p>
      <label className="field-label" htmlFor="link-name">Nombre</label>
      <input id="link-name" autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej. Documentación" maxLength={80} required />
      <label className="field-label" htmlFor="link-url">URL</label>
      <input id="link-url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com" required />
      <label className="field-label" htmlFor="link-category">Categoría</label>
      <select id="link-category" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
        <option value="">Sin categoría</option>
        {categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}
      </select>
      <div className="dialog-assurance"><ExternalLink size={15} /> El favicon se descargará automáticamente cuando esté disponible.</div>
      <div className="dialog-actions"><button className="button button-quiet" type="button" onClick={onCancel}>Cancelar</button><button className="button button-primary" type="submit">{link ? 'Guardar cambios' : 'Añadir enlace'} <ArrowUpRight size={15} /></button></div>
    </form>
  )
}

function CategoryForm({ category, onSubmit, onDelete, onMove, canMoveUp, canMoveDown, onCancel }: {
  category?: AppCategory
  onSubmit: (name: string) => void
  onDelete?: () => void
  onMove?: (direction: 'up' | 'down') => void
  canMoveUp?: boolean
  canMoveDown?: boolean
  onCancel: () => void
}): React.JSX.Element {
  const [name, setName] = useState(category?.name ?? '')

  return (
    <form className="dialog-form" onSubmit={(event) => {
      event.preventDefault()
      onSubmit(name)
    }}>
      <div className="dialog-topline"><span className="dialog-mark"><Folder size={18} /></span><button className="dialog-close" type="button" aria-label="Cerrar" onClick={onCancel}><X size={18} /></button></div>
      <span className="eyebrow">ORGANIZA TU ESPACIO</span>
      <h2>{category ? 'Editar carpeta' : 'Nueva carpeta'}</h2>
      <p className="dialog-copy">Las carpetas pueden contener Web Apps y enlaces externos.</p>
      <label className="field-label" htmlFor="category-name">Nombre</label>
      <input id="category-name" autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej. Trabajo" maxLength={50} required />
      {category && <div className="category-order-actions">
        <span>Orden de la carpeta</span>
        <button className="button button-quiet" type="button" aria-label={`Mover ${category.name} arriba`} disabled={!canMoveUp} onClick={() => onMove?.('up')}><ArrowUp size={14} /> Subir</button>
        <button className="button button-quiet" type="button" aria-label={`Mover ${category.name} abajo`} disabled={!canMoveDown} onClick={() => onMove?.('down')}><ArrowDown size={14} /> Bajar</button>
      </div>}
      <div className="dialog-actions category-dialog-actions">
        {onDelete && <button className="button button-danger-quiet" type="button" onClick={onDelete}>Eliminar carpeta</button>}
        <button className="button button-quiet" type="button" onClick={onCancel}>Cancelar</button>
        <button className="button button-primary" type="submit">{category ? 'Guardar' : 'Crear carpeta'} <FolderPlus size={15} /></button>
      </div>
    </form>
  )
}

function WorkspaceForm({ mode, initialName, onSubmit, onCancel }: {
  mode: 'create' | 'rename'
  initialName: string
  onSubmit: (name: string) => void
  onCancel: () => void
}): React.JSX.Element {
  const [name, setName] = useState(initialName)

  return (
    <form className="dialog-form" onSubmit={(event) => {
      event.preventDefault()
      onSubmit(name)
    }}>
      <div className="dialog-topline"><span className="dialog-mark"><Layers3 size={18} /></span><button className="dialog-close" type="button" aria-label="Cerrar" onClick={onCancel}><X size={18} /></button></div>
      <span className="eyebrow">ORGANIZA TUS ESPACIOS</span>
      <h2>{mode === 'create' ? 'Nuevo workspace' : 'Renombrar workspace'}</h2>
      <p className="dialog-copy">Cada workspace mantiene separadas sus aplicaciones, enlaces y categorías.</p>
      <label className="field-label" htmlFor="workspace-name">Nombre</label>
      <input id="workspace-name" autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej. Personal" maxLength={80} required />
      <div className="dialog-actions">
        <button className="button button-quiet" type="button" onClick={onCancel}>Cancelar</button>
        <button className="button button-primary" type="submit">{mode === 'create' ? 'Crear workspace' : 'Guardar nombre'} <ArrowUpRight size={15} /></button>
      </div>
    </form>
  )
}

function ProfileForm({ site, onSubmit, onCancel }: {
  site: WebAppSite
  onSubmit: (name: string) => void
  onCancel: () => void
}): React.JSX.Element {
  const [name, setName] = useState(defaultProfileName)

  return (
    <form className="dialog-form" onSubmit={(event) => {
      event.preventDefault()
      onSubmit(name)
    }}>
      <div className="dialog-topline"><span className="dialog-mark"><UserRoundPlus size={18} /></span><button className="dialog-close" type="button" aria-label="Cerrar" onClick={onCancel}><X size={18} /></button></div>
      <span className="eyebrow">NUEVA SESIÓN PARA {site.name.toUpperCase()}</span>
      <h2>Añadir perfil</h2>
      <p className="dialog-copy">Tendrá cookies, almacenamiento y una ventana Chromium propios.</p>
      <label className="field-label" htmlFor="new-profile-name">Nombre del perfil</label>
       <input id="new-profile-name" autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Profile_XXXXXX" maxLength={80} required />
      <div className="dialog-assurance"><ShieldCheck size={15} /> No compartirá la sesión de otros perfiles.</div>
      <div className="dialog-actions"><button className="button button-quiet" type="button" onClick={onCancel}>Cancelar</button><button className="button button-primary" type="submit">Crear perfil <Plus size={15} /></button></div>
    </form>
  )
}

function ExtensionManager({ site, profile, onClose, onChange }: {
  site: WebAppSite
  profile: WebAppSite['profiles'][number]
  onClose: () => void
  onChange: (extensions: NonNullable<WebAppSite['profiles'][number]['extensions']>) => void
}): React.JSX.Element {
  const [extensions, setExtensions] = useState<ExtensionCollection>({ global: [], profile: profile.extensions ?? [] })
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [scan, setScan] = useState<BrowserExtensionScan | null>(null)
  const [selectedCandidates, setSelectedCandidates] = useState<Set<string>>(new Set())

  useEffect(() => {
    window.webApps.listProfileExtensions(profile.id)
      .then(setExtensions)
      .catch((reason: unknown) => setError(getErrorMessage(reason)))
      .finally(() => setLoading(false))
  }, [profile.id])

  async function importExtension(source: 'folder' | 'zip', scope: ExtensionScope): Promise<void> {
    setBusy(true)
    setError('')
    try {
      const items = await window.webApps.importExtension(profile.id, source, scope)
      setExtensions(items)
      onChange(items.profile)
    } catch (reason) {
      setError(getErrorMessage(reason))
    } finally {
      setBusy(false)
    }
  }

  async function removeExtension(extensionId: string, name: string, scope: ExtensionScope): Promise<void> {
    const confirmation = scope === 'global'
      ? `¿Quitar “${name}” de todos los perfiles?`
      : `¿Quitar “${name}” de este perfil?`
    if (!window.confirm(confirmation)) return
    setBusy(true)
    setError('')
    try {
      const items = await window.webApps.removeExtension(profile.id, extensionId, scope)
      setExtensions(items)
      onChange(items.profile)
    } catch (reason) {
      setError(getErrorMessage(reason))
    } finally {
      setBusy(false)
    }
  }

  async function scanBrowser(source: BrowserExtensionSource): Promise<void> {
    setBusy(true)
    setError('')
    setScan(null)
    setSelectedCandidates(new Set())
    try {
      const result = await window.webApps.scanBrowserExtensions(source)
      if (!result.token) return
      setScan(result)
    } catch (reason) {
      setError(getErrorMessage(reason))
    } finally {
      setBusy(false)
    }
  }

  function toggleCandidate(candidateId: string): void {
    setSelectedCandidates((current) => {
      const next = new Set(current)
      if (next.has(candidateId)) next.delete(candidateId)
      else next.add(candidateId)
      return next
    })
  }

  async function importScanned(scope: ExtensionScope): Promise<void> {
    if (!scan || selectedCandidates.size === 0) return
    setBusy(true)
    setError('')
    try {
      const result = await window.webApps.importBrowserExtensions(profile.id, scope, scan.token, [...selectedCandidates])
      setExtensions(result)
      onChange(result.profile)
      setScan(null)
      setSelectedCandidates(new Set())
    } catch (reason) {
      setError(getErrorMessage(reason))
      try {
        const current = await window.webApps.listProfileExtensions(profile.id)
        setExtensions(current)
        onChange(current.profile)
      } catch {
        // Keep the import error visible if refreshing the profile list also fails.
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="extension-manager">
      <div className="dialog-topline">
        <span className="dialog-mark"><Puzzle size={18} /></span>
        <button className="dialog-close" type="button" aria-label="Cerrar" onClick={onClose}><X size={18} /></button>
      </div>
      <span className="eyebrow">{site.name.toUpperCase()} · {profile.name.toUpperCase()}</span>
      <h2>Extensiones</h2>
      <p className="dialog-copy">Las extensiones globales se cargan en todos los perfiles, pero sus datos siguen separados por sesión.</p>

      <div className="extension-scope-block">
        <div className="extension-scope-heading"><strong>Globales</strong><span>{extensions.global.length} en todos los perfiles</span></div>
        <div className="extension-import-actions">
          <button className="button button-quiet" type="button" disabled={busy} onClick={() => void importExtension('folder', 'global')}><FolderOpen size={15} /> Carpeta global</button>
          <button className="button button-quiet" type="button" disabled={busy} onClick={() => void importExtension('zip', 'global')}><Archive size={15} /> ZIP global</button>
        </div>
      </div>
      <div className="extension-scope-block">
        <div className="extension-scope-heading"><strong>Solo este perfil</strong><span>{extensions.profile.length} extensiones</span></div>
        <div className="extension-import-actions">
          <button className="button button-quiet" type="button" disabled={busy} onClick={() => void importExtension('folder', 'profile')}><FolderOpen size={15} /> Elegir carpeta</button>
          <button className="button button-quiet" type="button" disabled={busy} onClick={() => void importExtension('zip', 'profile')}><Archive size={15} /> Importar ZIP</button>
        </div>
      </div>
      <p className="extension-compatibility"><ShieldCheck size={14} /> No todas las Chrome APIs están soportadas por Electron. Los permisos de una extensión global se aplican en todos los perfiles compatibles. No se instala directamente desde Chrome Web Store.</p>

      <div className="browser-import-block">
        <div className="extension-scope-heading"><strong>Importar desde un navegador Chromium</strong><span>Chrome o Comet</span></div>
        <div className="browser-import-actions">
          <button className="button button-quiet" type="button" disabled={busy} onClick={() => void scanBrowser('chrome')}>Escanear Chrome</button>
          <button className="button button-quiet" type="button" disabled={busy} onClick={() => void scanBrowser('comet')}>Escanear Comet</button>
          <button className="button button-quiet" type="button" disabled={busy} onClick={() => void scanBrowser('folder')}>Otra carpeta</button>
        </div>
      </div>

      {scan && <div className="browser-scan-panel">
        <div className="browser-scan-heading">
          <strong>{scan.candidates.length} extensiones encontradas en {scan.sourceName}</strong>
          <button className="dialog-close" type="button" aria-label="Cerrar resultados" onClick={() => { setScan(null); setSelectedCandidates(new Set()) }}><X size={15} /></button>
        </div>
        <div className="browser-candidate-list">
          {scan.candidates.map((candidate: BrowserExtensionCandidate) => (
            <label className="browser-candidate" key={candidate.id}>
              <input type="checkbox" disabled={candidate.exceedsSizeLimit} checked={selectedCandidates.has(candidate.id)} onChange={() => toggleCandidate(candidate.id)} />
              <span className="browser-candidate-details">
                <strong>{candidate.name}</strong>
                <span>Versión {candidate.version} · Manifest V{candidate.manifestVersion} · {candidate.exceedsSizeLimit ? `Más de 1 GiB (${formatExtensionSize(candidate.sizeBytes)})` : formatExtensionSize(candidate.sizeBytes)}</span>
                {candidate.exceedsSizeLimit && <span className="extension-size-error">Supera el límite de importación de 1 GiB.</span>}
                {!candidate.exceedsSizeLimit && candidate.sizeBytes > 128 * 1024 * 1024 && <span className="extension-size-warning">Grande: solicitará confirmación antes de importar.</span>}
                <span className="extension-permissions">Permisos: {[...candidate.permissions, ...candidate.hostPermissions].slice(0, 3).join(', ') || 'ninguno'}{candidate.permissions.length + candidate.hostPermissions.length > 3 ? '…' : ''}</span>
              </span>
            </label>
          ))}
        </div>
        <div className="browser-import-submit">
          <button className="button button-quiet" type="button" disabled={busy || selectedCandidates.size === 0} onClick={() => void importScanned('profile')}>Instalar en este perfil</button>
          <button className="button button-primary" type="button" disabled={busy || selectedCandidates.size === 0} onClick={() => void importScanned('global')}>Instalar globalmente</button>
        </div>
      </div>}

      <div className="extension-list" aria-live="polite">
        {loading ? <span className="extension-empty">Cargando extensiones…</span> : extensions.global.length + extensions.profile.length === 0 ? (
          <span className="extension-empty">Todavía no hay extensiones instaladas.</span>
        ) : (['global', 'profile'] as const).flatMap((scope) => extensions[scope].map((extension) => (
          <article className="extension-item" key={`${scope}:${extension.id}`}>
            <span className="extension-icon">
              {extension.iconDataUrl ? <img src={extension.iconDataUrl} alt="" /> : <Puzzle size={17} />}
            </span>
            <span className="extension-details">
              <strong>{extension.name} <small>{scope === 'global' ? 'GLOBAL' : 'PERFIL'}</small></strong>
              <span>Versión {extension.version} · {extension.hasPopup ? 'popup disponible' : 'sin popup de acción'}</span>
              <span className="extension-permissions">Permisos: {[...extension.permissions, ...extension.hostPermissions].slice(0, 3).join(', ') || 'ninguno'}{extension.permissions.length + extension.hostPermissions.length > 3 ? '…' : ''}</span>
            </span>
            <button className="extension-remove" type="button" disabled={busy} aria-label={`Quitar ${extension.name}`} onClick={() => void removeExtension(extension.id, extension.name, scope)}><Trash2 size={15} /></button>
          </article>
        ))) }
      </div>
      {error && <p className="extension-error" role="alert">{error}</p>}
      <div className="dialog-actions extension-dialog-actions"><button className="button button-primary" type="button" disabled={busy} onClick={onClose}>Listo</button></div>
    </div>
  )
}

export default App
