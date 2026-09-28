import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'
import { apiForgotPassword } from '@/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const schema = z.object({
  email: z.string().min(1, 'Email is required'),
})

export function ForgotPasswordPage() {
  const form = useForm<{ email: string }>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  })

  return (
    <div>
      <h1 className="text-lg font-semibold tracking-tight">Reset password</h1>
      <p className="mt-1 text-[13px] text-muted-foreground">Enter your work email. We will issue a reset token for this demo.</p>
      <form
        className="mt-8 space-y-4"
        onSubmit={form.handleSubmit(async (values) => {
          const result = await apiForgotPassword(values.email)
          const token = typeof result === 'object' && result && 'token' in result ? result.token : undefined
          toast.success(token ? `Reset token: ${token}` : 'If the account exists, instructions were sent.')
        })}
      >
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" {...form.register('email')} />
        </div>
        <Button className="w-full" type="submit">
          Send reset token
        </Button>
      </form>
      <p className="mt-4 text-sm">
        <Link to="/reset-password" className="font-medium text-primary hover:underline">
          I already have a token
        </Link>
      </p>
      <p className="mt-2 text-sm">
        <Link to="/login" className="text-muted-foreground hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  )
}
