import { memo, useState, type ReactNode } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { headingTitle } from '../answer'
import { Mermaid } from './Mermaid'

function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false)
  const copy = (): void => {
    void navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }
  return (
    <div className="codeblock">
      <div className="codeblock__bar">
        <span>{language || 'text'}</span>
        <button type="button" onClick={copy}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  )
}

function textOf(children: ReactNode): string {
  if (typeof children === 'string') return children
  if (Array.isArray(children)) return children.map(textOf).join('')
  return ''
}

/** GitHub-flavoured Markdown with Mermaid diagrams and copyable code blocks. */
export const Markdown = memo(function Markdown({ text, final }: { text: string; final: boolean }) {
  const components: Components = {
    pre: ({ children }) => <>{children}</>,
    code: ({ className, children }) => {
      const language = /language-([\w+#-]+)/.exec(className ?? '')?.[1]
      const code = textOf(children).replace(/\n$/, '')
      if (language === undefined && !code.includes('\n')) return <code className="inline">{children}</code>
      if (language === 'mermaid') return <Mermaid code={code} final={final} />
      return <CodeBlock language={language ?? ''} code={code} />
    },
    // Sections are numbered by CSS, so drop any number the model wrote itself.
    h2: ({ children }) => <h2>{typeof children === 'string' ? headingTitle(children) : children}</h2>,
    a: ({ href, children }) => (
      <a href={href} target="_blank" rel="noreferrer">
        {children}
      </a>
    )
  }
  return (
    <div className="markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  )
})
