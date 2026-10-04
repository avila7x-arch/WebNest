import { useMemo, useState } from 'react'
import { ArrowUpRight, Check, Plus, Search, Store } from 'lucide-react'

interface CatalogSite {
  name: string
  url: string
  audience: 'daily' | 'developer'
  category: string
  description: string
}

const catalog: CatalogSite[] = [
  { name: 'Google', url: 'https://www.google.com', audience: 'daily', category: 'Búsqueda y utilidades', description: 'Buscador y acceso a los servicios de Google.' },
  { name: 'Bing', url: 'https://www.bing.com', audience: 'daily', category: 'Búsqueda y utilidades', description: 'Buscador web de Microsoft.' },
  { name: 'DuckDuckGo', url: 'https://duckduckgo.com', audience: 'daily', category: 'Búsqueda y utilidades', description: 'Buscador centrado en la privacidad.' },
  { name: 'Google Translate', url: 'https://translate.google.com', audience: 'daily', category: 'Búsqueda y utilidades', description: 'Traducción de texto, documentos y sitios.' },
  { name: 'Google Maps', url: 'https://maps.google.com', audience: 'daily', category: 'Búsqueda y utilidades', description: 'Mapas, indicaciones y lugares cercanos.' },
  { name: 'Gmail', url: 'https://mail.google.com', audience: 'daily', category: 'Correo y comunicación', description: 'Correo electrónico de Google.' },
  { name: 'Outlook', url: 'https://outlook.live.com', audience: 'daily', category: 'Correo y comunicación', description: 'Correo, calendario y contactos de Microsoft.' },
  { name: 'Proton Mail', url: 'https://mail.proton.me', audience: 'daily', category: 'Correo y comunicación', description: 'Correo electrónico con enfoque en privacidad.' },
  { name: 'WhatsApp', url: 'https://web.whatsapp.com', audience: 'daily', category: 'Correo y comunicación', description: 'Mensajes y llamadas desde el navegador.' },
  { name: 'Telegram', url: 'https://web.telegram.org', audience: 'daily', category: 'Correo y comunicación', description: 'Mensajería, canales y grupos.' },
  { name: 'Google Meet', url: 'https://meet.google.com', audience: 'daily', category: 'Correo y comunicación', description: 'Videollamadas desde el navegador.' },
  { name: 'Zoom', url: 'https://app.zoom.us', audience: 'daily', category: 'Correo y comunicación', description: 'Reuniones y videollamadas.' },
  { name: 'Microsoft Teams', url: 'https://teams.microsoft.com', audience: 'daily', category: 'Correo y comunicación', description: 'Chats, reuniones y colaboración de equipos.' },
  { name: 'Google Drive', url: 'https://drive.google.com', audience: 'daily', category: 'Productividad', description: 'Almacenamiento y archivos en la nube.' },
  { name: 'Google Docs', url: 'https://docs.google.com', audience: 'daily', category: 'Productividad', description: 'Documentos colaborativos en línea.' },
  { name: 'Google Calendar', url: 'https://calendar.google.com', audience: 'daily', category: 'Productividad', description: 'Agenda y calendario en la nube.' },
  { name: 'Google Photos', url: 'https://photos.google.com', audience: 'daily', category: 'Productividad', description: 'Fotos y videos guardados en la nube.' },
  { name: 'OneDrive', url: 'https://onedrive.live.com', audience: 'daily', category: 'Productividad', description: 'Archivos y documentos de Microsoft 365.' },
  { name: 'Dropbox', url: 'https://www.dropbox.com', audience: 'daily', category: 'Productividad', description: 'Almacenamiento y uso compartido de archivos.' },
  { name: 'Notion', url: 'https://www.notion.so', audience: 'daily', category: 'Productividad', description: 'Notas, documentos y proyectos en un solo espacio.' },
  { name: 'Trello', url: 'https://trello.com', audience: 'daily', category: 'Productividad', description: 'Organiza tareas con tableros visuales.' },
  { name: 'Todoist', url: 'https://todoist.com', audience: 'daily', category: 'Productividad', description: 'Lista de tareas y recordatorios personales.' },
  { name: 'Facebook', url: 'https://www.facebook.com', audience: 'daily', category: 'Redes y comunidades', description: 'Red social para compartir y mantenerse en contacto.' },
  { name: 'Instagram', url: 'https://www.instagram.com', audience: 'daily', category: 'Redes y comunidades', description: 'Fotos, videos y mensajes.' },
  { name: 'TikTok', url: 'https://www.tiktok.com', audience: 'daily', category: 'Redes y comunidades', description: 'Videos cortos y transmisiones en directo.' },
  { name: 'X', url: 'https://x.com', audience: 'daily', category: 'Redes y comunidades', description: 'Noticias, publicaciones y conversaciones.' },
  { name: 'LinkedIn', url: 'https://www.linkedin.com', audience: 'daily', category: 'Redes y comunidades', description: 'Red profesional, empleo y contactos.' },
  { name: 'Pinterest', url: 'https://www.pinterest.com', audience: 'daily', category: 'Redes y comunidades', description: 'Ideas e inspiración visual.' },
  { name: 'Reddit', url: 'https://www.reddit.com', audience: 'daily', category: 'Redes y comunidades', description: 'Comunidades y conversaciones por tema.' },
  { name: 'Discord', url: 'https://discord.com/app', audience: 'daily', category: 'Redes y comunidades', description: 'Comunidades, canales y llamadas.' },
  { name: 'YouTube', url: 'https://www.youtube.com', audience: 'daily', category: 'Video y música', description: 'Videos, canales y listas de reproducción.' },
  { name: 'Netflix', url: 'https://www.netflix.com', audience: 'daily', category: 'Video y música', description: 'Películas y series en streaming.' },
  { name: 'Prime Video', url: 'https://www.primevideo.com', audience: 'daily', category: 'Video y música', description: 'Películas y series de Amazon.' },
  { name: 'Twitch', url: 'https://www.twitch.tv', audience: 'daily', category: 'Video y música', description: 'Directos de videojuegos y comunidades.' },
  { name: 'Spotify', url: 'https://open.spotify.com', audience: 'daily', category: 'Video y música', description: 'Música, podcasts y audiolibros.' },
  { name: 'Apple Music', url: 'https://music.apple.com', audience: 'daily', category: 'Video y música', description: 'Música y listas de reproducción.' },
  { name: 'ChatGPT', url: 'https://chatgpt.com', audience: 'daily', category: 'IA y aprendizaje', description: 'Asistente de IA para escribir, analizar y crear.' },
  { name: 'Claude', url: 'https://claude.ai', audience: 'daily', category: 'IA y aprendizaje', description: 'Asistente para pensar, redactar y trabajar con documentos.' },
  { name: 'Gemini', url: 'https://gemini.google.com', audience: 'daily', category: 'IA y aprendizaje', description: 'Asistente de IA de Google.' },
  { name: 'Microsoft Copilot', url: 'https://copilot.microsoft.com', audience: 'daily', category: 'IA y aprendizaje', description: 'Asistente de IA integrado con servicios de Microsoft.' },
  { name: 'Perplexity', url: 'https://www.perplexity.ai', audience: 'daily', category: 'IA y aprendizaje', description: 'Búsqueda y respuestas con fuentes.' },
  { name: 'Duolingo', url: 'https://www.duolingo.com', audience: 'daily', category: 'IA y aprendizaje', description: 'Aprendizaje de idiomas con ejercicios breves.' },
  { name: 'Coursera', url: 'https://www.coursera.org', audience: 'daily', category: 'IA y aprendizaje', description: 'Cursos en línea de universidades y empresas.' },
  { name: 'Amazon', url: 'https://www.amazon.com', audience: 'daily', category: 'Compras y finanzas', description: 'Tienda en línea con productos de muchas categorías.' },
  { name: 'eBay', url: 'https://www.ebay.com', audience: 'daily', category: 'Compras y finanzas', description: 'Compra y venta de productos nuevos y usados.' },
  { name: 'Mercado Libre', url: 'https://www.mercadolibre.com', audience: 'daily', category: 'Compras y finanzas', description: 'Marketplace y servicios de pago populares en Latinoamérica.' },
  { name: 'PayPal', url: 'https://www.paypal.com', audience: 'daily', category: 'Compras y finanzas', description: 'Pagos digitales y administración de la cuenta.' },
  { name: 'Airbnb', url: 'https://www.airbnb.com', audience: 'daily', category: 'Compras y finanzas', description: 'Alojamientos y experiencias de viaje.' },
  { name: 'Booking.com', url: 'https://www.booking.com', audience: 'daily', category: 'Compras y finanzas', description: 'Búsqueda y reserva de alojamientos.' },
  { name: 'Canva', url: 'https://www.canva.com', audience: 'daily', category: 'Diseño', description: 'Diseño gráfico, documentos y presentaciones.' },
  { name: 'Figma', url: 'https://www.figma.com', audience: 'daily', category: 'Diseño', description: 'Diseño de interfaces y prototipos colaborativos.' },
  { name: 'GitHub', url: 'https://github.com', audience: 'developer', category: 'Código y repositorios', description: 'Repositorios Git, colaboración y proyectos de código.' },
  { name: 'GitLab', url: 'https://gitlab.com', audience: 'developer', category: 'Código y repositorios', description: 'Repositorios, revisión de código y CI/CD.' },
  { name: 'Bitbucket', url: 'https://bitbucket.org', audience: 'developer', category: 'Código y repositorios', description: 'Repositorios Git y flujos de trabajo para equipos.' },
  { name: 'SourceForge', url: 'https://sourceforge.net', audience: 'developer', category: 'Código y repositorios', description: 'Proyectos de código abierto y descargas.' },
  { name: 'Stack Overflow', url: 'https://stackoverflow.com', audience: 'developer', category: 'Documentación y comunidad', description: 'Preguntas y respuestas para desarrolladores.' },
  { name: 'MDN Web Docs', url: 'https://developer.mozilla.org', audience: 'developer', category: 'Documentación y comunidad', description: 'Referencia para HTML, CSS, JavaScript y Web APIs.' },
  { name: 'DevDocs', url: 'https://devdocs.io', audience: 'developer', category: 'Documentación y comunidad', description: 'Documentación técnica de lenguajes y herramientas.' },
  { name: 'W3Schools', url: 'https://www.w3schools.com', audience: 'developer', category: 'Documentación y comunidad', description: 'Tutoriales y referencias de tecnologías web.' },
  { name: 'Can I use', url: 'https://caniuse.com', audience: 'developer', category: 'Documentación y comunidad', description: 'Compatibilidad de funciones web entre navegadores.' },
  { name: 'web.dev', url: 'https://web.dev', audience: 'developer', category: 'Documentación y comunidad', description: 'Guías de desarrollo web, rendimiento y accesibilidad.' },
  { name: 'npm', url: 'https://www.npmjs.com', audience: 'developer', category: 'Paquetes y APIs', description: 'Registro de paquetes JavaScript y Node.js.' },
  { name: 'PyPI', url: 'https://pypi.org', audience: 'developer', category: 'Paquetes y APIs', description: 'Índice de paquetes para Python.' },
  { name: 'crates.io', url: 'https://crates.io', audience: 'developer', category: 'Paquetes y APIs', description: 'Registro de bibliotecas y herramientas de Rust.' },
  { name: 'Maven Central', url: 'https://central.sonatype.com', audience: 'developer', category: 'Paquetes y APIs', description: 'Repositorio central de paquetes Java y JVM.' },
  { name: 'Postman', url: 'https://www.postman.com', audience: 'developer', category: 'Paquetes y APIs', description: 'Diseño, prueba y documentación de APIs.' },
  { name: 'Swagger Editor', url: 'https://editor.swagger.io', audience: 'developer', category: 'Paquetes y APIs', description: 'Crea y valida especificaciones OpenAPI.' },
  { name: 'Replit', url: 'https://replit.com', audience: 'developer', category: 'Entornos de desarrollo', description: 'Escribe, ejecuta y comparte código desde el navegador.' },
  { name: 'CodePen', url: 'https://codepen.io', audience: 'developer', category: 'Entornos de desarrollo', description: 'Prueba y comparte ejemplos de HTML, CSS y JavaScript.' },
  { name: 'StackBlitz', url: 'https://stackblitz.com', audience: 'developer', category: 'Entornos de desarrollo', description: 'Entorno de desarrollo web ejecutado en el navegador.' },
  { name: 'CodeSandbox', url: 'https://codesandbox.io', audience: 'developer', category: 'Entornos de desarrollo', description: 'Prototipos y entornos de desarrollo colaborativos.' },
  { name: 'JSFiddle', url: 'https://jsfiddle.net', audience: 'developer', category: 'Entornos de desarrollo', description: 'Comparte y prueba fragmentos de código web.' },
  { name: 'Gitpod', url: 'https://gitpod.io', audience: 'developer', category: 'Entornos de desarrollo', description: 'Entornos de desarrollo en la nube para repositorios.' },
  { name: 'Vercel', url: 'https://vercel.com', audience: 'developer', category: 'Cloud y despliegue', description: 'Despliegue de aplicaciones y sitios web.' },
  { name: 'Netlify', url: 'https://www.netlify.com', audience: 'developer', category: 'Cloud y despliegue', description: 'Construcción y alojamiento de sitios web.' },
  { name: 'Render', url: 'https://render.com', audience: 'developer', category: 'Cloud y despliegue', description: 'Alojamiento de aplicaciones, APIs y bases de datos.' },
  { name: 'Railway', url: 'https://railway.com', audience: 'developer', category: 'Cloud y despliegue', description: 'Despliega servicios y bases de datos en la nube.' },
  { name: 'Fly.io', url: 'https://fly.io', audience: 'developer', category: 'Cloud y despliegue', description: 'Ejecuta aplicaciones cerca de tus usuarios.' },
  { name: 'DigitalOcean', url: 'https://cloud.digitalocean.com', audience: 'developer', category: 'Cloud y despliegue', description: 'Infraestructura, máquinas virtuales y servicios cloud.' },
  { name: 'Cloudflare', url: 'https://dash.cloudflare.com', audience: 'developer', category: 'Cloud y despliegue', description: 'DNS, seguridad, red y herramientas para aplicaciones.' },
  { name: 'AWS Console', url: 'https://console.aws.amazon.com', audience: 'developer', category: 'Cloud y despliegue', description: 'Consola de servicios de Amazon Web Services.' },
  { name: 'Google Cloud Console', url: 'https://console.cloud.google.com', audience: 'developer', category: 'Cloud y despliegue', description: 'Administración de proyectos y servicios de Google Cloud.' },
  { name: 'Microsoft Azure', url: 'https://portal.azure.com', audience: 'developer', category: 'Cloud y despliegue', description: 'Portal de administración de servicios Azure.' },
  { name: 'Supabase', url: 'https://supabase.com/dashboard', audience: 'developer', category: 'Cloud y despliegue', description: 'Backend, base de datos y autenticación para aplicaciones.' },
  { name: 'Firebase', url: 'https://console.firebase.google.com', audience: 'developer', category: 'Cloud y despliegue', description: 'Herramientas de Google para crear aplicaciones.' },
  { name: 'Sentry', url: 'https://sentry.io', audience: 'developer', category: 'Observabilidad', description: 'Seguimiento de errores y rendimiento de aplicaciones.' },
  { name: 'Grafana Cloud', url: 'https://grafana.com/products/cloud', audience: 'developer', category: 'Observabilidad', description: 'Métricas, registros y paneles de observabilidad.' },
  { name: 'Datadog', url: 'https://app.datadoghq.com', audience: 'developer', category: 'Observabilidad', description: 'Monitorización de infraestructura y aplicaciones.' },
  { name: 'SonarCloud', url: 'https://sonarcloud.io', audience: 'developer', category: 'Observabilidad', description: 'Análisis de calidad y seguridad del código.' },
  { name: 'LeetCode', url: 'https://leetcode.com', audience: 'developer', category: 'Aprendizaje y empleo', description: 'Práctica de algoritmos y preparación para entrevistas.' },
  { name: 'HackerRank', url: 'https://www.hackerrank.com', audience: 'developer', category: 'Aprendizaje y empleo', description: 'Retos de programación y evaluaciones técnicas.' },
  { name: 'freeCodeCamp', url: 'https://www.freecodecamp.org', audience: 'developer', category: 'Aprendizaje y empleo', description: 'Cursos gratuitos de programación con proyectos prácticos.' },
  { name: 'Exercism', url: 'https://exercism.org', audience: 'developer', category: 'Aprendizaje y empleo', description: 'Ejercicios de programación con mentoría comunitaria.' },
  { name: 'Linear', url: 'https://linear.app', audience: 'developer', category: 'Proyectos y equipo', description: 'Seguimiento de proyectos y tareas de producto.' },
  { name: 'Jira', url: 'https://www.atlassian.com/software/jira', audience: 'developer', category: 'Proyectos y equipo', description: 'Planificación y seguimiento de trabajo para equipos.' },
  { name: 'Read the Docs', url: 'https://readthedocs.org', audience: 'developer', category: 'Documentación y comunidad', description: 'Lee y aloja documentación técnica de proyectos.' },
  { name: 'ClickUp', url: 'https://app.clickup.com', audience: 'developer', category: 'Proyectos y equipo', description: 'Tareas, documentos y planificación de equipos.' },
  { name: 'Dev.to', url: 'https://dev.to', audience: 'developer', category: 'Documentación y comunidad', description: 'Artículos y conversaciones de la comunidad de desarrollo.' },
  { name: 'Hashnode', url: 'https://hashnode.com', audience: 'developer', category: 'Documentación y comunidad', description: 'Publicación y lectura de artículos técnicos.' },
]

