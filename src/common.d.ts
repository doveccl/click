type TMatcher = {
  id: number
  name?: string
  image?: string
  threshold?: number
  action: 'click' | 'stop' | 'jump'
  ratio?: number
  to?: string
  max?: number
  delay?: number
}
