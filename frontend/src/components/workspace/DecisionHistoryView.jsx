import React from "react";
import { History, GitCommit, UserCheck, Clock, ShieldCheck } from "lucide-react";
import { useDecisionStore } from "../../store/decisionStore";

export default function DecisionHistoryView() {
  const { decisionHistory, decision } = useDecisionStore();

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">
              Decision Version Lineage &amp; Audit Trail
            </h2>
            <span className="rounded bg-slate-100 text-slate-700 text-[10px] font-mono font-bold px-2 py-0.5">
              Active Head: {decision.version}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit logging (Section 20): Traceable record of original decision commitments, detected events, and human authorizations.
          </p>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md font-semibold">
          <ShieldCheck className="h-4 w-4" />
          <span>Audit Log Immutable</span>
        </div>
      </div>

      {/* History Timeline Cards */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
        <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
          {decisionHistory.map((item, index) => {
            const isLatest = index === 0;
            const isCommitted = item.status.includes("COMMITTED");
            const isChangeDetected = item.status.includes("CHANGE_DETECTED");

            return (
              <div key={index} className="relative group">
                {/* Node pip */}
                <div
                  className={`absolute -left-6 top-1 h-5 w-5 rounded-full border-2 flex items-center justify-center bg-white ${
                    isCommitted
                      ? "border-emerald-600 text-emerald-600"
                      : isChangeDetected
                      ? "border-amber-500 text-amber-500"
                      : "border-blue-600 text-blue-600"
                  }`}
                >
                  <GitCommit className="h-3 w-3" />
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 space-y-2 hover:border-slate-300 transition">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-200/80 pb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-xs text-slate-900">
                        {item.version}
                      </span>
                      <span
                        className={`rounded px-1.5 py-0.2 text-[10px] font-bold uppercase tracking-wider ${
                          isCommitted
                            ? "bg-emerald-100 text-emerald-800"
                            : isChangeDetected
                            ? "bg-amber-100 text-amber-800"
                            : "bg-slate-200 text-slate-800"
                        }`}
                      >
                        {item.status.replace(/_/g, " ")}
                      </span>
                      {isLatest && (
                        <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-1.5 py-0.2 rounded">
                          CURRENT HEAD
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {item.timestamp}
                      </span>
                      <span className="flex items-center gap-1 font-medium text-slate-700">
                        <UserCheck className="h-3 w-3 text-slate-400" />
                        {item.officer}
                      </span>
                    </div>
                  </div>

                  <h4 className="text-xs font-bold text-slate-900">{item.event}</h4>
                  <p className="text-xs text-slate-600 leading-relaxed font-sans">
                    {item.summary}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