function hostname(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return url.toLowerCase()
  }
}

function normalizeSearchText(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase()
}

function CatalogSiteIcon({ site }: { site: CatalogSite }): React.JSX.Element {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)

  return (
    <span className="shop-site-mark" aria-hidden="true">
      <span>{site.name.slice(0, 1)}</span>
      {!failed && <img
        className="shop-site-favicon"
        data-loaded={loaded}
        src={new URL('/favicon.ico', site.url).href}
        alt=""
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
      />}
    </span>
  )
}

function Shop({ installedUrls, onInstall }: {
  installedUrls: string[]
  onInstall: (site: CatalogSite) => Promise<void>
}): React.JSX.Element {
  const [query, setQuery] = useState('')
  const [activeAudience, setActiveAudience] = useState<'all' | 'daily' | 'developer'>('all')
  const [activeCategory, setActiveCategory] = useState('Todo')
  const [busyUrl, setBusyUrl] = useState('')
  const audienceCatalog = catalog.filter((site) => activeAudience === 'all' || site.audience === activeAudience)
  const categories = ['Todo', ...new Set(audienceCatalog.map((site) => site.category))]
  const installed = useMemo(() => new Set(installedUrls.map(hostname)), [installedUrls])
  const normalizedQuery = normalizeSearchText(query.trim())
  const matches = audienceCatalog.filter((site) => {
    const inCategory = activeCategory === 'Todo' || site.category === activeCategory
    const audienceLabel = site.audience === 'daily' ? 'uso diario' : 'programacion desarrollo'
    const searchText = normalizeSearchText(`${site.name} ${site.url} ${site.category} ${site.description} ${audienceLabel}`)
    return inCategory && searchText.includes(normalizedQuery)
  })
  const audiences = [
    { id: 'all' as const, label: 'Todos', count: catalog.length },
    { id: 'daily' as const, label: 'Uso diario', count: catalog.filter((site) => site.audience === 'daily').length },
    { id: 'developer' as const, label: 'Programación', count: catalog.filter((site) => site.audience === 'developer').length },
  ]

  async function add(site: CatalogSite): Promise<void> {
    setBusyUrl(site.url)
    try {
      await onInstall(site)
    } finally {
      setBusyUrl('')
    }
  }

  return (
    <div className="shop-view">
      <header className="shop-intro">
        <span className="shop-mark"><Store size={19} /></span>
        <div>
          <span className="eyebrow">CATÁLOGO INTEGRADO</span>
          <h2>Un sitio para cada espacio</h2>
          <p>Elige un servicio para añadirlo a este workspace. Cada perfil conserva sus propias sesiones.</p>
        </div>
      </header>

      <label className="shop-search">
        <Search size={17} />
        <input aria-label="Buscar en la tienda" placeholder="Buscar servicios..." value={query} onChange={(event) => setQuery(event.target.value)} />
        <span>{matches.length}</span>
      </label>

      <nav className="shop-audiences" aria-label="Tipo de sitio">
        {audiences.map((audience) => (
          <button
            className={activeAudience === audience.id ? 'active' : ''}
            type="button"
            key={audience.id}
            aria-pressed={activeAudience === audience.id}
            onClick={() => {
              setActiveAudience(audience.id)
              setActiveCategory('Todo')
            }}
          >
            <span>{audience.label}</span><span>{audience.count}</span>
          </button>
        ))}
      </nav>

      <nav className="shop-categories" aria-label="Categorías de la tienda">
        {categories.map((category) => (
          <button className={activeCategory === category ? 'active' : ''} type="button" key={category} aria-pressed={activeCategory === category} onClick={() => setActiveCategory(category)}>{category}</button>
        ))}
      </nav>

      {matches.length ? <div className="shop-grid">
        {matches.map((site) => {
          const isInstalled = installed.has(hostname(site.url))
          const isBusy = busyUrl === site.url
          return (
            <article className="shop-card" key={site.url}>
              <div className="shop-card-top">
                <CatalogSiteIcon site={site} />
                <span className="shop-card-category">{site.category}</span>
              </div>
              <h3>{site.name}</h3>
              <p>{site.description}</p>
              <span className="shop-domain">{new URL(site.url).hostname}</span>
              <button className="button button-quiet shop-add" type="button" disabled={isInstalled || isBusy} onClick={() => void add(site)}>
                {isInstalled ? <><Check size={15} /> Añadido</> : isBusy ? 'Añadiendo…' : <><Plus size={15} /> Añadir sitio</>}
                {!isInstalled && !isBusy && <ArrowUpRight size={14} />}
              </button>
            </article>
          )
        })}
      </div> : <div className="shop-empty">No encontramos servicios con esa búsqueda.</div>}
      <p className="shop-footnote">Catálogo integrado sin cuenta ni conexión a un servicio de tienda.</p>
    </div>
  )
}

export default Shop
