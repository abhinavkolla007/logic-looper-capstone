import CryptoJS from 'crypto-js'

type DailyScorePayload = {
  date: string
  score: number
  timeTaken: number
  timedBonus?: number
}

export function buildDailyScoreProof(payload: DailyScorePayload, authToken: string): string {
  const key = CryptoJS.SHA256(authToken).toString()
  const message = `${payload.date}|${payload.score}|${payload.timeTaken}|${payload.timedBonus ?? 0}`
  return CryptoJS.HmacSHA256(message, key).toString()
}
