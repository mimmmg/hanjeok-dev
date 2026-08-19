'use client'

import { useEffect, useState } from 'react'

/**
 * 브라우저 Geolocation 으로 현재 위치를 한 번 받아온다.
 *
 * PRD ⑦ 위치정보 처리 원칙:
 * 좌표는 서버에 저장하지 않고, 요청 시점 계산에만 쓰고 즉시 버린다.
 * 그래서 이 훅은 좌표를 React state 에만 담는다 — localStorage 에도,
 * 쿠키에도, 서버에도 쓰지 않는다. 화면을 벗어나면 함께 사라진다.
 * 거리 계산도 전부 브라우저에서 끝나므로 좌표가 네트워크를 타지 않는다.
 *
 * 권한을 거부해도 서비스는 그대로 동작해야 한다. 그래서 실패는 에러가 아니라
 * "거리를 모르는 상태"로 다룬다 — 호출한 화면은 거리 표시만 생략하면 된다.
 */

export type Coords = { lat: number; lng: number }

export type GeolocationState =
  /** 아직 물어보지 않음 */
  | { status: 'idle' }
  /** 권한 창이 떠 있거나 좌표를 받는 중 */
  | { status: 'loading' }
  | { status: 'granted'; coords: Coords }
  /** 사용자가 거부 — 다시 묻지 않는다 */
  | { status: 'denied' }
  /** 브라우저가 지원하지 않거나 위치를 못 잡음 */
  | { status: 'unavailable' }

type Options = {
  /**
   * false 면 요청하지 않는다. 마운트 시점의 값만 의미가 있다 —
   * 화면 중간에 켜고 끄는 용도가 아니라, 부모가 이미 좌표를 가진 경우
   * 중복 요청을 막는 스위치다.
   */
  enabled?: boolean
}

export function useGeolocation({ enabled = true }: Options = {}): GeolocationState {
  // 초기값을 여기서 정한다. effect 안에서 동기로 setState 하면
  // 연쇄 렌더가 일어나 React Compiler 린트가 막는다.
  const [state, setState] = useState<GeolocationState>(() =>
    enabled ? { status: 'loading' } : { status: 'idle' },
  )

  useEffect(() => {
    if (!enabled) return

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      // effect 본문에서 곧바로 부르지 않고 한 틱 미룬다 (위와 같은 이유)
      queueMicrotask(() => setState({ status: 'unavailable' }))
      return
    }

    // 화면을 벗어난 뒤 도착한 응답으로 state 를 건드리지 않게 한다
    let alive = true

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (!alive) return
        // position 객체를 통째로 들고 있지 않고 필요한 두 값만 꺼낸다.
        // 정확도·고도·속도까지 쥐고 있을 이유가 없다.
        setState({
          status: 'granted',
          coords: {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          },
        })
      },
      (error) => {
        if (!alive) return
        setState(
          error.code === error.PERMISSION_DENIED
            ? { status: 'denied' }
            : { status: 'unavailable' },
        )
      },
      {
        // 거리 표시는 대략이면 충분하다. 고정밀 모드는 배터리만 먹는다
        enableHighAccuracy: false,
        // 8초 안에 못 잡으면 포기하고 거리 없이 보여준다
        timeout: 8000,
        // 5분 이내에 받아둔 위치가 있으면 그대로 쓴다.
        // 화면을 오갈 때마다 GPS 를 다시 켜지 않게 하는 장치다
        maximumAge: 5 * 60 * 1000,
      },
    )

    return () => {
      alive = false
    }
  }, [enabled])

  return state
}
