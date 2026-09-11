import React, { useState } from "react";
import {
  ArrowRight,
  BrainCircuit,
  Check,
  Database,
  Map,
  MessageSquareText,
  Radio,
  ShieldCheck,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import RoleSelectionModal from "../components/workspace/RoleSelectionModal";

const WORKFLOW = [
  ["01", "Ask", "Describe the marine problem in natural language."],
  ["02", "Reason", "Connect relevant evidence across space and time."],
  ["03", "Verify", "Keep findings traceable and uncertainty visible."],
  ["04", "Continue", "Identify what evidence should come next."],
];

const EVIDENCE = [
  [
    Radio,
    "Ocean observations",
    "Operational marine observations and validated ocean information.",
  ],
  [
    Database,
    "Earth observation",
    "Satellite and geospatial evidence for regional understanding.",
  ],
  [
    Map,
    "Spatial + temporal context",
    "Understand where evidence applies and how conditions evolve.",
  ],
];

const PREVIEW_STEPS = [
  [
    MessageSquareText,
    "Question understood",
    "Marine condition + regional context",
    true,
  ],
  [
    Database,
    "Evidence selected",
    "Ocean · weather · spatial evidence",
    true,
  ],
  [
    BrainCircuit,
    "Reasoning in progress",
    "Spatial + temporal assessment",
    false,
  ],
];

function PreviewStep({ icon: Icon, title, text, complete }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3.5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
        <Icon size={17} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <p className="mt-0.5 text-xs leading-5 text-slate-500">{text}</p>
      </div>

      {complete && (
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white">
          <Check size={12} strokeWidth={3} />
        </span>
      )}
    </div>
  );
}

function ProductPreview() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
      <div className="flex h-12 items-center justify-between border-b border-slate-200 px-5">
        <span className="text-xs font-semibold text-slate-900">
          Sagar AI Workspace
        </span>

        <span className="text-[11px] font-medium text-slate-400">
          Marine reasoning
        </span>
      </div>

      <div className="space-y-3.5 p-5">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-600">
            Marine question
          </p>

          <p className="mt-2.5 text-sm leading-6 text-slate-800">
            What is changing in this marine region, and what evidence should
            we examine next?
          </p>
        </div>

        <div className="space-y-2">
          {PREVIEW_STEPS.map(([icon, title, text, complete]) => (
            <PreviewStep
              key={title}
              icon={icon}
              title={title}
              text={text}
              complete={complete}
            />
          ))}
        </div>

        <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-600">
            Next useful step
          </p>

          <div className="mt-2.5 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Identify the missing evidence
              </p>

              <p className="mt-1 text-xs leading-5 text-slate-500">
                Maintain traceability and uncertainty during analysis.
              </p>
            </div>

            <ArrowRight size={17} className="shrink-0 text-blue-600" />
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ eyebrow, title, description }) {
  return (
    <div className="grid gap-6 lg:grid-cols-12 lg:items-end">
      <div className="lg:col-span-7">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">
          {eyebrow}
        </p>

        <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl lg:text-[42px]">
          {title}
        </h2>
      </div>

      <p className="max-w-xl text-sm leading-7 text-slate-500 lg:col-span-5">
        {description}
      </p>
    </div>
  );
}

