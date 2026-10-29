"use client";

import { Fragment, memo, useMemo, type ReactNode } from "react";

import type { Resume } from "@/lib/resume/schema";
import { elementDomId, resumeElements } from "@/lib/resume/target";
import { highlightSegments } from "@/lib/tailoring/highlight";

/**
 * The CV as it will be read: typeset, not a stack of inputs.
 *
 * Editing happens in fields, but a recruiter never sees a field, and tailoring
 * is judged on the page — whether the advert's words are there, and where. So
 * this view marks every term of the advert the document already uses, and while
 * a recommendation is being looked at it shows that recommendation in place: the
 * current wording struck through and the proposed one beside it, in the
 * sentence it would change, before anything is applied.
 *
 * Every line is a button into the editor. Clicking a sentence opens the field
 * that holds it, which is the shortest way from "that bullet reads badly" to
 * fixing it.
 *
 * With `plain` it is the printed CV: no marks, no diff, no buttons.
 */

export type PreviewDiff = { key: string; current: string; suggested: string };

export type ResumePreviewProps = {
  resume: Resume;
  /** Terms to mark: the advert's keywords, spelled as the document spells them. */
  terms?: readonly string[];
  highlightedKey?: string | null;
  selectedKey?: string | null;
  /** The recommendation being looked at, drawn in place. */
  diff?: PreviewDiff | null;
  onEdit?: (key: string) => void;
  plain?: boolean;
};

function Preview({
  resume,
  terms = [],
  highlightedKey = null,
  selectedKey = null,
  diff = null,
  onEdit,
  plain = false,
}: ResumePreviewProps) {
  const texts = useMemo(
    () => new Map(resumeElements(resume).map((element) => [element.key, element.text] as const)),
    [resume],
  );

  const line = (key: string, as: "span" | "p" | "li" = "span", fallback?: string): ReactNode => {
    const text = texts.get(key) ?? "";
    if (!text.trim() && !fallback && diff?.key !== key) return null;

    return (
      <PreviewLine
        as={as}
        elementKey={key}
        text={text}
        fallback={fallback}
        terms={plain ? [] : terms}
        state={
          plain
            ? undefined
            : selectedKey === key
              ? "selected"
              : highlightedKey === key
                ? "hover"
                : undefined
        }
        diff={!plain && diff?.key === key ? diff : null}
        onEdit={plain ? undefined : onEdit}
      />
    );
  };

  const { personal } = resume;
  const contact = [personal.email, personal.phone, personal.location, ...personal.links].filter(
    (part) => part.trim(),
  );

  const experience = resume.experience.filter(
    (entry) => entry.company || entry.role || entry.bullets.some((bullet) => bullet.text.trim()),
  );
  const education = resume.education.filter((entry) => entry.institution || entry.degree);
  const skills = resume.skills.filter((group) => group.skills.length > 0);
  const projects = resume.projects.filter((project) => project.name);
  const languages = resume.languages.filter((language) => language.name);
  const certifications = resume.certifications.filter((certification) => certification.name);

  return (
    <article className="cvp" data-plain={plain ? "true" : undefined} aria-label="CV preview">
      <header className="cvp-head">
        <h1 className="cvp-name">{line("personal/fullName", "span", plain ? "" : "Your name")}</h1>
        {line("personal/headline", "p")}
        {contact.length > 0 && <p className="cvp-contact">{contact.join("  ·  ")}</p>}
      </header>

      {(resume.summary.text.trim() || diff?.key === "summary/text") && (
        <PreviewSection title="Summary">{line("summary/text", "p")}</PreviewSection>
      )}

      {experience.length > 0 && (
        <PreviewSection title="Experience">
          {experience.map((entry) => (
            <div key={entry.id} className="cvp-entry">
              <div className="cvp-entry-head">
                <p className="cvp-entry-title">
                  {line(`experience/${entry.id}/role`)}
                  {entry.role && entry.company && <span className="cvp-sep"> · </span>}
                  {line(`experience/${entry.id}/company`)}
                </p>
                <p className="cvp-dates">
                  {[entry.startDate, entry.current ? "Present" : entry.endDate]
                    .filter(Boolean)
                    .join(" – ")}
                </p>
              </div>
              {entry.location && <p className="cvp-meta">{entry.location}</p>}
              <ul className="cvp-bullets">
                {entry.bullets.map((bullet) => (
                  <Fragment key={bullet.id}>
                    {line(`experience/${entry.id}/bullets/${bullet.id}`, "li")}
                  </Fragment>
                ))}
              </ul>
            </div>
          ))}
        </PreviewSection>
      )}

      {skills.length > 0 && (
        <PreviewSection title="Skills">
          {skills.map((group) => (
            <p key={group.id} className="cvp-skills">
              {group.name && <b>{group.name}: </b>}
              {line(`skills/${group.id}`)}
            </p>
          ))}
        </PreviewSection>
      )}

      {projects.length > 0 && (
        <PreviewSection title="Projects">
          {projects.map((project) => (
            <div key={project.id} className="cvp-entry">
              <p className="cvp-entry-title">
                {line(`projects/${project.id}/name`)}
                {project.link && <span className="cvp-meta"> · {project.link}</span>}
              </p>
              <ul className="cvp-bullets">
                {project.bullets.map((bullet) => (
                  <Fragment key={bullet.id}>
                    {line(`projects/${project.id}/bullets/${bullet.id}`, "li")}
                  </Fragment>
                ))}
              </ul>
            </div>
          ))}
        </PreviewSection>
      )}

      {education.length > 0 && (
        <PreviewSection title="Education">
          {education.map((entry) => (
            <div key={entry.id} className="cvp-entry">
              <div className="cvp-entry-head">
                <p className="cvp-entry-title">
                  {line(`education/${entry.id}/degree`)}
                  {entry.degree && entry.institution && <span className="cvp-sep"> · </span>}
                  {line(`education/${entry.id}/institution`)}
                </p>
                <p className="cvp-dates">
                  {[entry.startDate, entry.endDate].filter(Boolean).join(" – ")}
                </p>
              </div>
              {line(`education/${entry.id}/details`, "p")}
            </div>
          ))}
        </PreviewSection>
      )}

      {languages.length > 0 && (
        <PreviewSection title="Languages">
          <p className="cvp-skills">
            {languages
              .map((language) =>
                language.level ? `${language.name} (${language.level})` : language.name,
              )
              .join("  ·  ")}
          </p>
        </PreviewSection>
      )}

      {certifications.length > 0 && (
        <PreviewSection title="Certifications">
          <ul className="cvp-bullets">
            {certifications.map((certification) => (
              <li key={certification.id}>
                {[certification.name, certification.issuer, certification.year]
                  .filter(Boolean)
                  .join(" · ")}
              </li>
            ))}
          </ul>
        </PreviewSection>
      )}
    </article>
  );
}

