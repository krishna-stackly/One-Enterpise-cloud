import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'
import { apiResetPassword } from '@/api'
import { PasswordInput } from '@/components/common/PasswordInput'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const schema = z
  .object({
    email: z.string().min(1, 'Email is required'),
    token: z.string().min(4, 'Token is required'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirm: z.string().min(8),
  })
  .refine((value) => value.password === value.confirm, { message: 'Passwords do not match', path: ['confirm'] })

type Values = z.infer<typeof schema>

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', token: '', password: '', confirm: '' },
  })

  return (
    <div>
      <h1 className="text-lg font-semibold tracking-tight">Choose a new password</h1>
      <p className="mt-1 text-[13px] text-muted-foreground">Use the token from the reset email, then set a new password.</p>
      <form
        className="mt-8 space-y-4"
        onSubmit={form.handleSubmit(async (values) => {
          try {
            await apiResetPassword(values.email, values.token, values.password)
            toast.success('Password updated. Sign in with your new password.')
            navigate('/login')
          } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Reset failed')
          }
        })}
      >
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" {...form.register('email')} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="token">Reset token</Label>
          <Input id="token" {...form.register('token')} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">New password</Label>
          <PasswordInput id="password" {...form.register('password')} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm">Confirm password</Label>
          <PasswordInput id="confirm" {...form.register('confirm')} />
          {form.formState.errors.confirm ? (
            <p className="text-xs text-error">{form.formState.errors.confirm.message}</p>
          ) : null}
        </div>
        <Button className="w-full" type="submit">
          Update password
        </Button>
      </form>
      <p className="mt-4 text-sm">
        <Link to="/login" className="text-muted-foreground hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  )
}
