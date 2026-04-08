import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { v4 as uuidv4 } from 'uuid'
import ApiKeyDisplay from '@/components/ApiKeyDisplay'

export default async function DashboardPage() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Check if user has a project — auto-create if not
  let { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('owner_id', user.id)
    .single()

  if (!project) {
    const apiKey = uuidv4()
    const { data: newProject, error } = await supabase
      .from('projects')
      .insert({
        name: 'My Project',
        api_key: apiKey,
        owner_id: user.id,
      })
      .select('*')
      .single()

    if (error) {
      return (
        <div className="text-brand-red">
          Failed to create project. Make sure RLS policies allow inserts for authenticated users.
        </div>
      )
    }
    project = newProject
  }

  // Fetch stats
  const { count: totalLogs } = await supabase
    .from('logs')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', project.id)

  const { count: blockedCount } = await supabase
    .from('logs')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', project.id)
    .eq('verdict', 'block')

  const allowedCount = (totalLogs ?? 0) - (blockedCount ?? 0)

  const codeSnippet = `const response = await fetch('${process.env.NEXT_PUBLIC_SUPABASE_URL ? 'https://your-domain.com' : 'https://your-domain.com'}/api/check', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    api_key: '${project.api_key}',
    action_type: 'send_email',
    payload: { to: 'user@example.com', count: 1 }
  })
});
const { allowed, reason } = await response.json();
if (!allowed) throw new Error(\`Blocked: \${reason}\`);`

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-semibold text-brand-white mb-1">Dashboard</h1>
      <p className="text-brand-grey text-sm mb-8">Welcome back. Here&apos;s your project overview.</p>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-brand-panel border border-brand-border rounded-lg p-5">
          <p className="text-xs text-brand-grey uppercase tracking-wider mb-1">Total Checks</p>
          <p className="text-3xl font-semibold text-brand-white">{totalLogs ?? 0}</p>
        </div>
        <div className="bg-brand-panel border border-brand-border rounded-lg p-5">
          <p className="text-xs text-brand-grey uppercase tracking-wider mb-1">Allowed</p>
          <p className="text-3xl font-semibold text-green-500">{allowedCount}</p>
        </div>
        <div className="bg-brand-panel border border-brand-border rounded-lg p-5">
          <p className="text-xs text-brand-grey uppercase tracking-wider mb-1">Blocked</p>
          <p className="text-3xl font-semibold text-brand-red">{blockedCount ?? 0}</p>
        </div>
      </div>

      {/* Project Info */}
      <div className="bg-brand-panel border border-brand-border rounded-lg p-5 mb-8">
        <h2 className="text-sm font-semibold text-brand-white mb-4">Project: {project.name}</h2>
        <div>
          <label className="block text-xs text-brand-grey uppercase tracking-wider mb-2">
            API Key
          </label>
          <ApiKeyDisplay apiKey={project.api_key} />
        </div>
      </div>

      {/* Quick Start */}
      <div className="bg-brand-panel border border-brand-border rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-brand-border flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
          <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
          <span className="text-xs text-brand-grey ml-2 font-mono">Quick Start</span>
        </div>
        <pre className="p-5 text-xs text-brand-grey font-mono overflow-x-auto leading-relaxed">
          {codeSnippet}
        </pre>
      </div>
    </div>
  )
}
