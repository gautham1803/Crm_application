import React, { useEffect } from "react";
import { Auth0Provider, useAuth0 } from "@auth0/auth0-react";
import { setAuth0Token } from "../lib/api";

const AuthManager: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isLoading, isAuthenticated, error, getAccessTokenSilently, loginWithRedirect } = useAuth0();

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        getAccessTokenSilently()
          .then((token) => setAuth0Token(token))
          .catch((err) => console.error("Failed to get Auth0 token", err));
      } else {
        loginWithRedirect();
      }
    }
  }, [isLoading, isAuthenticated, getAccessTokenSilently, loginWithRedirect]);

  if (error) {
    return <div className="p-8 text-red-500">Authentication Error: {error.message}</div>;
  }

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-screen w-full bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin"></div>
          <span className="text-slate-400 font-medium tracking-wide animate-pulse">Authenticating with Auth0...</span>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export const AuthWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Check if Auth0 is configured
  const domain = import.meta.env.VITE_AUTH0_DOMAIN;
  const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID;
  const audience = import.meta.env.VITE_AUTH0_AUDIENCE;

  // If Auth0 is not configured or uses placeholder values, bypass it automatically
  if (!domain || domain === "your-tenant.auth0.com" || !clientId || clientId === "your_client_id") {
    // Dev auth bypass is active
    return <>{children}</>;
  }

  return (
    <Auth0Provider
      domain={domain}
      clientId={clientId}
      authorizationParams={{
        redirect_uri: window.location.origin,
        audience: audience,
      }}
    >
      <AuthManager>{children}</AuthManager>
    </Auth0Provider>
  );
};
