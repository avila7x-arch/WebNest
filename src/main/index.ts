import { randomUUID } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import extractZip from 'extract-zip'
import electronUpdater from 'electron-updater'
import { app, BrowserWindow, clipboard, dialog, globalShortcut, ipcMain, Menu, nativeImage, screen, session, shell, Tray } from 'electron'
import type { MessageBoxOptions } from 'electron'
import type {
  AppCategory,
  BrowserExtensionCandidate,
  BrowserExtensionScan,
  BrowserExtensionSource,
  CreateSiteInput,
  ExternalLink,
  ExternalLinkInput,
  ExtensionCollection,
  ExtensionScope,
  ExtensionToolbarEntry,
  LibrarySnapshot,
  ProfileExtension,
  WebAppProfile,
  WebAppSite,
  WorkspaceExport,
  WorkspaceSummary,
} from '../shared/types'

const { autoUpdater } = electronUpdater

interface WorkspaceData extends WorkspaceSummary {
  sites: WebAppSite[]
  links: ExternalLink[]
  categories: AppCategory[]
  globalExtensions: ProfileExtension[]
}

const DEFAULT_WORKSPACE_ID = 'default'
const windows = new Map<string, BrowserWindow>()
const extensionToolbars = new Map<string, BrowserWindow>()
const extensionPopups = new Map<string, BrowserWindow>()
const hiddenExtensionToolbars = new Set<string>()
const pendingExtensionScans = new Map<string, Map<string, { directory: string; manifest: Record<string, unknown>; candidate: BrowserExtensionCandidate }>>()
const MAX_EXTENSION_SIZE_BYTES = 1024 * 1024 * 1024
const LARGE_EXTENSION_WARNING_BYTES = 128 * 1024 * 1024
const MAX_EXTENSION_FILES = 10_000
let sites: WebAppSite[] = []
let links: ExternalLink[] = []
let categories: AppCategory[] = []
let globalExtensions: ProfileExtension[] = []
let workspaces: WorkspaceData[] = []
let activeWorkspaceId = DEFAULT_WORKSPACE_ID
let storePath = ''
let managerWindow: BrowserWindow | undefined
let galleryWindow: BrowserWindow | undefined
let tray: Tray | undefined
let isQuitting = false
let focusedProfileId: string | undefined

function profilePartition(profileId: string): string {
  return `persist:webnest-${profileId}`
}

function extensionDirectory(profileId: string, folderName: string): string {
  return path.join(app.getPath('userData'), 'extensions', profileId, folderName)
}

function globalExtensionDirectory(folderName: string): string {
  return activeWorkspaceId === DEFAULT_WORKSPACE_ID
    ? path.join(app.getPath('userData'), 'extensions', 'global', folderName)
    : path.join(app.getPath('userData'), 'extensions', activeWorkspaceId, 'global', folderName)
}

function getProfile(profileId: string): WebAppProfile | undefined {
  return sites.flatMap((site) => site.profiles).find((profile) => profile.id === profileId)
}

function extensionEntries(profile: WebAppProfile): ExtensionToolbarEntry[] {
  return [
    ...globalExtensions.map((extension) => ({ ...extension, scope: 'global' as const })),
    ...(profile.extensions ?? [])
      .filter((extension) => !globalExtensions.some((global) => global.id === extension.id))
      .map((extension) => ({ ...extension, scope: 'profile' as const })),
  ]
}

function listProfileExtensionScopes(profile: WebAppProfile): ExtensionCollection {
  const copy = (extensions: ProfileExtension[]): ProfileExtension[] => extensions.map((extension) => ({
    ...extension,
    permissions: [...extension.permissions],
    hostPermissions: [...extension.hostPermissions],
  }))
  return { global: copy(globalExtensions), profile: copy(profile.extensions ?? []) }
}

function cleanText(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${field} es obligatorio.`)
  }
  return value.trim().slice(0, 80)
}

function normalizeUrl(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('La URL es obligatoria.')
  }

  let parsed: URL
  try {
    parsed = new URL(/^https?:\/\//i.test(value.trim()) ? value.trim() : `https://${value.trim()}`)
  } catch {
    throw new Error('Escribe una URL válida, por ejemplo https://chatgpt.com.')
  }

  if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname || parsed.username || parsed.password) {
    throw new Error('Los sitios deben usar HTTP o HTTPS y no incluir credenciales.')
  }

  return parsed.href
}

function normalizeExternalUrl(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error('La URL del enlace es obligatoria.')
  let parsed: URL
  try {
    parsed = new URL(/^https?:\/\//i.test(value.trim()) ? value.trim() : `https://${value.trim()}`)
  } catch {
    throw new Error('Escribe una URL válida para abrir en el navegador.')
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname || parsed.username || parsed.password) {
    throw new Error('Los enlaces externos deben usar HTTP o HTTPS y no incluir credenciales.')
  }
  return parsed.href
}

function validateCategoryId(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value !== 'string' || !categories.some((category) => category.id === value)) {
    throw new Error('La categoría seleccionada ya no existe.')
  }
  return value
}

async function save(): Promise<void> {
  const active = workspaces.find((workspace) => workspace.id === activeWorkspaceId)
  if (active) Object.assign(active, { sites, links, categories, globalExtensions })
  await fs.mkdir(path.dirname(storePath), { recursive: true })
  const temporaryPath = `${storePath}.tmp`
  await fs.writeFile(temporaryPath, JSON.stringify({ version: 4, activeWorkspaceId, workspaces }, null, 2), 'utf8')
  await fs.rename(temporaryPath, storePath)
}

function normalizeWorkspace(raw: Partial<WorkspaceData>, id: string, fallbackName: string): WorkspaceData {
  const normalizedSites = Array.isArray(raw.sites) ? raw.sites.map((site) => ({
    ...site,
    profiles: Array.isArray(site.profiles) ? site.profiles.map((profile) => ({
      ...profile,
      extensions: Array.isArray(profile.extensions) ? profile.extensions : [],
    })) : [],
    iconSource: site.iconSource ?? (site.iconDataUrl ? 'favicon' : undefined),
  })) : []
  const normalizedLinks = Array.isArray(raw.links) ? raw.links.map((link) => ({
    ...link,
    iconSource: link.iconSource ?? (link.iconDataUrl ? 'favicon' : undefined),
  })) : []
  const normalizedGlobalExtensions = Array.isArray(raw.globalExtensions) ? raw.globalExtensions.map((extension) => ({
    ...extension,
    permissions: Array.isArray(extension.permissions) ? extension.permissions : [],
    hostPermissions: Array.isArray(extension.hostPermissions) ? extension.hostPermissions : [],
  })) : []
  return {
    id,
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name : fallbackName,
    sites: normalizedSites,
    links: normalizedLinks,
    categories: Array.isArray(raw.categories) ? raw.categories : [],
    globalExtensions: normalizedGlobalExtensions,
  }
}

function activateWorkspaceState(workspace: WorkspaceData): void {
  activeWorkspaceId = workspace.id
  sites = workspace.sites
  links = workspace.links
  categories = workspace.categories
  globalExtensions = workspace.globalExtensions
}

async function load(): Promise<void> {
  try {
    const saved = await fs.readFile(storePath, 'utf8')
    const parsed = JSON.parse(saved) as unknown
    let initial: WorkspaceData
    if (Array.isArray(parsed)) {
      initial = normalizeWorkspace({ sites: parsed as WebAppSite[] }, DEFAULT_WORKSPACE_ID, 'Espacio personal')
    } else if (parsed && typeof parsed === 'object') {
      const data = parsed as Partial<LibrarySnapshot> & { workspaces?: unknown; activeWorkspaceId?: unknown }
      if (Array.isArray(data.workspaces)) {
        workspaces = data.workspaces.map((workspace, index) => {
          const candidate = workspace as Partial<WorkspaceData>
          const id = typeof candidate.id === 'string' && candidate.id ? candidate.id : `workspace-${index + 1}`
          return normalizeWorkspace(candidate, id, `Espacio ${index + 1}`)
        })
        const selected = typeof data.activeWorkspaceId === 'string'
          ? workspaces.find((workspace) => workspace.id === data.activeWorkspaceId)
          : undefined
        initial = selected ?? workspaces[0] ?? normalizeWorkspace({}, DEFAULT_WORKSPACE_ID, 'Espacio personal')
      } else {
        initial = normalizeWorkspace(data as Partial<WorkspaceData>, DEFAULT_WORKSPACE_ID, 'Espacio personal')
      }
    } else {
      initial = normalizeWorkspace({}, DEFAULT_WORKSPACE_ID, 'Espacio personal')
    }
    if (!workspaces.length) workspaces = [initial]
    else if (!workspaces.some((workspace) => workspace.id === initial.id)) workspaces.unshift(initial)
    activateWorkspaceState(initial)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.error('No se pudo leer la lista de aplicaciones:', error)
    }
    const initial = normalizeWorkspace({}, DEFAULT_WORKSPACE_ID, 'Espacio personal')
    workspaces = [initial]
    activateWorkspaceState(initial)
  }
}

