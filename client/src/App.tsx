import { Navigate, Route, Routes } from 'react-router-dom'
import JournalDetail from './pages/JournalDetail'
import Journals from './pages/Journals'
import Login from './pages/Login'
import Profile from './pages/Profile'
import Recommend from './pages/Recommend'
import Register from './pages/Register'
import ReviewDetail from './pages/ReviewDetail'
import Timeline from './pages/Timeline'
import WriteJournal from './pages/WriteJournal'
import WriteReview from './pages/WriteReview'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/recommend" element={<Recommend />} />
      <Route path="/journals" element={<Journals />} />
      <Route path="/timeline" element={<Timeline />} />
      <Route path="/write-review" element={<WriteReview />} />
      <Route path="/write-journal" element={<WriteJournal />} />
      <Route path="/journal-detail" element={<JournalDetail />} />
      <Route path="/review-detail" element={<ReviewDetail />} />
    </Routes>
  )
}

export default App
