'use client'

import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted/50", className)}
      {...props}
    />
  )
}

export { Skeleton }

export function ProductSkeleton() {
  return (
    <div className="bg-white rounded-[28px] p-4 border border-black/5 space-y-4">
      <div className="flex justify-between">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-4 w-12 rounded-md" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
      <div className="flex justify-between items-center pt-2">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-10 w-10 rounded-xl" />
      </div>
    </div>
  )
}

export function DfdCardSkeleton() {
  return (
    <div className="bg-white p-6 rounded-[32px] border border-black/5 flex items-center justify-between shadow-sm">
      <div className="flex items-center gap-6">
        <Skeleton className="w-16 h-16 rounded-3xl" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-6 w-64" />
        </div>
      </div>
      <Skeleton className="h-8 w-24 rounded-full" />
    </div>
  )
}
