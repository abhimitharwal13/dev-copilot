import type { ProblemType } from '../../../shared/types'

export interface TemplateSection {
  /** Markdown heading the model must use, so the UI can build a table of contents. */
  heading: string
  instructions: string
}

export interface OutputTemplate {
  type: ProblemType
  /** The role the model plays for this kind of problem. */
  persona: string
  sections: TemplateSection[]
  /** Extra rules specific to this problem type. */
  rules: string[]
}
