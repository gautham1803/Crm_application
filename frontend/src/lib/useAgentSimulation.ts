/** useAgentSimulation — wires all 8 AI agents into the step-by-step run UI. */
import { useCallback, useRef } from "react";
import { useAppStore, type SimulatedRun, type SimulatedRunStep } from "./store";
import { generateId } from "./utils";
import { showToast } from "../components/Toast";
import type { Contact, Account, Deal } from "./api";

// Agent imports — Llama group
import { runNurturerAgent, type GoalType } from "./ai/nurturerAgent";
import { runResearchAgent } from "./ai/researchAgent";
import { runLeadQualifierAgent } from "./ai/leadQualifierAgent";
import { runDealOrchestratorAgent } from "./ai/dealOrchestratorAgent";

// Agent imports — Mistral group
import { runOpportunityWatchAgent } from "./ai/opportunityWatchAgent";
import { runProposalAgent } from "./ai/proposalAgent";
import { runSchedulerAgent } from "./ai/schedulerAgent";

type Timer = ReturnType<typeof setTimeout>;

// ── Agent display names ───────────────────────────────────────
const AGENT_NAMES: Record<string, string> = {
  outbound_campaign:    "NurturerAgent",
  lead_qualification:   "LeadQualifierAgent",
  deal_progression:     "DealOrchestratorAgent",
  account_research:     "ResearchAgent",
  nurture_sequence:     "NurturerAgent",
  opportunity_watch:    "OpportunityWatchAgent",
  generate_proposal:    "ProposalAgent",
  schedule_meeting:     "SchedulerAgent",
};

// ── Step labels per mission ───────────────────────────────────
const STEP_LABELS: Record<string, string[]> = {
  outbound_campaign: [
    "Retrieving contact data and consent status",
    "Analyzing deal context and relationship history",
    "Calling Mistral — drafting personalized email",
    "Running ComplianceAgent (CAN-SPAM, TCPA)",
    "Creating approval for review",
  ],
  lead_qualification: [
    "Loading contact profile",
    "Analyzing company context and revenue signals",
    "Calling Llama — BANT scoring",
    "Generating qualification assessment",
    "Storing results and creating tasks",
  ],
  deal_progression: [
    "Loading deal history and stage context",
    "Analyzing stakeholder engagement",
    "Calling Llama — deal health analysis",
    "Generating action recommendations",
    "Auto-drafting follow-up via Mistral if stalled",
  ],
  account_research: [
    "Loading account and contact data",
    "Analyzing industry and revenue signals",
    "Calling Llama — generating intelligence",
    "Compiling research report",
    "Storing insights to memory",
  ],
  nurture_sequence: [
    "Loading contact/deal relationship data",
    "Analyzing optimal channel and timing",
    "Calling Mistral — drafting message",
    "Running ComplianceAgent",
    "Creating approval for review",
  ],
  opportunity_watch: [
    "Loading account signals and history",
    "Analyzing growth and buying signals",
    "Calling Mistral — scoring opportunity",
    "Generating outreach recommendations",
    "Creating alert and tasks for rep",
  ],
  generate_proposal: [
    "Loading deal data and line items",
    "Pulling account intelligence and memory",
    "Calling Mistral — generating full proposal",
    "Structuring pricing table and timeline",
    "Creating proposal approval card",
  ],
  schedule_meeting: [
    "Loading deal context and contact info",
    "Finding available time slots",
    "Calling Mistral — drafting scheduling email",
    "Running ComplianceAgent",
    "Creating scheduling approval for review",
  ],
};

// Missions that produce an approval card
const DRAFT_MISSIONS = new Set([
  "outbound_campaign", "deal_progression", "nurture_sequence",
  "opportunity_watch", "generate_proposal", "schedule_meeting",
]);

