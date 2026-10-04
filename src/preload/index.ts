import { contextBridge, ipcRenderer } from 'electron'
import type { BrowserExtensionSource, CreateSiteInput, ExtensionScope, ExternalLinkInput, WebAppsApi } from '../shared/types'

const api: WebAppsApi = {
  list: () => ipcRenderer.invoke('sites:list'),
  createCategory: (name) => ipcRenderer.invoke('categories:create', name),
  updateCategory: (categoryId, name) => ipcRenderer.invoke('categories:update', categoryId, name),
  deleteCategory: (categoryId) => ipcRenderer.invoke('categories:delete', categoryId),
  moveCategory: (categoryId, direction) => ipcRenderer.invoke('categories:move', categoryId, direction),
  createWorkspace: (name) => ipcRenderer.invoke('workspaces:create', name),
  switchWorkspace: (workspaceId) => ipcRenderer.invoke('workspaces:switch', workspaceId),
  renameWorkspace: (workspaceId, name) => ipcRenderer.invoke('workspaces:rename', workspaceId, name),
  exportWorkspace: () => ipcRenderer.invoke('workspaces:export'),
  importWorkspace: () => ipcRenderer.invoke('workspaces:import'),
  createSite: (input: CreateSiteInput) => ipcRenderer.invoke('sites:create', input),
  updateSite: (siteId, input) => ipcRenderer.invoke('sites:update', siteId, input),
  moveSite: (siteId, direction, categoryFilterId) => ipcRenderer.invoke('sites:move', siteId, direction, categoryFilterId),
  deleteSite: (siteId) => ipcRenderer.invoke('sites:delete', siteId),
  createExternalLink: (input: ExternalLinkInput) => ipcRenderer.invoke('links:create', input),
  updateExternalLink: (linkId, input) => ipcRenderer.invoke('links:update', linkId, input),
  deleteExternalLink: (linkId) => ipcRenderer.invoke('links:delete', linkId),
  openExternalLink: (linkId) => ipcRenderer.invoke('links:open', linkId),
  setIcon: (itemType, itemId, source) => ipcRenderer.invoke('icons:set', itemType, itemId, source),
  addProfile: (siteId, name) => ipcRenderer.invoke('profiles:add', siteId, name),
  renameProfile: (siteId, profileId, name) =>
    ipcRenderer.invoke('profiles:rename', siteId, profileId, name),
  deleteProfile: (siteId, profileId) => ipcRenderer.invoke('profiles:delete', siteId, profileId),
  openProfile: (siteId, profileId) => ipcRenderer.invoke('profiles:open', siteId, profileId),
  copyCurrentUrl: (profileId) => ipcRenderer.invoke('profiles:copy-url', profileId),
  listProfileExtensions: (profileId) => ipcRenderer.invoke('extensions:list', profileId),
  importExtension: (profileId, source, scope: ExtensionScope) => ipcRenderer.invoke('extensions:import', profileId, source, scope),
  scanBrowserExtensions: (source: BrowserExtensionSource) => ipcRenderer.invoke('extensions:scan-browser', source),
  importBrowserExtensions: (profileId, scope, scanToken, candidateIds) => ipcRenderer.invoke('extensions:import-browser', profileId, scope, scanToken, candidateIds),
  removeExtension: (profileId, extensionId, scope: ExtensionScope) => ipcRenderer.invoke('extensions:remove', profileId, extensionId, scope),
  activateExtension: (profileId, extensionId) => ipcRenderer.invoke('extensions:activate', profileId, extensionId),
  closeGallery: () => ipcRenderer.invoke('gallery:close'),
  showManager: () => ipcRenderer.invoke('manager:show'),
}

contextBridge.exposeInMainWorld('webApps', api)