async function fetchFavicon(url: string): Promise<string | undefined> {
  const pageUrl = new URL(url)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)

  try {
    const page = await fetch(url, { signal: controller.signal, redirect: 'follow' })
    let iconUrl: URL | undefined

    if (page.ok && page.headers.get('content-type')?.includes('text/html')) {
      const html = (await page.text()).slice(0, 1_000_000)
      const links = html.match(/<link\b[^>]*>/gi) ?? []
      for (const tag of links) {
        const rel = tag.match(/\brel\s*=\s*["']([^"']+)["']/i)?.[1]
        const href = tag.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1]
        if (rel?.toLowerCase().split(/\s+/).some((value) => value.includes('icon')) && href) {
          try {
            iconUrl = new URL(href, page.url || url)
            break
          } catch {
            // Ignore malformed icon links and try the conventional favicon path.
          }
        }
      }
    }

    iconUrl ??= new URL('/favicon.ico', pageUrl.origin)
    if (!['https:', 'http:'].includes(iconUrl.protocol)) return undefined

    const icon = await fetch(iconUrl, { signal: controller.signal, redirect: 'follow' })
    const mimeType = icon.headers.get('content-type')?.split(';')[0] ?? ''
    if (!icon.ok || !mimeType.startsWith('image/')) return undefined
    const bytes = Buffer.from(await icon.arrayBuffer())
    if (!bytes.length || bytes.length > 256_000) return undefined
    return `data:${mimeType};base64,${bytes.toString('base64')}`
  } catch {
    return undefined
  } finally {
    clearTimeout(timeout)
  }
}

function listLibrary(): LibrarySnapshot {
  return {
    sites: sites.map((site) => ({
      ...site,
      profiles: site.profiles.map((profile) => ({
        ...profile,
        extensions: profile.extensions?.map((extension) => ({
          ...extension,
          permissions: [...extension.permissions],
          hostPermissions: [...extension.hostPermissions],
        })) ?? [],
      })),
    })),
    links: links.map((link) => ({ ...link })),
    categories: categories.map((category) => ({ ...category })),
    globalExtensions: globalExtensions.map((extension) => ({
      ...extension,
      permissions: [...extension.permissions],
      hostPermissions: [...extension.hostPermissions],
    })),
    workspaces: workspaces.map(({ id, name }) => ({ id, name })),
    activeWorkspaceId,
    activeWorkspaceName: workspaces.find((workspace) => workspace.id === activeWorkspaceId)?.name ?? 'Espacio personal',
  }
}

function closeWorkspaceWindows(): void {
  for (const window of extensionPopups.values()) if (!window.isDestroyed()) window.destroy()
  for (const window of extensionToolbars.values()) if (!window.isDestroyed()) window.destroy()
  for (const window of windows.values()) if (!window.isDestroyed()) window.destroy()
  extensionPopups.clear()
  extensionToolbars.clear()
  windows.clear()
  hiddenExtensionToolbars.clear()
  pendingExtensionScans.clear()
  focusedProfileId = undefined
}

function uniqueWorkspaceName(rawName: string, excludingId?: string): string {
  const base = cleanText(rawName, 'El nombre del workspace')
  let candidate = base
  let suffix = 2
  while (workspaces.some((workspace) => workspace.id !== excludingId && workspace.name.toLocaleLowerCase() === candidate.toLocaleLowerCase())) {
    candidate = `${base} (${suffix})`
    suffix += 1
  }
  return candidate
}

async function createWorkspace(rawName: string): Promise<LibrarySnapshot> {
  await save()
  const workspace: WorkspaceData = {
    id: randomUUID(),
    name: uniqueWorkspaceName(rawName),
    sites: [],
    links: [],
    categories: [],
    globalExtensions: [],
  }
  workspaces.push(workspace)
  closeWorkspaceWindows()
  activateWorkspaceState(workspace)
  await save()
  return listLibrary()
}

async function switchWorkspace(workspaceId: string): Promise<LibrarySnapshot> {
  const workspace = workspaces.find((item) => item.id === workspaceId)
  if (!workspace) throw new Error('No se encontró el workspace.')
  if (workspace.id === activeWorkspaceId) return listLibrary()
  await save()
  closeWorkspaceWindows()
  activateWorkspaceState(workspace)
  await save()
  return listLibrary()
}

async function renameWorkspace(workspaceId: string, rawName: string): Promise<LibrarySnapshot> {
  const workspace = workspaces.find((item) => item.id === workspaceId)
  if (!workspace) throw new Error('No se encontró el workspace.')
  workspace.name = uniqueWorkspaceName(rawName, workspaceId)
  await save()
  return listLibrary()
}

async function exportWorkspace(): Promise<boolean> {
  const workspace = workspaces.find((item) => item.id === activeWorkspaceId)
  if (!workspace) throw new Error('No se encontró el workspace activo.')
  const data: WorkspaceExport = {
    format: 'webnest-workspace',
    version: 1,
    name: workspace.name,
    sites: sites.map((site) => ({
      ...site,
      profiles: site.profiles.map(({ extensions: _extensions, ...profile }) => profile),
    })),
    links: links.map((link) => ({ ...link })),
    categories: categories.map((category) => ({ ...category })),
  }
  const options = {
    title: 'Exportar workspace',
    defaultPath: `${workspace.name.replace(/[<>:"/\\|?*]/g, '_')}.webnest.json`,
    filters: [{ name: 'Workspace WebNest', extensions: ['json'] }],
  }
  const result = managerWindow && !managerWindow.isDestroyed()
    ? await dialog.showSaveDialog(managerWindow, options)
    : await dialog.showSaveDialog(options)
  if (result.canceled || !result.filePath) return false
  await fs.writeFile(result.filePath, JSON.stringify(data, null, 2), 'utf8')
  return true
}

function importedWorkspace(raw: unknown): WorkspaceData {
  if (!raw || typeof raw !== 'object') throw new Error('El archivo no contiene un workspace válido.')
  const data = raw as Partial<WorkspaceExport>
  if (data.format !== 'webnest-workspace' || data.version !== 1
    || !Array.isArray(data.sites) || !Array.isArray(data.links) || !Array.isArray(data.categories)) {
    throw new Error('El formato del archivo de workspace no es compatible.')
  }
  const categoryIds = new Map<string, string>()
  const categoryNames = new Set<string>()
  const importedCategories = data.categories.map((item) => {
    if (!item || typeof item.name !== 'string') throw new Error('El archivo contiene una categoría no válida.')
    const name = cleanText(item.name, 'El nombre de la categoría')
    if (categoryNames.has(name.toLocaleLowerCase())) throw new Error(`La categoría “${name}” está duplicada en el archivo.`)
    categoryNames.add(name.toLocaleLowerCase())
    const id = randomUUID()
    if (typeof item.id === 'string') categoryIds.set(item.id, id)
    return { id, name, createdAt: new Date().toISOString() }
  })
  const importedSites = data.sites.map((site) => {
    if (!site || typeof site.name !== 'string' || typeof site.url !== 'string' || !Array.isArray(site.profiles)) {
      throw new Error('El archivo contiene un sitio no válido.')
    }
    const iconDataUrl = typeof site.iconDataUrl === 'string' && site.iconDataUrl.startsWith('data:image/')
      && site.iconDataUrl.length <= 2_000_000 ? site.iconDataUrl : undefined
    return {
      ...site,
      id: randomUUID(),
      name: cleanText(site.name, 'El nombre del sitio'),
      url: normalizeUrl(site.url),
      categoryId: typeof site.categoryId === 'string' ? categoryIds.get(site.categoryId) : undefined,
      iconDataUrl,
      iconSource: iconDataUrl ? site.iconSource ?? 'favicon' : undefined,
      createdAt: new Date().toISOString(),
      profiles: (site.profiles.length ? site.profiles : [undefined]).map((profile) => {
        if (!profile) return createProfile()
        if (!profile || typeof profile.name !== 'string') throw new Error('El archivo contiene un perfil no válido.')
        return createProfile(cleanText(profile.name, 'El nombre del perfil'))
      }),
    }
  })
  const importedLinks = data.links.map((link) => {
    if (!link || typeof link.name !== 'string' || typeof link.url !== 'string') {
      throw new Error('El archivo contiene un enlace no válido.')
    }
    const iconDataUrl = typeof link.iconDataUrl === 'string' && link.iconDataUrl.startsWith('data:image/')
      && link.iconDataUrl.length <= 2_000_000 ? link.iconDataUrl : undefined
    return {
      ...link,
      id: randomUUID(),
      name: cleanText(link.name, 'El nombre del enlace'),
      url: normalizeExternalUrl(link.url),
      categoryId: typeof link.categoryId === 'string' ? categoryIds.get(link.categoryId) : undefined,
      iconDataUrl,
      iconSource: iconDataUrl ? link.iconSource ?? 'favicon' : undefined,
      createdAt: new Date().toISOString(),
    }
  })
  const name = typeof data.name === 'string' ? cleanText(data.name, 'El nombre del workspace') : 'Workspace importado'
  return {
    id: randomUUID(),
    name: uniqueWorkspaceName(name),
    sites: importedSites,
    links: importedLinks,
    categories: importedCategories,
    globalExtensions: [],
  }
}

