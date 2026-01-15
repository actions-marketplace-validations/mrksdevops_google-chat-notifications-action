const STATUSES = ['success', 'failure', 'cancelled'] as const
export type Status = (typeof STATUSES)[number]

export function parse(status: string): Status {
  const s = status.toLowerCase()
  if ((STATUSES as readonly string[]).includes(s)) {
    return s as Status
  }
  throw new Error(`Invalid parameter. status=${status}.`)
}
