import { useState } from 'react'

export default function SearchBar({ onSubmit, isLoading }) {
  const [topic, setTopic] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (topic.trim() && !isLoading) onSubmit(topic.trim())
  }

  return (
    <div className="animate-fade-up flex flex-col items-center gap-8 w-full max-w-[600px] mx-auto px-4">
      {/* Wordmark */}
      <div className="text-center space-y-2">
        <h1 className="text-5xl font-bold text-white tracking-tight">Pulse</h1>
        <p className="text-[#6b7280] text-base">Public opinion, analyzed by AI agents</p>
        <p className="text-sm text-zinc-500 mt-1">
          Built by <span className="text-zinc-300 font-medium">Odie Yang</span>
        </p>
      </div>

      {/* Search input */}
      <form onSubmit={handleSubmit} className="w-full">
        <div className="relative hover:scale-[1.015] transition-transform duration-200">
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="What's the internet saying about..."
            disabled={isLoading}
            className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-full px-6 py-4 pr-16 text-white text-lg placeholder-[#4b5563] focus:outline-none focus:border-[#3b82f6] transition-colors duration-200 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={isLoading || !topic.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-11 h-11 bg-[#3b82f6] rounded-full flex items-center justify-center hover:scale-110 transition-transform duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isLoading ? <Spinner /> : <ArrowRight />}
          </button>
        </div>
      </form>
    </div>
  )
}

function ArrowRight() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  )
}

function Spinner() {
  return (
    <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
      <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
    </svg>
  )
}
