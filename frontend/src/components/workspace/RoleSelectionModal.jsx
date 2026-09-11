import React from "react";
import { UserCheck, ShieldCheck, Anchor, Compass, Check, X, Radio, Eye } from "lucide-react";
import { useDecisionStore, AVAILABLE_ROLES } from "../../store/decisionStore";

export default function RoleSelectionModal({ isOpen, onClose, onRoleSelected }) {
  const { userRole, setUserRole } = useDecisionStore();

  if (!isOpen) return null;

  const handleSelectRole = (role) => {
    setUserRole(role);
    if (onRoleSelected) {
      onRoleSelected(role);
    }
    if (onClose) {
      onClose();
    }
  };

  const getRoleIcon = (id) => {
    switch (id) {
      case "decision_owner":
        return Anchor;
      case "marine_analyst":
        return Radio;
      case "approval_authority":
        return ShieldCheck;
      case "stakeholder_view":
        return Eye;
      default:
        return UserCheck;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl space-y-5 select-none">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-blue-700 font-bold">
                <UserCheck className="h-4 w-4" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                Select Operational Role
              </h3>
            </div>
            <p className="text-xs text-slate-500">
              Establish command sign-off authority and operational perspective before entering the workspace.
            </p>
          </div>

          {onClose && (
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Roles List */}
        <div className="space-y-2.5">
          {AVAILABLE_ROLES.map((role) => {
            const Icon = getRoleIcon(role.id);
            const isSelected = userRole?.id === role.id;

            return (
              <div
                key={role.id}
                onClick={() => handleSelectRole(role)}
                className={`flex items-start gap-3.5 p-3.5 rounded-xl border cursor-pointer transition ${
                  isSelected
                    ? "border-blue-600 bg-blue-50/50 shadow-xs"
                    : "border-slate-200 hover:border-blue-200 hover:bg-slate-50/70"
                }`}
              >
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                    isSelected
                      ? "bg-blue-600 text-white shadow-xs"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-900">
                      {role.name}
                    </span>
                    <span className="rounded bg-blue-100 text-blue-800 border border-blue-200 px-1.5 py-0.2 text-[9px] font-semibold">
                      {role.clearance}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-blue-700 mt-0.5">
                    {role.title}
                  </p>
                  <p className="text-[11px] text-slate-500 leading-snug mt-1">
                    {role.description}
                  </p>
                </div>

                <div className="shrink-0 self-center">
                  <div
                    className={`h-5 w-5 rounded-full border flex items-center justify-center ${
                      isSelected
                        ? "border-blue-600 bg-blue-600 text-white"
                        : "border-slate-300 bg-white"
                    }`}
                  >
                    {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="pt-2 flex items-center justify-between border-t border-slate-100 text-xs">
          <span className="text-slate-400 text-[11px]">
            Role can be switched anytime from TopBar
          </span>

          <button
            onClick={() => handleSelectRole(userRole || AVAILABLE_ROLES[0])}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold transition shadow-xs"
          >
            Proceed to Workspace →
          </button>
        </div>
      </div>
    </div>
  );
}
