"use client";

import { useState, useTransition } from "react";

import { deleteMyAccount } from "@/server/actions/account";

export function DeleteAccountForm() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        setError("");
        startTransition(async () => {
          // On success the action redirects and never returns.
          const outcome = await deleteMyAccount(formData);
          if (outcome?.error) setError(outcome.error);
        });
      }}
      className="mt-4 flex flex-wrap items-end gap-3"
    >
      <div className="field">
        <label className="field-label" htmlFor="confirm">
          Type DELETE to confirm
        </label>
        <input
          id="confirm"
          name="confirm"
          autoComplete="off"
          required
          className="field-input font-mono"
          placeholder="DELETE"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="btn cursor-pointer bg-flag disabled:opacity-55"
      >
        {pending ? "Deleting…" : "Delete account"}
      </button>
      {error && (
        <span role="alert" className="font-mono text-xs text-flag">
          {error}
        </span>
      )}
    </form>
  );
}
