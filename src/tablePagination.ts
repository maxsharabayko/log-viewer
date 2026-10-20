export const PAGE_SIZE = 500

export function getPage(totalRows: number, requestedPage: number) {
  const pageCount = Math.max(1, Math.ceil(totalRows / PAGE_SIZE))
  const page = Math.max(0, Math.min(requestedPage, pageCount - 1))
  const start = page * PAGE_SIZE
  const end = Math.min(start + PAGE_SIZE, totalRows)

  return { page, pageCount, start, end }
}
