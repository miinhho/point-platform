import { describe, expect, it } from 'vitest'
import { orderBalances } from './order'
import type { Balance, PointAccent, PointType } from '@/api/contract'

const point = (id: string, name: string, accent: PointAccent = 'blue'): PointType => ({
  id,
  name,
  nameIsShared: false,
  symbol: id.slice(-2).toUpperCase(),
  issuerId: 'u_x',
  issuerName: '발행자',
  accent,
  totalIssued: 1_000,
  issueCap: 10_000,
  canIssue: false,
  issuableHeadroom: 9_000,
})

const balance = (id: string, name: string, amount: number): Balance => ({
  pointType: point(id, name),
  amount,
  sendable: amount,
})

describe('orderBalances', () => {
  it('잔액이 많은 것이 먼저다', () => {
    const ordered = orderBalances([
      balance('pt_a', '가', 100),
      balance('pt_b', '나', 900),
      balance('pt_c', '다', 500),
    ])
    expect(ordered.map((b) => b.pointType.id)).toEqual(['pt_b', 'pt_c', 'pt_a'])
  })

  it('잔액 0 은 뒤로 간다', () => {
    const ordered = orderBalances([
      balance('pt_a', '가', 0),
      balance('pt_b', '나', 10),
      balance('pt_c', '다', 0),
    ])
    expect(ordered.map((b) => b.pointType.id)).toEqual(['pt_b', 'pt_a', 'pt_c'])
  })

  it('0 끼리는 원래 순서를 지킨다', () => {
    const ordered = orderBalances([balance('pt_z', '자', 0), balance('pt_a', '가', 0)])
    expect(ordered.map((b) => b.pointType.id)).toEqual(['pt_z', 'pt_a'])
  })

  // 떨어져 있으면 둘이 있다는 사실 자체를 모른다.
  it('이름이 같은 포인트는 잔액이 달라도 나란히 온다', () => {
    const ordered = orderBalances([
      balance('pt_on', '온포인트', 3_240_000),
      balance('pt_gm', '금머니', 620_000),
      balance('pt_sol', '솔포인트', 87_500),
      balance('pt_on2', '온포인트', 12_000),
    ])
    expect(ordered.map((b) => b.pointType.id)).toEqual(['pt_on', 'pt_on2', 'pt_gm', 'pt_sol'])
  })

  it('겹치는 이름 묶음 안에서는 잔액 순서를 지킨다', () => {
    const ordered = orderBalances([
      balance('pt_a', '온포인트', 10),
      balance('pt_b', '온포인트', 900),
    ])
    expect(ordered.map((b) => b.pointType.id)).toEqual(['pt_b', 'pt_a'])
  })

  it('원본을 바꾸지 않는다', () => {
    const input = [balance('pt_a', '가', 0), balance('pt_b', '나', 10)]
    orderBalances(input)
    expect(input.map((b) => b.pointType.id)).toEqual(['pt_a', 'pt_b'])
  })
})
