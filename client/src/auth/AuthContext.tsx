// react에서 자주 쓰는 기능 함수를 꺼내오는 import
// 클래스라기보단 대부분 Hook 또는 API 함수 
// useState: 컴포넌트 안에서 상태값을 만들 때 사용
// -> const [count, setCount] = useState(0)
// count: 현재 값
// setCount: 값을 바꾸는 함수 -> 값이 바뀌면 화면이 다시 렌더링 된다 
// useEffect: 렌더링 이후 실행할 작업을 등록할 때 사용 ex) API 호출, 이벤트 리스너 등록, 타이머 설정 ...
// useEffect(() => {}, [])
// -> [] = 처음 한 번만 실행이라는 뜻 
// useMemo: 계산 결과를 기억해두고, 필요한 경우에만 다시 계산 -> 성능 최적화용(캐싱)
// const ㅇㅇ = useMemo(() => {}, [data]) -> data가 바뀔 때마다 다시 계산한다는 의미 
// createContext: 여러 컴포넌트가 공통으로 사용할 값을 담는 Context를 만듦 
// ex) 로그인 사용자 정보, 테마, 언어 설정 등 전역에 가까운 값 
// useContext: createContext로 만든 값을 컴포넌트 안에서 꺼내 쓸 때 사용 
/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api'

type User = {
  id: string
  email: string
  nickname: string
}

// 그럼 이건 인증과 관련해서 전역에서 공유하며 사용할 값을 저장하는 거겠지
// -> 앱 어디서든 꺼내 쓸 수 있는 인증 관련 상태와 함수 묶음 
type AuthContextValue = {
  user: User | null // 현재 로그인한 사용자 정보, 로그인 하지 않았으면 null
  isLoading: boolean // 현재 인증 정보를 확인 중인지 ex) 앱이 처음 켜졌을 때 서버에 로그인 되어 있는지 확인 중 등 
  isAuthenticated: boolean // 로그인 여부 -> User가 있으면 true, 없으면 false
  refreshUser: () => Promise<void> // 현재 로그인한 사용자 정보를 다시 가져오는 함수 -> 내 정보 API 호출, 성공하면 user 업데이트, 실패하면 user를 null로 변경 등의 역할
  logout: () => Promise<void> // 로그아웃 함수 -> 로그아웃 API 호출, 토큰/세션 제거, user를 null로 변경, 로그인 페이지로 이동 
}

// AuthContextValue 값을 담는 Context를 만듦 
const AuthContext = createContext<AuthContextValue | null>(null)

