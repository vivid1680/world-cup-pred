import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') ?? '/dashboard';

  if (code) {
    const supabase = await createClient();
    // This is the line that catches the code and creates your session!
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error) {
      return NextResponse.redirect(`${requestUrl.origin}${next}`);
    } else {
      // If it drops the ball, it will tell us exactly why in the terminal
      console.error("SUPABASE CALLBACK ERROR:", error.message);
    }
  }

  return NextResponse.redirect(`${requestUrl.origin}/login?error=Could%20not%20authenticate%20user`);
}
