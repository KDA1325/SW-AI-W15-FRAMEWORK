import { useMemo, useState } from 'react'
import '../styles/Architecture.css'

type NodeKind =
  | 'client'
  | 'frontend'
  | 'backend'
  | 'ai'
  | 'data'
  | 'external'
  | 'deploy'

type ArchitectureNode = {
  accent: string
  description: string
  icon: string
  id: string
  kind: NodeKind
  label: string
  meta: string
}

type ArchitectureGroup = {
  accent: string
  id: string
  nodes: ArchitectureNode[]
  subtitle: string
  title: string
}

const iconBase = '/icons/architecture'

const groups: ArchitectureGroup[] = [
  {
    accent: 'teal',
    id: 'browser',
    subtitle: 'Vite SPA entry and user-facing screens',
    title: 'User + Browser',
    nodes: [
      {
        accent: 'teal',
        description: 'Runs the single-page app and receives the recommendation cards.',
        icon: 'browser.svg',
        id: 'user-browser',
        kind: 'client',
        label: 'User Browser',
        meta: 'Browser runtime',
      },
      {
        accent: 'teal',
        description: 'Vite serves and builds the React TypeScript client.',
        icon: 'vite.svg',
        id: 'vite-spa',
        kind: 'client',
        label: 'Vite SPA',
        meta: 'Build + dev server',
      },
      {
        accent: 'teal',
        description: 'React 19 and TypeScript power the visible app screens.',
        icon: 'react.svg',
        id: 'react-ts',
        kind: 'frontend',
        label: 'React 19 + TypeScript',
        meta: 'UI runtime',
      },
    ],
  },
  {
    accent: 'green',
    id: 'frontend',
    subtitle: 'Client state, routing, styling, and API calls',
    title: 'Frontend Runtime',
    nodes: [
      {
        accent: 'green',
        description: 'Axios wraps requests to the NestJS API.',
        icon: 'axios.svg',
        id: 'axios',
        kind: 'frontend',
        label: 'Axios API Client',
        meta: 'HTTP',
      },
      {
        accent: 'green',
        description: 'React Router maps profile, recommendations, journals, and timeline views.',
        icon: 'react.svg',
        id: 'router',
        kind: 'frontend',
        label: 'React Router',
        meta: 'Routes',
      },
      {
        accent: 'green',
        description: 'Tailwind CSS and project CSS tokens define the page styling.',
        icon: 'tailwind.svg',
        id: 'tailwind',
        kind: 'frontend',
        label: 'Tailwind CSS',
        meta: 'Styling',
      },
    ],
  },
  {
    accent: 'orange',
    id: 'backend',
    subtitle: 'Auth, posts, RAG orchestration, MCP, persistence',
    title: 'NestJS Backend API',
    nodes: [
      {
        accent: 'orange',
        description: 'Main API surface for auth, journals, reviews, profile, and recommendations.',
        icon: 'nestjs.svg',
        id: 'nestjs',
        kind: 'backend',
        label: 'NestJS 11',
        meta: 'Main backend',
      },
      {
        accent: 'orange',
        description: 'JWT strategy, Passport, and cookies protect user-scoped flows.',
        icon: 'jwt.svg',
        id: 'auth',
        kind: 'backend',
        label: 'JWT + Passport + Cookies',
        meta: 'Auth',
      },
      {
        accent: 'orange',
        description: 'RAG service builds embeddings, queries vector context, and analyzes player taste.',
        icon: 'openai.svg',
        id: 'rag',
        kind: 'backend',
        label: 'RAG Service',
        meta: 'Taste analysis',
      },
      {
        accent: 'orange',
        description: 'Agent loop plans bounded tool calls and merges external/local candidates.',
        icon: 'mcp.svg',
        id: 'agent',
        kind: 'backend',
        label: 'AI Agent Loop + MCP',
        meta: 'JSON-RPC tools/call',
      },
      {
        accent: 'orange',
        description: 'TypeORM owns entities for users, games, posts, tags, embeddings, and sync state.',
        icon: 'typeorm.svg',
        id: 'typeorm',
        kind: 'data',
        label: 'TypeORM',
        meta: 'Persistence layer',
      },
    ],
  },
  {
    accent: 'blue',
    id: 'ai-compute',
    subtitle: 'Python-native AI execution behind NestJS',
    title: 'FastAPI AI Compute',
    nodes: [
      {
        accent: 'blue',
        description: 'FastAPI exposes /embed, /rag/search, /rag/analyze, and agent recommendation endpoints.',
        icon: 'fastapi.svg',
        id: 'fastapi',
        kind: 'ai',
        label: 'FastAPI + Python',
        meta: 'AI compute service',
      },
      {
        accent: 'blue',
        description: 'LangChain retriever reads existing pgvector documents without changing the TypeORM schema.',
        icon: 'langchain.svg',
        id: 'langchain',
        kind: 'ai',
        label: 'LangChain Retriever',
        meta: 'pgvector retrieval',
      },
      {
        accent: 'blue',
        description: 'LangGraph plans bounded search_games MCP queries from RAG context.',
        icon: 'langgraph.svg',
        id: 'langgraph',
        kind: 'ai',
        label: 'LangGraph Planner',
        meta: 'Agent planning',
      },
      {
        accent: 'blue',
        description: 'OpenAI embeddings and structured chat JSON are used when API credentials are configured.',
        icon: 'openai.svg',
        id: 'openai',
        kind: 'external',
        label: 'OpenAI API',
        meta: 'Embeddings + chat JSON',
      },
    ],
  },
  {
    accent: 'amber',
    id: 'data-external',
    subtitle: 'Storage, local development, and external game/profile APIs',
    title: 'Data + External',
    nodes: [
      {
        accent: 'amber',
        description: 'Application storage and vector similarity search over EmbeddingDocument rows.',
        icon: 'postgresql.svg',
        id: 'postgres',
        kind: 'data',
        label: 'PostgreSQL + pgvector',
        meta: 'Primary DB target',
      },
      {
        accent: 'amber',
        description: 'Neon is a Postgres hosting option; the implementation does not require a Neon-specific SDK.',
        icon: 'neon.svg',
        id: 'neon',
        kind: 'data',
        label: 'Neon Postgres option',
        meta: 'Hosted Postgres',
      },
      {
        accent: 'amber',
        description: 'Docker Compose starts local pgvector/Postgres and FastAPI AI compute services.',
        icon: 'docker.svg',
        id: 'docker',
        kind: 'deploy',
        label: 'Local pgvector Docker',
        meta: 'Development',
      },
      {
        accent: 'amber',
        description: 'MCP search_games uses IGDB metadata through Twitch OAuth credentials.',
        icon: 'igdb.svg',
        id: 'igdb',
        kind: 'external',
        label: 'IGDB via Twitch OAuth',
        meta: 'Game metadata',
      },
      {
        accent: 'amber',
        description: 'Profile linking and play-history panels use Steam OpenID and Steam Web API.',
        icon: 'steam.svg',
        id: 'steam',
        kind: 'external',
        label: 'Steam OpenID + Web API',
        meta: 'Profile + play stats',
      },
    ],
  },
]

