import { Navigate, Route, Routes } from 'react-router-dom'
import Architecture from './pages/Architecture'
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
      <Route path="/architecture" element={<Architecture />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      <Route path="/recommend" element={<ProtectedRoute><Recommend /></ProtectedRoute>} />
      <Route path="/journals" element={<ProtectedRoute><Journals /></ProtectedRoute>} />
      <Route path="/timeline" element={<ProtectedRoute><Timeline /></ProtectedRoute>} />
      <Route path="/write-review" element={<ProtectedRoute><WriteReview /></ProtectedRoute>} />
      <Route path="/write-journal" element={<ProtectedRoute><WriteJournal /></ProtectedRoute>} />
      <Route path="/journal-detail" element={<ProtectedRoute><JournalDetail /></ProtectedRoute>} />
      {/* 
        /journal-detail/:postId
        :postId는 React Router의 동적 URL 파라미터입니다.
        Journals 목록에서 특정 게시글을 클릭하면 /journal-detail/게시글ID 형태로 이동하고,
        JournalDetail 페이지에서는 useParams()로 이 id를 꺼내서 GET /posts/:id API를 호출합니다.
        이렇게 해야 상세 페이지가 더미 데이터가 아니라 DB에 저장된 "해당 게시글 하나"를 보여줄 수 있습니다.
      */}
      <Route path="/journal-detail/:postId" element={<ProtectedRoute><JournalDetail /></ProtectedRoute>} />
      <Route path="/review-detail" element={<ProtectedRoute><ReviewDetail /></ProtectedRoute>} />
      <Route path="/review-detail/:postId" element={<ProtectedRoute><ReviewDetail /></ProtectedRoute>} />
    </Routes>
  )
}

export default App
