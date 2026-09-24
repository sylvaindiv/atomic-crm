import { useState } from "react";
import { useLogin } from "ra-core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const login = useLogin();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    try {
      await login({ email, password });
    } catch (reason: any) {
      setError(reason.message || "Erreur de connexion");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-900">
      <div className="w-full max-w-sm p-8">
        <h1 className="text-2xl font-semibold text-white text-center mb-8">
          Connexion
        </h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-sm text-zinc-200" htmlFor="email">
            E-mail
          </label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
            className="text-white placeholder:text-zinc-500 bg-zinc-800 border-zinc-700 focus-visible:ring-zinc-600"
          />
          <label className="block text-sm text-zinc-200" htmlFor="password">
            Mot de passe
          </label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
            className="text-white placeholder:text-zinc-500 bg-zinc-800 border-zinc-700 focus-visible:ring-zinc-600"
            autoFocus
          />
          {error && (
            <p className="text-red-400 text-sm" role="alert">
              {error}
            </p>
          )}
          <Button
            type="submit"
            disabled={!email || !password}
            className="w-full cursor-pointer"
            variant="secondary"
          >
            Connexion
          </Button>
        </form>
      </div>
    </div>
  );
};
