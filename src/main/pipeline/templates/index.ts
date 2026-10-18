import type { ProblemType } from '../../../shared/types'
import { DB_TEMPLATE } from './db'
import { DSA_TEMPLATE } from './dsa'
import { HLD_TEMPLATE } from './hld'
import { LLD_TEMPLATE } from './lld'
import type { OutputTemplate } from './types'

export type { OutputTemplate, TemplateSection } from './types'

export const TEMPLATES: Record<ProblemType, OutputTemplate> = {
  dsa: DSA_TEMPLATE,
  lld: LLD_TEMPLATE,
  hld: HLD_TEMPLATE,
  db: DB_TEMPLATE
}
