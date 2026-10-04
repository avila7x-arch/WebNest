export interface WebAppProfile {
  id: string
  name: string
  createdAt: string
  extensions?: ProfileExtension[]
}

export interface ProfileExtension {
  id: string
  name: string
  version: string
  folderName: string
  permissions: string[]
  hostPermissions: string[]
  iconDataUrl?: string
  hasPopup: boolean
}

export type ExtensionScope = 'global' | 'profile'

export interface ExtensionCollection {
  global: ProfileExtension[]
  profile: ProfileExtension[]
}

export interface ExtensionToolbarEntry extends ProfileExtension {
  scope: ExtensionScope
}

export type BrowserExtensionSource = 'chrome' | 'comet' | 'folder'

export interface BrowserExtensionCandidate {
  id: string
  name: string
  version: string
  manifestVersion: number
  sizeBytes: number
  exceedsSizeLimit: boolean
  permissions: string[]
  hostPermissions: string[]
}

export interface BrowserExtensionScan {
  token: string
  sourceName: string
  candidates: BrowserExtensionCandidate[]
}

export interface WebAppSite {
  id: string
  name: string
  url: string
  categoryId?: string
  iconDataUrl?: string
  iconSource?: 'favicon' | 'custom'
  profiles: WebAppProfile[]
  createdAt: string
}

export interface ExternalLink {
  id: string
  name: string
  url: string
  categoryId?: string
  iconDataUrl?: string
  iconSource?: 'favicon' | 'custom'
  createdAt: string
}

export interface AppCategory {
  id: string
  name: string
  createdAt: string
}

export interface LibrarySnapshot {
  sites: WebAppSite[]
  links: ExternalLink[]
  categories: AppCategory[]
  globalExtensions: ProfileExtension[]
  workspaces?: WorkspaceSummary[]
  activeWorkspaceId?: string
  activeWorkspaceName?: string
}

export interface WorkspaceSummary {
  id: string
  name: string
}

export interface WorkspaceExport {
  format: 'webnest-workspace'
  version: 1
  name: string
  sites: WebAppSite[]
  links: ExternalLink[]
  categories: AppCategory[]
}

export interface CreateSiteInput {
  name: string
  url: string
  profileName?: string
  categoryId?: string
}

export interface ExternalLinkInput {
  name: string
  url: string
  categoryId?: string
}

export interface WebAppsApi {
  list: () => Promise<LibrarySnapshot>
  createCategory: (name: string) => Promise<LibrarySnapshot>
  updateCategory: (categoryId: string, name: string) => Promise<LibrarySnapshot>
  deleteCategory: (categoryId: string) => Promise<LibrarySnapshot>
  moveCategory: (categoryId: string, direction: 'up' | 'down') => Promise<LibrarySnapshot>
  createWorkspace: (name: string) => Promise<LibrarySnapshot>
  switchWorkspace: (workspaceId: string) => Promise<LibrarySnapshot>
  renameWorkspace: (workspaceId: string, name: string) => Promise<LibrarySnapshot>
  exportWorkspace: () => Promise<boolean>
  importWorkspace: () => Promise<LibrarySnapshot | null>
  createSite: (input: CreateSiteInput) => Promise<LibrarySnapshot>
  updateSite: (siteId: string, input: CreateSiteInput) => Promise<LibrarySnapshot>
  moveSite: (siteId: string, direction: 'up' | 'down', categoryFilterId: string | null) => Promise<LibrarySnapshot>
  deleteSite: (siteId: string) => Promise<LibrarySnapshot>
  createExternalLink: (input: ExternalLinkInput) => Promise<LibrarySnapshot>
  updateExternalLink: (linkId: string, input: ExternalLinkInput) => Promise<LibrarySnapshot>
  deleteExternalLink: (linkId: string) => Promise<LibrarySnapshot>
  openExternalLink: (linkId: string) => Promise<void>
  setIcon: (itemType: 'site' | 'link', itemId: string, source: 'favicon' | 'custom') => Promise<LibrarySnapshot>
  addProfile: (siteId: string, name: string) => Promise<LibrarySnapshot>
  renameProfile: (siteId: string, profileId: string, name: string) => Promise<LibrarySnapshot>
  deleteProfile: (siteId: string, profileId: string) => Promise<LibrarySnapshot>
  openProfile: (siteId: string, profileId: string) => Promise<void>
  copyCurrentUrl: (profileId: string) => Promise<void>
  listProfileExtensions: (profileId: string) => Promise<ExtensionCollection>
  importExtension: (profileId: string, source: 'folder' | 'zip', scope: ExtensionScope) => Promise<ExtensionCollection>
  scanBrowserExtensions: (source: BrowserExtensionSource) => Promise<BrowserExtensionScan>
  importBrowserExtensions: (profileId: string, scope: ExtensionScope, scanToken: string, candidateIds: string[]) => Promise<ExtensionCollection>
  removeExtension: (profileId: string, extensionId: string, scope: ExtensionScope) => Promise<ExtensionCollection>
  activateExtension: (profileId: string, extensionId: string) => Promise<void>
  closeGallery: () => Promise<void>
  showManager: () => Promise<void>
}

declare global {
  interface Window {
    webApps: WebAppsApi
  }
}
