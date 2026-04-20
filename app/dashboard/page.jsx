'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { AlertCircle, TrendingUp, Database, Zap, Server, Clock } from 'lucide-react'

export default function DashboardPage() {
  const [metrics, setMetrics] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchMetrics()
  }, [])

  const fetchMetrics = async () => {
    try {
      const response = await fetch('/api/dashboard/metrics')
      const data = await response.json()
      setMetrics(data)
    } catch (error) {
      console.error('Failed to fetch metrics:', error)
    } finally {
      setLoading(false)
    }
  }

  const deploymentData = [
    { month: 'Jan', deployments: 24, successful: 20, failed: 4 },
    { month: 'Feb', deployments: 32, successful: 28, failed: 4 },
    { month: 'Mar', deployments: 28, successful: 26, failed: 2 },
    { month: 'Apr', deployments: 35, successful: 33, failed: 2 },
  ]

  const performanceData = [
    { time: '00:00', cpu: 20, memory: 40, disk: 30 },
    { time: '06:00', cpu: 35, memory: 45, disk: 35 },
    { time: '12:00', cpu: 65, memory: 70, disk: 45 },
    { time: '18:00', cpu: 45, memory: 55, disk: 40 },
    { time: '23:59', cpu: 25, memory: 42, disk: 32 },
  ]

  const statusData = [
    { name: 'Healthy', value: 8, color: '#22c55e' },
    { name: 'Degraded', value: 2, color: '#f59e0b' },
    { name: 'Down', value: 1, color: '#ef4444' },
  ]

  const stats = [
    { label: 'Total Deployments', value: '342', icon: Server, change: '+12%' },
    { label: 'Active Projects', value: '24', icon: Database, change: '+3' },
    { label: 'System Uptime', value: '99.9%', icon: Clock, change: '+0.1%' },
    { label: 'Auto-scales This Month', value: '156', icon: Zap, change: '+25%' },
  ]

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {stats.map((stat, index) => {
          const Icon = stat.icon
          return (
            <Card key={index}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.label}
                  </CardTitle>
                  <Icon className="size-4 text-primary" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground mt-1">{stat.change}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* System Status */}
      <Card>
        <CardHeader>
          <CardTitle>System Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="size-3 bg-green-500 rounded-full"></div>
                <span className="text-sm">Backend API</span>
              </div>
              <p className="text-xs text-muted-foreground">All systems operational</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="size-3 bg-green-500 rounded-full"></div>
                <span className="text-sm">Database</span>
              </div>
              <p className="text-xs text-muted-foreground">Healthy - 99.98% uptime</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="size-3 bg-yellow-500 rounded-full"></div>
                <span className="text-sm">Storage</span>
              </div>
              <p className="text-xs text-muted-foreground">85% capacity used</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Deployment Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Deployments This Quarter</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={deploymentData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="successful" stackId="a" fill="#22c55e" />
                <Bar dataKey="failed" stackId="a" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* System Performance */}
        <Card>
          <CardHeader>
            <CardTitle>System Performance (24h)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={performanceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="cpu" stroke="#3b82f6" />
                <Line type="monotone" dataKey="memory" stroke="#f59e0b" />
                <Line type="monotone" dataKey="disk" stroke="#ec4899" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Project Status */}
        <Card>
          <CardHeader>
            <CardTitle>Project Health Status</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { action: 'Deployment completed', project: 'api-service', time: '2 hours ago', status: 'success' },
                { action: 'Auto-scale triggered', project: 'web-app', time: '4 hours ago', status: 'info' },
                { action: 'Database backup', project: 'main-db', time: '1 day ago', status: 'success' },
                { action: 'Alert triggered', project: 'api-service', time: '2 days ago', status: 'warning' },
              ].map((activity, index) => (
                <div key={index} className="flex items-start justify-between pb-4 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium">{activity.action}</p>
                    <p className="text-xs text-muted-foreground">{activity.project}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{activity.time}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      <Card className="border-yellow-200 bg-yellow-50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="size-5 text-yellow-600" />
            <CardTitle className="text-yellow-900">Active Alerts</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <p className="text-yellow-800">• Storage usage at 85% for main-db (Phase 13)</p>
            <p className="text-yellow-800">• Auto-scaling limit reached for api-service (Phase 11)</p>
            <p className="text-yellow-800">• SSL certificate renewal due in 7 days (Phase 16)</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
