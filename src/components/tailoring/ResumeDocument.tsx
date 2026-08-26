"use client";

import { useMemo } from "react";

import {
  addBullet,
  addEntry,
  removeBullet,
  removeEntry,
  setEntryField,
  type EntrySection,
} from "@/lib/resume/edit";
import type { Resume } from "@/lib/resume/schema";
import { resumeElements, type ResumeElement } from "@/lib/resume/target";

import { ResumeField } from "./ResumeField";
import { ResumeEntry, ResumeSection } from "./ResumeSection";

/**
 * The CV, rendered as fields.
 *
 * Presentational on purpose: it holds no state and knows nothing about
 * recommendations, so the same component renders the working document in the
 * editor and the proposed one on the import review screen. That is the whole
 * reason it was separated — a review screen with its own second set of inputs
 * would drift from the editor by the first change made to either, and the
 * person correcting an imported date would be using a different control from
 * the one they use five minutes later.
 *
 * Every input writes through the address a recommendation points at, so typing
 * into a bullet and applying a suggestion to it are the same operation on the
 * same data.
 */
export type ResumeDocumentProps = {
  resume: Resume;
  onChange: (next: Resume) => void;
  /** Temporary highlight: the card under the pointer. */
  highlightedKey?: string | null;
  /** Persistent highlight: the card that was clicked. */
  selectedKey?: string | null;
  /** Keys an import could not read with confidence. */
  uncertain?: readonly string[];
};

