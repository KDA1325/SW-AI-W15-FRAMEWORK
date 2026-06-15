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
// default export 함수라 {} 안 씀 
import ProtectedRoute from './auth/ProtectedRoute'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      <Route path="/recommend" element={<ProtectedRoute><Recommend /></ProtectedRoute>} />
      <Route path="/journals" element={<ProtectedRoute><Journals /></ProtectedRoute>} />
      <Route path="/timeline" element={<ProtectedRoute><Timeline /></ProtectedRoute>} />
      <Route path="/write-review" element={<ProtectedRoute><WriteReview /></ProtectedRoute>} />
      <Route path="/write-journal" element={<ProtectedRoute><WriteJournal /></ProtectedRoute>} />
      <Route path="/journal-detail" element={<ProtectedRoute><JournalDetail /></ProtectedRoute>} />
      <Route path="/journal-detail/:postId" element={<ProtectedRoute><JournalDetail /></ProtectedRoute>} />
      <Route path="/review-detail" element={<ProtectedRoute><ReviewDetail /></ProtectedRoute>} />
    </Routes>
  )
}

export default App