export function useAgentSimulation() {
  const timersRef = useRef<Record<string, Timer>>({});

  const startRun = useCallback(
    (
      missionId: string,
      goal: string,
      contactOrAccount?: string,
      crmData?: { contacts: Contact[]; accounts: Account[]; deals: Deal[] },
      outputType: "EMAIL" | "SMS" | "LINKEDIN" = "EMAIL"
    ) => {
      const runId = generateId();
      const labels = STEP_LABELS[missionId] || STEP_LABELS.outbound_campaign;
      const agentName = AGENT_NAMES[missionId] || "Agent";
      const steps: SimulatedRunStep[] = labels.map((label) => ({ label, timeMs: 0, tokens: 0 }));

      const run: SimulatedRun = {
        id: runId,
        agentName,
        goal,
        status: "running",
        currentStep: 0,
        totalSteps: steps.length,
        stepLabel: `Step 1/${steps.length}: ${labels[0]}`,
        steps,
        cost: 0,
        startedAt: new Date().toISOString(),
        producesDraft: DRAFT_MISSIONS.has(missionId),
        contactOrAccount,
      };

      useAppStore.getState().addAgentRun(run);
      _executeRealAgent(runId, missionId, goal, contactOrAccount, crmData, labels, agentName, outputType);
      return runId;
    },
    []
  );

  async function _executeRealAgent(
    runId: string,
    missionId: string,
    goal: string,
    contactOrAccount: string | undefined,
    crmData: { contacts: Contact[]; accounts: Account[]; deals: Deal[] } | undefined,
    labels: string[],
    agentName: string,
    outputType: "EMAIL" | "SMS" | "LINKEDIN"
  ) {
    const store = useAppStore.getState;
    const contacts = crmData?.contacts || [];
    const accounts = crmData?.accounts || [];
    const deals = crmData?.deals || [];

    let currentStep = 0;
    const advanceUI = () => {
      currentStep++;
      if (currentStep < labels.length) {
        store().updateAgentRun(runId, {
          currentStep,
          stepLabel: `Step ${currentStep + 1}/${labels.length}: ${labels[currentStep]}`,
        });
      }
    };

    try {
      await _delay(600);
      advanceUI();
      await _delay(400);
      advanceUI();

      let totalCost = 0;

      // ── Llama group ──────────────────────────────────────────
      if (missionId === "lead_qualification") {
        const result = await runLeadQualifierAgent({ contacts, accounts, deals, contactName: contactOrAccount || "" });
        advanceUI();
        await _delay(200);
        advanceUI();

        if (result) {
          totalCost = result.cost;
          store().setContactScore(contactOrAccount || "", result);
          store().addAiSpend(result.cost);
          store().addNotification({
            type: "agent_complete",
            title: `LeadQualifierAgent scored ${contactOrAccount}`,
            description: `${result.overallScore}/100 (${result.qualification.toUpperCase()}) · Llama`,
            link: "/contacts",
          });

          showToast(`✦ ${contactOrAccount}: ${result.overallScore}/100 (${result.qualification.toUpperCase()})`, "ai");

          // Auto-chain: Hot → Research → Nurturer, Warm → Research only
          if (result.qualification === "hot" || result.qualification === "warm") {
            showToast("Running ResearchAgent on account...", "ai");
            try {
              const resResult = await runResearchAgent({ contacts, accounts, deals, targetName: contactOrAccount || "", targetType: "contact" });
              if (resResult) {
                store().setResearchResult(contactOrAccount || "", resResult);
                store().addAiSpend(resResult.cost);
                totalCost += resResult.cost;
                store().addNotification({ type: "agent_complete", title: "ResearchAgent completed", description: `Auto-profiled ${contactOrAccount}`, link: "/accounts" });
              }
            } catch (e) { console.warn("[Chain] ResearchAgent failed:", e); }

            if (result.qualification === "hot") {
              const contact = contacts.find((c) => `${c.first_name} ${c.last_name}` === contactOrAccount);
              if (contact?.consent_email) {
                showToast("Hot lead — drafting outreach...", "ai");
                try {
                  const nurResult = await runNurturerAgent({ contacts, accounts, deals, contactName: contactOrAccount || "", goalType: "qualification", outputType: "EMAIL" });
                  if (nurResult) {
                    store().addApproval(nurResult.approval);
                    store().addAiSpend(nurResult.cost);
                    totalCost += nurResult.cost;
                    store().addNotification({ type: "ai_draft", title: "NurturerAgent drafted outreach", description: `Auto-triggered for hot lead ${contactOrAccount}`, link: "/approvals" });
                  }
                } catch (e) { console.warn("[Chain] NurturerAgent failed:", e); }
              }
            }
          }
        } else {
          showToast("LeadQualifierAgent failed — check API keys", "error");
        }

      } else if (missionId === "account_research") {
        const result = await runResearchAgent({ contacts, accounts, deals, targetName: contactOrAccount || "", targetType: "account" });
        advanceUI();
        await _delay(200);
        advanceUI();

        if (result) {
          totalCost = result.cost;
          store().setResearchResult(contactOrAccount || "", result);
          store().addAiSpend(result.cost);
          store().addNotification({ type: "agent_complete", title: "ResearchAgent completed", description: `Profile updated for ${contactOrAccount} · Llama`, link: "/accounts" });
          showToast(`✦ ResearchAgent updated ${contactOrAccount}`, "ai");
        } else {
          showToast("ResearchAgent failed — check API keys", "error");
        }

      } else if (missionId === "deal_progression") {
        const result = await runDealOrchestratorAgent({ deals, contacts, accounts, dealName: contactOrAccount || "" });
        advanceUI();

        if (result) {
          totalCost = result.cost;
          store().setDealInsight(contactOrAccount || "", result);
          store().addAiSpend(result.cost);

          if (result.shouldDraftEmail && result.bestContactForEmail) {
            advanceUI();
            try {
              const nurResult = await runNurturerAgent({ contacts, accounts, deals, contactName: result.bestContactForEmail, dealName: contactOrAccount, goalType: result.emailGoal?.includes("re-engage") ? "re_engage" : "follow_up", outputType: "EMAIL" });
              if (nurResult) {
                store().addApproval(nurResult.approval);
                store().addAiSpend(nurResult.cost);
                totalCost += nurResult.cost;
                store().addNotification({ type: "ai_draft", title: "DealOrchestratorAgent drafted email", description: `For ${result.bestContactForEmail} on ${contactOrAccount}`, link: "/approvals" });
              }
            } catch (e) { console.warn("[Chain] DealOrchestrator NurturerAgent failed:", e); }
          } else {
            advanceUI();
          }

          store().addNotification({
            type: "agent_complete",
            title: `Deal Analysis: ${contactOrAccount}`,
            description: `${result.dealHealth.toUpperCase()} (${result.healthScore}/100)`,
            link: "/deals",
          });

          showToast(`✦ ${contactOrAccount}: ${result.dealHealth.toUpperCase()} (${result.healthScore}/100)`, result.dealHealth === "critical" ? "error" : result.dealHealth === "stalled" ? "warning" : "ai");
        } else {
          showToast("DealOrchestratorAgent failed — check API keys", "error");
        }

      // ── Mistral group ────────────────────────────────────────
      } else if (missionId === "outbound_campaign" || missionId === "nurture_sequence") {
        const result = await runNurturerAgent({ contacts, accounts, deals, contactName: contactOrAccount || "", goalType: missionId === "outbound_campaign" ? "first_touch" : "nurture", outputType: outputType as "EMAIL" | "SMS" });
        advanceUI();
        await _delay(200);

        if (result) {
          totalCost = result.cost;
          store().addApproval(result.approval);
          store().addAiSpend(result.cost);
          store().addNotification({ type: "ai_draft", title: `${agentName} created a draft`, description: `Draft ready for ${contactOrAccount || "review"} · Mistral`, link: "/approvals" });
          showToast(`✦ ${agentName} drafted ${outputType.toLowerCase()} for ${contactOrAccount || "review"}`, "ai", "Review Now →", () => { window.location.hash = "/approvals"; });
        }

      } else if (missionId === "opportunity_watch") {
        const result = await runOpportunityWatchAgent({ contacts, accounts, deals, targetName: contactOrAccount || "", targetType: "account" });
        advanceUI();
        await _delay(200);
        advanceUI();

        if (result) {
          totalCost = result.cost;
          store().addAiSpend(result.cost);
          store().addNotification({
            type: "agent_complete",
            title: result.alertMessage || `🔔 Opportunity signal for ${contactOrAccount}`,
            description: `Score: ${result.opportunityScore}/100 · Timing: ${result.recommendedTiming} · Mistral`,
            link: "/",
          });

          // Route to Dashboard opportunity alerts widget
          store().addOpportunityAlert({
            accountName: contactOrAccount || "Unknown",
            alertMessage: result.alertMessage || `Opportunity signal for ${contactOrAccount}`,
            opportunityScore: result.opportunityScore,
            recommendedTiming: result.recommendedTiming,
            outreachAngle: result.outreachAngle,
            signalsFound: result.signalsFound,
            talkingPoints: result.talkingPoints,
            riskFactors: result.riskFactors,
            summary: result.summary,
          });

          showToast(result.alertMessage || `✦ Opportunity signal for ${contactOrAccount}`, result.opportunityScore >= 70 ? "ai" : "warning");
        } else {
          showToast("OpportunityWatchAgent failed — check API keys", "error");
        }

      } else if (missionId === "generate_proposal") {
        const result = await runProposalAgent({ contacts, accounts, deals, dealName: contactOrAccount || "" });
        advanceUI();
        await _delay(200);
        advanceUI();

        if (result) {
          totalCost = result.cost;
          store().addAiSpend(result.cost);

          // Route to Deals page proposal section
          store().setProposalDocument(contactOrAccount || "", {
            id: `prop-${Date.now()}`,
            dealName: contactOrAccount || "",
            title: result.title,
            executiveSummary: result.executiveSummary,
            problemStatement: result.problemStatement,
            proposedSolution: result.proposedSolution,
            pricingTable: result.pricingTable,
            totalAcv: result.totalAcv,
            paymentTerms: result.paymentTerms,
            validUntil: result.validUntil,
            implementationTimeline: result.implementationTimeline,
            whyUs: result.whyUs,
            nextSteps: result.nextSteps,
            summary: result.summary,
            model: result.model,
            cost: result.cost,
            timestamp: new Date().toISOString(),
          });

          store().addNotification({ type: "agent_complete", title: "ProposalAgent generated proposal", description: `${result.title} — $${result.totalAcv.toLocaleString()} ACV`, link: "/deals" });

          // Auto-chain: draft a proposal email via NurturerAgent
          try {
            const deal = deals.find((d) => d.name === contactOrAccount);
            const primaryContact = deal?.contact_id ? contacts.find((c) => c.id === deal.contact_id) : null;
            if (primaryContact?.consent_email) {
              const contactName = `${primaryContact.first_name} ${primaryContact.last_name}`;
              showToast("Drafting proposal email...", "ai");
              const nurResult = await runNurturerAgent({ contacts, accounts, deals, contactName, dealName: contactOrAccount, goalType: "follow_up", outputType: "EMAIL" });
              if (nurResult) {
                store().addApproval(nurResult.approval);
                store().addAiSpend(nurResult.cost);
                totalCost += nurResult.cost;
                store().addNotification({ type: "ai_draft", title: "NurturerAgent drafted proposal email", description: `For ${contactName} on ${contactOrAccount}`, link: "/approvals" });
              }
            }
          } catch (e) { console.warn("[Chain] Proposal NurturerAgent failed:", e); }

          showToast(`✦ ProposalAgent generated proposal — $${result.totalAcv.toLocaleString()} ACV`, "ai", "View →", () => { window.location.hash = "/deals"; });
        } else {
          showToast("ProposalAgent failed — check API keys", "error");
        }

      } else if (missionId === "schedule_meeting") {
        const result = await runSchedulerAgent({ contacts, accounts, deals, dealName: contactOrAccount || "" });
        advanceUI();
        await _delay(200);

        if (result) {
          totalCost = result.cost;
          store().addApproval(result.approval);
          store().addAiSpend(result.cost);
          store().addNotification({ type: "ai_draft", title: "SchedulerAgent drafted scheduling email", description: `${result.meetingType} (${result.durationMinutes} min) for ${contactOrAccount} · Mistral`, link: "/approvals" });
          showToast(`✦ SchedulerAgent scheduled ${result.meetingType} for ${contactOrAccount}`, "ai", "Review →", () => { window.location.hash = "/approvals"; });
        } else {
          showToast("SchedulerAgent failed — check API keys", "error");
        }
      }

      store().updateAgentRun(runId, {
        status: "complete",
        currentStep: labels.length,
        stepLabel: "Complete",
        completedAt: new Date().toISOString(),
        cost: totalCost,
      });
    } catch (e: any) {
      console.error(`[${agentName}] Error:`, e);
      store().updateAgentRun(runId, {
        status: "failed",
        stepLabel: `Failed: ${e.message}`,
        completedAt: new Date().toISOString(),
      });
      showToast(`${agentName} failed: ${e.message}`, "error");
    }

    delete timersRef.current[runId];
  }

  const cancelRun = useCallback((runId: string) => {
    if (timersRef.current[runId]) {
      clearTimeout(timersRef.current[runId]);
      delete timersRef.current[runId];
    }
    useAppStore.getState().updateAgentRun(runId, {
      status: "cancelled",
      stepLabel: "Cancelled",
      completedAt: new Date().toISOString(),
    });
    showToast("Agent run cancelled", "warning");
  }, []);

  return { startRun, cancelRun };
}

function _delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
