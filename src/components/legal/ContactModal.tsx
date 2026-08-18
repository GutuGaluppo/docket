"use client";

import { useRef, useState, useTransition } from "react";

import { submitContact } from "@/server/actions/contact";

export function ContactModal({
  initialName = "",
  initialEmail = "",
}: {
  initialName?: string;
  initialEmail?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const open = () => {
    setError("");
    setSent(false);
    dialogRef.current?.showModal();
  };

  const close = () => {
    if (!pending) dialogRef.current?.close();
  };

  return (
    <>
      <button type="button" onClick={open} className="cursor-pointer uppercase">
        Contact
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby="contact-title"
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
        onCancel={(event) => {
          if (pending) event.preventDefault();
        }}
        className="m-auto w-[min(92vw,560px)] rounded-[3px] border border-rule bg-card p-0 text-ink shadow-paper backdrop:bg-ink/55"
      >
        <div className="p-6 sm:p-8">
          {sent ? (
            <div className="text-center">
              <p className="eyebrow text-stamp">Contact Docket</p>
              <h2 id="contact-title" className="mt-3 text-2xl font-bold tracking-[-0.02em]">
                Message sent
              </h2>
              <button type="button" onClick={close} className="btn mt-7">
                Close
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-5">
                <div>
                  <p className="eyebrow text-stamp">Contact Docket</p>
                  <h2 id="contact-title" className="mt-2 text-2xl font-bold tracking-[-0.02em]">
                    How can we help?
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={close}
                  disabled={pending}
                  aria-label="Close contact form"
                  className="cursor-pointer p-1 font-mono text-xl leading-none text-muted disabled:cursor-wait"
                >
                  ×
                </button>
              </div>

              <form
                ref={formRef}
                className="mt-6 space-y-5"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = event.currentTarget;
                  const data = new FormData(form);
                  setError("");

                  startTransition(async () => {
                    const result = await submitContact({
                      name: data.get("name"),
                      email: data.get("email"),
                      subject: data.get("subject"),
                      message: data.get("message"),
                      company: data.get("company"),
                    });

                    if (!result.ok) {
                      setError(result.error);
                      return;
                    }

                    formRef.current?.reset();
                    setSent(true);
                  });
                }}
              >
                <div className="field">
                  <label className="field-label" htmlFor="contact-name">
                    Your name
                  </label>
                  <input
                    id="contact-name"
                    name="name"
                    autoComplete="name"
                    defaultValue={initialName}
                    required
                    minLength={2}
                    maxLength={100}
                    className="field-input"
                  />
                </div>

                <div className="field">
                  <label className="field-label" htmlFor="contact-email">
                    Your email
                  </label>
                  <input
                    id="contact-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    defaultValue={initialEmail}
                    required
                    maxLength={254}
                    className="field-input"
                  />
                </div>

                <div className="field">
                  <label className="field-label" htmlFor="contact-subject">
                    Subject
                  </label>
                  <input
                    id="contact-subject"
                    name="subject"
                    required
                    minLength={3}
                    maxLength={120}
                    className="field-input"
                  />
                </div>

                <div className="field">
                  <label className="field-label" htmlFor="contact-message">
                    Message
                  </label>
                  <textarea
                    id="contact-message"
                    name="message"
                    required
                    minLength={10}
                    maxLength={5_000}
                    rows={7}
                    className="field-textarea"
                  />
                </div>

                <div
                  aria-hidden="true"
                  className="absolute -left-[10000px] h-px w-px overflow-hidden"
                >
                  <label htmlFor="contact-company">Company</label>
                  <input id="contact-company" name="company" tabIndex={-1} autoComplete="off" />
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  <button type="submit" disabled={pending} className="btn">
                    {pending ? "Sending…" : "Send message"}
                  </button>
                  <button
                    type="button"
                    onClick={close}
                    disabled={pending}
                    className="btn btn-quiet"
                  >
                    Cancel
                  </button>
                </div>

                <div aria-live="polite" className="min-h-5 font-mono text-xs">
                  {error && (
                    <p role="alert" className="text-flag">
                      {error}
                    </p>
                  )}
                </div>
              </form>
            </>
          )}
        </div>
      </dialog>
    </>
  );
}
