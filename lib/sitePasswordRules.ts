// 一般パスワードの入力ルール（クライアントとサーバーで共用）
export const SITE_PASSWORD_MIN_LENGTH = 4
export const SITE_PASSWORD_MAX_LENGTH = 64

export function isValidSitePassword(password: unknown): password is string {
  return typeof password === 'string'
    && password.length >= SITE_PASSWORD_MIN_LENGTH
    && password.length <= SITE_PASSWORD_MAX_LENGTH
    && password.trim() === password
}