export function ResumeDocument({
  resume,
  onChange,
  highlightedKey = null,
  selectedKey = null,
  uncertain = [],
}: ResumeDocumentProps) {
  const elements = useMemo(() => resumeElements(resume), [resume]);
  const byKey = useMemo(
    () => new Map(elements.map((element) => [element.key, element] as const)),
    [elements],
  );

  const flagged = useMemo(() => new Set(uncertain), [uncertain]);

  const write = (key: string, next: string) => {
    const element = byKey.get(key);
    if (element) onChange(element.write(next));
  };

  const field = (key: string) => {
    const element: ResumeElement | undefined = byKey.get(key);
    return {
      elementKey: key,
      value: element?.text ?? "",
      onChange: (next: string) => write(key, next),
      highlighted: highlightedKey === key,
      selected: selectedKey === key,
      flagged: flagged.has(key),
    };
  };

  const structural = (next: Resume) => onChange(next);
  const add = (section: EntrySection) => structural(addEntry(resume, section));

  return (
    <div className="cv-document">
      <ResumeSection id="cv-personal" title="Personal information">
        <div className="cv-grid">
          <ResumeField label="Full name" {...field("personal/fullName")} />
          <ResumeField
            label="Professional title"
            hint="What you call yourself. Role alignment reads this line first."
            {...field("personal/headline")}
          />
          <ResumeField label="Email" {...field("personal/email")} />
          <ResumeField label="Phone" {...field("personal/phone")} />
          <ResumeField label="Location" {...field("personal/location")} />
        </div>
      </ResumeSection>

      <ResumeSection
        id="cv-summary"
        title="Professional summary"
        hint="Two or three lines. The first thing a reader sees, and the cheapest place to answer the advert."
      >
        <ResumeField
          label="Summary"
          multiline
          rows={4}
          placeholder="Frontend engineer building product interfaces in React…"
          {...field("summary/text")}
        />
      </ResumeSection>

      <ResumeSection
        id="cv-experience"
        title="Experience"
        onAdd={() => add("experience")}
        addLabel="Add a role"
      >
        {resume.experience.map((entry) => (
          <ResumeEntry
            key={entry.id}
            title={[entry.company, entry.role].filter(Boolean).join(" — ") || "New role"}
            removeLabel={`Remove ${entry.company || "this role"}`}
            onRemove={() => structural(removeEntry(resume, "experience", entry.id))}
          >
            <div className="cv-grid">
              <ResumeField label="Role" {...field(`experience/${entry.id}/role`)} />
              <ResumeField label="Company" {...field(`experience/${entry.id}/company`)} />
              <ResumeField label="Location" {...field(`experience/${entry.id}/location`)} />
              <ResumeField
                elementKey={`experience/${entry.id}/startDate`}
                label="From"
                value={entry.startDate}
                onChange={(next) =>
                  structural(setEntryField(resume, "experience", entry.id, "startDate", next))
                }
              />
              <ResumeField
                elementKey={`experience/${entry.id}/endDate`}
                label="To"
                value={entry.current ? "Present" : entry.endDate}
                onChange={(next) =>
                  structural(setEntryField(resume, "experience", entry.id, "endDate", next))
                }
              />
            </div>

            <label className="cv-current">
              <input
                type="checkbox"
                checked={entry.current}
                onChange={(event) =>
                  structural({
                    ...resume,
                    experience: resume.experience.map((item) =>
                      item.id === entry.id
                        ? {
                            ...item,
                            current: event.target.checked,
                            // "Present" is what the document said, not a date
                            // this invented — and unticking it must not leave
                            // the word behind as if it were one.
                            endDate: event.target.checked ? "Present" : "",
                          }
                        : item,
                    ),
                  })
                }
              />
              I still work here
            </label>

            <div className="cv-bullets">
              {entry.bullets.map((bullet, index) => (
                <div key={bullet.id} className="cv-bullet">
                  <ResumeField
                    label={`Bullet ${index + 1}`}
                    multiline
                    rows={2}
                    {...field(`experience/${entry.id}/bullets/${bullet.id}`)}
                  />
                  <button
                    type="button"
                    className="cv-remove"
                    aria-label={`Remove bullet ${index + 1} of ${entry.company || "this role"}`}
                    onClick={() =>
                      structural(removeBullet(resume, "experience", entry.id, bullet.id))
                    }
                    suppressHydrationWarning
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="link-quiet"
                onClick={() => structural(addBullet(resume, "experience", entry.id))}
                suppressHydrationWarning
              >
                Add a bullet
              </button>
            </div>
          </ResumeEntry>
        ))}
      </ResumeSection>

      <ResumeSection
        id="cv-skills"
        title="Skills"
        onAdd={() => add("skills")}
        addLabel="Add a group"
        hint="Grouped, and separated by commas. A skill listed here and shown in a role counts for more than one that is only listed."
      >
        {resume.skills.map((group) => (
          <ResumeEntry
            key={group.id}
            title={group.name || "New group"}
            removeLabel={`Remove ${group.name || "this group"}`}
            onRemove={() => structural(removeEntry(resume, "skills", group.id))}
          >
            <div className="cv-grid">
              <ResumeField
                elementKey={`skills/${group.id}/name`}
                label="Group"
                value={group.name}
                placeholder="Frontend"
                onChange={(next) =>
                  structural(setEntryField(resume, "skills", group.id, "name", next))
                }
              />
              <ResumeField
                label="Skills"
                placeholder="React, TypeScript, CSS"
                {...field(`skills/${group.id}`)}
              />
            </div>
          </ResumeEntry>
        ))}
      </ResumeSection>

      <ResumeSection
        id="cv-education"
        title="Education"
        onAdd={() => add("education")}
        addLabel="Add"
      >
        {resume.education.map((entry) => (
          <ResumeEntry
            key={entry.id}
            title={[entry.institution, entry.degree].filter(Boolean).join(" — ") || "New entry"}
            removeLabel={`Remove ${entry.institution || "this entry"}`}
            onRemove={() => structural(removeEntry(resume, "education", entry.id))}
          >
            <div className="cv-grid">
              <ResumeField label="Degree" {...field(`education/${entry.id}/degree`)} />
              <ResumeField label="Institution" {...field(`education/${entry.id}/institution`)} />
              <ResumeField
                elementKey={`education/${entry.id}/endDate`}
                label="Finished"
                value={entry.endDate}
                onChange={(next) =>
                  structural(setEntryField(resume, "education", entry.id, "endDate", next))
                }
              />
            </div>
            <ResumeField
              label="Details"
              multiline
              rows={2}
              {...field(`education/${entry.id}/details`)}
            />
          </ResumeEntry>
        ))}
      </ResumeSection>

      <ResumeSection
        id="cv-projects"
        title="Projects"
        onAdd={() => add("projects")}
        addLabel="Add a project"
      >
        {resume.projects.map((project) => (
          <ResumeEntry
            key={project.id}
            title={project.name || "New project"}
            removeLabel={`Remove ${project.name || "this project"}`}
            onRemove={() => structural(removeEntry(resume, "projects", project.id))}
          >
            <ResumeField label="Name" {...field(`projects/${project.id}/name`)} />
            <div className="cv-bullets">
              {project.bullets.map((bullet, index) => (
                <div key={bullet.id} className="cv-bullet">
                  <ResumeField
                    label={`Bullet ${index + 1}`}
                    multiline
                    rows={2}
                    {...field(`projects/${project.id}/bullets/${bullet.id}`)}
                  />
                  <button
                    type="button"
                    className="cv-remove"
                    aria-label={`Remove bullet ${index + 1} of ${project.name || "this project"}`}
                    onClick={() =>
                      structural(removeBullet(resume, "projects", project.id, bullet.id))
                    }
                    suppressHydrationWarning
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="link-quiet"
                onClick={() => structural(addBullet(resume, "projects", project.id))}
                suppressHydrationWarning
              >
                Add a bullet
              </button>
            </div>
          </ResumeEntry>
        ))}
      </ResumeSection>

      <ResumeSection
        id="cv-languages"
        title="Languages"
        onAdd={() => add("languages")}
        addLabel="Add"
      >
        {resume.languages.map((language) => (
          <ResumeEntry
            key={language.id}
            title={language.name || "New language"}
            removeLabel={`Remove ${language.name || "this language"}`}
            onRemove={() => structural(removeEntry(resume, "languages", language.id))}
          >
            <div className="cv-grid">
              <ResumeField
                elementKey={`languages/${language.id}/name`}
                label="Language"
                value={language.name}
                onChange={(next) =>
                  structural(setEntryField(resume, "languages", language.id, "name", next))
                }
              />
              <ResumeField label="Level" {...field(`languages/${language.id}/level`)} />
            </div>
          </ResumeEntry>
        ))}
      </ResumeSection>

      <ResumeSection
        id="cv-certifications"
        title="Certifications"
        onAdd={() => add("certifications")}
        addLabel="Add"
      >
        {resume.certifications.map((certification) => (
          <ResumeEntry
            key={certification.id}
            title={certification.name || "New certification"}
            removeLabel={`Remove ${certification.name || "this certification"}`}
            onRemove={() => structural(removeEntry(resume, "certifications", certification.id))}
          >
            <div className="cv-grid">
              <ResumeField label="Name" {...field(`certifications/${certification.id}/name`)} />
              <ResumeField
                elementKey={`certifications/${certification.id}/issuer`}
                label="Issuer"
                value={certification.issuer}
                onChange={(next) =>
                  structural(
                    setEntryField(resume, "certifications", certification.id, "issuer", next),
                  )
                }
              />
              <ResumeField
                elementKey={`certifications/${certification.id}/year`}
                label="Year"
                value={certification.year}
                onChange={(next) =>
                  structural(
                    setEntryField(resume, "certifications", certification.id, "year", next),
                  )
                }
              />
            </div>
          </ResumeEntry>
        ))}
      </ResumeSection>
    </div>
  );
}
