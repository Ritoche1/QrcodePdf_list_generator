export interface Project {
  id: string;
  name: string;
  description?: string;
  entry_count: number;
  generated_count: number;
  created_at: string;
  updated_at: string;
  tags: string[];
}

export interface CreateProject {
  name: string;
  description?: string;
  tags?: string[];
}

export interface UpdateProject {
  name?: string;
  description?: string;
  tags?: string[];
}
