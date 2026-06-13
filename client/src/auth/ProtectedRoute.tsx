// 굳이 보호 라우트 따로 안 만들어도 됨
// 그냥 각 페이지나 컴포넌트에서 useAuth()로 로그인 상태 꺼내서 확인해도 됨
// -> 그런데도 보호 라우트를 따로 만드는 이유: 반복되는 인증 검사 로직을 한 곳에 모으기 위함
// -> 로그인 해야만 볼 수 있는 페이지가 많다면 각 페이지마다 useAuth 가져와서 확인하는 코드가 계속 들어가게 됨
// -> 페이지가 많아질 수록 중복 코드 많아짐
// => 그냥 보호 라우트 껍데기를 하나 만들어서 공통 처리
import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'

type ProtectedRouteProps = {
    // children: 보호 라우트로 감싸질 페이지 
    // -> main.tsx에서 App 전체를 감싸는 게 아니라 App.tsx에서 페이지 단위로 감쌈 
  children: ReactNode
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
    // context에서 현재 인증 상태를 꺼냄 
  const { isAuthenticated, isLoading } = useAuth()
  
  // 사용자가 원래 가려고 했던 주소를 기억함 
  // -> 나중에 로그인 후 로그인 전에 있던 원래 페이지로 돌려보낼 때 쓸 수 있음 
  const location = useLocation()

  // 앱이 켜져있을 때 /auth/me 확인이 끝나지 않았을 수 있으니 로딩이 끝날 때까지 기다림
  if (isLoading) {
    return <div>AUTH CHECKING...</div>
  }

  // 로딩 끝났는데 로그인 안 되어있는 상태 = !isAuthenticated
  if (!isAuthenticated) {
    // 로그인 페이지로 보냄 
    return <Navigate replace state={{ from: location }} to="/login" />
  }

  return children
}