import { useState } from "react";
import { useDataProvider, useGetIdentity } from "ra-core";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CrmDataProvider } from "../providers/types";
import { notifySessionChanged } from "../providers/turso/authProvider";

export const ChangePasswordPage = () => {
  const { identity } = useGetIdentity();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (newPassword !== confirmation) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    if (!identity) return;
    setPending(true);
    setError("");
    try {
      await dataProvider.updatePassword(identity.id, {
        currentPassword,
        newPassword,
      });
      notifySessionChanged();
      navigate("/", { replace: true });
    } catch (reason: any) {
      setError(reason.message || "Impossible de modifier le mot de passe.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-900">
      <div className="w-full max-w-sm p-8">
        <h1 className="text-2xl font-semibold text-white text-center mb-3">
          Choisissez un nouveau mot de passe
        </h1>
        <p className="text-sm text-zinc-300 mb-8">
          Votre mot de passe provisoire doit être remplacé avant d’accéder au
          CRM.
        </p>
        <form onSubmit={submit} className="space-y-4">
          <PasswordInput
            id="current-password"
            label="Mot de passe actuel"
            value={currentPassword}
            onChange={setCurrentPassword}
            autoComplete="current-password"
          />
          <PasswordInput
            id="new-password"
            label="Nouveau mot de passe"
            value={newPassword}
            onChange={setNewPassword}
            autoComplete="new-password"
          />
          <PasswordInput
            id="confirmation"
            label="Confirmer le nouveau mot de passe"
            value={confirmation}
            onChange={setConfirmation}
            autoComplete="new-password"
          />
          {error && (
            <p className="text-red-400 text-sm" role="alert">
              {error}
            </p>
          )}
          <Button
            type="submit"
            disabled={
              pending || !currentPassword || !newPassword || !confirmation
            }
            className="w-full cursor-pointer"
            variant="secondary"
          >
            {pending ? "Modification…" : "Modifier le mot de passe"}
          </Button>
        </form>
      </div>
    </div>
  );
};

const PasswordInput = ({
  id,
  label,
  value,
  onChange,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
}) => (
  <div>
    <label className="block text-sm text-zinc-200 mb-1" htmlFor={id}>
      {label}
    </label>
    <Input
      id={id}
      type="password"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      autoComplete={autoComplete}
      required
      className="text-white bg-zinc-800 border-zinc-700 focus-visible:ring-zinc-600"
    />
  </div>
);
