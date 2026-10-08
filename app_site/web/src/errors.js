export class ApiError extends Error {
  constructor(status, body) {
    super((body && body.message) || 'The request could not be completed.')
    this.name = 'ApiError'
    this.status = status
    this.rule = (body && body.error) || 'error'
  }
}
