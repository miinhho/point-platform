import { queryOptions } from '@tanstack/react-query'
import type { Issue, IssueDetail, IssueId, Points, PointTypeId } from '@/shared/contract'
import { request, type RequestOptions } from './http'
import { queryKeys } from './keys'

/** 발행은 자기 지갑으로만 한다 — docs/JOURNEY.md 여정 7 */
export interface CreateIssueInput {
  pointTypeId: PointTypeId
  amount: Points
}

export const issuesApi = {
  /** 응답은 `Transfer` 가 아니라 `Issue` 다 — 계약: docs/API.md */
  createIssue: (input: CreateIssueInput, idempotencyKey: string) =>
    request<Issue>('/issues', { method: 'POST', body: input, idempotencyKey }),

  issue: (id: IssueId, options?: RequestOptions) => request<IssueDetail>(`/issues/${id}`, options),

  issueByKey: (idempotencyKey: string, options?: RequestOptions) =>
    request<Issue | null>('/issues/by-key', { ...options, query: { idempotencyKey } }),
}

export const issueQuery = (issueId: IssueId) =>
  queryOptions({
    queryKey: queryKeys.issue(issueId),
    queryFn: () => issuesApi.issue(issueId),
  })
