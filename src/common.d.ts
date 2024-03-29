type TMatcher = {
  id: number
  name?: string
  image?: string
  threshold?: number
  max?: number
  action?: 'click' | 'stop' | 'jump'
  ratio?: number
  to?: string
}
