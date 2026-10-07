type EntryLike = {
  id: string
  createdAt: Date | string
}

export type ResetHistoryItem<T extends EntryLike> = {
  /** The entry created by this reset */
  entry: T
  /** When the reset happened */
  resetAt: Date
  /** Start of the streak this reset ended (the next-older entry) */
  previousAt: Date
  /** 1 = the oldest reset */
  number: number
}

export type ResetHistory<T extends EntryLike> = {
  /** The oldest entry: when the journey started */
  startEntry: T | undefined
  /** The newest entry: when the current streak started */
  currentEntry: T | undefined
  /** Every entry except the journey start, newest first */
  resets: ResetHistoryItem<T>[]
}

const toTime = (value: Date | string) => new Date(value).getTime()

/**
 * Derive a journey's reset history from its entries.
 *
 * A journey has one entry for its start plus one per reset. The server returns
 * them newest first, but this sorts defensively (newest first, ties broken by
 * id) so the result never depends on input order.
 */
export function deriveResetHistory<T extends EntryLike>(
  entries: readonly T[],
): ResetHistory<T> {
  const sorted = [...entries].sort((a, b) => {
    const diff = toTime(b.createdAt) - toTime(a.createdAt)
    if (diff !== 0) return diff
    return a.id < b.id ? 1 : a.id > b.id ? -1 : 0
  })

  const startEntry = sorted[sorted.length - 1]
  const currentEntry = sorted[0]
  const resetCount = Math.max(0, sorted.length - 1)

  const resets: ResetHistoryItem<T>[] = []
  for (let i = 0; i < resetCount; i++) {
    const entry = sorted[i]
    const previous = sorted[i + 1]
    resets.push({
      entry,
      resetAt: new Date(entry.createdAt),
      previousAt: new Date(previous.createdAt),
      number: resetCount - i,
    })
  }

  return { startEntry, currentEntry, resets }
}
