/**
 * ilike 검색어에서 와일드카드 문자를 무력화한다.
 *
 * `%` 와 `_` 는 SQL LIKE 의 와일드카드다. 사용자가 검색창에 "%"만 쳐도
 * 전체 목록이 나오고, "경_궁"은 의도치 않게 경복궁까지 잡는다.
 * 사용자가 친 글자는 글자 그대로 찾아야 하므로 이스케이프한다.
 *
 * (값 자체의 SQL 주입은 supabase-js 가 막는다. 여기서 다루는 건
 *  "와일드카드가 특수문자로 해석되는" 별개의 문제다.)
 */
export function escapeLikePattern(input: string): string {
  return input.replace(/[\\%_]/g, (c) => `\\${c}`)
}