export const ResumePreview = memo(Preview);

function PreviewSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="cvp-section">
      <h2 className="cvp-section-title">{title}</h2>
      {children}
    </section>
  );
}

function PreviewLine({
  as: Tag,
  elementKey,
  text,
  fallback,
  terms,
  state,
  diff,
  onEdit,
}: {
  as: "span" | "p" | "li";
  elementKey: string;
  text: string;
  fallback?: string;
  terms: readonly string[];
  state?: "hover" | "selected";
  diff: PreviewDiff | null;
  onEdit?: (key: string) => void;
}) {
  const body = diff ? (
    <>
      {diff.current.trim() && <del className="cvp-del">{diff.current}</del>}{" "}
      <ins className="cvp-ins">{diff.suggested}</ins>
    </>
  ) : text.trim() ? (
    highlightSegments(text, terms).map((segment, index) =>
      segment.match ? (
        <mark key={index} className="cvp-kw">
          {segment.text}
        </mark>
      ) : (
        <span key={index}>{segment.text}</span>
      ),
    )
  ) : (
    <span className="cvp-placeholder">{fallback}</span>
  );

  if (!onEdit) return <Tag className="cvp-line">{body}</Tag>;

  // The element keeps its own role — a bullet stays a list item — and the
  // control that opens the editor lives inside it.
  return (
    <Tag className="cvp-line">
      <span
        id={`preview-${elementDomId(elementKey)}`}
        className="cvp-hit"
        data-cv-key={elementKey}
        data-highlight={diff ? "diff" : state}
        role="button"
        tabIndex={0}
        title="Edit this line"
        onClick={() => onEdit(elementKey)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onEdit(elementKey);
          }
        }}
      >
        {body}
      </span>
    </Tag>
  );
}
