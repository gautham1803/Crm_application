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
            description: `${result.overallScore}/100 (${result.qualification.toUpperCase()}) · Confidence: ${result.confidenceLevel} · Llama`,
            link: "/contacts",
          });

          showToast(`✦ ${contactOrAccount}: ${result.overallScore}/100 (${result.qualification.toUpperCase()})`, "ai");

          // Auto-chain: Hot/Warm → Research → Dual-channel Nurturer
          if (result.qualification === "hot" || result.qualification === "warm") {
            showToast("Running ResearchAgent on account...", "ai");
            try {
              const resResult = await runResearchAgent({ contacts, accounts, deals, targetName: contactOrAccount || "", targetType: "contact" });
              if (resResult) {
                store().setResearchResult(contactOrAccount || "", resResult);
                store().addAiSpend(resResult.cost);
                totalCost += resResult.cost;
                store().addNotification({ type: "agent_complete", title: "ResearchAgent completed", description: `Auto-profiled ${contactOrAccount}`, link: "/accounts" });
                // Store competitor intel if available
                if (resResult.competitors?.length > 0) {
                  const accountName = contacts.find(c => `${c.first_name} ${c.last_name}` === contactOrAccount)?.account_id
                    ? accounts.find(a => a.id === contacts.find(c => `${c.first_name} ${c.last_name}` === contactOrAccount)?.account_id)?.name || contactOrAccount || ""
                    : contactOrAccount || "";
                  store().setCompetitorIntel(accountName, {
                    competitors: resResult.competitors,
                    painPoints: resResult.competitorPainPoints,
                    positioningLine: resResult.positioningLine,
                  });
                }
              }
            } catch (e) { console.warn("[Chain] ResearchAgent failed:", e); }

            // Draft dual-channel: Email + SMS for hot/warm leads
            const contact = contacts.find((c) => `${c.first_name} ${c.last_name}` === contactOrAccount);
            if (contact?.consent_email) {
              showToast("Drafting outreach email...", "ai");
              try {
                const emailResult = await runNurturerAgent({ contacts, accounts, deals, contactName: contactOrAccount || "", goalType: "qualification", outputType: "EMAIL" });
                if (emailResult) {
                  store().addApproval(emailResult.approval);
                  store().addAiSpend(emailResult.cost);
                  totalCost += emailResult.cost;
                  store().addNotification({ type: "ai_draft", title: "NurturerAgent drafted email", description: `Auto-triggered for ${result.qualification} lead ${contactOrAccount}`, link: "/approvals" });
                }
              } catch (e) { console.warn("[Chain] NurturerAgent email failed:", e); }
            }
            if (contact?.consent_sms && contact?.phone) {
              showToast("Drafting welcome SMS...", "ai");
              try {
                const smsResult = await runNurturerAgent({ contacts, accounts, deals, contactName: contactOrAccount || "", goalType: "qualification", outputType: "SMS" });
                if (smsResult) {
                  store().addApproval(smsResult.approval);
                  store().addAiSpend(smsResult.cost);
                  totalCost += smsResult.cost;
                  store().addNotification({ type: "ai_draft", title: "NurturerAgent drafted SMS", description: `Dual-channel for ${contactOrAccount}`, link: "/approvals" });
                }
              } catch (e) { console.warn("[Chain] NurturerAgent SMS failed:", e); }
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
          // Store competitor intel if available
          if (result.competitors?.length > 0) {
            store().setCompetitorIntel(contactOrAccount || "", {
              competitors: result.competitors,
              painPoints: result.competitorPainPoints || [],
              positioningLine: result.positioningLine || "",
            });
          }
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

          // Store win probability
          store().setWinProbability(contactOrAccount || "", {
            probability: result.winProbability,
            factors: result.probabilityFactors,
          });

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
            description: `${result.dealHealth.toUpperCase()} (${result.healthScore}/100) · Win: ${result.winProbability}%`,
            link: "/deals",
          });

          showToast(`✦ ${contactOrAccount}: ${result.dealHealth.toUpperCase()} (Win: ${result.winProbability}%)`, result.dealHealth === "critical" ? "error" : result.dealHealth === "stalled" ? "warning" : "ai");
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
            link: "/opportunity-alerts",
          });

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

          // Store expansion signals
          if (result.expansionSignals?.length > 0) {
            store().setExpansionSignals(contactOrAccount || "", {
              signals: result.expansionSignals,
              readinessScore: result.expansionReadiness,
              checkInDue: result.checkInDue,
            });
          }

          // Auto-chain: if expansion readiness > 70, draft upsell/referral email
          if (result.expansionReadiness > 70) {
            const accountContacts = contacts.filter(c => {
              const acct = accounts.find(a => a.name === contactOrAccount);
              return acct && c.account_id === acct.id && c.consent_email;
            });
            if (accountContacts.length > 0) {
              const targetContact = `${accountContacts[0].first_name} ${accountContacts[0].last_name}`;
              showToast(`Expansion ready — drafting upsell for ${targetContact}...`, "ai");
              try {
                const nurResult = await runNurturerAgent({ contacts, accounts, deals, contactName: targetContact, goalType: "post_close", outputType: "EMAIL" });
                if (nurResult) {
                  store().addApproval(nurResult.approval);
                  store().addAiSpend(nurResult.cost);
                  totalCost += nurResult.cost;
                  store().addNotification({ type: "ai_draft", title: "Expansion email drafted", description: `Upsell/referral for ${targetContact} at ${contactOrAccount}`, link: "/approvals" });
                }
              } catch (e) { console.warn("[Chain] Expansion NurturerAgent failed:", e); }
            }
          }

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
