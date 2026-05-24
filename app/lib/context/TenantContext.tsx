"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { fetchInitialMe, invalidateInitialMe } from "@/app/lib/data/initial";
import { createClient } from "@/app/lib/supabase/client";

interface TenantUser {
  id: string;
  authId: string;
  email: string;
  name: string;
  role: string;
}

interface Tenant {
  id: string;
  name: string;
  slug: string;
  defaultVertical: string;
}

interface TenantContextValue {
  user: TenantUser | null;
  tenant: Tenant | null;
  loading: boolean;
}

const TenantCtx = createContext<TenantContextValue>({
  user: null,
  tenant: null,
  loading: true,
});

export function useTenant() {
  return useContext(TenantCtx);
}

export function TenantProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<TenantUser | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;
    fetchInitialMe()
      .then((data) => {
        if (cancelled) return;
        if (data.status === 404 && pathname !== "/onboarding") {
          router.replace("/onboarding");
          return;
        }
        setUser(data.user);
        setTenant(data.tenant);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  // React to auth state changes (sign-out, sign-in as different user) so the
  // shared /api/me cache doesn't leak stale identity across sessions. Skips
  // INITIAL_SESSION + TOKEN_REFRESHED — those don't change user identity.
  useEffect(() => {
    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        invalidateInitialMe();
        setUser(null);
        setTenant(null);
      } else if (event === "SIGNED_IN" || event === "USER_UPDATED") {
        invalidateInitialMe();
        fetchInitialMe().then((data) => {
          if (data.status === 404 && pathname !== "/onboarding") {
            router.replace("/onboarding");
            return;
          }
          setUser(data.user);
          setTenant(data.tenant);
        });
      }
    });
    return () => subscription.unsubscribe();
  }, [pathname, router]);

  return (
    <TenantCtx.Provider value={{ user, tenant, loading }}>
      {children}
    </TenantCtx.Provider>
  );
}
