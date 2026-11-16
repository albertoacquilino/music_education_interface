/** Convert an app pitch token to a filename without changing the pitch identifier. */
export function noteAssetName(token: string): string {
  return token.replace(/^([A-G])(\d)([sf])/, '$1$3$2');
}
