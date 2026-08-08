/**
 * 立即触发的防抖：首次调用马上执行，等待时间内的后续调用会被忽略。
 */
export function debounceLeading<T extends (...args: any[]) => void>(
  fn: T,
  wait = 1000,
): (...args: Parameters<T>) => void {
  let last = 0

  return (...args: Parameters<T>) => {
    const now = Date.now()
    if (now - last < wait) return
    last = now
    fn(...args)
  }
}
