import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'

dayjs.extend(relativeTime)
dayjs.extend(utc)
dayjs.extend(timezone)

type InputTime = string | number | Date

export function getLocalTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

export function formatWithLocalTZ(
  time: InputTime,
  format = 'YYYY-MM-DD HH:mm:ss',
) {
  const tz = getLocalTimezone()
  return dayjs(time).tz(tz).format(format)
}

export function timeAgo(time: InputTime): string {
  const now = dayjs()
  const target = dayjs(time)

  const diffSeconds = now.diff(target, 'second')

  if (diffSeconds < 0) {
    return '刚刚'
  }

  if (diffSeconds < 60) {
    return '刚刚'
  }

  const diffMinutes = Math.floor(diffSeconds / 60)
  if (diffMinutes < 60) {
    return `${diffMinutes} 分钟前`
  }

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) {
    return `${diffHours} 小时前`
  }

  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 30) {
    return `${diffDays} 天前`
  }

  const diffMonths = Math.floor(diffDays / 30)
  if (diffMonths < 12) {
    return `${diffMonths} 个月前`
  }

  const diffYears = Math.floor(diffMonths / 12)
  return `${diffYears} 年前`
}
