import { Link, Route, Routes } from 'react-router-dom'
import ListingFeed from './pages/ListingFeed'
import ListingDetail from './pages/ListingDetail'
import MapView from './pages/MapView'
import AdminPanel from './pages/AdminPanel'
import './App.css'

export default function App() {
  return (
    <div className="app">
      <nav className="navbar">
        <div className="nav-brand">
          <Link to="/">SalvageScout</Link>
        </div>
        <div className="nav-links">
          <Link to="/">Listings</Link>
          <Link to="/map">Map</Link>
          <Link to="/admin">Admin</Link>
        </div>
      </nav>
      <main className="main-content">
        <Routes>
          <Route path="/" element={<ListingFeed />} />
          <Route path="/listings/:id" element={<ListingDetail />} />
          <Route path="/map" element={<MapView />} />
          <Route path="/admin" element={<AdminPanel />} />
        </Routes>
      </main>
    </div>
  )
}
