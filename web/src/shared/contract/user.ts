import type { UserId } from './ids'

export interface User {
  id: UserId
  name: string
  /** 동명이인을 가르는 유일한 문자열. */
  handle: string
  /** 원장 전체에서 이 이름을 쓰는 사용자가 둘 이상인가. 받은 목록 안에서 세면 방어가 꺼진다. */
  nameIsShared: boolean
}
