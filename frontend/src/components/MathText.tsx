import katex from 'katex'
import 'katex/dist/katex.min.css'

interface MathTextProps {
  text: string
  className?: string
}

export function MathText({ text, className }: MathTextProps) {
  const parts = text.split(/(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g)

  return (
    <span className={className}>
      {parts.map((part, i) => {
        if (part.startsWith('$$') && part.endsWith('$$')) {
          return (
            <span
              key={i}
              dangerouslySetInnerHTML={{
                __html: katex.renderToString(part.slice(2, -2), {
                  displayMode: true,
                  throwOnError: false,
                }),
              }}
            />
          )
        }
        if (part.startsWith('$') && part.endsWith('$')) {
          return (
            <span
              key={i}
              dangerouslySetInnerHTML={{
                __html: katex.renderToString(part.slice(1, -1), {
                  displayMode: false,
                  throwOnError: false,
                }),
              }}
            />
          )
        }
        return <span key={i}>{part}</span>
      })}
    </span>
  )
}
