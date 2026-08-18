/** 내역의 시각 표기. 연도는 쓰지 않는다 — 최근 것만 보는 목록이다. */
export function formatTime(iso: string): string {
  const date = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getMonth() + 1}.${date.getDate()} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}
