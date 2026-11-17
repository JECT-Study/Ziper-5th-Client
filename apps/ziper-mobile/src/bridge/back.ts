export type BackTarget = 'sheet' | 'web' | 'native' | 'root';

export function backTarget(sheet: boolean, webDepth: number, nativeCanPop: boolean): BackTarget {
  return sheet ? 'sheet' : webDepth > 0 ? 'web' : nativeCanPop ? 'native' : 'root';
}

export function interceptNativeBack(sheet: boolean, webDepth: number): boolean {
  return sheet || webDepth > 0;
}
