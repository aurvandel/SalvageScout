import { Route, Routes } from 'react-router-dom'
import ListingFeed from './pages/ListingFeed'
import ListingDetail from './pages/ListingDetail'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<ListingFeed />} />
      <Route path="/listings/:id" element={<ListingDetail />} />
    </Routes>
  )
}