const flowSteps = [
  'Browser',
  'React/Vite',
  'Axios',
  'NestJS API',
  'RAG Service',
  'FastAPI LangChain + OpenAI',
  'PostgreSQL pgvector',
  'LangGraph Agent',
  'MCP JSON-RPC',
  'IGDB',
  'React cards',
]

function Architecture() {
  const [selectedId, setSelectedId] = useState('rag')

  const selectedNode = useMemo(
    () =>
      groups
        .flatMap((group) => group.nodes)
        .find((node) => node.id === selectedId) ?? groups[2].nodes[2],
    [selectedId],
  )

  return (
    <main className="architecture-page">
      <section className="architecture-hero" aria-labelledby="architecture-title">
        <div className="architecture-title-block">
          <p className="architecture-eyebrow">GJC SYSTEM MAP</p>
          <h1 id="architecture-title">Gaming Journal Club Architecture</h1>
          <p>
            React + NestJS + FastAPI AI Compute + PostgreSQL pgvector를 실제 코드
            구조 기준으로 재구성한 웹 아키텍처 보드입니다.
          </p>
        </div>
        <div className="architecture-badges" aria-label="deployment notes">
          <span>
            <img alt="" src={`${iconBase}/docker.svg`} />
            Docker Compose
          </span>
          <span>
            <img alt="" src={`${iconBase}/vercel.svg`} />
            Vercel SPA rewrite
          </span>
        </div>
      </section>

      <section className="architecture-board" aria-label="Architecture diagram">
        <div className="architecture-groups">
          {groups.map((group) => (
            <article
              className={`architecture-group architecture-group-${group.accent}`}
              key={group.id}
            >
              <header>
                <h2>{group.title}</h2>
                <p>{group.subtitle}</p>
              </header>

              <div className="architecture-node-list">
                {group.nodes.map((node) => {
                  const isSelected = selectedNode.id === node.id

                  return (
                    <button
                      className={`architecture-node architecture-node-${node.accent} ${
                        isSelected ? 'architecture-node-selected' : ''
                      }`}
                      key={node.id}
                      onClick={() => setSelectedId(node.id)}
                      type="button"
                    >
                      <img alt="" src={`${iconBase}/${node.icon}`} />
                      <span>
                        <strong>{node.label}</strong>
                        <small>{node.meta}</small>
                      </span>
                    </button>
                  )
                })}
              </div>
            </article>
          ))}
        </div>

        <div className="architecture-connector-row" aria-hidden="true">
          <span>SPA</span>
          <span>HTTP API</span>
          <span>/embed /rag /agent</span>
          <span>vector + tools</span>
        </div>
      </section>

      <section className="architecture-detail" aria-live="polite">
        <div className={`architecture-detail-card architecture-detail-${selectedNode.accent}`}>
          <img alt="" src={`${iconBase}/${selectedNode.icon}`} />
          <div>
            <p>{selectedNode.meta}</p>
            <h2>{selectedNode.label}</h2>
            <span>{selectedNode.description}</span>
          </div>
        </div>

        <div className="architecture-flow" aria-label="Recommendation SYNC flow">
          <h2>Recommendation SYNC Flow</h2>
          <ol>
            {flowSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <p>
            Correction: Neon은 Postgres 호스팅 옵션입니다. 구현 대상은
            PostgreSQL + pgvector이며, 로컬에서는 pgvector Docker 구성을 함께
            지원합니다.
          </p>
        </div>
      </section>
    </main>
  )
}

export default Architecture
