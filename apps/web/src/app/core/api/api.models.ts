export type Difficulty = 'Easy' | 'Medium' | 'Hard';

export type ProblemStatus =
  | 'To solve'
  | 'Attempted'
  | 'Solved'
  | 'Needs review'
  | 'Mastered';

export interface Link {
  readonly url: string;
  readonly label: string;
}

export interface LinkInput {
  readonly url: string;
  readonly label?: string;
}

export interface Category {
  readonly id: string;
  readonly name: string;
}

export interface Tag {
  readonly id: string;
  readonly name: string;
}

export interface CategoryResource extends Category {
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface TagResource extends Tag {
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface NamedResourceRequest {
  readonly name: string;
}

export interface Problem {
  readonly id: string;
  readonly name: string;
  readonly category: Category;
  readonly difficulty: Difficulty | null;
  readonly status: ProblemStatus;
  readonly tags: readonly Tag[];
  readonly solution: Link | null;
  readonly source: Link | null;
  readonly notes: string;
  readonly timesSolved: number;
  readonly lastReviewedOn: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateProblemRequest {
  readonly name: string;
  readonly categoryId: string;
  readonly difficulty: Difficulty | null;
  readonly status: ProblemStatus;
  readonly tagIds: readonly string[];
  readonly solution: LinkInput | null;
  readonly source: LinkInput | null;
  readonly notes: string;
  readonly timesSolved: number;
  readonly lastReviewedOn: string | null;
}

export interface UpdateProblemRequest {
  readonly name?: string;
  readonly categoryId?: string;
  readonly difficulty?: Difficulty | null;
  readonly status?: ProblemStatus;
  readonly tagIds?: readonly string[];
  readonly solution?: LinkInput | null;
  readonly source?: LinkInput | null;
  readonly notes?: string;
  readonly timesSolved?: number;
}
