import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'
import { PasswordInput } from '@/components/common/PasswordInput'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuthStore } from '@/stores/auth-store'

const schema = z.object({
  email: z
    .string()
    .min(1, 'Enter a valid work email')
    .refine((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), 'Enter a valid work email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

type FormValues = z.infer<typeof schema>

const demos = [
  { email: 'aerrapothuapurwa@thestackly.com', name: 'Aerrapothu Apurwa', role: 'Scrum Master', project: '—' },
]

export function LoginPage() {
  const login = useAuthStore((s) => s.login)
  const navigate = useNavigate()
  const location = useLocation()
  const [submitting, setSubmitting] = useState(false)
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: 'aerrapothuapurwa@thestackly.com', password: 'Password@123' },
  })

  useEffect(() => {
    const message = (location.state as { message?: string } | null)?.message
    if (message) toast.error(message)
  }, [location.state])

  async function onSubmit(values: FormValues) {
    setSubmitting(true)
    try {
      const result = await login(values.email, values.password)
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      toast.success('Signed in')
      navigate('/dashboard')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <h1 className="text-lg font-semibold tracking-tight">Sign in</h1>
      <p className="mt-1 text-[13px] text-muted-foreground">Use your Stackly account. Assignments are project-specific.</p>
      <form className="mt-6 space-y-3.5" noValidate onSubmit={form.handleSubmit(onSubmit)}>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="username" {...form.register('email')} />
          {form.formState.errors.email ? (
            <p className="text-xs text-error">{form.formState.errors.email.message}</p>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <PasswordInput id="password" autoComplete="current-password" {...form.register('password')} />
          {form.formState.errors.password ? (
            <p className="text-xs text-error">{form.formState.errors.password.message}</p>
          ) : null}
        </div>
        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-sm font-medium text-primary hover:underline">
            Forgot password?
          </Link>
        </div>
        <Button className="w-full" type="submit" disabled={submitting}>
          Continue
        </Button>
      </form>
      <div className="mt-8">
        <p className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Demo accounts</p>
        <div className="grid gap-2">
          {demos.map((demo) => {
            return (
              <button
                key={demo.email}
                type="button"
                className="flex items-center justify-between rounded-lg border bg-card px-3 py-2 text-left hover:bg-muted"
                onClick={() => {
                  form.setValue('email', demo.email)
                  form.setValue('password', 'Password@123')
                  void onSubmit({ email: demo.email, password: 'Password@123' })
                }}
              >
                <span>
                  <span className="block text-sm font-medium">{demo.name}</span>
                  <span className="text-xs text-muted-foreground">{demo.email}</span>
                </span>
                <span className="text-right text-xs text-muted-foreground">
                  <span className="block font-semibold text-slate-700">{demo.role}</span>
                  {demo.project}
                </span>
              </button>
            )
          })}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Password for all demo users: Password@123</p>
      </div>
    </div>
  )
}
