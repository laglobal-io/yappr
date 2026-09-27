"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { disablePush, enablePush, pushStatus } from "@/lib/push";

const AuthCtx = createContext({ enabled: false, user: null });
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(!supabase);
  const [menuOpen, setMenuOpen] = useState(false);
  const [alerts, setAlerts] = useState("off"); // on | off | blocked | unsupported | working

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session ? data.session.user : null);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setUser(session ? session.user : null));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) pushStatus().then(setAlerts).catch(() => setAlerts("off"));
  }, [user]);

  const redirect = () => window.location.origin + window.location.pathname;

  const signInWithEmail = useCallback(async (email) => {
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirect() } });
    if (error) throw new Error(error.message || "Couldn't send the sign-in link.");
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: redirect() } });
    if (error) throw new Error(error.message || "Google sign-in isn't available right now.");
  }, []);

  const signOut = useCallback(async () => {
    try { await disablePush(supabase); } catch { /* ignore */ }
    await supabase.auth.signOut();
    setAlerts("off");
    setMenuOpen(false);
  }, []);

  const turnOnAlerts = useCallback(async () => {
    if (!user) { setMenuOpen(true); return; }
    setAlerts("working");
    try {
      await enablePush(supabase, user.id);
      setAlerts("on");
    } catch (err) {
      setAlerts(await pushStatus().catch(() => "off"));
      throw err;
    }
  }, [user]);

  const turnOffAlerts = useCallback(async () => {
    setAlerts("working");
    try { await disablePush(supabase); } finally { setAlerts(await pushStatus().catch(() => "off")); }
  }, []);

  return (
    <AuthCtx.Provider value={{
      enabled: !!supabase, supabase, user, ready, menuOpen, setMenuOpen,
      signInWithEmail, signInWithGoogle, signOut, alerts, turnOnAlerts, turnOffAlerts,
    }}>
      {children}
    </AuthCtx.Provider>
  );
}
