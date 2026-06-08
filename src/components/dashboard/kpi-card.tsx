import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface KPICardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: React.ComponentType<{ className?: string }>
  trend?: number
  variant?: 'default' | 'warning' | 'danger' | 'success'
  className?: string
}

export function KPICard({ title, value, subtitle, icon: Icon, trend, variant = 'default', className }: KPICardProps) {
  const variantStyles = {
    default: 'border-border',
    warning: 'border-yellow-500/50 bg-yellow-50/50 dark:bg-yellow-950/20',
    danger: 'border-red-500/50 bg-red-50/50 dark:bg-red-950/20',
    success: 'border-green-500/50 bg-green-50/50 dark:bg-green-950/20',
  }

  const iconStyles = {
    default: 'bg-primary/10 text-primary',
    warning: 'bg-yellow-500/10 text-yellow-600',
    danger: 'bg-red-500/10 text-red-600',
    success: 'bg-green-500/10 text-green-600',
  }

  return (
    <Card className={cn('border', variantStyles[variant], className)}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm text-muted-foreground font-medium">{title}</p>
            <p className="text-2xl font-bold mt-1 tracking-tight">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
            {trend !== undefined && (
              <div className="flex items-center gap-1 mt-2">
                {trend > 0 ? (
                  <TrendingUp className="h-3.5 w-3.5 text-green-500" />
                ) : trend < 0 ? (
                  <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                ) : (
                  <Minus className="h-3.5 w-3.5 text-muted-foreground" />
                )}
                <span className={cn('text-xs font-medium', trend > 0 ? 'text-green-600' : trend < 0 ? 'text-red-600' : 'text-muted-foreground')}>
                  {trend > 0 ? '+' : ''}{trend}% vs last month
                </span>
              </div>
            )}
          </div>
          <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center shrink-0', iconStyles[variant])}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
