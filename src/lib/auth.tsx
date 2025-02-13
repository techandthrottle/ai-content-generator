import { createContext, useContext, useEffect, useState } from 'react';

// Create a temporary auth context until Supabase is connected
export const AuthContext = createContext<{
  user: any;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}>({
  user: null,
  signInWithGoogle: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);

  const signInWithGoogle = async () => {
    console.log('Sign in with Google clicked');
  };

  const signOut = async () => {
    console.log('Sign out clicked');
  };

  return (
    <AuthContext.Provider value={{ user, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);