type TMatcher = {
  id: number
  name?: string
  image?: string
  threshold?: number
  action: 'click' | 'jump' | 'reset' | 'stop'
  ratio?: number
  to?: string
  count?: number
  max?: number
  delay?: number
}
