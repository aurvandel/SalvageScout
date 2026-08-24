import { useState } from 'react'
import LLMTab from './admin/LLMTab'
import ApifyTab from './admin/ApifyTab'
import NotificationsTab from './admin/NotificationsTab'
import SearchFiltersTab from './admin/SearchFiltersTab'
import ScheduleTab from './admin/ScheduleTab'
import ArenaTab from './admin/ArenaTab'
import './AdminPanel.css'

const TABS = [
  { id: 'llm', label: 'LLM' },
  { id: 'apify', label: 'Apify' },
  { id: 'notifications', label: 'Notifications' },
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
        {activeTab === 'apify' && <ApifyTab />}
        {activeTab === 'notifications' && <NotificationsTab />}
        {activeTab === 'search' && <SearchFiltersTab />}
        {activeTab === 'schedule' && <ScheduleTab />}
        {activeTab === 'arena' && <ArenaTab />}
      </div>
    </div>
  )
}
