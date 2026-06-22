'use client';

import { useEffect, useState } from 'react';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { createClient } from '@/utils/supabase/client';

export default function LoginPage() {
  const supabase = createClient();
  const [origin, setOrigin] = useState('');

  // Use useEffect to set the origin on client mount to avoid hydration mismatch
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4 py-12">
      <div className="w-full max-w-md space-y-8 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-8 shadow-2xl backdrop-blur-md">
        <div className="text-center">
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-amber-400 via-orange-500 to-amber-600 bg-clip-text text-transparent">
            WORLD CUP 2026
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            Sign in or register to submit predictions and track your score
          </p>
        </div>

        {origin && (
          <div className="mt-8">
            <Auth
              supabaseClient={supabase}
              appearance={{
                theme: ThemeSupa,
                variables: {
                  default: {
                    colors: {
                      brand: '#f97316',
                      brandAccent: '#ea580c',
                      brandButtonText: '#ffffff',
                      defaultButtonBackground: '#18181b',
                      defaultButtonBackgroundHover: '#27272a',
                      defaultButtonBorder: '#27272a',
                      defaultButtonText: '#ffffff',
                      dividerBackground: '#27272a',
                      inputBackground: '#18181b',
                      inputBorder: '#27272a',
                      inputBorderFocus: '#f97316',
                      inputBorderHover: '#3f3f46',
                      inputText: '#ffffff',
                      inputPlaceholder: '#71717a',
                      inputLabelText: '#a1a1aa',
                    },
                    space: {
                      buttonPadding: '10px 16px',
                      inputPadding: '10px 12px',
                    },
                    borderWidths: {
                      buttonBorderWidth: '1px',
                      inputBorderWidth: '1px',
                    },
                    radii: {
                      borderRadiusButton: '8px',
                      buttonBorderRadius: '8px',
                      inputBorderRadius: '8px',
                    },
                  },
                },
              }}
              providers={[]}
              onlyThirdPartyProviders={false}
              redirectTo={`${origin}/auth/callback`}
              theme="dark"
            />
          </div>
        )}
      </div>
    </div>
  );
}