export default function LandingPage() {
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="min-h-screen overflow-x-hidden bg-white font-sans text-slate-950">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-10">
          <Link to="/" className="leading-tight">
            <p className="text-sm font-bold tracking-tight text-slate-950">
              Sagar AI
            </p>
            <p className="mt-0.5 text-[11px] font-medium text-slate-500">
              Marine Intelligence
            </p>
          </Link>

          <button
            onClick={() => setIsRoleModalOpen(true)}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white transition hover:bg-blue-700 cursor-pointer"
          >
            Open workspace
            <ArrowRight size={14} />
          </button>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="border-b border-slate-200 bg-white">
          <div className="mx-auto grid max-w-7xl gap-12 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-12 lg:items-center lg:gap-14 lg:px-10 lg:py-24">
            <div className="lg:col-span-7">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">
                Marine Intelligence & Reasoning
              </p>

              <h1 className="mt-5 max-w-4xl text-[48px] font-bold leading-[1] tracking-[-0.055em] text-slate-950 sm:text-6xl lg:text-[72px]">
                Ask the ocean
                <br />
                <span className="text-blue-600">a better question.</span>
              </h1>

              <p className="mt-6 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base lg:text-[17px] lg:leading-8">
                Sagar AI connects marine evidence, spatial-temporal reasoning,
                uncertainty, and the next useful observation in one continuous
                workflow.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={() => setIsRoleModalOpen(true)}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white transition hover:bg-blue-700 active:scale-[0.98] cursor-pointer"
                >
                  Enter Sagar AI
                  <ArrowRight size={16} />
                </button>

                <a
                  href="#approach"
                  className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50"
                >
                  See the approach
                </a>
              </div>

              <div className="mt-6 flex items-center gap-2 text-xs font-medium text-slate-500">
                <ShieldCheck size={15} className="text-blue-600" />
                Evidence-first · uncertainty-visible reasoning
              </div>
            </div>

            <div className="lg:col-span-5">
              <ProductPreview />
            </div>
          </div>
        </section>

        {/* Approach */}
        <section
          id="approach"
          className="border-b border-slate-200 bg-white py-20 sm:py-24"
        >
          <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
            <SectionHeader
              eyebrow="The approach"
              title="From a question to the evidence that matters."
              description="Sagar is built around the reasoning process behind a marine problem—not another dashboard of disconnected data."
            />

            <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {WORKFLOW.map(([number, title, text]) => (
                <article
                  key={number}
                  className="border-t border-slate-200 pt-5"
                >
                  <span className="font-mono text-xs font-semibold text-blue-600">
                    {number}
                  </span>

                  <h3 className="mt-5 text-lg font-bold text-slate-950">
                    {title}
                  </h3>

                  <p className="mt-2 text-sm leading-7 text-slate-500">
                    {text}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Evidence */}
        <section
          id="evidence"
          className="border-b border-slate-200 bg-slate-50 py-20 sm:py-24"
        >
          <div className="mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-12 lg:gap-16 lg:px-10">
            <div className="lg:col-span-5">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">
                Evidence layer
              </p>

              <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl lg:text-[42px]">
                Real evidence.
                <br />
                Explicit uncertainty.
              </h2>

              <p className="mt-5 max-w-xl text-sm leading-7 text-slate-600">
                Sagar combines heterogeneous marine evidence while keeping
                provenance, coverage, and uncertainty visible throughout the
                reasoning process.
              </p>

              <Link
                to="/workspace"
                className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-blue-600 transition hover:text-blue-700"
              >
                Explore the workspace
                <ArrowRight size={15} />
              </Link>
            </div>

            <div className="space-y-3 lg:col-span-7">
              {EVIDENCE.map(([Icon, title, text]) => (
                <article
                  key={title}
                  className="flex gap-4 rounded-xl border border-slate-200 bg-white p-5 transition hover:border-blue-200 hover:shadow-sm"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                    <Icon size={18} />
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-slate-950">
                      {title}
                    </h3>

                    <p className="mt-1 text-sm leading-6 text-slate-500">
                      {text}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
            <div className="flex flex-col gap-8 rounded-2xl border border-blue-100 bg-blue-50 p-8 sm:p-10 lg:flex-row lg:items-center lg:justify-between lg:p-12">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">
                  Sagar AI
                </p>

                <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl lg:text-4xl">
                  Start with the question.
                  <br />
                  <span className="text-slate-600">
                    Let the evidence shape what comes next.
                  </span>
                </h2>
              </div>

              <button
                onClick={() => setIsRoleModalOpen(true)}
                className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white transition hover:bg-blue-700 cursor-pointer"
              >
                Open workspace
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-7 text-xs text-slate-500 sm:px-8 md:flex-row md:items-center md:justify-between lg:px-10">
          <strong className="text-slate-800">Sagar AI</strong>
          <span>Marine Intelligence & Reasoning</span>
          <span>Evidence-driven marine intelligence.</span>
        </div>
      </footer>

      {/* Role Selection Modal */}
      <RoleSelectionModal
        isOpen={isRoleModalOpen}
        onClose={() => setIsRoleModalOpen(false)}
        onRoleSelected={() => navigate("/workspace")}
      />
    </div>
  );
}