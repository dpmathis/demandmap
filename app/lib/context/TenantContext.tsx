"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";

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
    fetch("/api/me")
      .then(async (r) => {
        if (r.status === 404 && pathname !== "/onboarding") {
          router.replace("/onboarding");
          return null;
        }
        return r.ok ? r.json() : null;
      })
      .then((data) => {
        if (data) {
          setUser(data.user);
          setTenant(data.tenant);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [pathname, router]);

  return (
    <TenantCtx.Provider value={{ user, tenant, loading }}>
      {children}
    </TenantCtx.Provider>
  );
}
