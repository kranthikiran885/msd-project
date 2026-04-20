'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BarChart3,
  Settings,
  Database,
  Zap,
  Shield,
  Globe,
  GitBranch,
  Package,
  FileText,
  AlertCircle,
  Menu,
  X,
  LogOut,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

const navigation = [
  { name: 'Overview', href: '/dashboard', icon: BarChart3 },
  { name: 'Deployments', href: '/dashboard/deployments', icon: GitBranch },
  { name: 'Projects', href: '/dashboard/projects', icon: Package },
  { name: 'Databases', href: '/dashboard/databases', icon: Database },
  { name: 'Storage', href: '/dashboard/storage', icon: Package },
  { name: 'Domains', href: '/dashboard/domains', icon: Globe },
  { name: 'Secrets', href: '/dashboard/secrets', icon: Shield },
  { name: 'Logs', href: '/dashboard/logs', icon: FileText },
  { name: 'Alerts', href: '/dashboard/alerts', icon: AlertCircle },
  { name: 'Auto-scaling', href: '/dashboard/autoscaling', icon: Zap },
  { name: 'Billing', href: '/dashboard/billing', icon: BarChart3 },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
]

export default function DashboardLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const pathname = usePathname()

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'w-64' : 'w-20'
        } bg-card border-r transition-all duration-300 flex flex-col fixed h-full z-50 md:relative md:z-0`}
      >
        {/* Logo */}
        <div className="p-4 border-b flex items-center justify-between">
          {sidebarOpen && <Link href="/dashboard" className="font-bold text-lg">⚡ MSD</Link>}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="md:hidden"
          >
            {sidebarOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-2">
          {navigation.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="size-5 flex-shrink-0" />
                {sidebarOpen && <span className="text-sm font-medium">{item.name}</span>}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t space-y-2">
          {sidebarOpen && (
            <>
              <p className="text-xs text-muted-foreground px-4 py-2">Account</p>
              <Button variant="ghost" className="w-full justify-start text-red-500 hover:text-red-600 hover:bg-red-50">
                <LogOut className="size-4 mr-2" />
                Logout
              </Button>
            </>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {/* Top Bar */}
        <header className="bg-card border-b sticky top-0 z-40">
          <div className="px-6 py-4 flex items-center justify-between">
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <div className="flex items-center gap-4">
              <Button variant="outline">Documentation</Button>
              <Button variant="outline">Support</Button>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  )
}
