import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // if "next" is in param, use it as the redirect URL
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
    // Se houve erro na troca do código, aí sim mostramos o erro
    return NextResponse.redirect(`${origin}/auth/auth-code-error?error=${error.message}`)
  }

  // Se não veio código, mas você tem o #access_token (visível ao navegador), 
  // o dashboard vai conseguir te logar. Vamos tentar!
  return NextResponse.redirect(`${origin}${next}`)
}