async function importWorkspace(): Promise<LibrarySnapshot | null> {
  const options = {
    title: 'Importar workspace',
    properties: ['openFile'] as Array<'openFile'>,
    filters: [{ name: 'Workspace WebNest', extensions: ['json'] }],
  }
  const result = managerWindow && !managerWindow.isDestroyed()
    ? await dialog.showOpenDialog(managerWindow, options)
    : await dialog.showOpenDialog(options)
  if (result.canceled || !result.filePaths[0]) return null
  const selectedPath = result.filePaths[0]
  const details = await fs.stat(selectedPath)
  if (details.size > 100 * 1024 * 1024) throw new Error('El archivo de workspace supera el límite de 100 MiB.')
  const imported = importedWorkspace(JSON.parse(await fs.readFile(selectedPath, 'utf8')) as unknown)
  await save()
  workspaces.push(imported)
  closeWorkspaceWindows()
  activateWorkspaceState(imported)
  await save()
  return listLibrary()
}

function createProfile(name = `Profile_${randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase()}`): WebAppProfile {
  return { id: randomUUID(), name, createdAt: new Date().toISOString(), extensions: [] }
}

function createTrayIcon(): Electron.NativeImage {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><rect x="1" y="1" width="30" height="30" rx="9" fill="#31563e"/><path d="M8 9h4l4 13 4-13h4l-7 17h-3z" fill="#e8f0e6"/></svg>'
  return nativeImage.createFromDataURL(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`).resize({ width: 16, height: 16 })
}

async function createTray(): Promise<void> {
  const icon = createTrayIcon()
  tray = new Tray(icon.isEmpty() ? await app.getFileIcon(process.execPath, { size: 'small' }) : icon)
  tray.setToolTip('WebNest · tus Web Apps')
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Mostrar WebNest', click: showManager },
    { label: 'Abrir galería · Alt+C', click: toggleGallery },
    { type: 'separator' },
    {
      label: 'Salir de WebNest',
      click: () => {
        isQuitting = true
        app.quit()
      },
    },
  ]))
  tray.on('click', showManager)
  tray.on('double-click', showManager)
}

function initializeAutoUpdates(): void {
  if (!app.isPackaged) return

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.allowPrerelease = false
  let updatePromptOpen = false
  let downloadStarted = false

  autoUpdater.on('error', (error) => {
    downloadStarted = false
    console.warn('No se pudo comprobar o descargar una actualización de WebNest:', error)
  })
  autoUpdater.on('update-available', (info) => {
    if (updatePromptOpen || downloadStarted) return
    updatePromptOpen = true
    void dialog.showMessageBox({
      type: 'info',
      title: 'Actualización disponible',
      message: `WebNest ${info.version} está disponible.`,
      detail: '¿Quieres descargarla ahora? La actualización se instalará al reiniciar WebNest.',
      buttons: ['Descargar actualización', 'Más tarde'],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
    }).then(({ response }) => {
      if (response !== 0) return
      downloadStarted = true
      void autoUpdater.downloadUpdate().catch((error: unknown) => {
        downloadStarted = false
        console.warn('No se pudo descargar la actualización de WebNest:', error)
      })
    }).catch((error: unknown) => {
      console.warn('No se pudo mostrar el aviso de actualización:', error)
    }).finally(() => {
      updatePromptOpen = false
    })
  })
  autoUpdater.on('update-downloaded', (info) => {
    downloadStarted = false
    if (updatePromptOpen) return
    updatePromptOpen = true
    void dialog.showMessageBox({
      type: 'info',
      title: 'Actualización lista',
      message: `WebNest ${info.version} está lista para instalarse.`,
      detail: 'Puedes reiniciar ahora o continuar trabajando; se instalará cuando cierres WebNest.',
      buttons: ['Reiniciar y actualizar', 'Más tarde'],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
    }).then(({ response }) => {
      if (response === 0) autoUpdater.quitAndInstall(true, true)
    }).catch((error: unknown) => {
      console.warn('No se pudo mostrar la actualización descargada:', error)
    }).finally(() => {
      updatePromptOpen = false
    })
  })

  const checkForUpdates = (): void => {
    void autoUpdater.checkForUpdates().catch((error: unknown) => {
      console.warn('No se pudo comprobar si hay actualizaciones de WebNest:', error)
    })
  }
  const initialCheck = setTimeout(checkForUpdates, 15_000)
  initialCheck.unref()
  const updateCheckInterval = setInterval(checkForUpdates, 6 * 60 * 60 * 1000)
  updateCheckInterval.unref()
}

async function chooseCustomIcon(): Promise<string | undefined> {
  const options = {
    title: 'Elegir icono personalizado',
    properties: ['openFile'] as Array<'openFile'>,
    filters: [{ name: 'Imagen', extensions: ['svg', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'ico'] }],
  }
  const result = managerWindow && !managerWindow.isDestroyed()
    ? await dialog.showOpenDialog(managerWindow, options)
    : await dialog.showOpenDialog(options)
  const filePath = result.filePaths[0]
  if (result.canceled || !filePath) return undefined

  const stat = await fs.stat(filePath)
  if (stat.size > 1_000_000) throw new Error('El icono personalizado no puede superar 1 MB.')
  const bytes = await fs.readFile(filePath)
  const extension = path.extname(filePath).toLowerCase()
  if (extension === '.svg') {
    const svg = bytes.toString('utf8').replace(/^\uFEFF/, '')
    const hasSvgRoot = /^(?:\s|<\?xml[^>]*>|<!--[\s\S]*?-->)*<svg\b/i.test(svg)
    const hasUnsafeContent = /<\s*(?:script|foreignObject|iframe|object|embed)\b|\son[a-z][\w:-]*\s*=|<!\s*(?:doctype|entity)\b|<\?xml-stylesheet\b|@import\b|\b(?:href|src)\s*=\s*(?:"(?!#)[^"]*"|'(?!#)[^']*'|(?!(?:["'#]))[^\s>]+)|url\(\s*(['"]?)(?!#)[^)]+\)/i.test(svg)
    if (!hasSvgRoot || hasUnsafeContent) throw new Error('El SVG debe ser una imagen segura sin scripts ni referencias externas.')
    const declaredDimensions = [...svg.matchAll(/\b(?:width|height)\s*=\s*["']\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)(?:[a-z%]+)?["']/gi)]
    if (declaredDimensions.some((match) => !Number.isFinite(Number(match[1])) || Number(match[1]) <= 0 || Number(match[1]) > 4096)) {
      throw new Error('Las dimensiones declaradas del SVG no pueden superar 4096 píxeles.')
    }
    const viewBox = svg.match(/\bviewBox\s*=\s*["']\s*[-+\d.e]+\s+[-+\d.e]+\s+([\d.e+-]+)\s+([\d.e+-]+)/i)
    if (viewBox && (Number(viewBox[1]) > 4096 || Number(viewBox[2]) > 4096)) {
      throw new Error('El viewBox del SVG no puede superar 4096 píxeles por lado.')
    }
    const vector = nativeImage.createFromDataURL(`data:image/svg+xml;base64,${bytes.toString('base64')}`)
    const { width, height } = vector.getSize()
    if (vector.isEmpty() || width <= 0 || height <= 0 || width > 4096 || height > 4096 || width * height > 16_000_000) {
      throw new Error('No se pudo leer el SVG o sus dimensiones son demasiado grandes.')
    }
    const scale = Math.min(256 / width, 256 / height, 1)
    const png = vector.resize({
      width: Math.max(1, Math.round(width * scale)),
      height: Math.max(1, Math.round(height * scale)),
    }).toPNG()
    if (!png.length || png.length > 1_000_000) throw new Error('No se pudo convertir el SVG a un icono PNG válido.')
    return `data:image/png;base64,${png.toString('base64')}`
  }

  const formats = {
    '.png': { mime: 'image/png', valid: bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) },
    '.jpg': { mime: 'image/jpeg', valid: bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 },
    '.jpeg': { mime: 'image/jpeg', valid: bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 },
    '.webp': { mime: 'image/webp', valid: bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP' },
    '.gif': { mime: 'image/gif', valid: ['GIF87a', 'GIF89a'].includes(bytes.toString('ascii', 0, 6)) },
    '.ico': { mime: 'image/x-icon', valid: bytes[0] === 0 && bytes[1] === 0 && bytes[2] === 1 && bytes[3] === 0 },
  } as const
  const format = formats[extension as keyof typeof formats]
  if (!format?.valid) throw new Error('El archivo no coincide con un formato de imagen admitido.')
  return `data:${format.mime};base64,${bytes.toString('base64')}`
}

function uniqueCategoryName(name: string, exceptId?: string): void {
  if (categories.some((category) => category.id !== exceptId && category.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
    throw new Error('Ya existe una categoría con ese nombre.')
  }
}

async function findManifestRoot(root: string, depth = 0): Promise<{ directory: string; manifest: Record<string, unknown> } | undefined> {
  const manifestPath = path.join(root, 'manifest.json')
  try {
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8')) as Record<string, unknown>
    return { directory: root, manifest }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error
    if (depth >= 3) return undefined
  }

  const entries = await fs.readdir(root, { withFileTypes: true })
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue
    const found = await findManifestRoot(path.join(root, entry.name), depth + 1)
    if (found) return found
  }
  return undefined
}

async function extensionMessages(directory: string, manifest: Record<string, unknown>): Promise<Map<string, string>> {
  const messages = new Map<string, string>()
  const appLocale = app.getLocale().replace(/-/g, '_')
  const locales = [
    typeof manifest.default_locale === 'string' ? manifest.default_locale.replace(/-/g, '_') : undefined,
    appLocale.includes('_') ? appLocale.split('_')[0] : appLocale,
    appLocale,
  ].filter((locale): locale is string => typeof locale === 'string' && /^[A-Za-z0-9_-]+$/.test(locale))
    .filter((locale, index, list) => list.indexOf(locale) === index)

  for (const locale of locales) {
    try {
      const filePath = path.join(directory, '_locales', locale, 'messages.json')
      const stat = await fs.stat(filePath)
      if (stat.size > 1_000_000) continue
      const parsed = JSON.parse(await fs.readFile(filePath, 'utf8')) as Record<string, unknown>
      for (const [key, value] of Object.entries(parsed)) {
        if (value && typeof value === 'object' && typeof (value as { message?: unknown }).message === 'string') {
          messages.set(key.toLowerCase(), (value as { message: string }).message)
        }
      }
    } catch {
      // Continue through locale fallbacks; a missing locale file is expected.
    }
  }
  return messages
}

async function localizedManifestValue(directory: string, manifest: Record<string, unknown>, value: unknown): Promise<string | undefined> {
  if (typeof value !== 'string') return undefined
  if (!value.includes('__MSG_')) return value
  const messages = await extensionMessages(directory, manifest)
  let unresolved = false
  const resolved = value.replace(/__MSG_(.+?)__/gi, (token, key: string) => {
    const message = messages.get(key.toLowerCase())
    if (message === undefined) {
      unresolved = true
      return token
    }
    return message
  }).trim()
  return unresolved || resolved.includes('__MSG_') ? undefined : resolved
}

async function localizedExtensionName(directory: string, manifest: Record<string, unknown>): Promise<string> {
  const name = await localizedManifestValue(directory, manifest, manifest.name)
  if (name) return name
  const shortName = await localizedManifestValue(directory, manifest, manifest.short_name)
  if (shortName) return shortName
  return 'Extensión sin nombre'
}

function compareExtensionVersions(left: string, right: string): number {
  const a = left.split(/[.+-]/).map((part) => Number.parseInt(part, 10) || 0)
  const b = right.split(/[.+-]/).map((part) => Number.parseInt(part, 10) || 0)
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0)
    if (difference) return difference
  }
  return 0
}

function formatExtensionSize(bytes: number): string {
  const mebibytes = bytes / (1024 * 1024)
  return mebibytes >= 1024 ? `${(mebibytes / 1024).toFixed(2)} GiB` : `${mebibytes.toFixed(1)} MiB`
}

async function measureExtensionTree(root: string): Promise<{ sizeBytes: number; exceedsSizeLimit: boolean }> {
  let entriesCount = 0
  let totalBytes = 0
  const pending = [root]

  while (pending.length) {
    const current = pending.pop()!
    const entries = await fs.readdir(current, { withFileTypes: true })
    for (const entry of entries) {
      entriesCount += 1
      if (entriesCount > MAX_EXTENSION_FILES) throw new Error('La extensión contiene demasiados archivos.')
      const entryPath = path.join(current, entry.name)
      const details = await fs.lstat(entryPath)
      if (details.isSymbolicLink()) throw new Error('No se admiten enlaces simbólicos dentro de una extensión.')
      if (details.isDirectory()) pending.push(entryPath)
      else if (details.isFile()) {
        totalBytes += details.size
        if (totalBytes > MAX_EXTENSION_SIZE_BYTES) return { sizeBytes: totalBytes, exceedsSizeLimit: true }
      }
    }
  }
  return { sizeBytes: totalBytes, exceedsSizeLimit: false }
}

async function scanExtensionDirectory(root: string): Promise<Map<string, { directory: string; manifest: Record<string, unknown>; candidate: BrowserExtensionCandidate }>> {
  const found = new Map<string, { directory: string; manifest: Record<string, unknown>; candidate: BrowserExtensionCandidate }>()
  let visited = 0

  async function walk(directory: string, relativeSegments: string[], depth: number): Promise<void> {
    if (depth > 5) return
    const entries = await fs.readdir(directory, { withFileTypes: true })
    visited += entries.length
    if (visited > 20_000) throw new Error('La carpeta contiene demasiados elementos para escanear.')

    const manifestEntry = entries.find((entry) => entry.isFile() && entry.name.toLowerCase() === 'manifest.json')
    if (manifestEntry) {
      try {
        const manifest = JSON.parse(await fs.readFile(path.join(directory, manifestEntry.name), 'utf8')) as Record<string, unknown>
        if (typeof manifest.name !== 'string' || typeof manifest.version !== 'string') return
        if (manifest.manifest_version !== 2 && manifest.manifest_version !== 3) return
        const displayName = await localizedExtensionName(directory, manifest)
        const size = await measureExtensionTree(directory)

        const extensionFolderIndex = relativeSegments.findIndex((segment) => segment.toLowerCase() === 'extensions')
        const directoryIdentity = extensionFolderIndex >= 0
          ? relativeSegments[extensionFolderIndex + 1]
          : relativeSegments.length >= 2 ? relativeSegments[0] : undefined
        const identity = directoryIdentity ?? (typeof manifest.key === 'string' ? manifest.key : manifest.name)
        const candidate: BrowserExtensionCandidate = {
          id: randomUUID(),
          name: displayName,
          version: manifest.version,
          manifestVersion: manifest.manifest_version,
          sizeBytes: size.sizeBytes,
          exceedsSizeLimit: size.exceedsSizeLimit,
          permissions: [...new Set([...stringList(manifest.permissions), ...stringList(manifest.optional_permissions)])],
          hostPermissions: [...new Set([...stringList(manifest.host_permissions), ...stringList(manifest.optional_host_permissions)])],
        }
        const previous = found.get(identity)
        if (!previous || compareExtensionVersions(candidate.version, previous.candidate.version) > 0) {
          found.set(identity, { directory, manifest, candidate })
        }
      } catch {
        // Skip malformed manifests and keep scanning other extensions.
      }
      return
    }

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue
      await walk(path.join(directory, entry.name), [...relativeSegments, entry.name], depth + 1)
    }
  }

  await walk(root, [], 0)
  return found
}

async function scanBrowserExtensions(source: BrowserExtensionSource): Promise<BrowserExtensionScan> {
  const home = app.getPath('home')
  const sourcePaths = {
    chrome: path.join(home, 'AppData', 'Local', 'Google', 'Chrome', 'User Data', 'Default', 'Extensions'),
    comet: path.join(home, 'AppData', 'Local', 'Perplexity', 'Comet', 'User Data', 'Default', 'Extensions'),
  }
  const suggestedPath = source === 'folder' ? home : sourcePaths[source]
  let root: string | undefined = source === 'folder' ? undefined : sourcePaths[source]
  if (root) {
    try {
      if (!(await fs.stat(root)).isDirectory()) root = undefined
    } catch {
      root = undefined
    }
  }

  if (!root) {
    const title = source === 'chrome' ? 'Seleccionar carpeta Extensions de Chrome' : source === 'comet' ? 'Seleccionar carpeta Extensions de Comet' : 'Seleccionar carpeta de extensiones Chromium'
    const options = { title, properties: ['openDirectory'] as Array<'openDirectory'>, defaultPath: suggestedPath }
    const result = managerWindow && !managerWindow.isDestroyed()
      ? await dialog.showOpenDialog(managerWindow, options)
      : await dialog.showOpenDialog(options)
    if (result.canceled || !result.filePaths[0]) return { token: '', sourceName: source, candidates: [] }
    root = result.filePaths[0]
  }

  const scanned = await scanExtensionDirectory(root)
  const candidates = [...scanned.values()].map(({ candidate }) => candidate).sort((a, b) => a.name.localeCompare(b.name))
  if (!candidates.length) throw new Error('No encontré extensiones compatibles en esa carpeta.')

  const token = randomUUID()
  pendingExtensionScans.clear()
  const pending = new Map<string, { directory: string; manifest: Record<string, unknown>; candidate: BrowserExtensionCandidate }>()
  for (const item of scanned.values()) pending.set(item.candidate.id, item)
  pendingExtensionScans.set(token, pending)
  return {
    token,
    sourceName: source === 'chrome' ? 'Chrome' : source === 'comet' ? 'Comet' : 'carpeta Chromium',
    candidates,
  }
}

async function validateExtensionTree(root: string): Promise<number> {
  const { sizeBytes, exceedsSizeLimit } = await measureExtensionTree(root)
  if (exceedsSizeLimit) throw new Error('La extensión supera el límite de 1 GiB.')
  return sizeBytes
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

async function extensionIcon(directory: string, manifest: Record<string, unknown>): Promise<string | undefined> {
  const icons = manifest.icons
  if (!icons || typeof icons !== 'object') return undefined
  const candidates = Object.entries(icons as Record<string, unknown>)
    .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
    .sort(([a], [b]) => Number(b) - Number(a))

  for (const [, relativePath] of candidates) {
    const iconPath = path.resolve(directory, relativePath)
    if (!iconPath.startsWith(`${directory}${path.sep}`)) continue
    try {
      const details = await fs.stat(iconPath)
      if (details.size > 256_000) continue
      const bytes = await fs.readFile(iconPath)
      const extension = path.extname(iconPath).toLowerCase()
      const mime = extension === '.svg' ? 'image/svg+xml' : extension === '.jpg' || extension === '.jpeg' ? 'image/jpeg' : 'image/png'
      return `data:${mime};base64,${bytes.toString('base64')}`
    } catch {
      // Try the next declared icon if this one is missing.
    }
  }
  return undefined
}

async function loadProfileExtensions(profile: WebAppProfile, profileSession = session.fromPartition(profilePartition(profile.id))): Promise<void> {
  for (const extension of extensionEntries(profile)) {
    try {
      if (!profileSession.extensions.getExtension(extension.id)) {
        const directory = extension.scope === 'global'
          ? globalExtensionDirectory(extension.folderName)
          : extensionDirectory(profile.id, extension.folderName)
        await profileSession.extensions.loadExtension(directory)
      }
    } catch (error) {
      console.warn(`No se pudo cargar la extensión ${extension.name} en el perfil ${profile.name}:`, error)
    }
  }
}

function positionExtensionToolbar(profileId: string): void {
  const parent = windows.get(profileId)
  const toolbar = extensionToolbars.get(profileId)
  if (!parent || parent.isDestroyed() || !toolbar || toolbar.isDestroyed()) return
  const profile = getProfile(profileId)
  const extensions = profile ? extensionEntries(profile) : []
  const width = Math.min(extensions.length * 45 + 58, 520)
  const parentBounds = parent.getBounds()
  toolbar.setBounds({
    x: Math.max(parentBounds.x + 8, parentBounds.x + parentBounds.width - width - 18),
    y: parentBounds.y + 38,
    width,
    height: 46,
  })
}

async function refreshExtensionToolbar(profileId: string): Promise<void> {
  const parent = windows.get(profileId)
  const previous = extensionToolbars.get(profileId)
  if (previous && !previous.isDestroyed()) previous.close()
  extensionToolbars.delete(profileId)

  const profile = getProfile(profileId)
  const extensions = profile ? extensionEntries(profile) : []
  if (!parent || parent.isDestroyed() || !profile || hiddenExtensionToolbars.has(profileId)) return

  const width = Math.min(extensions.length * 45 + 58, 520)
  const parentBounds = parent.getBounds()
  const toolbar = new BrowserWindow({
    parent,
    width,
    height: 46,
    x: Math.max(parentBounds.x + 8, parentBounds.x + parentBounds.width - width - 18),
    y: parentBounds.y + 38,
    frame: false,
    transparent: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    show: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  extensionToolbars.set(profileId, toolbar)

  const reposition = (): void => positionExtensionToolbar(profileId)
  parent.on('move', reposition)
  parent.on('resize', reposition)
  toolbar.on('closed', () => {
    parent.removeListener('move', reposition)
    parent.removeListener('resize', reposition)
    if (extensionToolbars.get(profileId) === toolbar) extensionToolbars.delete(profileId)
  })
  parent.on('closed', () => {
    if (!toolbar.isDestroyed()) toolbar.close()
  })

  const toolbarUrl = process.env.ELECTRON_RENDERER_URL
    ? `${process.env.ELECTRON_RENDERER_URL}/?toolbar=${encodeURIComponent(profileId)}`
    : undefined
  const loaded = toolbarUrl
    ? toolbar.loadURL(toolbarUrl)
    : toolbar.loadFile(path.join(__dirname, '../renderer/index.html'), { query: { toolbar: profileId } })
  void loaded.then(() => {
    if (!toolbar.isDestroyed()) toolbar.showInactive()
  })
}

async function copyCurrentUrl(profileId: string): Promise<void> {
  const profileWindow = windows.get(profileId)
  if (!profileWindow || profileWindow.isDestroyed()) throw new Error('No se encontró la ventana del perfil.')
  const url = profileWindow.webContents.getURL()
  if (!/^https?:\/\//i.test(url)) throw new Error('El perfil todavía no tiene una URL web para copiar.')
  clipboard.writeText(url)
}

function toggleFocusedProfileToolbar(): void {
  const profileId = focusedProfileId
  const profileWindow = profileId ? windows.get(profileId) : undefined
  if (!profileId || !profileWindow || profileWindow.isDestroyed()) return
  const toolbar = extensionToolbars.get(profileId)
  if (toolbar && !toolbar.isDestroyed() && toolbar.isVisible()) {
    hiddenExtensionToolbars.add(profileId)
    toolbar.hide()
    return
  }
  hiddenExtensionToolbars.delete(profileId)
  if (toolbar && !toolbar.isDestroyed()) toolbar.showInactive()
  else void refreshExtensionToolbar(profileId)
}

async function importExtension(profileId: string, source: 'folder' | 'zip', scope: ExtensionScope, selectedPath?: string): Promise<ExtensionCollection> {
  const profile = getProfile(profileId)
  if (!profile) throw new Error('No se encontró el perfil.')

  const options = source === 'folder'
    ? { title: 'Seleccionar extensión de Chrome', properties: ['openDirectory'] as Array<'openDirectory'> }
    : {
      title: 'Importar extensión ZIP',
      properties: ['openFile'] as Array<'openFile'>,
      filters: [{ name: 'Archivo ZIP', extensions: ['zip'] }],
    }
  if (!selectedPath) {
    const result = managerWindow && !managerWindow.isDestroyed()
      ? await dialog.showOpenDialog(managerWindow, options)
      : await dialog.showOpenDialog(options)
    if (result.canceled || !result.filePaths[0]) return listProfileExtensionScopes(profile)
    selectedPath = result.filePaths[0]
  }
  const temporaryDirectory = path.join(app.getPath('temp'), `webnest-extension-${randomUUID()}`)
  await fs.mkdir(temporaryDirectory, { recursive: true })

  try {
    let sourceDirectory = selectedPath
    if (source === 'zip') {
      let expandedBytes = 0
      let entryCount = 0
      await extractZip(selectedPath, {
        dir: temporaryDirectory,
        onEntry: (entry) => {
          entryCount += 1
          if (entryCount > MAX_EXTENSION_FILES) throw new Error('El ZIP contiene demasiados archivos.')
          expandedBytes += entry.uncompressedSize
          if (expandedBytes > MAX_EXTENSION_SIZE_BYTES) throw new Error('El ZIP supera el límite descomprimido de 1 GiB.')
        },
      })
      sourceDirectory = temporaryDirectory
    }
    const located = await findManifestRoot(sourceDirectory)
    if (!located) throw new Error('No encontré un manifest.json en la carpeta o ZIP seleccionado.')
    const extensionSizeBytes = await validateExtensionTree(located.directory)

    const manifest = located.manifest
    if (typeof manifest.name !== 'string' || typeof manifest.version !== 'string') {
      throw new Error('El manifest.json debe incluir nombre y versión.')
    }
    if (manifest.manifest_version !== 2 && manifest.manifest_version !== 3) {
      throw new Error('La extensión debe usar Manifest V2 o V3.')
    }
    const displayName = await localizedExtensionName(located.directory, manifest)

    const permissions = [...new Set([
      ...stringList(manifest.permissions),
      ...stringList(manifest.optional_permissions),
    ])]
    const hostPermissions = [...new Set([
      ...stringList(manifest.host_permissions),
      ...stringList(manifest.optional_host_permissions),
    ])]
    const permissionSummary = [...permissions, ...hostPermissions]
    const scopeDescription = scope === 'global'
      ? 'Se cargará en todos los perfiles actuales y futuros. Sus datos de extensión permanecerán separados por perfil.'
      : 'Solo se cargará en este perfil.'
    const promptOptions: MessageBoxOptions = {
      type: 'warning',
      title: scope === 'global' ? 'Instalar extensión global' : 'Instalar extensión en este perfil',
      message: scope === 'global'
        ? `¿Instalar “${displayName}” globalmente?`
        : `¿Instalar “${displayName}” en ${profile.name}?`,
      detail: [
        `Versión: ${manifest.version}`,
        `Tamaño: ${formatExtensionSize(extensionSizeBytes)}`,
        ...(extensionSizeBytes > LARGE_EXTENSION_WARNING_BYTES ? ['Es una extensión grande; confirma que quieres importar más de 128 MiB.'] : []),
        `Permisos: ${permissionSummary.length ? permissionSummary.join(', ') : 'No declara permisos explícitos'}`,
        '',
        scopeDescription,
        'Una extensión puede leer o modificar las páginas indicadas por sus permisos. Instala solo software de confianza.',
      ].join('\n'),
      buttons: ['Cancelar', extensionSizeBytes > LARGE_EXTENSION_WARNING_BYTES ? 'Confirmar importación grande' : scope === 'global' ? 'Instalar globalmente' : 'Instalar extensión'],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
    }
    const prompt = managerWindow && !managerWindow.isDestroyed()
      ? await dialog.showMessageBox(managerWindow, promptOptions)
      : await dialog.showMessageBox(promptOptions)
    if (prompt.response !== 1) return listProfileExtensionScopes(profile)

    const folderName = randomUUID()
    const destination = scope === 'global'
      ? globalExtensionDirectory(folderName)
      : extensionDirectory(profileId, folderName)
    await fs.mkdir(path.dirname(destination), { recursive: true })
    await fs.cp(located.directory, destination, {
      recursive: true,
      filter: async (sourcePath) => !(await fs.lstat(sourcePath)).isSymbolicLink(),
    })

    const previousGlobalExtensions = globalExtensions
    const previousProfileExtensions = profile.extensions ?? []
    const loadedProfileIds: string[] = []
    let stored: ProfileExtension | undefined
    try {
      const targetProfiles = scope === 'global'
        ? sites.flatMap((site) => site.profiles)
        : [profile]
      for (const targetProfile of targetProfiles) {
        const targetSession = session.fromPartition(profilePartition(targetProfile.id))
        const loaded = await targetSession.extensions.loadExtension(destination)
        if (path.resolve(loaded.path) !== path.resolve(destination)) {
          throw new Error(`Ya existe una extensión con el mismo ID en el perfil ${targetProfile.name}.`)
        }
        loadedProfileIds.push(targetProfile.id)
        if (stored && loaded.id !== stored.id) throw new Error('La extensión generó identificadores distintos entre perfiles.')
        stored ??= {
          id: loaded.id,
          name: displayName || loaded.name,
          version: loaded.version,
          folderName,
          permissions,
          hostPermissions,
          iconDataUrl: await extensionIcon(destination, manifest),
          hasPopup: Boolean(
            (manifest.action as { default_popup?: string } | undefined)?.default_popup
            || (manifest.browser_action as { default_popup?: string } | undefined)?.default_popup,
          ),
        }
        if (scope === 'profile' && globalExtensions.some((extension) => extension.id === loaded.id)) {
          throw new Error('Esta extensión ya está instalada globalmente en este perfil.')
        }
        if (scope === 'global' && (targetProfile.extensions ?? []).some((extension) => extension.id === loaded.id)) {
          throw new Error(`Quita primero la extensión local del perfil ${targetProfile.name} antes de instalarla globalmente.`)
        }
      }

      if (!stored) throw new Error('No hay perfiles en los que cargar la extensión.')
      if (scope === 'global') globalExtensions = [...globalExtensions, stored]
      else profile.extensions = [...previousProfileExtensions, stored]
      await save()

      for (const targetProfile of targetProfiles) {
        if (windows.has(targetProfile.id)) await refreshExtensionToolbar(targetProfile.id)
      }
      return listProfileExtensionScopes(profile)
    } catch (error) {
      globalExtensions = previousGlobalExtensions
      profile.extensions = previousProfileExtensions
      if (stored) {
        for (const loadedProfileId of loadedProfileIds) {
          const targetSession = session.fromPartition(profilePartition(loadedProfileId))
          const loaded = targetSession.extensions.getExtension(stored.id)
          if (loaded && path.resolve(loaded.path) === path.resolve(destination)) {
            targetSession.extensions.removeExtension(stored.id)
          }
        }
      }
      await fs.rm(destination, { recursive: true, force: true })
      throw new Error(`No se pudo cargar la extensión: ${getErrorMessage(error)}`)
    }
  } finally {
    await fs.rm(temporaryDirectory, { recursive: true, force: true })
  }
}

async function importScannedExtensions(
  profileId: string,
  scope: ExtensionScope,
  scanToken: string,
  candidateIds: string[],
): Promise<ExtensionCollection> {
  const profile = getProfile(profileId)
  const scanned = pendingExtensionScans.get(scanToken)
  if (!profile || !scanned) throw new Error('La selección de extensiones expiró. Vuelve a escanear la carpeta.')
  if (!candidateIds.length) throw new Error('Selecciona al menos una extensión.')

  try {
    for (const candidateId of [...new Set(candidateIds)]) {
      const candidate = scanned.get(candidateId)
      if (!candidate) throw new Error('Una de las extensiones seleccionadas ya no está disponible.')
      if (candidate.candidate.exceedsSizeLimit) throw new Error(`“${candidate.candidate.name}” supera el límite de 1 GiB.`)
      const currentManifest = JSON.parse(await fs.readFile(path.join(candidate.directory, 'manifest.json'), 'utf8')) as Record<string, unknown>
      if (currentManifest.name !== candidate.manifest.name || currentManifest.version !== candidate.manifest.version) {
        throw new Error(`“${candidate.manifest.name}” cambió en la carpeta de origen. Vuelve a escanear.`)
      }
      await importExtension(profileId, 'folder', scope, candidate.directory)
    }
    return listProfileExtensionScopes(profile)
  } finally {
    pendingExtensionScans.delete(scanToken)
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function removeExtension(profileId: string, extensionId: string, scope: ExtensionScope): Promise<ExtensionCollection> {
  const profile = getProfile(profileId)
  if (!profile) throw new Error('No se encontró el perfil.')
  const extension = scope === 'global'
    ? globalExtensions.find((item) => item.id === extensionId)
    : (profile.extensions ?? []).find((item) => item.id === extensionId)
  if (!extension) throw new Error('No se encontró la extensión.')

  const affectedProfiles = scope === 'global' ? sites.flatMap((site) => site.profiles) : [profile]
  const installedPath = scope === 'global'
    ? globalExtensionDirectory(extension.folderName)
    : extensionDirectory(profileId, extension.folderName)
  for (const targetProfile of affectedProfiles) {
    const targetSession = session.fromPartition(profilePartition(targetProfile.id))
    const loaded = targetSession.extensions.getExtension(extensionId)
    if (loaded && path.resolve(loaded.path) === path.resolve(installedPath)) {
      targetSession.extensions.removeExtension(extensionId)
    }
    const popupKey = `${targetProfile.id}:${extensionId}`
    const popup = extensionPopups.get(popupKey)
    if (popup && !popup.isDestroyed()) popup.close()
    extensionPopups.delete(popupKey)
  }

  if (scope === 'global') {
    globalExtensions = globalExtensions.filter((item) => item.id !== extensionId)
  } else {
    profile.extensions = profile.extensions?.filter((item) => item.id !== extensionId) ?? []
  }
  await fs.rm(installedPath, { recursive: true, force: true })
  await save()
  for (const targetProfile of affectedProfiles) {
    if (windows.has(targetProfile.id)) await refreshExtensionToolbar(targetProfile.id)
  }
  return listProfileExtensionScopes(profile)
}

async function activateProfileExtension(profileId: string, extensionId: string): Promise<void> {
  const profile = getProfile(profileId)
  const entry = globalExtensions.find((item) => item.id === extensionId)
    ?? profile?.extensions?.find((item) => item.id === extensionId)
  const parent = windows.get(profileId)
  if (!profile || !entry || !parent || parent.isDestroyed()) throw new Error('No se encontró la extensión abierta.')
  if (!entry.hasPopup) throw new Error('Esta extensión no ofrece un popup de acción compatible.')

  const extension = session.fromPartition(profilePartition(profileId)).extensions.getExtension(extensionId)
  if (!extension) throw new Error('La extensión no está cargada en este perfil.')
  const manifest = extension.manifest as {
    action?: { default_popup?: string }
    browser_action?: { default_popup?: string }
  }
  const popupPath = manifest.action?.default_popup ?? manifest.browser_action?.default_popup
  if (!popupPath) throw new Error('La extensión no define un popup de acción.')

  const popupKey = `${profileId}:${extensionId}`
  const existing = extensionPopups.get(popupKey)
  if (existing && !existing.isDestroyed()) {
    existing.focus()
    return
  }

  const toolbar = extensionToolbars.get(profileId)
  const parentWindow = toolbar && !toolbar.isDestroyed() ? toolbar : parent
  const popup = new BrowserWindow({
    parent: parentWindow,
    width: 360,
    height: 520,
    minWidth: 280,
    minHeight: 180,
    frame: false,
    resizable: false,
    show: false,
    backgroundColor: '#1b2520',
    webPreferences: {
      partition: profilePartition(profileId),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  extensionPopups.set(popupKey, popup)
  popup.on('closed', () => extensionPopups.delete(popupKey))
  popup.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  const popupUrl = new URL(popupPath, `${extension.url.replace(/\/$/, '')}/`).href
  await popup.loadURL(popupUrl)
  popup.show()
}

function createManagerWindow(): void {
  const window = new BrowserWindow({
    width: 1240,
    height: 840,
    minWidth: 780,
    minHeight: 620,
    backgroundColor: '#141b18',
    title: 'WebNest',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  managerWindow = window
  window.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      window.hide()
    }
  })
  window.on('closed', () => {
    managerWindow = undefined
  })

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) {
      void shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void window.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

function closeGallery(): void {
  if (galleryWindow && !galleryWindow.isDestroyed()) galleryWindow.close()
}

function showManager(): void {
  if (!managerWindow || managerWindow.isDestroyed()) createManagerWindow()
  if (managerWindow?.isMinimized()) managerWindow.restore()
  managerWindow?.show()
  managerWindow?.focus()
}

function toggleGallery(): void {
  if (galleryWindow && !galleryWindow.isDestroyed()) {
    closeGallery()
    return
  }

  const area = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea
  const width = Math.min(820, area.width - 32)
  const height = Math.min(610, area.height - 32)
  const window = new BrowserWindow({
    width,
    height,
    x: area.x + Math.round((area.width - width) / 2),
    y: area.y + Math.round((area.height - height) / 2),
    show: false,
    frame: false,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    backgroundColor: '#141b18',
    title: 'Galería de aplicaciones',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  galleryWindow = window
  window.on('blur', closeGallery)
  window.on('closed', () => {
    galleryWindow = undefined
  })
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

  const galleryUrl = process.env.ELECTRON_RENDERER_URL
    ? `${process.env.ELECTRON_RENDERER_URL}/?gallery=1`
    : undefined
  const loaded = galleryUrl
    ? window.loadURL(galleryUrl)
    : window.loadFile(path.join(__dirname, '../renderer/index.html'), { query: { gallery: '1' } })
  void loaded.then(() => {
    if (!window.isDestroyed()) window.show()
  })
}

async function openProfile(siteId: string, profileId: string): Promise<void> {
  const site = sites.find((item) => item.id === siteId)
  const profile = site?.profiles.find((item) => item.id === profileId)
  if (!site || !profile) throw new Error('No se encontró el sitio o perfil solicitado.')

  const existing = windows.get(profileId)
  if (existing && !existing.isDestroyed()) {
    if (existing.isMinimized()) existing.restore()
    existing.focus()
    focusedProfileId = profileId
    return
  }

  const partition = profilePartition(profile.id)
  const profileSession = session.fromPartition(partition)
  await loadProfileExtensions(profile, profileSession)
  const window = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 760,
    minHeight: 560,
    title: `${site.name} · ${profile.name}`,
    backgroundColor: '#141b18',
    webPreferences: {
      partition,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  windows.set(profileId, window)
  focusedProfileId = profileId
  window.on('focus', () => { focusedProfileId = profileId })
  window.on('closed', () => {
    if (windows.get(profileId) !== window) return
    windows.delete(profileId)
    hiddenExtensionToolbars.delete(profileId)
    if (focusedProfileId === profileId) focusedProfileId = undefined
  })
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (!/^https?:\/\//i.test(url)) return { action: 'deny' }
    return {
      action: 'allow',
      overrideBrowserWindowOptions: {
        width: 1200,
        height: 800,
        webPreferences: {
          partition,
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
        },
      },
    }
  })

  await window.loadURL(site.url)
  await refreshExtensionToolbar(profileId)
}

async function clearProfileData(profileId: string): Promise<void> {
  const profile = getProfile(profileId)
  const window = windows.get(profileId)
  if (window && !window.isDestroyed()) window.destroy()
  windows.delete(profileId)
  hiddenExtensionToolbars.delete(profileId)
  if (focusedProfileId === profileId) focusedProfileId = undefined

  const toolbar = extensionToolbars.get(profileId)
  if (toolbar && !toolbar.isDestroyed()) toolbar.destroy()
  extensionToolbars.delete(profileId)
  for (const [key, popup] of extensionPopups) {
    if (!key.startsWith(`${profileId}:`)) continue
    if (!popup.isDestroyed()) popup.destroy()
    extensionPopups.delete(key)
  }

  const profileSession = session.fromPartition(profilePartition(profileId))
  for (const entry of profile ? extensionEntries(profile) : []) {
    const loaded = profileSession.extensions.getExtension(entry.id)
    const directory = entry.scope === 'global'
      ? globalExtensionDirectory(entry.folderName)
      : extensionDirectory(profileId, entry.folderName)
    if (loaded && path.resolve(loaded.path) === path.resolve(directory)) {
      profileSession.extensions.removeExtension(entry.id)
    }
  }
  await profileSession.clearStorageData()
  await profileSession.clearCache()
  await fs.rm(path.join(app.getPath('userData'), 'extensions', profileId), { recursive: true, force: true })
}

function registerIpc(): void {
  ipcMain.handle('sites:list', () => listLibrary())

  ipcMain.handle('categories:create', async (_event, rawName: string) => {
    const name = cleanText(rawName, 'El nombre de la categoría')
    uniqueCategoryName(name)
    categories = [...categories, { id: randomUUID(), name, createdAt: new Date().toISOString() }]
    await save()
    return listLibrary()
  })

  ipcMain.handle('categories:update', async (_event, categoryId: string, rawName: string) => {
    const category = categories.find((item) => item.id === categoryId)
    if (!category) throw new Error('No se encontró la categoría.')
    const name = cleanText(rawName, 'El nombre de la categoría')
    uniqueCategoryName(name, categoryId)
    category.name = name
    await save()
    return listLibrary()
  })

  ipcMain.handle('categories:delete', async (_event, categoryId: string) => {
    if (!categories.some((item) => item.id === categoryId)) throw new Error('No se encontró la categoría.')
    categories = categories.filter((item) => item.id !== categoryId)
    sites = sites.map((site) => site.categoryId === categoryId ? { ...site, categoryId: undefined } : site)
    links = links.map((link) => link.categoryId === categoryId ? { ...link, categoryId: undefined } : link)
    await save()
    return listLibrary()
  })

  ipcMain.handle('categories:move', async (_event, categoryId: string, direction: 'up' | 'down') => {
    if (direction !== 'up' && direction !== 'down') throw new Error('Dirección de orden no válida.')
    const index = categories.findIndex((category) => category.id === categoryId)
    if (index < 0) throw new Error('No se encontró la categoría.')
    const target = index + (direction === 'up' ? -1 : 1)
    if (target < 0 || target >= categories.length) return listLibrary()
    const reordered = [...categories]
    ;[reordered[index], reordered[target]] = [reordered[target], reordered[index]]
    categories = reordered
    await save()
    return listLibrary()
  })

  ipcMain.handle('sites:create', async (_event, input: CreateSiteInput) => {
    const name = cleanText(input?.name, 'El nombre del sitio')
    const profileName = typeof input?.profileName === 'string' && input.profileName.trim()
      ? cleanText(input.profileName, 'El nombre del perfil')
      : undefined
    const url = normalizeUrl(input?.url)
    const site: WebAppSite = {
      id: randomUUID(),
      name,
      url,
      iconDataUrl: await fetchFavicon(url),
      iconSource: 'favicon',
      categoryId: validateCategoryId(input?.categoryId),
      profiles: [createProfile(profileName)],
      createdAt: new Date().toISOString(),
    }
    sites = [...sites, site]
    await save()
    return listLibrary()
  })

  ipcMain.handle('sites:update', async (_event, siteId: string, input: CreateSiteInput) => {
    const current = sites.find((site) => site.id === siteId)
    if (!current) throw new Error('No se encontró el sitio.')
    const name = cleanText(input?.name, 'El nombre del sitio')
    const url = normalizeUrl(input?.url)
    const iconDataUrl = current.iconSource === 'custom'
      ? current.iconDataUrl
      : current.url === url ? current.iconDataUrl : await fetchFavicon(url)
    sites = sites.map((site) => site.id === siteId ? {
      ...site,
      name,
      url,
      iconDataUrl,
      categoryId: validateCategoryId(input?.categoryId),
      iconSource: current.iconSource ?? 'favicon',
    } : site)
    await save()
    return listLibrary()
  })

  ipcMain.handle('sites:move', async (_event, siteId: string, direction: 'up' | 'down', categoryFilterId: string | null) => {
    if ((direction !== 'up' && direction !== 'down') || (categoryFilterId !== null && typeof categoryFilterId !== 'string')) {
      throw new Error('Movimiento de sitio no válido.')
    }
    if (categoryFilterId !== null && categoryFilterId !== 'uncategorized'
      && !categories.some((category) => category.id === categoryFilterId)) {
      throw new Error('La categoría seleccionada ya no existe.')
    }
    const matchesFilter = (site: WebAppSite): boolean => categoryFilterId === null
      || (categoryFilterId === 'uncategorized' ? !site.categoryId : site.categoryId === categoryFilterId)
    const visibleSites = sites.filter(matchesFilter)
    const visibleIndex = visibleSites.findIndex((site) => site.id === siteId)
    if (visibleIndex < 0) throw new Error('No se encontró el sitio en esta vista.')
    const target = visibleSites[visibleIndex + (direction === 'up' ? -1 : 1)]
    if (!target) return listLibrary()
    const reordered = [...sites]
    const sourceIndex = reordered.findIndex((site) => site.id === siteId)
    const targetIndex = reordered.findIndex((site) => site.id === target.id)
    ;[reordered[sourceIndex], reordered[targetIndex]] = [reordered[targetIndex], reordered[sourceIndex]]
    sites = reordered
    await save()
    return listLibrary()
  })

  ipcMain.handle('sites:delete', async (_event, siteId: string) => {
    const site = sites.find((item) => item.id === siteId)
    if (!site) throw new Error('No se encontró el sitio.')
    for (const profile of site.profiles) await clearProfileData(profile.id)
    sites = sites.filter((item) => item.id !== siteId)
    await save()
    return listLibrary()
  })

  ipcMain.handle('links:create', async (_event, input: ExternalLinkInput) => {
    const name = cleanText(input?.name, 'El nombre del enlace')
    const url = normalizeExternalUrl(input?.url)
    const link: ExternalLink = {
      id: randomUUID(),
      name,
      url,
      categoryId: validateCategoryId(input?.categoryId),
      iconDataUrl: await fetchFavicon(url),
      iconSource: 'favicon',
      createdAt: new Date().toISOString(),
    }
    links = [...links, link]
    await save()
    return listLibrary()
  })

  ipcMain.handle('links:update', async (_event, linkId: string, input: ExternalLinkInput) => {
    const current = links.find((item) => item.id === linkId)
    if (!current) throw new Error('No se encontró el enlace.')
    const name = cleanText(input?.name, 'El nombre del enlace')
    const url = normalizeExternalUrl(input?.url)
    const iconDataUrl = current.iconSource === 'custom'
      ? current.iconDataUrl
      : current.url === url ? current.iconDataUrl : await fetchFavicon(url)
    links = links.map((link) => link.id === linkId ? {
      ...link,
      name,
      url,
      categoryId: validateCategoryId(input?.categoryId),
      iconDataUrl,
      iconSource: current.iconSource ?? 'favicon',
    } : link)
    await save()
    return listLibrary()
  })

  ipcMain.handle('links:delete', async (_event, linkId: string) => {
    if (!links.some((item) => item.id === linkId)) throw new Error('No se encontró el enlace.')
    links = links.filter((item) => item.id !== linkId)
    await save()
    return listLibrary()
  })

  ipcMain.handle('links:open', async (_event, linkId: string) => {
    const link = links.find((item) => item.id === linkId)
    if (!link) throw new Error('No se encontró el enlace.')
    await shell.openExternal(normalizeExternalUrl(link.url))
  })

  ipcMain.handle('icons:set', async (_event, itemType: 'site' | 'link', itemId: string, source: 'favicon' | 'custom') => {
    if (itemType !== 'site' && itemType !== 'link') throw new Error('Tipo de elemento no válido.')
    if (source !== 'favicon' && source !== 'custom') throw new Error('Tipo de icono no válido.')
    const item = itemType === 'site'
      ? sites.find((site) => site.id === itemId)
      : links.find((link) => link.id === itemId)
    if (!item) throw new Error('No se encontró el elemento.')

    if (source === 'custom') {
      const iconDataUrl = await chooseCustomIcon()
      if (!iconDataUrl) return listLibrary()
      item.iconDataUrl = iconDataUrl
      item.iconSource = 'custom'
    } else {
      item.iconDataUrl = await fetchFavicon(item.url)
      item.iconSource = 'favicon'
    }
    await save()
    return listLibrary()
  })

  ipcMain.handle('profiles:add', async (_event, siteId: string, rawName?: string) => {
    const name = typeof rawName === 'string' && rawName.trim() ? cleanText(rawName, 'El nombre del perfil') : undefined
    const site = sites.find((item) => item.id === siteId)
    if (!site) throw new Error('No se encontró el sitio.')
    site.profiles.push(createProfile(name))
    await save()
    return listLibrary()
  })

  ipcMain.handle('profiles:rename', async (_event, siteId: string, profileId: string, rawName: string) => {
    const name = cleanText(rawName, 'El nombre del perfil')
    const site = sites.find((item) => item.id === siteId)
    const profile = site?.profiles.find((item) => item.id === profileId)
    if (!site || !profile) throw new Error('No se encontró el perfil.')
    profile.name = name
    await save()
    const window = windows.get(profileId)
    if (window && !window.isDestroyed()) window.setTitle(`${site.name} · ${name}`)
    return listLibrary()
  })

  ipcMain.handle('profiles:delete', async (_event, siteId: string, profileId: string) => {
    const site = sites.find((item) => item.id === siteId)
    if (!site) throw new Error('No se encontró el sitio.')
    if (site.profiles.length <= 1) {
      throw new Error('Cada sitio necesita al menos un perfil. Para quitarlo, elimina el sitio completo.')
    }
    if (!site.profiles.some((profile) => profile.id === profileId)) throw new Error('No se encontró el perfil.')
    await clearProfileData(profileId)
    site.profiles = site.profiles.filter((profile) => profile.id !== profileId)
    await save()
    return listLibrary()
  })

  ipcMain.handle('profiles:open', (_event, siteId: string, profileId: string) =>
    openProfile(siteId, profileId),
  )
  ipcMain.handle('profiles:copy-url', (_event, profileId: string) => copyCurrentUrl(profileId))
  ipcMain.handle('extensions:list', (_event, profileId: string) => {
    const profile = getProfile(profileId)
    if (!profile) throw new Error('No se encontró el perfil.')
    return listProfileExtensionScopes(profile)
  })
  ipcMain.handle('extensions:import', (_event, profileId: string, source: 'folder' | 'zip', scope: ExtensionScope) => {
    if (source !== 'folder' && source !== 'zip') throw new Error('Tipo de importación no válido.')
    if (scope !== 'global' && scope !== 'profile') throw new Error('Ámbito de extensión no válido.')
    return importExtension(profileId, source, scope)
  })
  ipcMain.handle('extensions:scan-browser', (_event, source: BrowserExtensionSource) => {
    if (source !== 'chrome' && source !== 'comet' && source !== 'folder') throw new Error('Origen Chromium no válido.')
    return scanBrowserExtensions(source)
  })
  ipcMain.handle('extensions:import-browser', (_event, profileId: string, scope: ExtensionScope, scanToken: string, candidateIds: string[]) => {
    if (scope !== 'global' && scope !== 'profile') throw new Error('Ámbito de extensión no válido.')
    if (typeof scanToken !== 'string' || !Array.isArray(candidateIds) || candidateIds.some((id) => typeof id !== 'string')) {
      throw new Error('Selección de extensiones no válida.')
    }
    return importScannedExtensions(profileId, scope, scanToken, candidateIds)
  })
  ipcMain.handle('extensions:remove', (_event, profileId: string, extensionId: string, scope: ExtensionScope) => {
    if (scope !== 'global' && scope !== 'profile') throw new Error('Ámbito de extensión no válido.')
    return removeExtension(profileId, extensionId, scope)
  },
  )
  ipcMain.handle('extensions:activate', (_event, profileId: string, extensionId: string) =>
    activateProfileExtension(profileId, extensionId),
  )
  ipcMain.handle('gallery:close', () => closeGallery())
  ipcMain.handle('manager:show', () => showManager())
  ipcMain.handle('workspaces:create', (_event, name: string) => createWorkspace(name))
  ipcMain.handle('workspaces:switch', (_event, workspaceId: string) => switchWorkspace(workspaceId))
  ipcMain.handle('workspaces:rename', (_event, workspaceId: string, name: string) => renameWorkspace(workspaceId, name))
  ipcMain.handle('workspaces:export', () => exportWorkspace())
  ipcMain.handle('workspaces:import', () => importWorkspace())
}

app.whenReady().then(async () => {
  storePath = path.join(app.getPath('userData'), 'web-apps.json')
  await load()
  await createTray()
  registerIpc()
  createManagerWindow()
  initializeAutoUpdates()
  if (!globalShortcut.register('Alt+C', toggleGallery)) {
    console.warn('No se pudo registrar el atajo global Alt+C.')
  }
  if (!globalShortcut.register('Alt+Shift+T', toggleFocusedProfileToolbar)) {
    console.warn('No se pudo registrar el atajo global Alt+Shift+T.')
  }

  app.on('activate', () => {
    showManager()
  })
})

app.on('window-all-closed', () => undefined)

app.on('before-quit', () => {
  isQuitting = true
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})
