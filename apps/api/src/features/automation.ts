/**
 * Visual Automation Builder (#6) — execution core. A flow is a graph of nodes
 * (trigger → condition → delay → action). `stepFlow` advances a run by one node
 * and returns the actions to perform plus the next node + any delay. Pure and
 * unit-tested; the scheduler/queue persists runs and performs the actions.
 */
import { evaluateRules, type RuleGroup, type SubjectSignals } from './segments.js';

export type TriggerType =
  | 'product_viewed' | 'product_viewed_multiple' | 'add_to_cart' | 'checkout_started'
  | 'checkout_abandoned' | 'purchase_completed' | 'customer_inactive' | 'coupon_used'
  | 'joined_segment' | 'low_stock' | 'price_dropped' | 'back_in_stock';

export type ActionType =
  | 'send_email' | 'send_web_push' | 'generate_coupon' | 'show_popup'
  | 'add_to_segment' | 'remove_from_segment' | 'create_admin_alert' | 'stop';

export interface FlowNode {
  id: string;
  kind: 'trigger' | 'condition' | 'delay' | 'action';
  // condition
  rules?: RuleGroup;
  // delay
  delayMinutes?: number;
  // action
  action?: { type: ActionType; config?: Record<string, unknown> };
  next?: string[]; // for condition: [trueNext, falseNext]; else [next]
}

export interface Flow {
  nodes: Record<string, FlowNode>;
  startId: string;
}

export interface StepResult {
  actions: { type: ActionType; config?: Record<string, unknown> }[];
  nextNodeId: string | null;
  waitMinutes: number;
  done: boolean;
}

/**
 * Execute nodes starting at `fromId` until we hit a delay, an action, or the
 * end. Conditions and triggers are pass-through routers (evaluated inline).
 * Returns the first action(s) reached and where to resume.
 */
export function stepFlow(flow: Flow, fromId: string, signals: SubjectSignals): StepResult {
  let current: FlowNode | undefined = flow.nodes[fromId];
  const actions: StepResult['actions'] = [];
  let guard = 0;

  while (current && guard++ < 100) {
    if (current.kind === 'trigger') {
      current = nextOf(flow, current, true);
      continue;
    }
    if (current.kind === 'condition') {
      const pass = current.rules ? evaluateRules(current.rules, signals) : true;
      current = nextOf(flow, current, pass);
      continue;
    }
    if (current.kind === 'delay') {
      const next = nextOf(flow, current, true);
      return { actions, nextNodeId: next?.id ?? null, waitMinutes: current.delayMinutes ?? 0, done: false };
    }
    if (current.kind === 'action') {
      if (current.action) actions.push(current.action);
      if (current.action?.type === 'stop') {
        return { actions, nextNodeId: null, waitMinutes: 0, done: true };
      }
      const next = nextOf(flow, current, true);
      if (!next) return { actions, nextNodeId: null, waitMinutes: 0, done: true };
      current = next;
      continue;
    }
    break;
  }
  return { actions, nextNodeId: current?.id ?? null, waitMinutes: 0, done: !current };
}

function nextOf(flow: Flow, node: FlowNode, branchTrue: boolean): FlowNode | undefined {
  if (!node.next || node.next.length === 0) return undefined;
  if (node.kind === 'condition') {
    const id = branchTrue ? node.next[0] : node.next[1];
    return id ? flow.nodes[id] : undefined;
  }
  return flow.nodes[node.next[0]!];
}

/** Validate a flow graph: single start, no dangling edges, has a terminal path. */
export function validateFlow(flow: Flow): string[] {
  const errors: string[] = [];
  if (!flow.nodes[flow.startId]) errors.push('startId does not reference a node.');
  for (const [id, node] of Object.entries(flow.nodes)) {
    for (const n of node.next ?? []) {
      if (n && !flow.nodes[n]) errors.push(`Node ${id} points to missing node ${n}.`);
    }
  }
  return errors;
}
