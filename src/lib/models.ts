export interface Task {
  id: string
  title: string
  order: number
  createdAt: string
}

export interface Completion {
  taskId: string
  date: string // YYYY-MM-DD
}
