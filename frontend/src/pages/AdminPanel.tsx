import { useState } from 'react'
import LLMTab from './admin/LLMTab'
import ScraperTab from './admin/ScraperTab'
import NotificationsTab from './admin/NotificationsTab'
import SearchFiltersTab from './admin/SearchFiltersTab'
import ScheduleTab from './admin/ScheduleTab'
import ArenaTab from './admin/ArenaTab'
import PromptsTab from './admin/PromptsTab'
import UsageTab from './admin/UsageTab'
import './AdminPanel.css'

const TABS = [
  { id: 'llm', label: 'LLM' },
  { id: 'scraper', label: 'Scraper' },
  { id: 'usage', label: 'Usage' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'prompts', label: 'Prompts' },
  { id: 'search', label: 'Search Filters' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'arena', label: 'Arena' },
] as const

type TabId = typeof TABS[number]['id']

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState<TabId>('llm')

  return (
    <div className="admin-panel">
      <h1>Admin Panel</h1>

      <div className="tab-bar">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="tab-content">
        {activeTab === 'llm' && <LLMTab />}
        {activeTab === 'scraper' && <ScraperTab />}
        {activeTab === 'usage' && <UsageTab />}
        {activeTab === 'notifications' && <NotificationsTab />}
        {activeTab === 'prompts' && <PromptsTab />}
        {activeTab === 'search' && <SearchFiltersTab />}
        {activeTab === 'schedule' && <ScheduleTab />}
        {activeTab === 'arena' && <ArenaTab />}
      </div>
    </div>
  )
}
