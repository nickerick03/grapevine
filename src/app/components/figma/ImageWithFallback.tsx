import React, { useState } from 'react'
import { House } from '@phosphor-icons/react'

export function ImageWithFallback(props: React.ImgHTMLAttributes<HTMLImageElement>) {
  const [didError, setDidError] = useState(false)

  const handleError = () => {
    setDidError(true)
  }

  const { src, alt, style, className, ...rest } = props
  const hasSrc = typeof src === 'string' ? src.trim().length > 0 : Boolean(src)

  const placeholder = (
    <div
      className={`inline-block text-center align-middle bg-[#f7e5b5] ${className ?? ''}`}
      style={style}
    >
      <div className="flex items-center justify-center w-full h-full">
        <House size={30} weight="fill" className="text-[#9a7a2f]" />
      </div>
    </div>
  )

  if (!hasSrc || didError) {
    return placeholder
  }

  return (
    <img src={src} alt={alt} className={className} style={style} {...rest} onError={handleError} />
  )
}