// export: 이 파일 밖에서도 이 함수/변수/타입을 가져다 쓸 수 있게 공개한다는 뜻
// -> 이게 붙은 함수/변수/타입을 다른 파일에서 import 할 수 있다 = import { AuthProvider } from './AuthProvider'
// export function AuthProvider -> named export -> import할 때 AuthProvider로 이름을 맞춰줘야 함 
// export default AuthProvider -> default export -> 가져오는 쪽에서 이름을 마음대로 붙일 수 있음 -> import MyProvider도 가능 
export function AuthProvider({ children }: { children: React.ReactNode }) {
    // user라는 상태값을 만듦
    //-> user 상태값을 바꾸는 함수 이름을 setUser로 지음 -> 초기값 null 
  const [user, setUser] = useState<User | null>(null)
  
  // isLoading이라는 상태값을 만들어서 setIsLoading라는 이름의 함수로 isLoading 값을 바꿀 수 있게 함 
  // 초기값 true -> isLoading은 나중에 refreshUser()가 끝나면 false로 바뀜
  const [isLoading, setIsLoading] = useState(true)

  // /auth/me와 logout 요청의 순서를 구분하기 위한 번호입니다.
  // logout 전에 시작된 /auth/me 응답이 logout 뒤에 늦게 도착하면, 그 응답은 무시해야 합니다.
  const authRequestIdRef = useRef(0)

  // 현재 로그인한 사용자 정보를 서버에서 다시 가져오는 함수
  // 예: 새로고침했을 때 아직 로그인 상태인지 확인하거나,
  // 로그인 후 최신 사용자 정보를 Context에 반영하고 싶을 때 사용
  const refreshUser = async () => {
    // 이번 /auth/me 요청의 번호를 하나 올려서 기록합니다.
    // 나중에 응답이 돌아왔을 때 이 번호가 최신 번호와 다르면 오래된 응답으로 판단합니다.
    const requestId = authRequestIdRef.current + 1
    authRequestIdRef.current = requestId

    try {
      // /auth/me API에 요청해서 "현재 로그인한 사용자" 정보를 받아옴
      // 이건 페이지 이동(라우터 이동)이 아니라 서버에 데이터를 요청하는 것
      // -> 프론트 페이지 이동을 하는 건 <Link to="/profile" />
      // 예: 화면이 /profile이어도 주소창은 그대로이고, 백그라운드에서 서버의 /auth/me로 요청만 보냄
      // -> 브라우저 주소창은 그대로 http://localhost:5173/profile, 프론트 내부적으로 서버에 요청을 이런 식으로 보냄 GET http://localhost:3000/auth/me
      // <User>는 response.data가 User 타입이라고 TypeScript에게 알려주는 역할
      const response = await api.get<User>('/auth/me')

      // 요청이 성공하면 서버가 보내준 사용자 정보를 user 상태에 저장
      // user가 null이 아니게 되므로 isAuthenticated도 true가 됨
      if (requestId === authRequestIdRef.current) {
        setUser(response.data)
      }
    } catch {
      // 요청이 실패하면 로그인하지 않은 상태로 판단
      // 예: 토큰이 없거나, 세션이 만료됐거나, 서버가 401을 반환한 경우
      if (requestId === authRequestIdRef.current) {
        setUser(null)
      }
    } finally {
      // 성공/실패와 상관없이 "로그인 확인 중" 상태를 끝냄
      // 이 값이 false가 되어야 화면에서 로딩 상태를 해제할 수 있음
      if (requestId === authRequestIdRef.current) {
        setIsLoading(false)
      }
    }
  }

  // 로그아웃 처리 함수
  // 서버에 로그아웃 요청을 보낸 뒤, 프론트엔드의 user 상태도 비워줌
  const logout = async () => {
    // logout이 시작되면 요청 번호를 올립니다.
    // 이렇게 하면 logout 전에 시작된 /auth/me 응답이 나중에 도착해도 무시됩니다.
    const requestId = authRequestIdRef.current + 1
    authRequestIdRef.current = requestId

    try {
      // 서버 쪽 쿠키/세션/토큰을 제거하기 위한 로그아웃 API 호출
      await api.post('/auth/logout')
    } finally {
      if (requestId === authRequestIdRef.current) {
        // 프론트엔드에서도 로그인한 사용자 정보를 제거
        // 이 순간 isAuthenticated는 false가 됨
        setUser(null)
        setIsLoading(false)
      }
    }
  }

  // AuthProvider가 처음 화면에 나타날 때 한 번만 실행됨
  // 앱을 새로고침해도 로그인 상태가 유지되는지 확인하기 위해 refreshUser를 호출
  // []: 의존성 배열 -> 이 컴포넌트가 처음 렌더링된 뒤에만 실행하고 그 뒤엔 다시 실행하지 말라는 명령
  // [user]: user가 바뀔 때마다 실행하라는 명령 
  // AuthProvider는 UI가 없음 -> 렌더링 결과:<AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  // -> 화면에 버튼이나 글자를 그리는 게 아니라, children(=App)을 감싸서 context 값 공급 
  // => 눈에 보이는 UI가 아니라, App 전체에 로그인 정보를 공급하는 컴포넌트
  // => 렌더링 된다 = React가 그 컴포넌트 함수를 실행해서 무엇을 반환하는지 확인한다(!= 화면을 그린다)
  // => 새로고침 -> AuthProvider 새로 마운트 -> useEffect 실행 -> 새로고침 될 때 한번씩 실행 
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void refreshUser()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [])

  // Context를 통해 하위 컴포넌트들에게 나눠줄 값 묶음
  // useMemo를 쓰면 user 또는 isLoading이 바뀔 때만 이 객체를 새로 만듦
  const value = useMemo(
    () => ({
      // 현재 로그인한 사용자 정보
      user,

      // 로그인 상태를 서버에서 확인 중인지 여부
      isLoading,

      // user가 있으면 로그인 상태, 없으면 비로그인 상태
      isAuthenticated: user !== null,

      // 다른 컴포넌트에서 사용자 정보를 다시 불러오고 싶을 때 사용할 함수
      refreshUser,

      // 다른 컴포넌트에서 로그아웃하고 싶을 때 사용할 함수
      logout,
    }),
    [user, isLoading],
  )

  // Provider는 children(App 전체)을 감싸면서 value를 공급함
  // 그래서 App 아래의 모든 컴포넌트가 useAuth()로 user, logout 등을 꺼내 쓸 수 있음
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// Context에 담긴 인증 정보를 편하게 꺼내 쓰기 위한 커스텀 Hook
// 컴포넌트에서 const { user, logout } = useAuth()처럼 사용
export function useAuth() {
  // 가장 가까운 AuthContext.Provider가 공급한 value를 가져옴
  // 가장 가까운 AuthContext.Provider = 컴포넌트 트리에서 현재 컴포넌트를 감싸고 있는 Provider들 중 제일 안쪽 Provider
  // -> 인증 context에선 App만 감싸는 식이라 provider 중첩할 일이 별로 없어서 제일 안쪽 provider라는 게 딱히 없는데,  
  // 다른 페이지를 감싸거나 하는 context라면 provider가 a 값을 반환하게 할 수도 있고, b 값을 반환하게 할 수도 있고 
  // 이런 식으로 다른 변수를 가져오게 provider 중첩해서 사용하는 경우가 있기 때문에 제일 안쪽 Provider 라는 개념이 있는 것 
  const context = useContext(AuthContext)

  if (!context) {
    // AuthProvider 바깥에서 useAuth를 쓰면 context가 설정한 기본값이 null이므로(context가 없으므로) 에러를 던짐
    // 즉, useAuth를 쓰려면 반드시 <AuthProvider> 안쪽 컴포넌트여야 함
    throw new Error('useAuth must be used inside AuthProvider')
  }

  // 정상적으로 Provider 안에서 호출됐다면 인증 관련 값과 함수들을 반환
  return context
}
